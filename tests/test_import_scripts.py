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


if __name__ == '__main__':
    unittest.main()
