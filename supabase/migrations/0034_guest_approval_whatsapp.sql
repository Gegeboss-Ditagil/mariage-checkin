-- ============================================================================
-- Canal WhatsApp en plus du SMS pour l'invite surprise (voir
-- supabase/migrations/0032_guest_approvals.sql) -- demande de Gersom le
-- 30/08/2026 : "donne l'option par whatsapp ou message... au cas ou il n'a
-- pas de reseau [cellulaire] et est connecte au wifi" (WhatsApp fonctionne
-- sur data/wifi, contrairement au SMS qui a besoin du reseau cellulaire).
--
-- L'approbateur peut repondre de deux facons desormais :
--   1. Le lien /approve/[token] (deja existant, page web).
--   2. Repondre directement "Oui"/"O"/"Y" ou "Non"/"N" au message WhatsApp
--      (app/api/public/twilio/whatsapp-inbound/route.ts) -- la demande la
--      plus recente encore en_attente pour ce numero est retrouvee par
--      telephone (pas de token dans une reponse WhatsApp en texte libre).
-- ============================================================================

alter table guest_approval_requests
  add column decided_via text check (decided_via in ('web', 'whatsapp'));

comment on column guest_approval_requests.decided_via is
  'Canal utilise pour la decision : lien web (/approve/[token]) ou reponse texte WhatsApp. NULL tant que en_attente.';
