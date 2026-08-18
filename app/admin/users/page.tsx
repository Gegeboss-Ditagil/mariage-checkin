'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { UserRow } from '@/lib/types';

const inputClass =
  'w-full rounded-xl2 border-2 border-gold-400/25 bg-night-800 px-3 py-2.5 text-cream placeholder:text-cream/30 focus:border-gold-400 focus:outline-none';

export default function UsersAdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [nomAffichage, setNomAffichage] = useState('');
  const [role, setRole] = useState<'admin' | 'agent_checkin' | 'placeur'>('agent_checkin');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNom, setEditNom] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editPin, setEditPin] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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
      body: JSON.stringify({
        nom_affichage: nomAffichage,
        role,
        pin: role === 'admin' ? undefined : pin,
        email: role === 'admin' ? email : undefined,
        password: role === 'admin' ? password : undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setNomAffichage('');
    setPin('');
    setEmail('');
    setPassword('');
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

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setEditNom(u.nom_affichage);
    setEditEmail(u.email || '');
    setEditPassword('');
    setEditPin('');
    setEditError(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function saveEdit(u: UserRow) {
    setSaving(true);
    setEditError(null);
    const body: Record<string, unknown> = { id: u.id, nom_affichage: editNom };
    if (u.role === 'admin') {
      body.email = editEmail;
      if (editPassword.trim()) body.password = editPassword;
    } else if (editPin.trim()) {
      body.pin = editPin;
    }

    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setEditError(data.error || 'Échec de la mise à jour');
      return;
    }
    setEditingId(null);
    load();
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <TopBar title="Comptes de l'equipe" backHref="/admin" />

      <div className="flex-1 space-y-6 px-4 py-4">
        <form onSubmit={add} className="card space-y-3">
          <p className="font-semibold text-cream">Ajouter un compte</p>
          <input
            className={inputClass}
            placeholder="Nom affiche (ex: Gersom Dos)"
            value={nomAffichage}
            onChange={(e) => setNomAffichage(e.target.value)}
            required
          />
          <select
            className={inputClass}
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
                className={inputClass}
                placeholder="Email de connexion"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                className={inputClass}
                placeholder="Mot de passe"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </>
          ) : (
            <input
              className={inputClass}
              placeholder="PIN (4 chiffres)"
              inputMode="numeric"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          )}

          {error && <p className="text-sm text-status-over">{error}</p>}
          <button type="submit" className="btn-primary w-full">
            Creer le compte
          </button>
        </form>

        <ul className="divide-y divide-gold-400/10">
          {users.map((u) => (
            <li key={u.id} className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-cream">{u.nom_affichage}</p>
                  <p className="text-sm text-cream/50">{u.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-gold-400/25 px-3 py-1 text-xs font-semibold text-gold-300/80"
                    onClick={() => (editingId === u.id ? cancelEdit() : startEdit(u))}
                  >
                    {editingId === u.id ? 'Annuler' : 'Modifier'}
                  </button>
                  <button
                    className={
                      'rounded-full px-3 py-1 text-xs font-semibold ' +
                      (u.active ? 'bg-status-complete/10 text-status-complete' : 'bg-status-over/10 text-status-over')
                    }
                    onClick={() => toggleActive(u)}
                  >
                    {u.active ? 'Actif' : 'Desactive'}
                  </button>
                </div>
              </div>

              {editingId === u.id && (
                <div className="mt-3 space-y-2 rounded-xl2 border border-gold-400/15 bg-night-800/60 p-3">
                  <input
                    className={inputClass}
                    placeholder="Nom affiché"
                    value={editNom}
                    onChange={(e) => setEditNom(e.target.value)}
                  />

                  {u.role === 'admin' ? (
                    <>
                      <input
                        className={inputClass}
                        placeholder="Email de connexion"
                        type="email"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                      />
                      <input
                        className={inputClass}
                        placeholder="Nouveau mot de passe (laisser vide pour ne pas changer)"
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                      />
                    </>
                  ) : (
                    <input
                      className={inputClass}
                      placeholder="Nouveau PIN (laisser vide pour ne pas changer)"
                      inputMode="numeric"
                      value={editPin}
                      onChange={(e) => setEditPin(e.target.value)}
                    />
                  )}

                  {editError && <p className="text-sm text-status-over">{editError}</p>}

                  <button
                    className="btn-primary w-full"
                    disabled={saving || !editNom.trim()}
                    onClick={() => saveEdit(u)}
                  >
                    {saving ? '…' : 'Enregistrer'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
