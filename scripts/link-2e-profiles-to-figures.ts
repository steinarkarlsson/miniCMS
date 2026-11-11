/**
 * Adds 2nd edition profiles to figures that already have a 1st edition profile.
 *
 *   yarn sanity exec scripts/link-2e-profiles-to-figures.ts --with-user-token                 (dry run)
 *   yarn sanity exec scripts/link-2e-profiles-to-figures.ts --with-user-token -- --no-dry-run
 *
 * For each 1st edition profile on a figure the matching 2nd edition profile is
 * found by name: exact (ignoring accents, case and punctuation), through the
 * RENAMED table for profiles that changed name or were merged between
 * editions, or through the SPLIT table for profiles that 2nd edition divided
 * into several, where the figure's 5th/6th edition profile names pick the
 * right one and `otherwise` applies when they give no answer.
 *
 * Figures that already have a 2nd edition profile are left untouched, so the
 * script is safe to re-run. Figures with no match are reported, not changed.
 * A report is written to data/link-2e-report.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

/** 1st edition name -> 2nd edition name, for profiles that were renamed or merged. */
const RENAMED: Record<string, string> = {
  'Bandobras Took': 'Bandobras Took, The Bullroarer',
  'Damrod, Captain of the Rangers of Gondor': 'Damrod, Ranger of Ithilien',
  'Dwarf Captains': 'Dwarf Captain',
  'Eomer, Captain of Rohan': 'Éomer, Marshal of the Riddermark',
  'Galadriel': 'Galadrier', // sic: the 2nd edition profile is misspelt in the dataset
  'Gimli': 'Gimli, Son of Glóin',
  'Gollum': 'Gollum/Sméagol',
  'Grishnakh, Orc Captain': 'Grishnákh',
  'High Elf Warrior': 'Elf Warrior',
  'Hobbit Archer': 'Hobbit Archers',
  'Hobbit Shirriff': 'Shirriffs',
  'Knights of Minas Tirith': 'Knight of Minas Tirith',
  'Lurtz': 'Lurtz, Uruk-hai Captain',
  'Meriadoc Brandybuck, Knight of the Mark': 'Meriadoc, Knight of the Mark',
  'Mordor Troll (Catapult)': 'Mordor Troll',
  'Moria Goblin Drum': 'Goblin Drummers',
  'Orc Crewman': 'Orc Warrior',
  'Peregrin Took, Guard of the Citadel': 'Peregrin, Guard of the Citadel',
  'Sam Gamgee': 'Samwise Gamgee',
  'Shagrat, Uruk-hai Captain': 'Shagrat, Captain of Cirith Ungol',
  'Troll Chieftain': 'Mordor Troll Chieftain',
  'White Warg': 'White/Wild Warg',
  'White Warg Chieftain': 'White/Wild Warg Chieftain',
  'Wild Man of Dunland': 'Wild Men of Dunland',
  'Witch King': 'The Witch-king of Angmar',
  'Wood Elf Warrior': 'Elf Warrior',
}

/**
 * 1st edition name -> the 2nd edition profiles it was split into. The figure
 * gets every candidate that one of its 5th/6th edition profiles is named
 * after, or `otherwise` when none is.
 */
const SPLIT: Record<string, {into: string[]; otherwise?: string}> = {
  'Aragorn - Strider': {into: ['Strider / Aragorn', 'Aragorn, King Elessar'], otherwise: 'Strider / Aragorn'},
  'Captain of Men': {into: ['Captain of Minas Tirith', 'Captain of Rohan', 'Captain of Dol Amroth', 'Captain of Númenor']},
  'Warrior of Gondor': {into: ['Warrior of Minas Tirith', 'Warrior of Númenor']},
  'Grip, Fang and Wolf': {into: ['Grip', 'Fang', 'Wolf']},
  'Uruk-hai Warrior': {into: ['Uruk-hai Warrior', 'Uruk-hai Scout', 'Mordor Uruk-hai'], otherwise: 'Uruk-hai Warrior'},
  'Haradrim Chieftain': {into: ['Haradrim Chieftain', 'Haradrim King'], otherwise: 'Haradrim Chieftain'},
}

