'use client';

import { useState } from 'react';
import { TopBar } from '@/components/TopBar';
import type { ImportReport } from '@/lib/withjoyImport';

type Status = 'idle' | 'previewing' | 'previewed' | 'importing' | 'done' | 'error';

export default function ImportWithJoyPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [expectedBeforeCount, setExpectedBeforeCount] = useState<number | null>(null);
  const [expectedFingerprint, setExpectedFingerprint] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setReport(null);
    setMessage(null);
    setConfirmation('');
    setStatus('previewing');
    try {
      const text = await file.text();
      setCsvText(text);
      const response = await fetch('/api/admin/import-withjoy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText: text, mode: 'preview' }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.report) throw new Error(data?.error || 'Échec de la lecture du fichier');
      setReport(data.report);
      setExpectedBeforeCount(data.currentInvitationCount);
      setExpectedFingerprint(data.stateFingerprint);
      setStatus('previewed');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Échec de la lecture du fichier');
    }
  }

  async function handleConfirm() {
    if (!csvText || expectedBeforeCount === null || !expectedFingerprint || confirmation !== 'REMPLACER') return;
    if (!window.confirm(`Remplacer les ${expectedBeforeCount} invitations actuelles et remettre les arrivées à zéro ?`)) return;
    setStatus('importing');
    setMessage(null);
    try {
      const response = await fetch('/api/admin/import-withjoy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, mode: 'confirm', confirmation, expectedBeforeCount, expectedFingerprint }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Échec de l'import");
      setStatus('done');
      setMessage(`Import terminé : ${data.result.invitations_apres} invitations (${data.result.invitations_avant} auparavant). Sauvegarde ${data.result.backup_id}.`);
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : "Échec de l'import");
    }
  }

  function reset() {
    setFileName(null);
    setCsvText(null);
    setReport(null);
    setExpectedBeforeCount(null);
    setExpectedFingerprint(null);
    setConfirmation('');
    setStatus('idle');
    setMessage(null);
  }

  const blocked = !!report && (report.unplacedCount > 0 || report.overCapacity.length > 0);
  const clean = !!report && report.ok && report.warnings.length === 0 && !blocked;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Importer depuis With Joy" backHref="/admin" />
      <div className="flex-1 space-y-5 px-4 py-4">
        <p className="text-sm text-black/50">
          Sélectionnez un export CSV With Joy. L’aperçu est calculé sans écriture; la confirmation recalcule le
          fichier côté serveur avant un remplacement atomique avec sauvegarde complète.
        </p>

        <label className="btn-secondary block cursor-pointer text-center">
          {fileName || 'Choisir le CSV With Joy'}
          {/* iOS/Safari (iPhone) rapporte parfois un type MIME different pour
              un CSV telecharge puis "Enregistre dans Fichiers" (mail, Drive,
              With Joy...) selon sa provenance -- lister plusieurs alias
              plutot que le seul text/csv evite qu'il apparaisse grise dans
              le selecteur "Parcourir" iOS. La lecture reste par contenu
              (file.text()), aucune verification stricte du type ensuite. */}
          <input
            type="file"
            accept=".csv,text/csv,text/comma-separated-values,application/csv,application/vnd.ms-excel,text/plain"
            className="hidden"
            onChange={handleFile}
          />
        </label>

        {status === 'previewing' && <p className="text-center text-black/50">Analyse du fichier…</p>}
        {report && !report.ok && (
          <div className="rounded-xl2 bg-status-over/10 p-4 text-status-over">
            <p className="font-semibold">Fichier non importable</p>
            <p className="mt-1 text-sm">{report.fatalError}</p>
          </div>
        )}

        {report?.ok && (
          <div className="space-y-4">
            <div className={'rounded-xl2 p-4 ' + (clean ? 'bg-status-complete/10' : 'bg-status-partial/10')}>
              <p className={'font-semibold ' + (clean ? 'text-status-complete' : 'text-status-partial')}>
                {blocked ? 'Import bloqué — placement incomplet' : clean ? 'Aperçu complet' : 'Aperçu — points à vérifier'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat value={report.groupCount} label="invitations" />
              <Stat value={report.personCount} label="personnes" />
              <Stat value={`${report.tablesUsed}/${report.totalTables}`} label="tables utilisées" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat value={report.parCote.Nelly} label="côté Nelly" accent="text-nelly" />
              <Stat value={report.parCote.Gege} label="côté Gégé" accent="text-gege" />
              <Stat value={report.parCote.Neutre} label="neutre / staff" />
            </div>

            <div className="card space-y-1 p-4 text-sm text-black/60">
              <p>{report.officiellesCount} / 400 places officielles</p>
              <p>{report.reserveCount} personnes en réserve (table 41)</p>
              <p>{report.withFixedTable} invitations confirmées par tag T/Fxxx</p>
              <p>{report.withoutTable} personnes volontairement sans table</p>
              <p>{report.declinedCount} personnes ayant décliné, exclues de l’import</p>
              {report.unplacedCount > 0 && <p className="font-semibold text-status-over">{report.unplacedCount} personnes non placées</p>}
            </div>

            {report.warnings.length > 0 && (
              <div className="card space-y-2 p-4">
                <p className="font-semibold text-status-partial">Points à vérifier ({report.warnings.length})</p>
                <ul className="space-y-1 text-sm text-black/60">
                  {report.warnings.map((warning, index) => <li key={index}>• {warning}</li>)}
                </ul>
              </div>
            )}

            {!blocked && (
              <div className="space-y-2 rounded-xl2 border-2 border-status-over/30 bg-status-over/5 p-4">
                <p className="text-sm font-semibold text-status-over">Action destructive réservée aux phases Préparation et Test</p>
                <p className="text-xs text-black/50">
                  Le remplacement remet à zéro arrivées, membres et débordements. Une sauvegarde complète est créée.
                  Si la liste change après cet aperçu, l’import sera refusé.
                </p>
                <input
                  className="w-full rounded-xl2 border-2 border-status-over/30 bg-white px-3 py-2"
                  placeholder="Tapez REMPLACER"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {message && <p className={'rounded-xl2 p-3 text-sm font-medium ' + (status === 'done' ? 'bg-status-complete/10 text-status-complete' : 'bg-status-over/10 text-status-over')}>{message}</p>}
      </div>

      {report?.ok && status !== 'done' && !blocked && (
        <div className="space-y-2 px-4 pb-6">
          <button type="button" className="btn-primary w-full" disabled={status === 'importing' || confirmation !== 'REMPLACER'} onClick={handleConfirm}>
            {status === 'importing' ? 'Import en cours…' : 'CONFIRMER ET REMPLACER'}
          </button>
          <button type="button" className="btn-secondary w-full" onClick={reset} disabled={status === 'importing'}>Annuler</button>
        </div>
      )}
      {status === 'done' && <div className="px-4 pb-6"><button type="button" className="btn-secondary w-full" onClick={reset}>Importer un autre fichier</button></div>}
    </div>
  );
}

function Stat({ value, label, accent = '' }: { value: number | string; label: string; accent?: string }) {
  return <div className="card py-2"><p className={'text-xl font-bold ' + accent}>{value}</p><p className="text-[11px] text-black/50">{label}</p></div>;
}
