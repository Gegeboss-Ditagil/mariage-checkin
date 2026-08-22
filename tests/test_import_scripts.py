import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class StaffImportRulesTest(unittest.TestCase):
    def test_sql_tag_rules_reconnaissent_needs_table(self):
        # La règle existe aussi dans les RPC d'édition manuelle. 0023 est
        # indispensable aux bases où 0022 avait déjà été appliquée.
        for migration in (
            ROOT / 'supabase/migrations/0022_manage_invitation_tags.sql',
            ROOT / 'supabase/migrations/0023_sync_needs_table_tag_rules.sql',
        ):
            sql = migration.read_text(encoding='utf-8').lower()
            self.assertIn('needs_table_gege', sql)
            self.assertIn('needs_table_nelly', sql)

    def test_notable_reste_sans_table_sauf_tag_explicite(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            csv_path = temp / 'guestlist.csv'
            prepared_path = temp / 'prepared.json'
            assigned_path = temp / 'assigned.json'

            rows = [
                {
                    'party': 'staff-sans-table',
                    'first name': 'Alice',
                    'last name': 'Photo',
                    'rsvp': 'Oui',
                    'tags': 'Photographe,no_table',
                },
                {
                    'party': 'staff-table-explicite',
                    'first name': 'Bob',
                    'last name': 'DJ',
                    'rsvp': 'Oui',
                    'tags': 'DJ,notable,T001',
                },
            ]
            with csv_path.open('w', encoding='utf-8', newline='') as target:
                writer = csv.DictWriter(target, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

            prepared = subprocess.run(
                [sys.executable, str(ROOT / 'scripts/build_plan_from_csv.py'), str(csv_path), '--output', str(prepared_path)],
                check=True,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
            )
            subprocess.run(
                [sys.executable, str(ROOT / 'scripts/assign_tables_from_labels.py'), str(prepared_path), '--output', str(assigned_path)],
                check=True,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
            )

            data = json.loads(assigned_path.read_text(encoding='utf-8'))
            by_name = {inv['nom_affichage']: inv for inv in data['invitations']}

            self.assertEqual(by_name['Alice Photo']['category'], 'Staff')
            self.assertTrue(by_name['Alice Photo']['no_table'])
            self.assertIsNone(by_name['Alice Photo']['table_final'])
            self.assertEqual(by_name['Bob DJ']['category'], 'Staff')
            self.assertFalse(by_name['Bob DJ']['no_table'])
            self.assertEqual(by_name['Bob DJ']['table_final'], 1)
            self.assertIn('le tag de table explicite est prioritaire', prepared.stdout)

    def test_staff_individuel_isole_du_foyer_avec_telephone(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            csv_path = temp / 'guestlist.csv'
            prepared_path = temp / 'prepared.json'

            rows = [
                {
                    'party': 'foyer-mixte',
                    'first name': 'Roger',
                    'last name': 'Landu',
                    'phone number': '+33651643433',
                    'rsvp': 'Oui',
                    'tags': 'SERVICES,Côté_Gege,T030',
                },
                {
                    'party': 'foyer-mixte',
                    'first name': 'Nadine',
                    'last name': 'Landu',
                    'phone number': '',
                    'rsvp': 'Oui',
                    'tags': 'Côté_Gege,T030',
                },
            ]
            with csv_path.open('w', encoding='utf-8', newline='') as target:
                writer = csv.DictWriter(target, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

            subprocess.run(
                [sys.executable, str(ROOT / 'scripts/build_plan_from_csv.py'), str(csv_path), '--output', str(prepared_path)],
                check=True,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
            )

            data = json.loads(prepared_path.read_text(encoding='utf-8'))
            by_name = {inv['nom_affichage']: inv for inv in data['invitations']}

            # Roger porte le tag de role : il est isole dans sa propre
            # invitation Staff, avec son telephone.
            self.assertEqual(by_name['Roger Landu']['category'], 'Staff')
            self.assertEqual(by_name['Roger Landu']['nombre_prevu'], 1)
            self.assertEqual(by_name['Roger Landu']['telephone'], '+33651643433')

            # Nadine ne porte pas le tag de role : elle reste une invitation
            # separee, non-staff, sans telephone (absent du CSV).
            self.assertEqual(by_name['Nadine Landu']['category'], None)
            self.assertIsNone(by_name['Nadine Landu']['telephone'])

    def test_groomsman_bridesmaid_ne_sont_pas_du_staff(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            csv_path = temp / 'guestlist.csv'
            prepared_path = temp / 'prepared.json'

            rows = [
                {
                    'party': '',
                    'first name': 'Herve',
                    'last name': 'Menga',
                    'phone number': '+41766283081',
                    'rsvp': 'Oui',
                    'tags': 'Groomsman,Côté_Gege',
                },
                {
                    'party': '',
                    'first name': 'Deborah',
                    'last name': 'Yezi',
                    'phone number': '',
                    'rsvp': 'Oui',
                    'tags': 'Bridesmaid,Côté_Gege',
                },
            ]
            with csv_path.open('w', encoding='utf-8', newline='') as target:
                writer = csv.DictWriter(target, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

            subprocess.run(
                [sys.executable, str(ROOT / 'scripts/build_plan_from_csv.py'), str(csv_path), '--output', str(prepared_path)],
                check=True,
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
            )

            data = json.loads(prepared_path.read_text(encoding='utf-8'))
            by_name = {inv['nom_affichage']: inv for inv in data['invitations']}

            # Groomsman/Bridesmaid sont le cortege, pas le staff operationnel :
            # ils ne doivent jamais apparaitre sur /staff.
            self.assertIsNone(by_name['Herve Menga']['category'])
            self.assertIsNone(by_name['Deborah Yezi']['category'])

    def test_groomsman_avec_tag_staff_reste_staff(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            csv_path = temp / 'guestlist.csv'
            prepared_path = temp / 'prepared.json'

            rows = [{
                'party': '',
                'first name': 'Sem',
                'last name': 'Landu',
                'phone number': '+33782184726',
                'rsvp': 'Oui',
                'tags': 'Groomsman,SERVICES,Orateur,Côté_Gege,T030',
            }]
            with csv_path.open('w', encoding='utf-8', newline='') as target:
                writer = csv.DictWriter(target, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

            subprocess.run(
                [sys.executable, str(ROOT / 'scripts/build_plan_from_csv.py'), str(csv_path), '--output', str(prepared_path)],
                check=True, capture_output=True, text=True, encoding='utf-8', errors='replace',
            )

            data = json.loads(prepared_path.read_text(encoding='utf-8'))
            inv = data['invitations'][0]
            self.assertEqual(inv['nom_affichage'], 'Sem Landu')
            self.assertEqual(inv['category'], 'Staff')

    def test_avertit_sur_double_tag_de_table(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            csv_path = temp / 'guestlist.csv'
            prepared_path = temp / 'prepared.json'

            rows = [{
                'party': '',
                'first name': 'Cedrik',
                'last name': 'LeCaous',
                'phone number': '',
                'rsvp': 'Oui',
                'tags': 'Amis_Gege,Côté_Gege,T027,T036',
            }]
            with csv_path.open('w', encoding='utf-8', newline='') as target:
                writer = csv.DictWriter(target, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

            prepared = subprocess.run(
                [sys.executable, str(ROOT / 'scripts/build_plan_from_csv.py'), str(csv_path), '--output', str(prepared_path)],
                check=True, capture_output=True, text=True, encoding='utf-8', errors='replace',
            )

            data = json.loads(prepared_path.read_text(encoding='utf-8'))
            inv = data['invitations'][0]
            self.assertEqual(inv['table_num_explicit'], '027')
            self.assertIn('plusieurs tags de table', prepared.stdout)
            self.assertIn('T027', prepared.stdout)
            self.assertIn('T036', prepared.stdout)

    def test_foyer_entierement_staff_isole_chaque_personne(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            csv_path = temp / 'guestlist.csv'
            prepared_path = temp / 'prepared.json'

            rows = [
                {
                    'party': 'foyer-tout-staff',
                    'first name': 'Remy',
                    'last name': 'Landu',
                    'phone number': '+33651874779',
                    'rsvp': 'Oui',
                    'tags': 'SERVICES,Directeur_Festin _Adjoint,Côté_Gege,T030',
                },
                {
                    'party': 'foyer-tout-staff',
                    'first name': 'Denise',
                    'last name': 'Landu',
                    'phone number': '+33618318413',
                    'rsvp': 'Oui',
                    'tags': 'SERVICES,Adjoint_Décoration,Côté_Gege,T030',
                },
            ]
            with csv_path.open('w', encoding='utf-8', newline='') as target:
                writer = csv.DictWriter(target, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

            subprocess.run(
                [sys.executable, str(ROOT / 'scripts/build_plan_from_csv.py'), str(csv_path), '--output', str(prepared_path)],
                check=True, capture_output=True, text=True, encoding='utf-8', errors='replace',
            )

            data = json.loads(prepared_path.read_text(encoding='utf-8'))
            self.assertEqual(len(data['invitations']), 2)
            by_name = {inv['nom_affichage']: inv for inv in data['invitations']}
            self.assertEqual(by_name['Remy Landu']['category'], 'Staff')
            self.assertEqual(by_name['Remy Landu']['nombre_prevu'], 1)
            self.assertEqual(by_name['Denise Landu']['category'], 'Staff')
            self.assertEqual(by_name['Denise Landu']['nombre_prevu'], 1)

    def test_rsvp_decline_exclu_entierement(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            csv_path = temp / 'guestlist.csv'
            prepared_path = temp / 'prepared.json'

            rows = [
                {
                    'party': 'foyer-decline',
                    'first name': 'Ana',
                    'last name': 'Perdue',
                    'phone number': '',
                    'rsvp': 'Non, nous allons manquer le vol',
                    'tags': 'Côté_Nelly',
                },
                {
                    'party': 'foyer-decline',
                    'first name': 'Bob',
                    'last name': 'Reste',
                    'phone number': '',
                    'rsvp': 'Oui',
                    'tags': 'Côté_Nelly',
                },
            ]
            with csv_path.open('w', encoding='utf-8', newline='') as target:
                writer = csv.DictWriter(target, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

            subprocess.run(
                [sys.executable, str(ROOT / 'scripts/build_plan_from_csv.py'), str(csv_path), '--output', str(prepared_path)],
                check=True, capture_output=True, text=True, encoding='utf-8', errors='replace',
            )

            data = json.loads(prepared_path.read_text(encoding='utf-8'))
            names = [n for inv in data['invitations'] for n in inv['names']]
            self.assertNotIn('Ana Perdue', names)
            self.assertIn('Bob Reste', names)
            self.assertEqual(len(data['declined_report']), 1)
            self.assertIn('Ana Perdue', data['declined_report'][0]['declined'])

    def test_debordement_table_explicite_bascule_en_pool(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            csv_path = temp / 'guestlist.csv'
            prepared_path = temp / 'prepared.json'
            assigned_path = temp / 'assigned.json'

            rows = []
            for i in range(11):
                rows.append({
                    'party': f'solo-{i}',
                    'first name': f'Invite{i}',
                    'last name': 'Debordement',
                    'phone number': '',
                    'rsvp': 'Oui',
                    'tags': 'Côté_Nelly,T005',
                })
            with csv_path.open('w', encoding='utf-8', newline='') as target:
                writer = csv.DictWriter(target, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

            subprocess.run(
                [sys.executable, str(ROOT / 'scripts/build_plan_from_csv.py'), str(csv_path), '--output', str(prepared_path)],
                check=True, capture_output=True, text=True, encoding='utf-8', errors='replace',
            )
            subprocess.run(
                [sys.executable, str(ROOT / 'scripts/assign_tables_from_labels.py'), str(prepared_path), '--output', str(assigned_path)],
                check=True, capture_output=True, text=True, encoding='utf-8', errors='replace',
            )

            data = json.loads(assigned_path.read_text(encoding='utf-8'))
            self.assertEqual(len(data['unplaced']), 0)
            statuts = {inv['nom_affichage']: inv['placement_status'] for inv in data['invitations']}
            confirmees = sum(1 for s in statuts.values() if s == 'confirmee')
            provisoires = sum(1 for s in statuts.values() if s == 'provisoire')
            self.assertEqual(confirmees, 10)
            self.assertEqual(provisoires, 1)

    def test_capacite_totale_saturee_signale_les_non_places(self):
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            csv_path = temp / 'guestlist.csv'
            prepared_path = temp / 'prepared.json'
            assigned_path = temp / 'assigned.json'

            rows = []
            for i in range(420):
                rows.append({
                    'party': f'solo-{i}',
                    'first name': f'Invite{i}',
                    'last name': 'Sature',
                    'phone number': '',
                    'rsvp': 'Oui',
                    'tags': 'Côté_Nelly',
                })
            with csv_path.open('w', encoding='utf-8', newline='') as target:
                writer = csv.DictWriter(target, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

            subprocess.run(
                [sys.executable, str(ROOT / 'scripts/build_plan_from_csv.py'), str(csv_path), '--output', str(prepared_path)],
                check=True, capture_output=True, text=True, encoding='utf-8', errors='replace',
            )
            assigned = subprocess.run(
                [sys.executable, str(ROOT / 'scripts/assign_tables_from_labels.py'), str(prepared_path), '--output', str(assigned_path)],
                check=True, capture_output=True, text=True, encoding='utf-8', errors='replace',
            )

            data = json.loads(assigned_path.read_text(encoding='utf-8'))
            self.assertEqual(len(data['unplaced']), 10)
            self.assertIn('Truly unplaced (no room anywhere): 10', assigned.stdout)

    def test_needs_table_gege_nelly_reste_sans_table_et_nest_pas_staff(self):
        # Decouvert le 22/08/2026 (export With Joy du meme jour) : ces deux
        # tags signifient que Gege/Nelly n'a pas encore assigne de table a la
        # main -- meme intention que "notable" (jamais d'auto-assignation via
        # le pool), sans etre du staff. Verifie aussi qu'une variation de
        # casse ("needs_table_gege" en minuscules) est toleree, comme le
        # commentaire de NO_TABLE_TAGS_NORMALIZED le promet.
        with tempfile.TemporaryDirectory() as directory:
            temp = Path(directory)
            csv_path = temp / 'guestlist.csv'
            prepared_path = temp / 'prepared.json'
            assigned_path = temp / 'assigned.json'

            rows = [
                {
                    'party': 'attente-nelly',
                    'first name': 'Eric',
                    'last name': 'Lema',
                    'rsvp': 'Oui',
                    'tags': 'Côté_Nelly, Needs_Table_Nelly',
                },
                {
                    'party': 'attente-gege-casse-variee',
                    'first name': 'Fatou',
                    'last name': 'Casse',
                    'rsvp': 'Oui',
                    'tags': 'Côté_Gege, needs_table_gege',
                },
                {
                    'party': 'attente-nelly-table-explicite',
                    'first name': 'Henry',
                    'last name': 'Force',
                    'rsvp': 'Oui',
                    'tags': 'Côté_Nelly, Needs_Table_Nelly, T005',
                },
            ]
            with csv_path.open('w', encoding='utf-8', newline='') as target:
                writer = csv.DictWriter(target, fieldnames=rows[0].keys())
                writer.writeheader()
                writer.writerows(rows)

            subprocess.run(
                [sys.executable, str(ROOT / 'scripts/build_plan_from_csv.py'), str(csv_path), '--output', str(prepared_path)],
                check=True, capture_output=True, text=True, encoding='utf-8', errors='replace',
            )
            subprocess.run(
                [sys.executable, str(ROOT / 'scripts/assign_tables_from_labels.py'), str(prepared_path), '--output', str(assigned_path)],
                check=True, capture_output=True, text=True, encoding='utf-8', errors='replace',
            )

            data = json.loads(assigned_path.read_text(encoding='utf-8'))
            by_name = {inv['nom_affichage']: inv for inv in data['invitations']}

            self.assertIsNone(by_name['Eric Lema']['category'])
            self.assertTrue(by_name['Eric Lema']['no_table'])
            self.assertIsNone(by_name['Eric Lema']['table_final'])

            self.assertIsNone(by_name['Fatou Casse']['category'])
            self.assertTrue(by_name['Fatou Casse']['no_table'])
            self.assertIsNone(by_name['Fatou Casse']['table_final'])

            # Un tag de table explicite reste prioritaire sur Needs_Table_*,
            # meme regle que pour "notable" (docs/QE_QA_PROCESS.md, cas 1).
            self.assertIsNone(by_name['Henry Force']['category'])
            self.assertFalse(by_name['Henry Force']['no_table'])
            self.assertEqual(by_name['Henry Force']['table_final'], 5)


if __name__ == '__main__':
    unittest.main()
