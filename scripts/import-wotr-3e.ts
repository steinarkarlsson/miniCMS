/**
 * Creates the 3rd edition (War of the Ring, 2009) game data:
 *  - the ten army lists of the rulebook (pages 92-211),
 *  - one formation per book entry (formations and Epic Heroes alike),
 *  - one profile3e per distinct stat line,
 *  - one battlehost army list per entry of the Battlehosts supplement, linked
 *    to the formations it is built from.
 *
 * Source data was transcribed from the books into
 *   data/3e-war-of-the-ring.json   (one object per army-list entry)
 *   data/3e-battlehosts.json       (battlehosts, plus Fortunes/Fates and notes
 *                                   which have no schema and are not imported)
 *
 *   yarn sanity exec scripts/import-wotr-3e.ts --with-user-token                    (dry run)
 *   yarn sanity exec scripts/import-wotr-3e.ts --with-user-token -- --no-dry-run
 *   ... -- --no-dry-run --replace    overwrite documents that already exist
 *
 * Ids are deterministic, so a re-run creates only what is missing (or, with
 * --replace, rewrites everything from the data files). A report is written to
 * data/import-report-3e.json.
 *
 * Profiles: stat rows that share a name but differ in any printed value get
 * separate profiles. The first printed keeps the plain name; an Epic Hero takes
 * its entry title ("Galadriel, Protectress of Lothlórien"); others get the
 * unit type or the formation title in brackets ("Orc Captain (Cavalry)").
 */
import {createHash} from 'node:crypto'
import {readFileSync, writeFileSync} from 'node:fs'
import {getCliClient} from 'sanity/cli'

const EDITION_ID = 'b0b076d4-cc91-4a1a-8258-d9547a53807b' // 3rd Ed. War of the Ring (2009-2012)
const PRINT_WOTR = 'fd3bd453-87c7-449d-ae83-544960e883d7' // War of the Ring
const PRINT_BH = '11298bc7-aea2-4606-885a-94b4d2afa48c' // War of the Ring Battlehosts

const dryRun = !process.argv.includes('--no-dry-run')
const replace = process.argv.includes('--replace')
const client = getCliClient({apiVersion: '2025-01-01'})

type StatLine = Record<'name' | 'race' | 'type' | 'M' | 'F' | 'S' | 'D' | 'A' | 'R' | 'C' | 'Mt', string>
type Section = {
  heading: string
  text?: string
  options?: {name: string; points?: string}[]
  rules?: {name: string; text?: string}[]
}
type Entry = {
  army: string
  title: string
  page: number
  points?: string
  kind: string
  size?: string
  statLines?: StatLine[]
  sections?: Section[]
}
type Battlehost = {
  kind: string
  army: string
  title: string
  page: number
  points?: string
  composition?: string[]
  rules?: {name: string; text?: string; parent?: string}[]
  otherText?: {heading: string; text: string}[]
}

const ARMIES: {name: string; alignment: 'Good' | 'Evil'; pages: string; battlehostsName?: string}[] = [
  {name: 'Gondor and Arnor', alignment: 'Good', pages: '92-107', battlehostsName: 'Gondor'},
  {name: 'The Kingdom of Rohan', alignment: 'Good', pages: '108-117'},
  {name: 'The Elven Kingdoms', alignment: 'Good', pages: '118-129', battlehostsName: 'Elven Kingdoms'},
  {name: 'The Dwarf Holds', alignment: 'Good', pages: '130-139'},
  {name: 'The Forgotten Kingdoms', alignment: 'Good', pages: '140-151'},
  {name: 'Mordor', alignment: 'Evil', pages: '152-167'},
  {name: 'The Fortress of Isengard', alignment: 'Evil', pages: '168-179'},
  {name: 'The Misty Mountains', alignment: 'Evil', pages: '180-189'},
  {name: 'The Fallen Realms', alignment: 'Evil', pages: '190-205', battlehostsName: 'Fallen Realms'},
  {name: 'Angmar', alignment: 'Evil', pages: '206-211'},
]

