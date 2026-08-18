'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { TableRow } from '@/lib/types';

export default function TablesAdminPage() {
  const [tables, setTables] = useState<TableRow[]>([]);
  const [normalCount, setNormalCount] = useState(36);
  const [reserveCount, setReserveCount] = useState(4);
  const [normalCapacity, setNormalCapacity] = useState(10);
  const [reserveCapacity, setReserveCapacity] = useState(10);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    fetch('/api/admin/tables')
      .then((r) => r.json())
      .then((d) => setTables(d.tables || []));
  }

  useEffect(load, []);

  async function generate() {
    setBusy(true);
    setMessage(null);
    const res = await fetch('/api/admin/tables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ normalCount, reserveCount, normalCapacity, reserveCapacity }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMessage(`Erreur : ${data.error}`);
    setMessage(data.inserted > 0 ? `${data.inserted} table(s) créée(s).` : 'Toutes les tables existent déjà.');
    load();
  }

  async function updateTable(t: TableRow, patch: Partial<TableRow>) {
    setTables((prev) => prev.map((row) => (row.id === t.id ? { ...row, ...patch } : row)));
    await fetch('/api/admin/tables', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, ...patch }),
    });
  }

  async function removeTable(t: TableRow) {
    if (!confirm(`Supprimer la table ${t.number} ?`)) return;
    await fetch('/api/admin/tables', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id }),
    });
    load();
  }

  const normales = tables.filter((t) => !t.is_reserve);
  const reserves = tables.filter((t) => t.is_reserve);

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Tables" backHref="/admin" />

      <div className="flex-1 space-y-6 px-4 py-4">
        {tables.length === 0 && (
          <div className="card space-y-3">
            <p className="font-semibold">Générer les tables</p>
            <p className="text-sm text-black/50">
              Crée les tables normales (1..N) puis les tables de réserve juste après, avec une capacité par défaut
              (modifiable ensuite table par table).
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tables normales" value={normalCount} onChange={setNormalCount} />
              <Field label="Capacité normale" value={normalCapacity} onChange={setNormalCapacity} />
              <Field label="Tables de réserve" value={reserveCount} onChange={setReserveCount} />
              <Field label="Capacité réserve" value={reserveCapacity} onChange={setReserveCapacity} />
            </div>
            <button className="btn-primary w-full" disabled={busy} onClick={generate}>
              {busy ? 'Création…' : `CRÉER ${normalCount + reserveCount} TABLES`}
            </button>
          </div>
        )}

        {message && <p className="rounded-xl2 bg-black/5 p-3 text-sm">{message}</p>}

        {normales.length > 0 && (
          <TableGroup title={`Tables normales (${normales.length})`} rows={normales} onUpdate={updateTable} onRemove={removeTable} />
        )}
        {reserves.length > 0 && (
          <TableGroup title={`Tables de réserve (${reserves.length})`} rows={reserves} onUpdate={updateTable} onRemove={removeTable} />
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-black/50">{label}</span>
      <input
        type="number"
        min={0}
        className="w-full rounded-xl2 border border-black/10 px-3 py-2"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function TableGroup({
  title,
  rows,
  onUpdate,
  onRemove,
}: {
  title: string;
  rows: TableRow[];
  onUpdate: (t: TableRow, patch: Partial<TableRow>) => void;
  onRemove: (t: TableRow) => void;
}) {
  return (
    <div>
      <p className="mb-2 font-semibold">{title}</p>
      <ul className="divide-y divide-black/5">
        {rows.map((t) => (
          <li key={t.id} className="flex items-center gap-3 py-3">
            <span className="w-10 shrink-0 font-mono font-bold">#{t.number}</span>
            <input
              className="min-w-0 flex-1 rounded-xl2 border border-black/10 px-2 py-1.5 text-sm"
              placeholder="Libellé (optionnel)"
              defaultValue={t.label ?? ''}
              onBlur={(e) => onUpdate(t, { label: e.target.value })}
            />
            <input
              type="number"
              min={0}
              className="w-16 shrink-0 rounded-xl2 border border-black/10 px-2 py-1.5 text-sm"
              defaultValue={t.capacity}
              onBlur={(e) => onUpdate(t, { capacity: Number(e.target.value) })}
            />
            <button className="shrink-0 text-sm text-status-over" onClick={() => onRemove(t)}>
              Suppr.
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
