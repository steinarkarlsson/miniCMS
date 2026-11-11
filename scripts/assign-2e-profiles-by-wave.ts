/**
 * Assigns 2nd edition profiles to figures released in the 2nd edition era
 * (release waves dated 2001-01-01 up to but not including 2009-01-01, i.e.
 * everything from The Fellowship of the Ring (2001) through Mordor (2008)).
 *
 *   yarn sanity exec scripts/assign-2e-profiles-by-wave.ts --with-user-token                 (dry run)
 *   yarn sanity exec scripts/assign-2e-profiles-by-wave.ts --with-user-token -- --no-dry-run
 *   yarn sanity exec scripts/assign-2e-profiles-by-wave.ts --with-user-token -- --from 2005-01-01 --to 2009-01-01
 *
 * For every figure in those waves that has no 2nd edition profile yet, the
 * matching 2nd edition profile is found from the names of its 1st/5th/6th
 * edition profiles: exact (ignoring accents, case and punctuation) or through
 * the RENAMED table. FIGURE_OVERRIDES pins the answer for figures whose other
 * profiles are missing or misleading, and HOLD lists figures whose automatic
 * match is doubtful and must be confirmed by hand first. A figure whose other
 * editions point at two different 2nd edition profiles is reported as
 * ambiguous and left alone.
 *
 * Figures that already have a 2nd edition profile are only changed when
 * ADJUST_EXISTING names them (profiles to add or remove); otherwise the report
 * lists the ones whose other editions suggest a further or different 2nd
 * edition profile, for review. NOT_PLAYABLE lists vignettes and display
 * pieces that get no profiles at all and are left out of the report. Published and draft figures are both
 * patched, each under its own id. A report is written to
 * data/assign-2e-by-wave-report.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

function argValue(flag: string, fallback: string): string {
  const i = args.indexOf(flag)
  if (i === -1) return fallback
  const v = args[i + 1]
  if (!v || v.startsWith('--')) throw new Error(`${flag} needs a value`)
  return v
}
const FROM = argValue('--from', '2001-01-01')
const TO = argValue('--to', '2009-01-01')

/** 1st/5th/6th edition profile name -> 2nd edition profile name. */
const RENAMED: Record<string, string> = {
  // Named characters
  'Aragorn - Strider': 'Strider / Aragorn',
  'Aragorn (Strider)': 'Strider / Aragorn',
  'Gimli Son of Gloin': 'Gimli, Son of Glóin',
  'Gimli, Son of Gloin': 'Gimli, Son of Glóin',
  'Legolas Greenleaf': 'Legolas',
  'Merry': 'Meriadoc Brandybuck',
  'Pippin': 'Peregrin Took',
  'Denethor': 'Denethor, Steward of Gondor',
  'Elrond, Master of Rivendell': 'Elrond',
  'Gothmog, Lieutenant of Sauron': 'Gothmog, Lieutenant of Morgul',
  'The Witch-King of Angmar (Ringwraith)': 'The Witch-king of Angmar',
  'The Witch-King of Angmar (Crown)': 'The Witch-king of Angmar',
  'Frodo Baggins (Garrison of Ithilien)': 'Frodo Baggins',
  'Samwise Gamgee (Garrison of Ithilien)': 'Samwise Gamgee',
  'Samwise Gamgee (Rangers of Ithilien)': 'Samwise Gamgee',
  // Warriors renamed or split by faction in later editions
  'Angmar Orc Warrior': 'Orc Warrior',
  'Isengard Orc Warrior': 'Orc Warrior',
  'Mordor Orc Warrior': 'Orc Warrior',
  'Angmar Warg Rider': 'Warg Rider',
  'Isengard Warg Rider': 'Warg Rider',
  'Mordor Warg Rider': 'Warg Rider',
  'Angmar Orc Shaman': 'Orc Shaman',
  'Isengard Orc Shaman': 'Orc Shaman',
  'Mordor Orc Shaman': 'Orc Shaman',
  'Gondor Avenger Bolt Thrower': 'Avenger Bolt Thrower',
  'Gondor Battlecry Trebuchet': 'Battlecry Trebuchet',
  'High Elf Warrior': 'Elf Warrior',
  'Rivendell Warrior': 'Elf Warrior',
  'High Elf Captain': 'Elven Captain',
  'Rivendell Captain': 'Elven Captain',
  'Half Troll': 'Half Troll of Far Harad',
  'Corsair Crossbowman': 'Corsair Arbalester',
  'Orc Taskmaster': 'Mordor Orc Taskmaster',
  'Black Numenorean Knight': 'Morgul Knight',
  'Hobbit Archer': 'Hobbit Archers',
}