function key(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

type Profile = {_id: string; _type: string; name: string}
type FigureProfile = {_key: string; _ref: string; type?: string; name?: string}
type Figure = {_id: string; mainName: string; profiles: FigureProfile[]}
type Outcome =
  | {kind: 'matched'; profiles: Profile[]; rule: string}
  | {kind: 'ambiguous'; options: string[]}
  | {kind: 'unmatched'}

async function main() {
  const profiles: Profile[] = await client.fetch(
    `*[_type in ["profile1e", "profile2e"] && !(_id in path("drafts.**"))]{_id, _type, name}`
  )
  const p2ByKey = new Map<string, Profile>()
  for (const p of profiles) if (p._type === 'profile2e') p2ByKey.set(key(p.name), p)
  const p2 = (name: string) => {
    const p = p2ByKey.get(key(name))
    if (!p) throw new Error(`No 2nd edition profile named "${name}" (check RENAMED/SPLIT tables)`)
    return p
  }
  const renamed = new Map(Object.entries(RENAMED).map(([from, to]) => [key(from), p2(to)]))
  const split = new Map(
    Object.entries(SPLIT).map(([from, {into, otherwise}]) => [
      key(from),
      {into: into.map(p2), otherwise: otherwise ? p2(otherwise) : undefined},
    ])
  )

  // Published and draft figures alike; each is patched under its own id.
  const figures: Figure[] = await client.fetch(`*[_type == "figure" && count(profiles[@->_type == "profile1e"]) > 0]{
    _id, mainName, "profiles": profiles[]{_key, _ref, "type": @->_type, "name": @->name}
  }`)
  const laterNamesOf = (figure: Figure) =>
    new Set(figure.profiles.filter((p) => p.type === 'profile5e' || p.type === 'profile6e').map((p) => key(p.name ?? '')))

  const resolve = (figure: Figure, oneE: FigureProfile): Outcome => {
    const k = key(oneE.name ?? '')
    const s = split.get(k)
    if (s) {
      const later = laterNamesOf(figure)
      const picked = s.into.filter((c) => later.has(key(c.name)))
      if (picked.length) return {kind: 'matched', profiles: picked, rule: 'split'}
      if (s.otherwise) return {kind: 'matched', profiles: [s.otherwise], rule: 'split-default'}
      return {kind: 'ambiguous', options: s.into.map((c) => c.name)}
    }
    const byRename = renamed.get(k)
    if (byRename) return {kind: 'matched', profiles: [byRename], rule: 'renamed'}
    const exact = p2ByKey.get(k)
    if (exact) return {kind: 'matched', profiles: [exact], rule: 'exact'}
    return {kind: 'unmatched'}
  }

  const linked: {figure: string; from: string[]; to: string[]; rules: string[]}[] = []
  const ambiguous: {figure: string; from: string; options: string[]}[] = []
  const unmatched: {figure: string; from: string}[] = []
  const skipped: string[] = []
  const warnings: {figure: string; laterEditionsSuggest: string[]; chosen: string[]}[] = []
  const mutations: {id: string; refs: string[]}[] = []
  const ruleCount: Record<string, number> = {}

  for (const figure of figures) {
    if (figure.profiles.some((p) => p.type === 'profile2e')) {
      skipped.push(figure.mainName)
      continue
    }
    const refs: string[] = []
    const from: string[] = []
    const to: string[] = []
    const rules: string[] = []
    for (const oneE of figure.profiles.filter((p) => p.type === 'profile1e')) {
      const outcome = resolve(figure, oneE)
      if (outcome.kind === 'ambiguous') {
        ambiguous.push({figure: figure.mainName, from: oneE.name!, options: outcome.options})
        continue
      }
      if (outcome.kind === 'unmatched') {
        unmatched.push({figure: figure.mainName, from: oneE.name!})
        continue
      }
      for (const p of outcome.profiles) {
        if (refs.includes(p._id)) continue
        refs.push(p._id)
        from.push(oneE.name!)
        to.push(p.name)
        rules.push(outcome.rule)
        ruleCount[outcome.rule] = (ruleCount[outcome.rule] ?? 0) + 1
      }
    }
    // Cross-check: 5th/6th edition names that are also 2nd edition names but were not chosen.
    const suggested = [...laterNamesOf(figure)]
      .map((k) => p2ByKey.get(k))
      .filter((p): p is Profile => !!p && !refs.includes(p._id))
    if (suggested.length) warnings.push({figure: figure.mainName, laterEditionsSuggest: suggested.map((p) => p.name), chosen: to})
    if (!refs.length) continue
    linked.push({figure: figure.mainName, from, to, rules})
    mutations.push({id: figure._id, refs})
  }

  const report = {
    dryRun,
    figuresWith1e: figures.length,
    linked: linked.length,
    profilesAdded: mutations.reduce((n, m) => n + m.refs.length, 0),
    ambiguous: ambiguous.length,
    unmatched: unmatched.length,
    skippedAlreadyHave2e: skipped.length,
    rules: ruleCount,
    warnings,
    ambiguousDetail: ambiguous,
    unmatchedDetail: unmatched,
    linkedDetail: linked,
  }
  const reportPath = path.resolve('data/link-2e-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  const {ambiguousDetail, unmatchedDetail, linkedDetail, warnings: _w, ...summary} = report
  console.log(JSON.stringify(summary, null, 2))
  console.log(`Report written to ${reportPath}`)
  if (dryRun) {
    console.log('Dry run: nothing written.')
    return
  }
  const BATCH = 100
  for (let i = 0; i < mutations.length; i += BATCH) {
    let tx = client.transaction()
    for (const m of mutations.slice(i, i + BATCH)) {
      tx = tx.patch(m.id, (p) =>
        p.setIfMissing({profiles: []}).append('profiles', m.refs.map((_ref) => ({_type: 'reference', _ref, _key: _ref})))
      )
    }
    await tx.commit()
    console.log(`Committed ${Math.min(i + BATCH, mutations.length)}/${mutations.length}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
