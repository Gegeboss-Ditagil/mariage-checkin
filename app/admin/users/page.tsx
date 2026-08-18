'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { UserRow } from '@/lib/types';

export default function UsersAdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [nomAffichage, setNomAffichage] = useState('');
  const [role, setRole] = useState<'admin' | 'agent_checkin' | 'placeur'>('agent_checkin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []));
  }

  useEffect(load, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nom_affichage: nomAffichage, role, email, password, pin }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNomAffichage('');
    setEmail('');
    setPassword('');
    setPin('');
    load();
  }

  async function toggleActive(u: UserRow) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, active: !u.active }),
    });
    load();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Comptes de l'équipe" backHref="/admin" />

      <div className="flex-1 space-y-6 px-4 py-4">
        <form onSubmit={add} className="card space-y-3">
          <p className="font-semibold">Ajouter un compte</p>
          <input
            className="w-full rounded-xl2 border border-black/10 px-3 py-2.5"
            placeholder="Nom affiché (ex: Agent 1)"
            value={nomAffichage}
            onChange={(e) => setNomAffichage(e.target.value)}
            required
          />
          <select
            className="w-full rounded-xl2 border border-black/10 px-3 py-2.5"
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
          >
            <option value="agent_checkin">Agent check-in</option>
            <option value="placeur">Placeur</option>
            <option value="admin">Admin</option>
          </select>

          {role === 'admin' ? (
            <>
              <input
                className="w-full rounded-xl2 border border-black/10 px-3 py-2.5"
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="w-full rounded-xl2 border border-black/10 px-3 py-2.5"
                placeholder="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          ) : (
            <input
              className="w-full rounded-xl2 border border-black/10 px-3 py-2.5"
              placeholder="PIN (4 chiffres)"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
            />
          )}

          {error && <p className="text-sm text-status-over">{error}</p>}
          <button type="submit" className="btn-primary w-full">
            Créer le compte
          </button>
        </form>

        <ul className="divide-y divide-black/5">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{u.nom_affichage}</p>
                <p className="text-sm text-black/50">{u.role}</p>
              </div>
              <button
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  u.active ? 'bg-status-complete/10 text-status-complete' : 'bg-status-over/10 text-status-over'
                }`}
                onClick={() => toggleActive(u)}
              >
                {u.active ? 'Actif' : 'Désactivé'}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