/**
 * Figure mainName -> 2nd edition profile names, for figures whose other
 * profiles do not identify the 2nd edition profile on their own.
 */
const FIGURE_OVERRIDES: Record<string, string[]> = {
  'Elendil & Isildur': ['Elendil', 'Isildur'],
  // Plastic troll kit buildable as either; 2nd edition only has the Mordor Troll profile.
  'Mordor/Isengard Troll': ['Mordor Troll'],
  // Decided by Steinar on 2026-11-05.
  'Shagrat with Shield': ['Shagrat, War Leader of Cirith Ungol'],
  'Mordor Orc Captain 3': ['Orc Captain', 'Mordor Orc Captain'],
  'Mordor Orc Captain 4': ['Orc Captain', 'Mordor Orc Captain'],
  'Warg Chieftain': ['Wild Warg Chieftain', 'White/Wild Warg Chieftain'],
}

/** Figures whose automatic match is doubtful: reported, never written. */
const HOLD = new Set<string>([])

/**
 * Figure mainName -> 2nd edition profiles to add to or remove from a figure
 * that already has 2nd edition profiles. Decided by Steinar on 2026-11-05.
 */
const ADJUST_EXISTING: Record<string, {add?: string[]; remove?: string[]}> = {
  'Orc Captain 1': {add: ['Mordor Orc Captain']},
  'Orc Captain 2': {add: ['Mordor Orc Captain']},
  'Rohan Banner Bearer Mounted': {add: ['Rider of Rohan'], remove: ['Warrior of Rohan']},
  ...Object.fromEntries(Array.from({length: 12}, (_, i) => [`Ranger ${i + 1}`, {add: ['Ranger of Gondor']}])),
}

/** Vignettes and display pieces that represent no game profile in any edition. */
const NOT_PLAYABLE = new Set<string>([
  'Frodo (Barrow-Downs)',
  'Merry (Barrow-Downs)',
  'Pippin (Barrow-Downs)',
  'Sam (Barrow-Downs)',
  'Frodo (Orc Armour)',
  'Frodo (Shelob)',
  'Sam (Orc Armour)',
  'Gimli on Dead Uruk-Hai',
  'Final Fate of the Witch-King',
])

