import csv
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class StaffImportRulesTest(unittest.TestCase):
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


if __name__ == '__main__':
    unittest.main()
