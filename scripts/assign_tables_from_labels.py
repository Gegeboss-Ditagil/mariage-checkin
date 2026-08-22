import argparse, json, random
from collections import defaultdict

random.seed(20261008)

parser = argparse.ArgumentParser(description="Assigner les tables dans un JSON local, sans écrire en base.")
parser.add_argument("input", nargs="?", default="scripts/invitations_pre.json")
parser.add_argument("--output", default="scripts/invitations_final.json")
args = parser.parse_args()

with open(args.input, encoding='utf-8') as source:
    data = json.load(source)
invitations = data['invitations']

# Modele v1.1.0 : 40 tables officielles (1-40) et une reserve (41).
TABLE_NUMBERS = list(range(1, 42))
RESERVE = {41}
CAPACITY = 10
CAPACITE_OFFICIELLE = (len(TABLE_NUMBERS) - len(RESERVE)) * CAPACITY  # 400

# labeled tables actually referenced in the CSV (explicit)
labeled_tables = set(int(i['table_num_explicit']) for i in invitations if i['table_num_explicit'])
unlabeled_tables = [t for t in TABLE_NUMBERS if t not in labeled_tables and t not in RESERVE]
reserve_tables = sorted(RESERVE)

print("Labeled tables (from CSV):", sorted(labeled_tables))
print("Fully unlabeled non-reserve tables (pool for 'reste'):", unlabeled_tables)

# --- Step A: place explicit-label invitations, respecting capacity ---
by_table = defaultdict(list)
for inv in invitations:
    if inv['table_num_explicit']:
        by_table[int(inv['table_num_explicit'])].append(inv)

final_assignment = defaultdict(list)  # table_num -> [invitations]
overflow_pool = []
confirmed_ids = set()

for tnum in sorted(by_table):
    items = by_table[tnum]  # keep CSV order = order added
    total = 0
    kept_here = []
    for inv in items:
        if total + inv['nombre_prevu'] <= CAPACITY:
            kept_here.append(inv)
            total += inv['nombre_prevu']
        else:
            overflow_pool.append(inv)
    final_assignment[tnum] = kept_here
    for inv in kept_here:
        inv['placement_status'] = 'confirmee'
        inv['table_final'] = tnum
        confirmed_ids.add(id(inv))

print(f"\nExplicit-table overflow (didn't fit in labeled table capacity): {len(overflow_pool)} invitations, {sum(i['nombre_prevu'] for i in overflow_pool)} people")
for o in overflow_pool:
    print(f"   table T/F{o['table_num_explicit']} overflow -> {o['nom_affichage']} (n={o['nombre_prevu']}, côté={o['cote']})")

# --- Step B: 'reste' pool = no explicit table + overflow from labeled tables ---
# Les groupes "notable" sans tag de table restent volontairement sans table.
sans_table = [i for i in invitations if i.get('no_table')]
for inv in sans_table:
    inv['placement_status'] = 'provisoire'
    inv['table_final'] = None

reste = [i for i in invitations if not i['table_num_explicit'] and not i.get('no_table')] + overflow_pool
random.shuffle(reste)
# sort by size descending within shuffle groups a bit to pack better (best-fit-decreasing lite),
# but keep majority of randomness: shuffle first, then stable-sort only to reduce fragmentation
reste.sort(key=lambda i: -i['nombre_prevu'])  # first-fit-decreasing on the shuffled set (ties keep shuffled order)

print(f"\n'Reste' pool total: {len(reste)} invitations, {sum(i['nombre_prevu'] for i in reste)} people")

remaining_capacity = {t: CAPACITY for t in unlabeled_tables}
pool_order = unlabeled_tables[:]  # deterministic order 15,16,23,24,25,34..40
unplaced = []

for inv in reste:
    placed = False
    for t in pool_order:
        if remaining_capacity[t] >= inv['nombre_prevu']:
            final_assignment[t].append(inv)
            remaining_capacity[t] -= inv['nombre_prevu']
            inv['placement_status'] = 'provisoire'
            inv['table_final'] = t
            placed = True
            break
    if not placed:
        unplaced.append(inv)

# if still unplaced, spill into reserve tables
if unplaced:
    print(f"\n{len(unplaced)} invitations didn't fit in the unlabeled pool, trying reserve tables...")
    rem_res = {t: CAPACITY for t in reserve_tables}
    still_unplaced = []
    for inv in unplaced:
        placed = False
        for t in reserve_tables:
            if rem_res[t] >= inv['nombre_prevu']:
                final_assignment[t].append(inv)
                rem_res[t] -= inv['nombre_prevu']
                inv['placement_status'] = 'provisoire_reserve'
                inv['table_final'] = t
                placed = True
                break
        if not placed:
            still_unplaced.append(inv)
    unplaced = still_unplaced

print(f"\nTruly unplaced (no room anywhere): {len(unplaced)}")
for u in unplaced:
    print("  ", u['nom_affichage'], u['nombre_prevu'])

# --- Summary stats ---
print("\n=== Table occupancy summary ===")
total_people = 0
for t in TABLE_NUMBERS:
    invs = final_assignment.get(t, [])
    occ = sum(i['nombre_prevu'] for i in invs)
    total_people += occ
    flag = "RESERVE" if t in RESERVE else ("labeled" if t in labeled_tables else "pool")
    print(f"Table {t:2d} [{flag:8s}]: {occ:2d}/10  ({len(invs)} invitations)")

print("\nTotal people placed:", total_people)
print("Total invitations placed:", sum(len(v) for v in final_assignment.values()))
print("Staff volontairement sans table:", len(sans_table))

officielles_count = sum(
    i['nombre_prevu'] for t, invs in final_assignment.items() if t not in RESERVE for i in invs
)
print(f"\nPlaces officielles : {officielles_count}/{CAPACITE_OFFICIELLE}"
      + (f"  ⚠️  DEPASSEMENT de {officielles_count - CAPACITE_OFFICIELLE} — couper la liste avant le jour J"
         if officielles_count > CAPACITE_OFFICIELLE else ""))

with open(args.output, 'w', encoding='utf-8') as f:
    json.dump({
        'invitations': invitations,
        'unplaced': unplaced,
        'sans_table': sans_table,
        'declined_report': data['declined_report'],
        'labeled_tables': sorted(labeled_tables),
        'unlabeled_tables': unlabeled_tables,
    }, f, ensure_ascii=False, indent=1)
print("\nSaved", args.output)