/** Stat-row name (optionally "name|entry title") -> character document name. */
const CHARACTER_ALIASES: Record<string, string> = {
  Peregrin: 'Peregrin Took (Pippin)',
  Meriadoc: 'Meriadoc Brandybuck (Merry)',
  'Dáin Ironfoot': 'Dain',
  'Lieutenant Cirion': 'Cirion',
  'King Arvedui': 'Arvedui',
  'Malbeth the Seer': 'Malbeth',
  'Angbor the Fearless': 'Angbor',
  'Forlong the Fat': 'Forlong',
  'The King of the Dead': 'King of the Dead',
  Háma: 'Hama, Doorward',
  'The Golden King': 'Golden King of Abrakhan',
  'Spider Queen|Shelob': 'Shelob',
  'The Balrog': "Durin's Bane",
  'The Necromancer': 'Sauron',
  Gríma: 'Grima Wormtongue',
  'The Mouth of Sauron': 'Mouth of Sauron',
  Flói: 'Floi Stonehand',
  Vrashkû: 'Vrasku',
}

/** Profile names chosen by hand where the automatic disambiguation reads badly ("name|entry title"). */
const NAME_OVERRIDES: Record<string, string> = {
  'Spider Queen|Shelob': 'Spider Queen (Shelob)',
  'The Witch-king|Winged Nazgûl': 'The Witch-king (Winged Nazgûl)',
}

/** Battlehost composition names that do not literally match a formation title. */
const COMPOSITION_ALIASES: Record<string, string[]> = {
  // Gandalf the White is the upgrade printed inside the Gandalf the Grey entry (p150)
  'gandalf the white': ['Gandalf the Grey'],
  'axemen of lossarnach': ['The Axemen of Lossarnach'],
  'aragorn, gimli and legolas': ["Aragorn, Isildur's Heir", 'Gimli, son of Glóin', 'Legolas, Prince of Mirkwood'],
  'siege bow batteries': ['Siege Bow Battery'],
  'war catapult batteries': ['War Catapult Battery'],
  'uruk-hai phalanxes': ['Uruk-hai Phalanx'],
  'uruk-hai berserkers': ['Uruk-hai Berserker Warband'],
  "vrasku's talons": ["Vrashkû's Talons"], // spelt Vraskû in Battlehosts, Vrashkû in the rulebook
  'corsair raiding parties': ['Corsair Raiding Party'],
  'war mumakil of harad': ['War Mûmak of Harad'],
  werewolves: ['Werewolf Pack'],
  // The named Nazgûl are all taken through the Ringwraith entry (p163)
  'khamul, the easterling': ['Ringwraith'],
  'the witch-king of angmar': ['Ringwraith'],
  'the dark marshal': ['Ringwraith'],
  'the betrayer': ['Ringwraith'],
  'the knight of umbar': ['Ringwraith'],
  'the dwimmerlaik': ['Ringwraith'],
  'the tainted': ['Ringwraith'],
}

// ---------------------------------------------------------------------------

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’‘]/g, "'")
    .toLowerCase()
