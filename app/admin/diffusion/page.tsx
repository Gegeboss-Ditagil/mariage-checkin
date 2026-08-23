'use client';

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { TopBar } from '@/components/TopBar';
import {
  DEFAULT_INVITATION_MESSAGE,
  DIFFUSION_FIELDS,
  DiffusionContact,
  DiffusionField,
  autoMapDiffusionHeaders,
  emailLink,
  invitationLink,
  parseDiffusionRows,
  renderInvitationMessage,
  whatsappLink,
} from '@/lib/invitationDiffusion';

type Filter = 'tous' | 'a_envoyer' | 'envoyes' | 'erreurs' | 'sans_telephone' | 'sans_email';

export default function DiffusionInvitationsPage() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Partial<Record<DiffusionField, string>>>({});
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [template, setTemplate] = useState(DEFAULT_INVITATION_MESSAGE);
  const [filter, setFilter] = useState<Filter>('tous');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const contacts = useMemo(
    () =>
      parseDiffusionRows(rawRows, mapping).map((contact) => ({
        ...contact,
        statut: statusOverrides[contact.id] || contact.statut,
      })),
    [rawRows, mapping, statusOverrides]
  );

  const visibleContacts = contacts.filter((contact) => {
    if (filter === 'a_envoyer') return contact.statut !== 'Envoyé';
    if (filter === 'envoyes') return contact.statut === 'Envoyé';
    if (filter === 'erreurs') return contact.erreurs.length > 0;
    if (filter === 'sans_telephone') return !contact.telephone;
    if (filter === 'sans_email') return !contact.email;
    return true;
  });

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setNotice(null);
    setExpandedId(null);
    setStatusOverrides({});

    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '', raw: false });
      const detectedHeaders = rows.length > 0 ? Object.keys(rows[0]) : [];
      setFileName(file.name);
      setRawRows(rows);
      setHeaders(detectedHeaders);
      setMapping(autoMapDiffusionHeaders(detectedHeaders));
      setNotice(rows.length > 0 ? `${rows.length} lignes chargées localement.` : 'Le premier onglet est vide.');
    } catch {
      setFileName(null);
      setRawRows([]);
      setHeaders([]);
      setMapping({});
      setNotice('Impossible de lire ce fichier. Utilisez un fichier Excel ou CSV valide.');
    } finally {
      event.target.value = '';
    }
  }

  function markSent(contact: DiffusionContact) {
    setStatusOverrides((current) => ({ ...current, [contact.id]: 'Envoyé' }));
  }

  async function copyMessage(contact: DiffusionContact) {
    await navigator.clipboard.writeText(renderInvitationMessage(template, contact));
    setNotice(`Message de ${contact.famille} copié.`);
  }

  function exportTracking() {
    const exported = contacts.map((contact) => ({
      Famille: contact.famille,
      Prénom: contact.prenom,
      Téléphone: contact.telephone,
      Email: contact.email,
      'Code invitation': contact.codeInvitation,
      'Lien Canva': invitationLink(contact.codeInvitation) || '',
      'Nombre de personnes': contact.nombrePersonnes,
      Langue: contact.langue,
      'Canal préféré': contact.canalPrefere,
      Statut: contact.statut,
      Notes: contact.notes,
      Erreurs: contact.erreurs.join(' ; '),
      'Message généré': renderInvitationMessage(template, contact),
    }));
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(exported);
    sheet['!cols'] = [
      { wch: 30 }, { wch: 18 }, { wch: 20 }, { wch: 30 }, { wch: 16 }, { wch: 48 },
      { wch: 20 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 28 }, { wch: 34 }, { wch: 70 },
    ];
    XLSX.utils.book_append_sheet(workbook, sheet, 'Diffusion invitations');
    XLSX.writeFile(workbook, `diffusion-invitations-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const validCount = contacts.filter((contact) => contact.erreurs.length === 0).length;
  const sentCount = contacts.filter((contact) => contact.statut === 'Envoyé').length;

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Diffusion des invitations" backHref="/admin" />

      <div className="flex-1 space-y-5 px-4 py-4">
        <div className="card border-2 border-gold-300/30">
          <p className="font-semibold">Traitement local et privé</p>
          <p className="mt-1 text-sm text-black/50">
            Le fichier reste dans ce navigateur : aucune coordonnée n'est envoyée à Supabase. Exportez le suivi avant
            de fermer la page, car l'application ne conserve pas cette liste.
          </p>
        </div>

        <label className="btn-secondary block cursor-pointer text-center">
          {fileName || 'Choisir un fichier Excel ou CSV'}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        </label>
        {notice && <p className="rounded-xl2 bg-white p-3 text-sm text-black/60 shadow-card">{notice}</p>}

        {headers.length > 0 && (
          <div className="card space-y-3">
            <p className="font-semibold">Associer les colonnes</p>
            {DIFFUSION_FIELDS.map((field) => (
              <label key={field.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-black/60">
                  {field.label}{field.required ? ' *' : ''}
                </span>
                <select
                  className="max-w-[55%] rounded-xl2 border-2 border-gold-300/40 bg-white px-3 py-2 text-sm focus:border-gold-500 focus:outline-none"
                  value={mapping[field.key] || ''}
                  onChange={(event) =>
                    setMapping((current) => ({ ...current, [field.key]: event.target.value || undefined }))
                  }
                >
                  <option value="">— Non associée —</option>
                  {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </select>
              </label>
            ))}
          </div>
        )}

        {contacts.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Familles" value={contacts.length} />
              <Stat label="Prêtes" value={validCount} accent="text-status-complete" />
              <Stat label="Envoyées" value={sentCount} accent="text-gold-600" />
            </div>

            <div className="card">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="font-semibold">Modèle du message</p>
                <button type="button" className="text-xs font-semibold text-gold-700" onClick={() => setTemplate(DEFAULT_INVITATION_MESSAGE)}>
                  Réinitialiser
                </button>
              </div>
              <textarea
                className="min-h-56 w-full rounded-xl2 border-2 border-gold-300/40 bg-white p-3 text-sm focus:border-gold-500 focus:outline-none"
                value={template}
                onChange={(event) => setTemplate(event.target.value)}
              />
              <p className="mt-2 text-xs text-black/40">
                Variables : {'{famille}'}, {'{prenom}'}, {'{code_invitation}'}, {'{lien_invitation}'},{' '}
                {'{nombre_personnes}'}, {'{langue}'}.
              </p>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {([
                ['tous', 'Tous'], ['a_envoyer', 'À envoyer'], ['envoyes', 'Envoyés'], ['erreurs', 'À corriger'],
                ['sans_telephone', 'Sans téléphone'], ['sans_email', 'Sans email'],
              ] as Array<[Filter, string]>).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    filter === key ? 'border-ink bg-ink text-white' : 'border-black/10 bg-white text-black/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {visibleContacts.map((contact) => {
                const expanded = expandedId === contact.id;
                const message = renderInvitationMessage(template, contact);
                // Une coordonnee valide ne suffit pas : aucun raccourci
                // d'envoi n'est propose tant que le destinataire ou le lien
                // Canva est invalide. Cela evite qu'un message avec
                // "[LIEN INVALIDE]" parte par inadvertance.
                const hasSafeInvitation = Boolean(contact.famille && invitationLink(contact.codeInvitation));
                const whatsApp = hasSafeInvitation ? whatsappLink(contact, message) : null;
                const email = hasSafeInvitation ? emailLink(contact, message) : null;
                return (
                  <div key={contact.id} className="card">
                    <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setExpandedId(expanded ? null : contact.id)}>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{contact.famille || contact.id}</span>
                        <span className="block text-xs text-black/50">
                          {contact.codeInvitation || 'Code manquant'} · {contact.nombrePersonnes} personne{contact.nombrePersonnes > 1 ? 's' : ''} · {contact.statut}
                        </span>
                      </span>
                      <span className={contact.erreurs.length ? 'shrink-0 text-xs font-bold text-status-over' : 'shrink-0 text-xs font-bold text-status-complete'}>
                        {contact.erreurs.length ? `${contact.erreurs.length} erreur(s)` : 'Prêt'}
                      </span>
                    </button>

                    {expanded && (
                      <div className="mt-3 space-y-3 border-t border-gold-400/10 pt-3">
                        {contact.erreurs.length > 0 && (
                          <ul className="rounded-xl bg-status-over/10 p-3 text-xs text-status-over">
                            {contact.erreurs.map((error) => <li key={error}>• {error}</li>)}
                          </ul>
                        )}
                        <pre className="whitespace-pre-wrap rounded-xl2 bg-black/5 p-3 text-sm font-sans text-black/70">{message}</pre>
                        <div className="grid grid-cols-2 gap-2">
                          <button type="button" className="btn-secondary text-sm" onClick={() => copyMessage(contact)}>
                            Copier
                          </button>
                          <button
                            type="button"
                            className="btn-secondary text-sm"
                            disabled={!hasSafeInvitation || (!whatsApp && !email)}
                            onClick={() => markSent(contact)}
                          >
                            Marquer envoyé
                          </button>
                          {whatsApp ? (
                            <a href={whatsApp} target="_blank" rel="noreferrer" className="btn-secondary text-center text-sm">WhatsApp</a>
                          ) : (
                            <span className="rounded-xl2 bg-black/5 px-3 py-3 text-center text-xs text-black/30">WhatsApp indisponible</span>
                          )}
                          {email ? (
                            <a href={email} className="btn-secondary text-center text-sm">Email</a>
                          ) : (
                            <span className="rounded-xl2 bg-black/5 px-3 py-3 text-center text-xs text-black/30">Email indisponible</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {visibleContacts.length === 0 && <p className="py-6 text-center text-black/40">Aucune ligne dans ce filtre.</p>}
            </div>

            <button type="button" className="btn-primary w-full" onClick={exportTracking}>
              EXPORTER LE SUIVI EXCEL
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent = '' }: { label: string; value: number; accent?: string }) {
  return (
    <div className="card py-3">
      <p className={`text-2xl font-bold ${accent}`}>{value}</p>
      <p className="text-[11px] text-black/50">{label}</p>
    </div>
  );
}
