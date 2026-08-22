import argparse, csv, re, json, random, unicodedata
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

def normalize_tag(tag):
    normalized = unicodedata.normalize('NFD', tag)
    return ''.join(c for c in normalized if c.isalpha() and not unicodedata.combining(c)).lower()

# Needs_Table_Gege / Needs_Table_Nelly (decouvert le 22/08/2026, export With
# Joy du 22/08/2026) : signifie que Gege ou Nelly n'a pas encore assigne
# manuellement de table a cette personne -- meme intention que "notable"
# (ne JAMAIS auto-assigner via le pool aleatoire, attendre une decision
# manuelle), mais garde le tag brut pour qu'on puisse filtrer "qui attend
# encore un placement, et de quel cote" dans /search ou /plan-table.
# Normalise (comme notable) pour tolerer une variation de casse future --
# le format peut encore changer selon l'export With Joy.
NO_TABLE_TAGS_NORMALIZED = {'notable', 'sanstable', 'needstablegege', 'needstablenelly'}

def has_no_table_tag(tags):
    return any(normalize_tag(tag) in NO_TABLE_TAGS_NORMALIZED for tag in tags)

TABLE_RE = re.compile(r'^[TF](\d{3})$')
DECLINE = 'Non, nous allons manquer le vol'
CLOSE_FAMILY_TAGS = {"Parents Culumbu","Parents Gege","Parents Nelly","Famille Kumpesa Vemba","Famille Mbidi DOS","Parents Nelly / Tonton Mbiki"}
# Groomsman/Bridesmaid designent le cortege (garcons/demoiselles d'honneur),
# pas le staff operationnel (service, securite, DJ...) -- ne comptent jamais
# comme un tag de role staff, meme si ce sont des "roles" au sens large.
WEDDING_PARTY_TAGS = {"Groomsman", "Bridesmaid"}
NON_ROLE_TAGS = {"Côté_Nelly","Côté_Gege","SMS_1506","SMSGEGE_1506","SMS_nelly1606","SMS_1506AA","SMS_Late_Gege","2evague","Maybe","Amis_Gege","notable"} | CLOSE_FAMILY_TAGS | WEDDING_PARTY_TAGS

def is_role_tag(t):
    if TABLE_RE.match(t): return False
    if t in NON_ROLE_TAGS: return False
    # Needs_Table_Gege/Nelly ne sont pas des tags de role staff : sans ce
    # garde-fou, is_staff_member les traiterait a tort comme du staff (bug
    # trouve le 22/08/2026 avant tout reimport, voir docs/QE_QA_PROCESS.md).
    if normalize_tag(t) in NO_TABLE_TAGS_NORMALIZED: return False
    return True

def is_staff_member(r):
    ts = tags_of(r)
    return 'SERVICES' in ts or any(is_role_tag(t) for t in ts)

def phone_of(members):
    # Le telephone With Joy est rempli par personne, pas par foyer : pour une
    # invitation groupee, on prend le premier telephone non vide rencontre.
    for m in members:
        ph = (m.get('phone number') or '').strip()
        if ph:
            return ph
    return None

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
        if len(nums) > 1:
            nom = f"{m.get('first name','').strip()} {m.get('last name','').strip()}".strip() or 'Accompagnant non-nommé'
            print(
                f"WARNING: {nom} porte plusieurs tags de table ({', '.join('T'+n for n in nums)}) ; "
                f"seul le premier (T{nums[0]}) est utilise, les autres sont ignores pour le placement."
            )
        key = nums[0] if nums else None  # if a person has 2 table tags (rare), take first encountered
        by_table[key].append(m)
    # Le tag de role staff est individuel (docs/BUSINESS_RULES.md) : si un
    # seul membre d'un foyer le porte, seule cette personne est category
    # 'Staff', isolee dans sa propre invitation -- jamais tout le foyer. On
    # isole donc chaque personne staff dans sa propre invitation individuelle
    # (meme quand plusieurs membres du meme foyer sont staff : ca permet de
    # cocher l'arrivee de chacun separement) ; les membres non-staff du meme
    # foyer restent groupes ensemble comme avant.
    for tnum, mem in by_table.items():
        staff_members = [m for m in mem if is_staff_member(m)]
        non_staff_members = [m for m in mem if not is_staff_member(m)]
        for m in staff_members:
            subgroups.append({'party_id': pid, 'members': [m], 'table_num': tnum})
        if non_staff_members:
            subgroups.append({'party_id': pid, 'members': non_staff_members, 'table_num': tnum})

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
    no_table = has_no_table_tag(all_tags) and not sg['table_num']
    if has_no_table_tag(all_tags) and sg['table_num']:
        print(
            f"WARNING: {sg['party_id']} porte notable et un tag de table "
            f"T/F{sg['table_num']} ; le tag de table explicite est prioritaire."
        )
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
        'no_table': no_table,
        'cote': cote,
        'tags': sorted(all_tags),
        'close_family': close,
        'notes': notes,
        'names': names_disp,
        'telephone': phone_of(members),
    }

invitations = [build_invitation(sg) for sg in subgroups]

with open(args.output, 'w', encoding='utf-8') as f:
    json.dump({'invitations': invitations, 'declined_report': declined_report}, f, ensure_ascii=False, indent=1)

print("Saved", args.output, "—", len(invitations), "invitations")
print("Side breakdown:", Counter(i['cote'] for i in invitations))
print("Explicit table target count:", sum(1 for i in invitations if i['table_num_explicit']))
print("No explicit table:", sum(1 for i in invitations if not i['table_num_explicit']))
print("With phone:", sum(1 for i in invitations if i['telephone']))
print("Without phone:", sum(1 for i in invitations if not i['telephone']))
print("Staff invitations:", sum(1 for i in invitations if i['category'] == 'Staff'))

