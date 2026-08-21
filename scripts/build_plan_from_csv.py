import argparse, csv, re, json, random
from collections import defaultdict, Counter

random.seed(20261008)  # date du mariage, pour reproductibilite

parser = argparse.ArgumentParser(description="Préparer un plan depuis un export With Joy, sans écrire en base.")
parser.add_argument("csv_path", help="Chemin vers l'export CSV With Joy")
parser.add_argument("--output", default="scripts/invitations_pre.json", help="Fichier JSON de sortie")
args = parser.parse_args()

path = args.csv_path
with open(path, encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

def tags_of(r):
    return [t.strip() for t in (r.get('tags') or '').split(',') if t.strip()]

TABLE_RE = re.compile(r'^[TF](\d{3})$')
DECLINE = 'Non, nous allons manquer le vol'
CLOSE_FAMILY_TAGS = {"Parents Culumbu","Parents Gege","Parents Nelly","Famille Kumpesa Vemba","Famille Mbidi DOS","Parents Nelly / Tonton Mbiki"}
NON_ROLE_TAGS = {"Côté_Nelly","Côté_Gege","SMS_1506","SMSGEGE_1506","SMS_nelly1606","SMS_1506AA","SMS_Late_Gege","2evague","Maybe","Amis_Gege","notable"} | CLOSE_FAMILY_TAGS

def is_role_tag(t):
    if TABLE_RE.match(t): return False
    if t in NON_ROLE_TAGS: return False
    return True

# 1) group rows by party (household); rows w/o party = solo
groups = defaultdict(list)
solo_i = 0
for r in rows:
    p = r['party']
    if p:
        groups[p].append(r)
    else:
        solo_i += 1
        groups[f"__solo_{solo_i}"].append(r)

declined_report = []
subgroups = []  # each: dict(members, table_num or None)

for pid, members in groups.items():
    kept = [m for m in members if (m.get('rsvp') or '').strip() != DECLINE]
    declined = [m for m in members if (m.get('rsvp') or '').strip() == DECLINE]
    if declined:
        declined_report.append({
            'party_id': pid,
            'declined': [f"{m.get('first name','').strip()} {m.get('last name','').strip()}".strip() for m in declined],
            'kept_count': len(kept),
        })
    if not kept:
        continue
    # split by table tag if members disagree
    by_table = defaultdict(list)
    for m in kept:
        nums = [mm.group(1) for t in tags_of(m) if (mm := TABLE_RE.match(t))]
        key = nums[0] if nums else None  # if a person has 2 table tags (rare), take first encountered
        by_table[key].append(m)
    for tnum, mem in by_table.items():
        subgroups.append({'party_id': pid, 'members': mem, 'table_num': tnum})

print("Total subgroups:", len(subgroups))
print("Total kept people:", sum(len(s['members']) for s in subgroups))
print("Declined groups/people:", len(declined_report), sum(len(d['declined']) for d in declined_report))

# 2) enrich each subgroup
def build_invitation(sg):
    members = sg['members']
    all_tags = set()
    for m in members: all_tags.update(tags_of(m))
    cote = 'Nelly' if 'Côté_Nelly' in all_tags else ('Gege' if 'Côté_Gege' in all_tags else 'Neutre')
    close = sorted(all_tags & CLOSE_FAMILY_TAGS)
    roles = sorted(t for t in all_tags if is_role_tag(t) and t != 'SERVICES')
    is_staff = 'SERVICES' in all_tags or bool(roles)
    last_names = [ (m.get('last name') or '').strip() for m in members ]
    last_names_nonblank = [n for n in last_names if n]
    dominant_last = Counter(last_names_nonblank).most_common(1)[0][0] if last_names_nonblank else None
    names_disp = []
    for m in members:
        fn = (m.get('first name') or '').strip()
        ln = (m.get('last name') or '').strip()
        full = f"{fn} {ln}".strip()
        names_disp.append(full if full else "Accompagnant non-nommé")
    if len(members) == 1:
        nom_affichage = names_disp[0]
    else:
        nom_affichage = f"Famille {dominant_last}" if dominant_last else f"Groupe ({names_disp[0]}...)"
    rsvps = sorted(set((m.get('rsvp') or '').strip() or 'Sans réponse' for m in members))
    notes_parts = [f"RSVP: {' / '.join(rsvps)}"]
    if roles or 'SERVICES' in all_tags:
        role_list = (['SERVICES'] if 'SERVICES' in all_tags else []) + roles
        notes_parts.append(f"Rôle: {', '.join(role_list)}")
    if close:
        notes_parts.append(f"Famille proche: {', '.join(close)}")
    if len(members) > 1:
        notes_parts.append(f"Membres: {', '.join(names_disp)}")
    notes = " | ".join(notes_parts)
    return {
        'party_id': sg['party_id'],
        'table_num_explicit': sg['table_num'],
        'nom_affichage': nom_affichage,
        'groupe': dominant_last,
        'nombre_prevu': len(members),
        'category': 'Staff' if is_staff else None,
        'cote': cote,
        'tags': sorted(all_tags),
        'close_family': close,
        'notes': notes,
        'names': names_disp,
    }

invitations = [build_invitation(sg) for sg in subgroups]

with open(args.output, 'w', encoding='utf-8') as f:
    json.dump({'invitations': invitations, 'declined_report': declined_report}, f, ensure_ascii=False, indent=1)

print("Saved", args.output, "—", len(invitations), "invitations")
print("Side breakdown:", Counter(i['cote'] for i in invitations))
print("Explicit table target count:", sum(1 for i in invitations if i['table_num_explicit']))
print("No explicit table:", sum(1 for i in invitations if not i['table_num_explicit']))

