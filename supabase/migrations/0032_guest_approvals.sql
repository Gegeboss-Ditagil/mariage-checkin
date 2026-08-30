-- ============================================================================
-- Invité surprise avec approbation SMS à distance (Twilio) -- demande de
-- Gersom le 30/08/2026. Permet à un placeur/directeur/admin de photographier
-- un invité non prévu depuis /scan, choisir son côté (Gégé/Nelly), et
-- envoyer une demande d'approbation par SMS au parent concerné AVANT de le
-- laisser entrer. L'ajout réel à la liste des invités et l'assignation de
-- table restent MANUELS, après approbation (demande explicite de Gersom).
--
-- Un numéro Twilio français ne supporte pas les MMS -- la photo n'est
-- JAMAIS envoyée dans le SMS : seul un lien vers /approve/[token] (page
-- publique, sans connexion) l'affiche à l'ouverture (voir lib/twilio.ts).
-- ============================================================================

-- Config : numéro de l'approbateur par côté. Table plutôt que variable
-- d'environnement pour que Gersom puisse changer un numéro depuis l'admin
-- sans redéploiement.
create table guest_approvers (
  cote text primary key check (cote in ('Nelly', 'Gege')),
  nom text not null,
  telephone text not null,
  updated_at timestamptz not null default now()
);

-- Confirmé par Gersom le 30/08/2026 : "Mon Papa" (son propre père) = Côté
-- Gégé ; "Papa David" (père de Nelly) = Côté Nelly.
insert into guest_approvers (cote, nom, telephone) values
  ('Gege', 'Mon Papa', '+15148151586'),
  ('Nelly', 'Papa David', '+33643348560');

-- Config : destinataires du SMS de rapport envoyé au directeur de festin une
-- fois la table effectivement assignée (Remy / Tuzola, demande de Gersom).
-- Laissée VIDE ici -- numéros pas encore confirmés (docs/DATA_CHANGE_INSTRUCTIONS.md,
-- protocole d'autorisation habituel). Le SMS de rapport (lib/twilio.ts,
-- notifyFestinDirectors) est un no-op silencieux tant que cette table est
-- vide : le reste du parcours (photo -> approbation -> assignation) marche
-- normalement sans elle.
create table festin_directors (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  telephone text not null,
  created_at timestamptz not null default now()
);

create table guest_approval_requests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id),
  -- Long token aleatoire (32 octets hex, voir app/api/guest-approvals/route.ts)
  -- utilise dans l'URL publique /approve/[token]. Ne JAMAIS le rendre lisible
  -- via une policy RLS anon (voir plus bas) : sa confidentialite EST le
  -- controle d'acces de la page publique.
  token text not null unique,
  requested_by uuid references users(id),
  cote text not null check (cote in ('Nelly', 'Gege')),
  nom_invite text not null,
  nombre_invites int not null default 1 check (nombre_invites >= 1),
  -- Chemin dans le bucket Storage prive 'guest-approval-photos' (PAS une URL
  -- publique -- toujours resolue en URL signee cote serveur avant d'etre
  -- renvoyee a un client, voir lib/guestApprovalPhotos.ts).
  photo_url text not null,
  -- Numero de l'approbateur AU MOMENT de l'envoi (tracabilite si le numero
  -- change plus tard dans guest_approvers).
  approver_phone text not null,
  statut text not null default 'en_attente' check (statut in ('en_attente', 'approuve', 'refuse')),
  decided_at timestamptz,
  table_id uuid references tables(id),
  assigned_by uuid references users(id),
  assigned_at timestamptz,
  created_at timestamptz not null default now()
);

create index guest_approval_requests_statut_idx on guest_approval_requests(statut);
create index guest_approval_requests_event_idx on guest_approval_requests(event_id);

alter table guest_approvers enable row level security;
alter table festin_directors enable row level security;
alter table guest_approval_requests enable row level security;

-- Aucune policy publique/anon sur ces trois tables -- contrairement aux
-- tables operationnelles historiques (voir 0003_rls.sql, "public read ...
-- using (true)"), guest_approval_requests contient une photo de personne et
-- le token secret de la page publique /approve/[token] : une lecture anon,
-- meme "juste pour le temps reel", exposerait `token` a n'importe qui
-- possede la cle anon et casserait la confidentialite du lien SMS. Tous les
-- acces passent par les routes API cote serveur (client service role) :
-- /api/guest-approvals (staff, capacite guestApproval, sondage plutot que
-- websocket temps reel pour cette raison -- voir app/approbations/page.tsx)
-- et /api/public/guest-approvals/[token] (public, uniquement les colonnes
-- necessaires a l'affichage).

insert into storage.buckets (id, name, public)
values ('guest-approval-photos', 'guest-approval-photos', false)
on conflict (id) do nothing;

-- Assigne une table a une demande deja approuvee : cree l'invitation
-- correspondante, marque la demande assignee, journalise. Reserve a la
-- capacite guestApproval (admin/directeur/placeur) -- volontairement PAS la
-- meme route que /api/invitations/add (capacite addInvitation, reservee a
-- l'admin seul, voir lib/permissions.ts) : action etroite qui finalise
-- uniquement une demande DEJA approuvee par SMS, pas un droit general
-- d'ajouter n'importe quelle invitation n'importe quand.
create or replace function assign_table_to_guest_approval(
  p_request_id uuid,
  p_table_id uuid,
  p_agent_id uuid
) returns invitations as $$
declare
  v_req guest_approval_requests;
  v_table tables;
  v_inv invitations;
begin
  select * into v_req from guest_approval_requests where id = p_request_id for update;
  if not found then
    raise exception 'request_not_found';
  end if;
  if v_req.statut <> 'approuve' then
    raise exception 'request_not_approved';
  end if;
  if v_req.table_id is not null then
    raise exception 'request_already_assigned';
  end if;

  select * into v_table from tables where id = p_table_id for update;
  if not found then
    raise exception 'table_not_found';
  end if;

  insert into invitations (
    event_id, table_id, nom_affichage, nombre_prevu, nombre_arrive, statut, cote, notes
  ) values (
    v_req.event_id, p_table_id, v_req.nom_invite, v_req.nombre_invites, 0, 'non_arrive', v_req.cote,
    'Invité surprise approuvé par SMS'
  ) returning * into v_inv;

  update guest_approval_requests
    set table_id = p_table_id, assigned_by = p_agent_id, assigned_at = now()
    where id = p_request_id;

  insert into audit_logs (event_id, action, invitation_id, table_id, agent_id, details)
    values (
      v_req.event_id, 'guest_approval_assigned', v_inv.id, p_table_id, p_agent_id,
      jsonb_build_object(
        'request_id', p_request_id, 'nom_invite', v_req.nom_invite,
        'nombre_invites', v_req.nombre_invites, 'cote', v_req.cote, 'table_number', v_table.number
      )
    );

  return v_inv;
end;
$$ language plpgsql set search_path = public, pg_temp;
