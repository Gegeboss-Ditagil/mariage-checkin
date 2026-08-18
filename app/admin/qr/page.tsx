'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { QrCodeRow } from '@/lib/types';

interface TableOption {
  id: string;
  number: number;
  label: string | null;
}

export default function QrAdminPage() {
  const [qrCodes, setQrCodes] = useState<QrCodeRow[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [code, setCode] = useState('');
  const [tableId, setTableId] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch('/api/admin/qr')
      .then((r) => r.json())
      .then((d) => {
        setQrCodes(d.qrCodes || []);
        setTables(d.tables || []);
      });
  }

  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, table_id: tableId }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setCode('');
    setTableId('');
    load();
  }

  async function remove(id: string) {
    await fetch('/api/admin/qr', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const tableLabel = (id: string) => {
    const t = tables.find((t) => t.id === id);
    return t ? `Table ${t.number}${t.label ? ' — ' + t.label : ''}` : id;
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="QR codes" backHref="/admin" />

      <div className="flex-1 space-y-6 px-4 py-4">
        <form onSubmit={add} className="card space-y-3">
          <p className="font-semibold">Associer un QR à une table</p>
          <input
            className="w-full rounded-xl2 border border-black/10 px-3 py-2.5"
            placeholder="Code / identifiant du QR (ex: table-12)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <select
            className="w-full rounded-xl2 border border-black/10 px-3 py-2.5"
            value={tableId}
            onChange={(e) => setTableId(e.target.value)}
            required
          >
            <option value="">Choisir une table</option>
            {tables.map((t) => (
              <option key={t.id} value={t.id}>
                Table {t.number}
                {t.label ? ` — ${t.label}` : ''}
              </option>
            ))}
          </select>
          {error && <p className="text-sm text-status-over">{error}</p>}
          <button type="submit" className="btn-primary w-full">
            Associer
          </button>
        </form>

        <div>
          <p className="mb-2 font-semibold">QR déjà associés ({qrCodes.length})</p>
          <ul className="divide-y divide-black/5">
            {qrCodes.map((q) => (
              <li key={q.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-mono text-sm">{q.code}</p>
                  <p className="text-sm text-black/50">{tableLabel(q.table_id)}</p>
                </div>
                <button className="text-sm text-status-over" onClick={() => remove(q.id)}>
                  Retirer
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