const slug = (s: string) =>
  fold(s)
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
const singular = (s: string) =>
  s
    .split(' ')
    .map((w) => (w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ')
const matchKey = (s: string) =>
  singular(
    fold(s)
      .replace(/[^a-z0-9' -]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
const key = (...parts: string[]) => createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 12)
const ref = (_ref: string, k?: string) => ({_type: 'reference', _ref, ...(k ? {_key: k} : {})})
const source = (print: string, page: string) => ({
  _key: key(print, page),
  _type: 'profileSource',
  kind: 'print',
  page,
  print: ref(print),
})
const int = (v: string | undefined) => (v !== undefined && /^-?\d+$/.test(v) ? Number(v) : undefined)

const entries: Entry[] = JSON.parse(readFileSync('data/3e-war-of-the-ring.json', 'utf8'))
const battlehostData: Battlehost[] = JSON.parse(readFileSync('data/3e-battlehosts.json', 'utf8'))
const formations = entries.filter((e) => e.kind !== 'Note')
const skippedNotes = entries.filter((e) => e.kind === 'Note').map((e) => `${e.title} (p${e.page})`)

const listId = (army: string) => `armylist3e-${slug(army)}`
const formationId = (e: Entry) => `formation3e-${slug(e.army)}-${slug(e.title)}`

// --- profiles ----------------------------------------------------------------

const STAT_KEYS = ['race', 'type', 'M', 'F', 'S', 'D', 'A', 'R', 'C', 'Mt'] as const
const signature = (s: StatLine) => STAT_KEYS.map((k) => s[k]).join(' ')

type Variant = {
  row: StatLine
  name: string
  first: Entry
  pages: Set<number>
  entries: Entry[]
}
const byName = new Map<string, Variant[]>()
const variantOf = new Map<StatLine, Variant>()
for (const e of formations) {
  for (const row of e.statLines ?? []) {
    const variants = byName.get(row.name) ?? []
    byName.set(row.name, variants)
    let v = variants.find((x) => signature(x.row) === signature(row))
    if (!v) {
      v = {row, name: row.name, first: e, pages: new Set(), entries: []}
      variants.push(v)
    }
    v.pages.add(e.page)
    if (!v.entries.includes(e)) v.entries.push(e)
    variantOf.set(row, v)
  }
}
const takenNames = new Set<string>()
for (const [name, variants] of byName) {
  const overridden = variants.filter((v) => NAME_OVERRIDES[`${name}|${v.first.title}`])
  const rest = variants.filter((v) => !overridden.includes(v))
  overridden.forEach((v) => {
    v.name = NAME_OVERRIDES[`${name}|${v.first.title}`]
    takenNames.add(v.name)
  })
  rest.forEach((v, i) => {
    let candidate = name
    if (i > 0 || takenNames.has(candidate)) {
      const soloHero = v.first.kind === 'Epic Hero' && (v.first.statLines ?? []).length === 1
      const typeUnique = rest.filter((x) => x.row.type === v.row.type).length === 1
      if (soloHero && v.first.title !== name) candidate = v.first.title
      else if (typeUnique && v.row.type !== rest[0].row.type) candidate = `${name} (${v.row.type})`
      else candidate = `${name} (${v.first.title})`
    }
    if (takenNames.has(candidate)) throw new Error(`Profile name collision: ${candidate}`)
    takenNames.add(candidate)
    v.name = candidate
  })
}
const allVariants = [...byName.values()].flat()
const profileId = (v: Variant) => `profile3e-${slug(v.name)}`

function profileDoc(v: Variant, characters: Map<string, string>, unmatchedNotes: string[]) {
  const {row} = v
  const [, fight, shoot] = /^(-?\d+|-)\/(\d+)?/.exec(row.F) ?? []
  const [, defence, bracketed] = /^(\d+)(?:\((\d+)\))?$/.exec(row.D) ?? []
  const unparsed = (['M', 'S', 'A', 'R', 'C'] as const).filter((k) => row[k] !== '-' && int(row[k]) === undefined)
  if (row.D !== '-' && !defence) unparsed.push('D' as never)
  if (!/^(-|-?\d+)\/(-|\d\+)$/.test(row.F)) unparsed.push('F' as never)
  const solo = v.entries.length === 1 && (v.first.statLines ?? []).length === 1
  const sections = solo ? (v.first.sections ?? []) : []
  const ruleNames = (heading: string) =>
    sections.filter((s) => s.heading === heading).flatMap((s) => (s.rules ?? []).map((r) => r.name))
  const charName = CHARACTER_ALIASES[`${row.name}|${v.first.title}`] ?? CHARACTER_ALIASES[row.name] ?? row.name
  const character = characters.get(fold(charName))
  if (unparsed.length) unmatchedNotes.push(`${v.name}: ${unparsed.join(', ')} kept as text in notes`)
  const doc: Record<string, unknown> = {
    _id: profileId(v),
    _type: 'profile3e',
    name: v.name,
    category: row.Mt !== '-' || row.type === 'Hero' ? 'Hero' : 'Warrior',
    race: row.race === '-' ? undefined : row.race,
    unitType: row.type === '-' ? undefined : row.type,
    movement: int(row.M),
    fightValue: int(fight),
    shootValue: int(shoot),
    strength: int(row.S),
    defence: int(defence),
    defenceBracketed: int(bracketed),
    attacks: int(row.A),
    resilience: int(row.R),
    courage: int(row.C),
    heroicValues: row.Mt === '-' ? undefined : {_type: 'heroicValues', might: row.Mt},
    sources: [source(PRINT_WOTR, [...v.pages].sort((a, b) => a - b).join(', '))],
    character: character ? ref(character) : undefined,
    unique: character || v.first.kind === 'Epic Hero' ? true : undefined,
    points: solo ? v.first.points?.replace(/\s*(points|pts)$/i, '') : undefined,
    heroicActions: solo && ruleNames('Epic Actions').length ? ruleNames('Epic Actions') : undefined,
    specialRules: solo && ruleNames('Special Rules').length ? ruleNames('Special Rules') : undefined,
    notes: unparsed.length
      ? [
          {
            _key: key(v.name, 'note'),
            _type: 'block',
            style: 'normal',
            markDefs: [],
            children: [
              {
                _key: key(v.name, 'span'),
                _type: 'span',
                marks: [],
                text: `Stat line as printed: M ${row.M}, F ${row.F}, S ${row.S}, D ${row.D}, A ${row.A}, R ${row.R}, C ${row.C}, Mt ${row.Mt}`,
              },
            ],
          },
        ]
      : undefined,
  }
  return JSON.parse(JSON.stringify(doc))
}

// --- formations ----------------------------------------------------------------

function formationDoc(e: Entry) {
  const seen = new Set<string>()
  const profiles = (e.statLines ?? [])
    .map((row) => profileId(variantOf.get(row)!))
    .filter((id) => !seen.has(id) && seen.add(id))
    .map((id) => ref(id, key(id)))
  const names = (heading: string) =>
    (e.sections ?? []).filter((s) => s.heading === heading).flatMap((s) => (s.rules ?? []).map((r) => r.name))
  const doc = {
    _id: formationId(e),
    _type: 'formation',
    name: e.title,
    armyList: ref(listId(e.army)),
    kind: e.kind,
    points: e.points,
    size: e.size,
    sources: [source(PRINT_WOTR, String(e.page))],
    profiles,
    specialRules: names('Special Rules').length ? names('Special Rules') : undefined,
    epicActions: names('Epic Actions').length ? names('Epic Actions') : undefined,
    sections: (e.sections ?? []).map((s, i) => ({
      _key: key(e.title, String(i)),
      _type: 'formationSection',
      heading: s.heading,
      text: s.text,
      options: s.options?.length
        ? s.options.map((o, j) => ({
            _key: key(e.title, String(i), String(j)),
            _type: 'profileOption',
            name: o.name,
            points: o.points?.replace(/^(\d+) (points|pts)$/i, '$1'),
          }))
        : undefined,
    })),
  }
  return JSON.parse(JSON.stringify(doc))
}

// --- battlehosts ---------------------------------------------------------------

const battlehostArmy = (name: string) => ARMIES.find((a) => a.battlehostsName === name || a.name === name)

function resolveComposition(line: string, army: string, unresolved: string[]): Entry[] {
  const core = line.replace(/\([^)]*\)/g, '').replace(/\*/g, '')
  const found: Entry[] = []
  for (const alt of core.split(/\s+(?:AND\/OR|OR|or)\s+/)) {
    const name = alt
      .trim()
      .replace(/^\d+(-\d+|\+)?\s+/, '')
      .replace(/\bformations?\b/g, '')
      .replace(/[.\s]+$/, '')
      .trim()
    const titles = COMPOSITION_ALIASES[fold(name)]
    const wanted = titles ? titles.map(matchKey) : [matchKey(name)]
    for (const w of wanted) {
      const hits = formations.filter((f) => matchKey(f.title) === w || matchKey(f.title.split(',')[0]) === w)
      const local = hits.filter((f) => f.army === army)
      const pick = local.length ? local : hits
      if (pick.length === 1) found.push(pick[0])
      else unresolved.push(`${line} -> "${name}" (${pick.length} matches)`)
    }
  }
  return found
}

function battlehostDoc(b: Battlehost, unresolved: string[]) {
  const army = battlehostArmy(b.army)
  if (!army) throw new Error(`Unknown battlehost army: ${b.army}`)
  const seen = new Set<string>()
  const formationRefs = (b.composition ?? [])
    .flatMap((line) => resolveComposition(line, army.name, unresolved))
    .map(formationId)
    .filter((id) => !seen.has(id) && seen.add(id))
    .map((id) => ref(id, key(id)))
  const rules = [
    ...(b.rules ?? []).map((r) => ({name: r.parent ? `${r.parent}: ${r.name}` : r.name, text: r.text})),
    ...(b.otherText ?? []).map((o) => ({name: o.heading, text: o.text})),
  ]
  const doc = {
    _id: `armylist3e-battlehost-${slug(b.title)}`,
    _type: 'armyList',
    name: b.title,
    edition: ref(EDITION_ID),
    type: 'battlehost',
    alignment: army.alignment,
    parentArmyList: ref(listId(army.name)),
    points: b.points,
    composition: b.composition,
    formations: formationRefs,
    rules: rules.map((r, i) => ({_key: key(b.title, String(i)), _type: 'armyListRule', ...r})),
    sources: [source(PRINT_BH, String(b.page))],
  }
  return JSON.parse(JSON.stringify(doc))
}

// ---------------------------------------------------------------------------

async function main() {
  const characterDocs = await client.fetch<{_id: string; name?: string}[]>(`*[_type == "character"]{_id, name}`)
  const characters = new Map(characterDocs.filter((c) => c.name).map((c) => [fold(c.name!), c._id]))
  for (const target of Object.values(CHARACTER_ALIASES))
    if (!characters.has(fold(target))) throw new Error(`Character alias target not found: ${target}`)
  const refsOk = await client.fetch<number>(`count(*[_id in $ids])`, {ids: [EDITION_ID, PRINT_WOTR, PRINT_BH]})
  if (refsOk !== 3) throw new Error('Edition or print document missing')

  const notes: string[] = []
  const unresolved: string[] = []
  const lists = ARMIES.map((a) => ({
    _id: listId(a.name),
    _type: 'armyList',
    name: a.name,
    edition: ref(EDITION_ID),
    type: 'standard',
    alignment: a.alignment,
    sources: [source(PRINT_WOTR, a.pages)],
  }))
  const profiles = allVariants.map((v) => profileDoc(v, characters, notes))
  const formationDocs = formations.map(formationDoc)
  const battlehosts = battlehostData.filter((b) => b.kind === 'Battlehost').map((b) => battlehostDoc(b, unresolved))

  const ids = new Set<string>()
  for (const d of [...lists, ...profiles, ...formationDocs, ...battlehosts]) {
    if (ids.has(d._id)) throw new Error(`Duplicate id: ${d._id}`)
    ids.add(d._id)
  }
  const existing = new Set(await client.fetch<string[]>(`*[_id in $ids]._id`, {ids: [...ids]}))
  const clashes = await client.fetch<string[]>(
    `*[_type == "profile3e" && name in $names && !(_id in $ids)].name`,
    {names: profiles.map((p: {name: string}) => p.name), ids: [...ids]}
  )
  if (clashes.length) throw new Error(`profile3e names already used by other documents: ${clashes.join(', ')}`)

  const report = {
    armyLists: lists.map((l) => l.name),
    profiles: profiles.map((p: Record<string, any>) => ({
      id: p._id,
      name: p.name,
      category: p.category,
      character: characterDocs.find((c) => c._id === p.character?._ref)?.name,
      pages: p.sources[0].page,
    })),
    renamedProfiles: allVariants.filter((v) => v.name !== v.row.name).map((v) => `${v.row.name} -> ${v.name}`),
    formations: formationDocs.map((f: Record<string, any>) => `${f.armyList._ref.replace('armylist3e-', '')}: ${f.name}`),
    battlehosts: battlehosts.map((b: Record<string, any>) => ({
      name: b.name,
      parent: b.parentArmyList._ref,
      formations: (b.formations ?? []).map((f: {_ref: string}) => f._ref),
    })),
    unresolvedComposition: unresolved,
    statsKeptAsText: notes,
    notImported: {
      notes: skippedNotes,
      fortunesAndFates: battlehostData.filter((b) => b.kind === 'Fortune' || b.kind === 'Fate').length,
    },
  }
  writeFileSync('data/import-report-3e.json', JSON.stringify(report, null, 2) + '\n')

  const groups: [string, Record<string, any>[]][] = [
    ['army lists', lists],
    ['profiles', profiles],
    ['formations', formationDocs],
    ['battlehosts', battlehosts],
  ]
  for (const [label, docs] of groups) {
    const fresh = docs.filter((d) => !existing.has(d._id)).length
    console.log(`${label}: ${docs.length} (${fresh} new, ${docs.length - fresh} existing${replace ? ' to replace' : ' left alone'})`)
  }
  console.log(`profiles linked to a character: ${profiles.filter((p: any) => p.character).length}`)
  console.log(`profiles renamed to stay unique: ${report.renamedProfiles.length}`)
  console.log(`battlehost composition lines unresolved: ${unresolved.length}`)
  unresolved.forEach((u) => console.log(`  ? ${u}`))
  console.log('Report: data/import-report-3e.json')
  if (dryRun) {
    console.log('Dry run: nothing written. Re-run with -- --no-dry-run to apply.')
    return
  }
  for (const [label, docs] of groups) {
    for (let i = 0; i < docs.length; i += 100) {
      const tx = client.transaction()
      for (const d of docs.slice(i, i + 100)) {
        if (replace) tx.createOrReplace(d as any)
        else tx.createIfNotExists(d as any)
      }
      await tx.commit()
    }
    console.log(`committed ${label}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
