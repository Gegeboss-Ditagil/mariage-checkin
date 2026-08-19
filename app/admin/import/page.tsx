'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { TopBar } from '@/components/TopBar';

const TARGET_FIELDS = [
  { key: 'nom_affichage', label: 'Nom affiché (obligatoire)', required: true },
  { key: 'groupe', label: 'Groupe / famille' },
  { key: 'table_number', label: 'Numéro de table' },
  { key: 'nombre_prevu', label: 'Nombre prévu' },
  { key: 'category', label: 'Catégorie (F/T/M…)' },
  { key: 'telephone', label: 'Téléphone' },
  { key: 'email', label: 'Email' },
  { key: 'notes', label: 'Notes' },
] as const;

export default function ImportPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    if (file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => {
          const data = res.data as Record<string, any>[];
          setHeaders(res.meta.fields || []);
          setRows(data);
          autoMap(res.meta.fields || []);
        },
      });
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];
      const hdrs = data.length ? Object.keys(data[0]) : [];
      setHeaders(hdrs);
      setRows(data);
      autoMap(hdrs);
    }
  }

  function autoMap(hdrs: string[]) {
    const guesses: Record<string, string> = {};
    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    for (const field of TARGET_FIELDS) {
      const match = hdrs.find((h) => normalize(h).includes(normalize(field.key).slice(0, 4)));
      if (match) guesses[field.key] = match;
    }
    setMapping(guesses);
  }

  async function handleImport() {
    setImporting(true);
    setResult(null);

    const mapped = rows.map((row) => ({
      nom_affichage: mapping.nom_affichage ? String(row[mapping.nom_affichage] ?? '').trim() : '',
      groupe: mapping.groupe ? String(row[mapping.groupe] ?? '').trim() : undefined,
      table_number: mapping.table_number ? Number(row[mapping.table_number]) || undefined : undefined,
      nombre_prevu: mapping.nombre_prevu ? Number(row[mapping.nombre_prevu]) || undefined : undefined,
      category: mapping.category ? String(row[mapping.category] ?? '').trim() : undefined,
      telephone: mapping.telephone ? String(row[mapping.telephone] ?? '').trim() : undefined,
      email: mapping.email ? String(row[mapping.email] ?? '').trim() : undefined,
      notes: mapping.notes ? String(row[mapping.notes] ?? '').trim() : undefined,
    })).filter((r) => r.nom_affichage);

    const res = await fetch('/api/admin/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: mapped }),
    });
    const data = await res.json();
    setImporting(false);

    if (!res.ok) {
      setResult('Erreur : ' + data.error);
      return;
    }
    setResult(
      data.imported + ' invitations importées.' +
        (data.unmatchedTables ? ' ' + data.unmatchedTables + ' lignes avaient un numéro de table introuvable (non assignées).' : '')
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-night-radial text-cream">
      <TopBar title="Importer les invités" backHref="/admin" />

      <div className="flex-1 space-y-5 px-4 py-4">
        <div>
          <label className="btn-secondary block cursor-pointer text-center">
            {fileName || 'Choisir un fichier CSV ou XLSX'}
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFile} />
          </label>
          <p className="mt-2 text-xs text-cream/40">{rows.length > 0 && rows.length + ' lignes détectées'}</p>
        </div>

        {headers.length > 0 && (
          <div className="space-y-3">
            <p className="font-semibold text-cream">Associer les colonnes</p>
            {TARGET_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3">
                <span className="text-sm text-cream/60">{f.label}</span>
                <select
                  className="rounded-xl2 border-2 border-gold-400/25 bg-night-800 px-3 py-2 text-sm text-cream focus:border-gold-400 focus:outline-none"
                  value={mapping[f.key] || ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                >
                  <option value="">—</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}

        {result && <p className="rounded-xl2 bg-night-800 p-3 text-sm text-cream/70">{result}</p>}
      </div>

      {rows.length > 0 && (
        <div className="px-4 pb-6">
          <button
            className="btn-primary w-full"
            disabled={importing || !mapping.nom_affichage}
            onClick={handleImport}
          >
            {importing ? 'Import en cours…' : 'IMPORTER ' + rows.length + ' LIGNES'}
          </button>
        </div>
      )}
    </div>
  );
}
