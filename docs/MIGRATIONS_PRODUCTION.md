# Migrations : dépôt ↔ production

**Version documentaire : 1.79.3**
**Dernière mise à jour : 2026-10-10**

Une ligne par fichier de `supabase/migrations/`. `tests/migration-history.test.ts` échoue si un fichier manque ici : toute nouvelle migration doit dire si elle est appliquée en production.

## Règles (v1.77.0)

- **Une seule numérotation** : l'historique de production (`supabase_migrations.schema_migrations`) n'utilise que la version à 4 chiffres du fichier (`0070`, `0071`…), jamais une version horodatée.
- **Ne pas utiliser `apply_migration` de l'outil Supabase de l'agent** : il enregistre une version horodatée (`2026…`), c'est ce qui a créé l'écart signalé par le check « Supabase Preview ». Appliquer le SQL (`execute_sql` ou éditeur SQL) puis inscrire la ligne d'historique :
  `insert into supabase_migrations.schema_migrations (version, name, created_by) values ('00NN', '00NN_nom', 'qui/quand') on conflict (version) do nothing;`
- **Toute suppression** (`delete`, `drop`) passe par l'éditeur SQL (l'outil de l'agent expire dessus) : l'agent prépare le script dans `supabase/manual/`, avec sauvegarde et retour arrière.
- Après chaque application : `select check_name, detail from app_health_report() where not ok;` doit être vide.

## État au 10/10/2026

Vérifié en production table par table (fonctions, colonnes, données). Toutes les migrations du dépôt sont appliquées ; l'historique ne contient plus que les versions à 4 chiffres (68 lignes, 0 doublon, copie dans `supabase_migrations.schema_migrations_backup_20261010`).

