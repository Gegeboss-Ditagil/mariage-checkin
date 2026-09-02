'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/TopBar';
import { Role, ROLE_LABELS, UserRow } from '@/lib/types';

const inputClass =
  'w-full rounded-xl2 border-2 border-hairline bg-surface px-3 py-2.5  placeholder:text-text-faint focus:border-accent focus:outline-none';

// Liste partagée entre le formulaire de création et l'édition (changer de
// rôle/accès, demande de Gersom le 02/09/2026) -- une seule source pour ne
// pas laisser les deux listes diverger.
const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'agent_checkin', label: 'Agent accueil (scan, recherche et check-in)' },
  { value: 'placeur', label: 'Agent placeur (scan + modification tables)' },
  { value: 'directeur', label: 'Directeur de festin (accès complet, hors admin)' },
  { value: 'visibilite', label: 'Visibilité (lecture seule)' },
  { value: 'admin', label: 'Admin' },
];

export default function UsersAdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [nomAffichage, setNomAffichage] = useState('');
  const [role, setRole] = useState<Role>('agent_checkin');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNom, setEditNom] = useState('');
  const [editRole, setEditRole] = useState<Role>('agent_checkin');
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
    setEditRole(u.role);
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
    // Changer de rôle exige les nouveaux identifiants dans la même requête
    // (voir app/api/admin/users/route.ts) -- seulement inclus si le rôle a
    // réellement changé, pour ne jamais redemander un mot de passe/PIN à
    // chaque édition banale (nom seul, par ex.).
    const roleChanged = editRole !== u.role;
    if (roleChanged) body.role = editRole;
    const effectiveRole = roleChanged ? editRole : u.role;
    if (effectiveRole === 'admin') {
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
          <p className="font-semibold ">Ajouter un compte</p>
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
            onChange={(e) => setRole(e.target.value as Role)}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
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

        <ul className="divide-y divide-hairline">
          {users.map((u) => (
            <li key={u.id} className="py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium ">{u.nom_affichage}</p>
                  <p className="text-sm text-text-faint">{ROLE_LABELS[u.role] || u.role}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-hairline px-3 py-1 text-xs font-semibold text-accent/80"
                    onClick={() => (editingId === u.id ? cancelEdit() : startEdit(u))}
                  >
                    {editingId === u.id ? 'Annuler' : 'Modifier'}
                  </button>
                  {/* Bascule verre liquide (theme iOS) au lieu de l'ancien
                      badge texte cliquable -- demande de Gersom le
                      02/09/2026. */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={u.active}
                    aria-label={(u.active ? 'Désactiver ' : 'Activer ') + u.nom_affichage}
                    className={'glass-toggle' + (u.active ? ' glass-toggle-on' : '')}
                    onClick={() => toggleActive(u)}
                  >
                    <span aria-hidden className={'glass-toggle-thumb' + (u.active ? ' glass-toggle-thumb-on' : '')} />
                  </button>
                </div>
              </div>

              {editingId === u.id && (
                (() => {
                  const roleChanged = editRole !== u.role;
                  // Rôle changé : le mode de connexion en dépend (email +
                  // mot de passe pour admin, nom + PIN sinon), donc le
                  // nouvel identifiant devient obligatoire au lieu de
                  // facultatif -- voir app/api/admin/users/route.ts.
                  const missingCredential = roleChanged
                    ? editRole === 'admin'
                      ? !editEmail.trim() || !editPassword.trim()
                      : !editPin.trim()
                    : false;
                  return (
                    <div className="mt-3 space-y-2 rounded-xl2 border border-hairline bg-surface-2 p-3">
                      <input
                        className={inputClass}
                        placeholder="Nom affiché"
                        value={editNom}
                        onChange={(e) => setEditNom(e.target.value)}
                      />

                      <div>
                        <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-faint">
                          Rôle / accès
                        </label>
                        <select
                          className={inputClass}
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value as Role)}
                        >
                          {ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      {roleChanged && (
                        <p className="text-xs font-medium text-status-partial">
                          Changement de rôle : {editRole === 'admin' || u.role === 'admin'
                            ? 'le mode de connexion change, un nouvel identifiant est requis ci-dessous.'
                            : 'le PIN doit être ressaisi ci-dessous.'}
                        </p>
                      )}

                      {editRole === 'admin' ? (
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
                            placeholder={roleChanged ? 'Mot de passe' : 'Nouveau mot de passe (laisser vide pour ne pas changer)'}
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                          />
                        </>
                      ) : (
                        <input
                          className={inputClass}
                          placeholder={roleChanged ? 'PIN (4 chiffres)' : 'Nouveau PIN (laisser vide pour ne pas changer)'}
                          inputMode="numeric"
                          value={editPin}
                          onChange={(e) => setEditPin(e.target.value)}
                        />
                      )}

                      {editError && <p className="text-sm text-status-over">{editError}</p>}

                      <button
                        className="btn-primary w-full"
                        disabled={saving || !editNom.trim() || missingCredential}
                        onClick={() => saveEdit(u)}
                      >
                        {saving ? '…' : 'Enregistrer'}
                      </button>
                    </div>
                  );
                })()
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

