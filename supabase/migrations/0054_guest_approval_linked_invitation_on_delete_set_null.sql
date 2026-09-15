-- ============================================================================
-- Bug reel trouve par reproduction directe (Gersom, 14/09/2026) : un
-- reimport complet depuis /admin/import-withjoy ("Remplacer les invitations")
-- echouait systematiquement des que la base contenait au moins une demande
-- d'invite surprise avec un "arrive avec" (guest_approval_requests.
-- linked_invitation_id, migration 0046_guest_approval_linked_invitation.sql)
-- -- "Échec atomique de l'import : update or delete on table 'invitations'
-- violates foreign key constraint 'guest_approval_requests_linked_invitation_id_fkey'".
--
-- admin_replace_invitations (0026, redefinie par 0052) fait
-- `delete from invitations where event_id = ...` et documente deja
-- l'intention (commentaire : "les journaux/exceptions restent en base mais
-- leur lien peut être mis à NULL par la suppression") -- audit_logs et
-- exceptions ont bien ON DELETE SET NULL sur leur propre reference a
-- invitations, mais guest_approval_requests_linked_invitation_id_fkey avait
-- ete ajoutee en 0046 SANS clause ON DELETE (defaut NO ACTION), un oubli a
-- l'epoque puisqu'aucun reimport complet n'avait ete tente depuis. Corrige
-- ici sur le meme modele que audit_logs/exceptions : la demande
-- d'approbation elle-meme (historique) survit toujours, seul son lien
-- "arrive avec" est efface si l'invitation liee disparait.
-- ============================================================================
alter table guest_approval_requests
  drop constraint guest_approval_requests_linked_invitation_id_fkey;

alter table guest_approval_requests
  add constraint guest_approval_requests_linked_invitation_id_fkey
  foreign key (linked_invitation_id) references invitations(id) on delete set null;