| Fichier | État en production |
|---|---|
| `0001_init.sql` | Appliquée, présente dans l'historique |
| `0002_functions.sql` | Appliquée, présente dans l'historique |
| `0003_rls.sql` | Appliquée, présente dans l'historique |
| `0004_realtime.sql` | Appliquée, présente dans l'historique |
| `0005_function_search_path_hardening.sql` | Appliquée le 18/08/2026, restaurée dans le dépôt en v1.75.0 |
| `0006_exceptions.sql` | Appliquée, présente dans l'historique |
| `0007_overflow_manage.sql` | Appliquée, présente dans l'historique |
| `0008_move_invitation.sql` | Appliquée, présente dans l'historique |
| `0009_invitation_contact.sql` | Appliquée, présente dans l'historique |
| `0010_invitation_members.sql` | Appliquée, présente dans l'historique |
| `0011_user_display_name.sql` | Appliquée, présente dans l'historique |
| `0012_overflow_any_table.sql` | Appliquée, présente dans l'historique |
| `0013_overflow_no_capacity_block.sql` | Appliquée, présente dans l'historique |
| `0014_no_show.sql` | Appliquée, présente dans l'historique |
| `0015_roles_v2.sql` | Appliquée, présente dans l'historique |
| `0016_rename_remy.sql` | Appliquée, présente dans l'historique |
| `0017_invitation_tags.sql` | Appliquée, présente dans l'historique |
| `0019_reduce_reserve_to_one_table.sql` | Appliquée, présente dans l'historique |
| `0020_bulk_move_and_swap_invitations.sql` | Appliquée, présente dans l'historique |
| `0021_rename_and_merge_invitations.sql` | Appliquée, présente dans l'historique |
| `0022_manage_invitation_tags.sql` | Appliquée, présente dans l'historique |
| `0023_sync_needs_table_tag_rules.sql` | Appliquée, présente dans l'historique |
| `0024_initialize_members_adjust_prevu.sql` | Appliquée, présente dans l'historique |
| `0025_enable_rls_invitations_backup.sql` | Appliquée, présente dans l'historique |
| `0026_import_replace_invitations.sql` | Appliquée, présente dans l'historique |
| `0027_sync_non_role_tags_cortege_contact_mail.sql` | Appliquée, présente dans l'historique |
| `0028_rsvp_based_placement_status.sql` | Appliquée, présente dans l'historique |
| `0029_guest_arrival_status.sql` | Appliquée, présente dans l'historique |
| `0030_add_unplanned_arrival.sql` | Appliquée, présente dans l'historique |
| `0031_split_guest_to_new_invitation.sql` | Appliquée, présente dans l'historique |
| `0032_guest_approvals.sql` | Appliquée, présente dans l'historique |
| `0033_festin_directors_contacts.sql` | Appliquée, présente dans l'historique |
| `0034_guest_approval_whatsapp.sql` | Appliquée, présente dans l'historique |
| `0035_festin_directors_unique_phone.sql` | Appliquée, présente dans l'historique |
| `0036_enable_rls_user_credential_backups.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0037_guest_approval_app_push.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0038_strict_guest_approval_assignment.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0039_shared_agenda.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0040_repair_missing_invitation_members.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0041_agenda_manager_access.sql` | Appliquée le 10/10/2026 (v1.77.0) : jamais passée auparavant ; colonne inutilisée depuis v1.31.1, ajoutée pour que la production égale le dépôt |
| `0042_promote_nelly_directeur.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0043_agenda_custom_assignees.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0044_guest_approval_pre_approval_reservation.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0045_auto_assign_table_for_guest_approval.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0046_guest_approval_linked_invitation.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0047_atomic_reset_test_event_data.sql` | Jamais appliquée seule : remplacée par 0069 (inscrite par le script manuel) |
| `0048_unplanned_guest_never_counts_toward_prevu.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0049_force_assign_guest_approval.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0050_reserve_table_for_reconsidered_refusal.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0051_table_42_johannesburg_reserve.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0052_invitations_withjoy_party_id.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0053_rename_member_syncs_solo_display_name.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0054_guest_approval_linked_invitation_on_delete_set_null.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0055_events_twilio_enabled.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0056_guest_approval_cote_before_reserve.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0057_app_logs.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0058_agenda_items_private.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0059_users_password_management.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0060_users_login_lockout.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0061_table41_reserve_remove_table42.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0062_table42_reserve_table41_regular.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0063_users_phone.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0064_table1_reserve_hide_table42_makongo_luzolo.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0065_remove_cedrix_merge_ya_maguy.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0066_table42_reserve_again_with_table1.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0067_placeur014_016_role_placeur.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0068_remove_extra_member_rows_malungu_lecaous.sql` | Appliquée à la main, inscrite à l'historique le 10/10/2026 (effets vérifiés) |
| `0069_health_report_reset_fix_strict_overload.sql` | Appliquée le 10/10/2026 par Gersom (éditeur SQL, script `supabase/manual/2026-10-10_appliquer_0069_et_nettoyer_historique.sql`) ; contrôle de santé vérifié vide |
| `0070_reset_removes_test_surprise_guests.sql` | Appliquée le 10/10/2026 par Gersom (éditeur SQL) et inscrite à l'historique ; bouton rouge pressé en Mode test, effets vérifiés (invités surprise et scans effacés) |
| `0071_remove_invitations_without_table_groups_1_3.sql` | Appliquée le 10/10/2026 par Gersom (éditeur SQL) et inscrite à l'historique ; vérifié (267 invitations, sauvegarde de 9 fiches) |
| `0072_sync_guest_list_66_seatplan_20261010.sql` | Appliquée le 11/10/2026 par Gersom (éditeur SQL) et inscrite à l'historique ; vérifié (262 invitations, Famille Moussaoui, sauvegarde présente) |
| `0073_sync_guest_list_67.sql` | Appliquée (v1.79.3) — effets vérifiés le 11/10/2026 avant 0074 : sauvegarde `v1.79.3_guest_list_67` présente, Frank Mbonda retiré, 262 invitations |
| `0074_sync_guest_list_68_name_tags.sql` | Appliquée par l'agent (MCP Supabase, `apply_migration`) le 11/10/2026 après simulation dans une transaction annulée ; effets vérifiés (263 invitations, 0 table en surcapacité, sauvegarde `v1.80.0_guest_list_68`) |

## Hors dépôt, trouvé en production

- **Opérations de données ponctuelles** (août 2026 : `reimport_guestlist_*`, `restore_invitations_after_unexpected_wipe_20260821`, `clean_reset_invitations_20260821*`, `clear_table_for_no_table_staff`, `remove_fabricated_rows_20260822`) : imports et nettoyages d'avant le parcours With Joy actuel, sans effet sur la structure. Retirées de l'historique le 10/10/2026 (copie conservée dans `supabase_migrations.schema_migrations_backup_20261010`).
- **`canada_jets_leads_pipeline`** (21/09/2026) : tables `canada_jets_leads` et `canada_jets_lead_events` d'un autre projet, vides, créées dans cette base. La règle « public insert leads » permet à quiconque possède la clé publique de l'application d'y insérer des lignes. **Supprimées par Gersom le 10/10/2026** (vérifié : 0 table, 0 règle restante). Avant : vérifiées vides et sans aucune dépendance, SQL : `supabase/manual/2026-10-10_supprimer_tables_canada_jets.sql` (garde-fou : annule si une ligne est apparue), à exécuter dans l'éditeur SQL (`docs/BACKLOG.md` n°9).