function key(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

type Profile = {_id: string; name: string}
type FigureProfile = {_key: string; _ref: string; type?: string; name?: string}
type Figure = {_id: string; mainName: string; wave: string; profiles: FigureProfile[] | null}
type Candidate = {profile: Profile; via: string[]}

async function main() {
  const profiles: Profile[] = await client.fetch(`*[_type == "profile2e" && !(_id in path("drafts.**"))]{_id, name}`)
  const p2ByKey = new Map<string, Profile>()
  for (const p of profiles) p2ByKey.set(key(p.name), p)
  const p2 = (name: string) => {
    const p = p2ByKey.get(key(name))
    if (!p) throw new Error(`No 2nd edition profile named "${name}" (check RENAMED/FIGURE_OVERRIDES)`)
    return p
  }
  const renamed = new Map(Object.entries(RENAMED).map(([from, to]) => [key(from), p2(to)]))
  const overrides = new Map(Object.entries(FIGURE_OVERRIDES).map(([fig, names]) => [fig, names.map(p2)]))
  const adjustments = new Map(
    Object.entries(ADJUST_EXISTING).map(([fig, {add, remove}]) => [fig, {add: (add ?? []).map(p2), remove: (remove ?? []).map(p2)}])
  )

  const figures: Figure[] = await client.fetch(
    `*[_type == "figure" && defined(releaseWave) && releaseWave->releaseDate >= $from && releaseWave->releaseDate < $to]
      | order(releaseWave->releaseDate asc, mainName asc) {
      _id, mainName, "wave": releaseWave->name,
      "profiles": profiles[]{_key, _ref, "type": @->_type, "name": @->name}
    }`,
    {from: FROM, to: TO}
  )

  /** 2nd edition profiles the figure's other editions point at, keyed by profile id. */
  const candidatesOf = (figure: Figure): Candidate[] => {
    const out = new Map<string, Candidate>()
    for (const p of figure.profiles ?? []) {
      if (!p?.name || p.type === 'profile2e') continue
      const k = key(p.name)
      const match = renamed.get(k) ?? p2ByKey.get(k)
      if (!match) continue
      const via = `${p.type?.replace('profile', '')}: ${p.name}`
      const c = out.get(match._id)
      if (c) c.via.push(via)
      else out.set(match._id, {profile: match, via: [via]})
    }
    return [...out.values()]
  }

  const assigned: {figure: string; wave: string; to: string[]; via: string[]; rule: string}[] = []
  const held: {figure: string; wave: string; options: string[]}[] = []
  const ambiguous: {figure: string; wave: string; options: string[]; via: string[]}[] = []
  const unmatched: {figure: string; wave: string; otherEditions: string[]}[] = []
  const review: {figure: string; wave: string; has: string[]; otherEditionsSuggest: string[]}[] = []
  const adjusted: {figure: string; wave: string; added: string[]; removed: string[]}[] = []
  const notPlayable: string[] = []
  const mutations: {id: string; refs: string[]; removeRefs?: string[]}[] = []
  let alreadyHave2e = 0

  for (const figure of figures) {
    const name = figure.mainName.replace(/^drafts\./, '')
    const current = (figure.profiles ?? []).filter((p) => p?.type === 'profile2e')
    const candidates = candidatesOf(figure)
    if (NOT_PLAYABLE.has(name)) {
      notPlayable.push(name)
      continue
    }
    const adjust = adjustments.get(name)
    if (adjust) {
      const add = adjust.add.filter((p) => !current.some((c) => c._ref === p._id))
      const remove = adjust.remove.filter((p) => current.some((c) => c._ref === p._id))
      if (add.length || remove.length) {
        adjusted.push({figure: name, wave: figure.wave, added: add.map((p) => p.name), removed: remove.map((p) => p.name)})
        mutations.push({id: figure._id, refs: add.map((p) => p._id), removeRefs: remove.map((p) => p._id)})
      }
      continue
    }
    if (current.length) {
      alreadyHave2e++
      const extra = candidates.filter((c) => !current.some((p) => p._ref === c.profile._id))
      if (extra.length) {
        review.push({
          figure: name,
          wave: figure.wave,
          has: current.map((p) => p.name ?? p._ref),
          otherEditionsSuggest: extra.map((c) => c.profile.name),
        })
      }
      continue
    }
    const override = overrides.get(name)
    if (HOLD.has(name)) {
      held.push({figure: name, wave: figure.wave, options: candidates.map((c) => c.profile.name)})
      continue
    }
    let chosen: Profile[]
    let via: string[]
    let rule: string
    if (override) {
      chosen = override
      via = ['override']
      rule = 'override'
    } else if (candidates.length === 1) {
      chosen = [candidates[0].profile]
      via = candidates[0].via
      rule = candidates[0].via.some((v) => renamed.has(key(v.replace(/^\w+: /, '')))) ? 'renamed' : 'exact'
    } else if (candidates.length > 1) {
      ambiguous.push({
        figure: name,
        wave: figure.wave,
        options: candidates.map((c) => c.profile.name),
        via: candidates.flatMap((c) => c.via),
      })
      continue
    } else {
      unmatched.push({
        figure: name,
        wave: figure.wave,
        otherEditions: (figure.profiles ?? []).filter((p) => p?.name).map((p) => `${p.type?.replace('profile', '')}: ${p.name}`),
      })
      continue
    }
    assigned.push({figure: name, wave: figure.wave, to: chosen.map((p) => p.name), via, rule})
    mutations.push({id: figure._id, refs: chosen.map((p) => p._id)})
  }

  const count = <T extends {wave: string}>(xs: T[]) =>
    xs.reduce<Record<string, number>>((acc, x) => ((acc[x.wave] = (acc[x.wave] ?? 0) + 1), acc), {})
  const report = {
    dryRun,
    range: {from: FROM, to: TO},
    figures: figures.length,
    alreadyHave2e,
    assigned: assigned.length,
    adjusted: adjusted.length,
    notPlayable: notPlayable.length,
    documentsPatched: mutations.length,
    held: held.length,
    ambiguous: ambiguous.length,
    unmatched: unmatched.length,
    reviewExisting: review.length,
    assignedByWave: count(assigned),
    unmatchedByWave: count(unmatched),
    adjustedDetail: adjusted,
    notPlayableDetail: notPlayable,
    heldDetail: held,
    ambiguousDetail: ambiguous,
    unmatchedDetail: unmatched,
    reviewExistingDetail: review,
    assignedDetail: assigned,
  }
  const reportPath = path.resolve('data/assign-2e-by-wave-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  const {heldDetail, ambiguousDetail, unmatchedDetail, reviewExistingDetail, assignedDetail, adjustedDetail, notPlayableDetail, ...summary} = report
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
      tx = tx.patch(m.id, (p) => {
        let patch = p.setIfMissing({profiles: []})
        if (m.removeRefs?.length) patch = patch.unset(m.removeRefs.map((ref) => `profiles[_ref == "${ref}"]`))
        if (m.refs.length) patch = patch.append('profiles', m.refs.map((_ref) => ({_type: 'reference', _ref, _key: _ref})))
        return patch
      })
    }
    await tx.commit()
    console.log(`Committed ${Math.min(i + BATCH, mutations.length)}/${mutations.length}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
