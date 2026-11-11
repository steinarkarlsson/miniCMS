/**
 * Assigns 4th edition profiles to figures released from The Fellowship of the
 * Ring (2001) through General Releases (2012), i.e. release waves dated
 * 2001-12-01 up to and including 2012-01-01.
 *
 *   yarn sanity exec scripts/assign-4e-profiles-by-wave.ts --with-user-token                 (dry run)
 *   yarn sanity exec scripts/assign-4e-profiles-by-wave.ts --with-user-token -- --no-dry-run
 *
 * The 4th edition profile is found from the figure's existing profiles:
 *  1. FIGURE_OVERRIDES pins the answer for a figure by mainName.
 *  2. If the figure has 2nd edition profiles, each one is mapped by name:
 *     exact (ignoring accents, case and punctuation) or through FROM_2E. A
 *     FROM_2E value of VIA_LATER means the 2nd edition profile was split in
 *     4th edition and the figure's 5th/6th edition profiles decide.
 *  3. Otherwise the 5th/6th edition profile names are used, exact or through
 *     FROM_LATER.
 * HOLD lists figures whose match is doubtful: they are reported with the
 * proposed profiles but never written. NOT_PLAYABLE figures get no profiles.
 * Figures that already have a 4th edition profile are left alone. Published
 * and draft figures are both patched. A report is written to
 * data/assign-4e-by-wave-report.json.
 */
import fs from 'node:fs'
import path from 'node:path'
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

const FROM = '2001-12-01'
const TO = '2012-01-01' // inclusive

const VIA_LATER = Symbol('via 5e/6e')

/** 2nd edition profile name -> 4th edition profile name(s). [] = no 4th edition counterpart needed. */
const FROM_2E: Record<string, string[] | typeof VIA_LATER> = {
  'Arwen Evenstar': ['Arwen'],
  'Frodo Baggins': ['Frodo'],
  'Balin': ['Balin, Son of Fundin'],
  'Beregond of Gondor': ['Beregond'],
  'Buhrdûr': ['Buhrdûr, Troll Chieftain'],
  'Elendil': ['Elendil, High King of Gondor and Arnor'],
  'Glorfindel': ['Glorfindel, Lord of the West'],
  'Grishnákh': ['Grishnákh, Orc Captain'],
  'Gûlavhar, the Terror of Angmar': ['Gûlavhar, the Terror of Arnor'],
  'Lurtz, Uruk-hai Captain': ['Lurtz'],
  'Sharku, Warg Rider Captain': ['Sharku'],
  'Strider / Aragorn': ['Aragorn - Strider'],
  'The Ringwraiths': ['Ringwraith'],
  'The Spider Queen': ['Spider Queen'],
  'Thranduil': ['Thranduil, King of Mirkwood'],
  'Mûmakil of Harad': ['War Mûmak of Harad'],
  'Wild Men of Dunland': ['Wild Man of Dunland'],
  'White/Wild Warg': ['Wild Warg'],
  'White/Wild Warg Chieftain': ['Wild Warg Chieftain'],
  'Mordor Orc Taskmaster': ['Mordor Taskmaster'],
  'Galadriel, Lady of the Galadhrim': ['Galadriel, Protectress of Lothlórien'],
  // Folded into the plain profile in 4th edition.
  'Khandish Mercenary': ['Khandish Warrior'],
  'Khandish Mercenary Chieftain': ['Khandish Chieftain'],
  'Khandish Mercenary Horseman': ['Khandish Horseman'],
  'Mordor Orc Captain': ['Orc Captain'],
  // Split in 4th edition: the figure's 5th/6th edition profiles decide.
  'Elf Warrior': VIA_LATER,
  'Elven Captain': VIA_LATER,
  'Gollum/Sméagol': VIA_LATER,
  'Orc Shaman': VIA_LATER,
}

/** 5th/6th edition profile name -> 4th edition profile name. */
const FROM_LATER: Record<string, string> = {
  'Orc Shaman': 'Mordor Orc Shaman',
  'Halbarad': 'Halbarad Dúnadan',
  'Moria Blackshield': 'Gundabad Blackshield',
  'Moria Blackshield Warrior': 'Gundabad Blackshield',
  'Moria Blackshield Captain': 'Gundabad Blackshield Captain',
  'Moria Blackshield Shaman': 'Gundabad Blackshield Shaman',
  'Moria Blackshield Drummer': 'Gundabad Blackshield Drummers',
  'Moria Blackshield Drum Bearer': 'Gundabad Blackshield Drummers',
  'Dwarf Shieldbearer': 'Shieldbearer',
  'Black Numenorean Knight': 'Morgul Knight',
  'Black Numenorean Warrior': 'Black Númenorean',
  'Moria Goblin Prowlers': 'Moria Goblin Prowler',
  'Woses Warriors': 'Woses Warrior',
  'Lothlórien Stormcaller': 'Galadhrim Stormcaller',
  'Rivendell Stormcaller': 'High Elf Stormcaller',
  'Rivendell Warrior': 'High Elf Warrior',
  'Rivendell Captain': 'High Elf Captain',
  'Lothlorien Warrior': 'Wood Elf Warrior',
  'Smeagol': 'Sméagol',
}

/** Figure mainName -> 4th edition profile names. */
const FIGURE_OVERRIDES: Record<string, string[]> = {
  'Elendil & Isildur': ['Elendil, High King of Gondor and Arnor', 'Isildur'],
  // Plastic troll kit buildable as either.
  'Mordor/Isengard Troll': ['Mordor Troll', 'Isengard Troll'],
  // The drum itself and its drummers are separate 4th edition profiles.
  'Goblin Drum': ['Moria Goblin Drum'],
  'Goblin Drummer 1': ['Moria Goblin Drummers'],
  'Goblin Drummer 2': ['Moria Goblin Drummers'],
  // The twins have a joint profile in one book and individual ones in another.
  'Elladan': ['Elladan', 'Elladan and Elrohir'],
  'Elladan Armoured on Foot': ['Elladan', 'Elladan and Elrohir'],
  'Elladan Mounted': ['Elladan', 'Elladan and Elrohir'],
  'Elrohir': ['Elrohir', 'Elladan and Elrohir'],
  'Elrohir Armoured on Foot': ['Elrohir', 'Elladan and Elrohir'],
  'Elrohir Mounted': ['Elrohir', 'Elladan and Elrohir'],
  'Gandalf and Cart': ['Gandalf the Grey', "Gandalf's Cart"],
  // Decided by Steinar on 2026-11-11.
  'Uruk-Hai Siege Berserker': ['Uruk-hai Berserker'],
  ...Object.fromEntries([1, 2, 3, 4].map((i) => [`Uruk-Hai Siege Engineer ${i}`, ['Uruk-hai Warrior']])),
  'Dwarf Ballista Crew 1': ['Dwarf Warrior'],
  'Dwarf Ballista Crew 2': ['Dwarf Warrior'],
  'Elrond Master of Rivendell': ['Elrond, Master of Rivendell'],
  'Haldir (Helms Deep)': ["Haldir, Defender of Helm's Deep"],
  'Haldir Armoured with Sword': ["Haldir, Defender of Helm's Deep"],
  'Éomer Mounted (Pelennor)': ['Éomer, Knight of the Pelennor'],
  'Galadriel (White Council)': ['Galadriel, Protectress of Lothlórien'],
  'Easterling Kataphract 1': ['Easterling Kataphrakt'],
  'Gondor Avenger Bolt Thrower Captain': ['Warrior of Minas Tirith'],
  'Gondor Avenger Bolt Thrower Crew 1': ['Warrior of Minas Tirith'],
  'Gondor Trebuchet Captain': ['Warrior of Minas Tirith'],
  'Gondor Siege Crew 1': ['Warrior of Minas Tirith'],
  'Gondor Siege Crew 2': ['Warrior of Minas Tirith'],
  'Uruk-Hai Ballista Captain': ['Uruk-hai Warrior'],
  'Uruk-Hai Ballista Crew 1': ['Uruk-hai Warrior'],
  'Uruk-Hai Ballista Crew 2': ['Uruk-hai Warrior'],
  // Proposals for held figures (see HOLD).
  'Vault Warden Crew 1': ['Iron Shield', 'Foe Spear'],
  'Vault Warden Crew 2': ['Iron Shield', 'Foe Spear'],
  'Vault Warden Crew 3': ['Iron Shield', 'Foe Spear'],
  'Vault Warden Crew 4': ['Iron Shield', 'Foe Spear'],
  'Watcher in the Water Tentacle 1': ['The Watcher in the Water'],
  'Watcher in the Water Tentacle 2': ['The Watcher in the Water'],
  'Watcher in the Water Tentacle 3': ['The Watcher in the Water'],
}

/** Figure mainName -> why the match is doubtful. Reported with the proposal, never written. */
const HOLD: Record<string, string> = {
  ...Object.fromEntries([1, 2, 3, 4].map((i) => [`Vault Warden Crew ${i}`, 'which crew figures are the Iron Shield and which the Foe Spear'])),
  ...Object.fromEntries([1, 2, 3].map((i) => [`Watcher in the Water Tentacle ${i}`, 'no profiles in any edition'])),
}

/**
 * Figure mainName -> 4th edition profiles to add to or remove from a figure
 * that already has 4th edition profiles. Decided by Steinar on 2026-11-11.
 */
const ADJUST_EXISTING: Record<string, {add?: string[]; remove?: string[]}> = {
  ...Object.fromEntries(Array.from({length: 12}, (_, i) => [`Ranger ${i + 1}`, {add: ['Blackroot Vale Archer']}])),
  'Meriadoc Brandybuck, Knight of the Mark': {add: ['Meriadoc, Captain of the Shire'], remove: ['Meriadoc, Knight of the Mark']},
  'Peregrin Took, Guard of the Citadel': {add: ['Peregrin, Captain of the Shire'], remove: ['Peregrin, Guard of the Citadel']},
  'Gandalf on Shadowfax': {add: ['Shadowfax']},
}

/** Every figure with the first profile also gets the second. Decided by Steinar on 2026-11-11. */
const ALSO: Record<string, string> = {
  'Aragorn - Strider': "Aragorn, Isildur's Heir",
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
type FigureProfile = {_ref: string; type?: string; name?: string}
type Figure = {_id: string; mainName: string; wave: string; profiles: FigureProfile[] | null}

async function main() {
  const profiles: Profile[] = await client.fetch(`*[_type == "profile4e" && !(_id in path("drafts.**"))]{_id, name}`)
  const byKey = new Map<string, Profile>()
  for (const p of profiles) {
    if (byKey.has(key(p.name))) throw new Error(`Two 4th edition profiles named "${p.name}"`)
    byKey.set(key(p.name), p)
  }
  const p4 = (name: string) => {
    const p = byKey.get(key(name))
    if (!p) throw new Error(`No 4th edition profile named "${name}"`)
    return p
  }
  const from2e = new Map(Object.entries(FROM_2E).map(([k, v]) => [key(k), v === VIA_LATER ? VIA_LATER : (v as string[]).map(p4)] as const))
  const fromLater = new Map(Object.entries(FROM_LATER).map(([k, v]) => [key(k), p4(v)]))
  const overrides = new Map(Object.entries(FIGURE_OVERRIDES).map(([k, v]) => [k, v.map(p4)]))

  const adjustments = new Map(
    Object.entries(ADJUST_EXISTING).map(([k, {add, remove}]) => [k, {add: (add ?? []).map(p4), remove: (remove ?? []).map(p4)}])
  )
  const also = new Map(Object.entries(ALSO).map(([k, v]) => [p4(k)._id, p4(v)]))
  const withAlso = (ps: Profile[]) => {
    const out = new Map(ps.map((p) => [p._id, p]))
    for (const p of ps) {
      const extra = also.get(p._id)
      if (extra) out.set(extra._id, extra)
    }
    return [...out.values()]
  }

  const figures: Figure[] = await client.fetch(
    `*[_type == "figure" && defined(releaseWave) && releaseWave->releaseDate >= $from && releaseWave->releaseDate <= $to]
      | order(releaseWave->releaseDate asc, mainName asc) {
      _id, mainName, "wave": releaseWave->name,
      "profiles": profiles[]{_ref, "type": @->_type, "name": @->name}
    }`,
    {from: FROM, to: TO}
  )

  const viaLater = (figure: Figure): Profile[] => {
    const out = new Map<string, Profile>()
    for (const p of figure.profiles ?? []) {
      if (!p?.name || (p.type !== 'profile5e' && p.type !== 'profile6e')) continue
      const m = fromLater.get(key(p.name)) ?? byKey.get(key(p.name))
      if (m) out.set(m._id, m)
    }
    return [...out.values()]
  }

  type Row = {figure: string; wave: string; to: string[]; rule: string; from: string[]}
  const assigned: Row[] = []
  const held: (Row & {why: string})[] = []
  const unmatched: {figure: string; wave: string; otherEditions: string[]}[] = []
  const partial: {figure: string; wave: string; unmapped: string[]; to: string[]}[] = []
  const notPlayable: string[] = []
  const mutations: {id: string; refs: string[]; removeRefs?: string[]}[] = []
  const adjusted: {figure: string; wave: string; added: string[]; removed: string[]}[] = []
  const linked = new Set<string>()
  let alreadyHave4e = 0

  for (const figure of figures) {
    const name = figure.mainName
    const all = (figure.profiles ?? []).filter((p) => p?.name)
    const other = all.map((p) => `${p.type?.replace('profile', '')}: ${p.name}`)
    if (NOT_PLAYABLE.has(name)) {
      notPlayable.push(name)
      continue
    }
    const current = all.filter((p) => p.type === 'profile4e')
    if (current.length) {
      alreadyHave4e++
      const adjust = adjustments.get(name) ?? {add: [], remove: []}
      const remove = adjust.remove.filter((p) => current.some((c) => c._ref === p._id))
      const keptIds = current.map((c) => c._ref).filter((id) => !remove.some((p) => p._id === id))
      const wanted = withAlso([...keptIds.map((id) => profiles.find((p) => p._id === id)!).filter(Boolean), ...adjust.add])
      const add = wanted.filter((p) => !keptIds.includes(p._id))
      keptIds.forEach((id) => linked.add(id))
      add.forEach((p) => linked.add(p._id))
      if (add.length || remove.length) {
        adjusted.push({figure: name, wave: figure.wave, added: add.map((p) => p.name), removed: remove.map((p) => p.name)})
        mutations.push({id: figure._id, refs: add.map((p) => p._id), removeRefs: remove.map((p) => p._id)})
      }
      continue
    }
    const two = all.filter((p) => p.type === 'profile2e')
    let chosen: Profile[] = []
    let rule: string
    const override = overrides.get(name)
    if (override) {
      chosen = override
      rule = 'override'
    } else if (two.length) {
      rule = 'from 2e'
      const out = new Map<string, Profile>()
      const unmapped: string[] = []
      for (const p of two) {
        const k = key(p.name!)
        const mapped = from2e.get(k)
        let ms: Profile[]
        if (mapped === VIA_LATER) {
          ms = viaLater(figure)
          rule = 'from 2e, split decided by 5e/6e'
        } else ms = mapped ?? (byKey.has(k) ? [byKey.get(k)!] : [])
        if (!ms.length) unmapped.push(p.name!)
        ms.forEach((m) => out.set(m._id, m))
      }
      chosen = [...out.values()]
      if (unmapped.length && chosen.length) partial.push({figure: name, wave: figure.wave, unmapped, to: chosen.map((p) => p.name)})
    } else {
      rule = 'from 5e/6e'
      chosen = viaLater(figure)
    }
    chosen = withAlso(chosen)
    if (!chosen.length) {
      unmatched.push({figure: name, wave: figure.wave, otherEditions: other})
      continue
    }
    const row = {figure: name, wave: figure.wave, to: chosen.map((p) => p.name), rule, from: other}
    if (HOLD[name]) {
      held.push({...row, why: HOLD[name]})
      continue
    }
    assigned.push(row)
    chosen.forEach((p) => linked.add(p._id))
    mutations.push({id: figure._id, refs: chosen.map((p) => p._id)})
  }

  const heldProfiles = new Set(held.flatMap((h) => h.to))
  const unlinkedProfiles = profiles
    .filter((p) => !linked.has(p._id))
    .map((p) => p.name)
    .sort((a, b) => a.localeCompare(b))
  const report = {
    dryRun,
    range: {from: FROM, toInclusive: TO},
    figures: figures.length,
    alreadyHave4e,
    assigned: assigned.length,
    adjusted: adjusted.length,
    documentsPatched: mutations.length,
    held: held.length,
    unmatchedFigures: unmatched.length,
    notPlayable: notPlayable.length,
    profiles: profiles.length,
    profilesWithoutFigures: unlinkedProfiles.length,
    profilesWithoutFiguresDetail: unlinkedProfiles.map((n) => (heldProfiles.has(n) ? `${n} (proposed for held figures)` : n)),
    adjustedDetail: adjusted,
    heldDetail: held,
    unmatchedDetail: unmatched,
    partialDetail: partial,
    notPlayableDetail: notPlayable,
    assignedDetail: assigned,
  }
  const reportPath = path.resolve('data/assign-4e-by-wave-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(
    JSON.stringify(
      {...report, assignedDetail: undefined, heldDetail: undefined, unmatchedDetail: undefined, notPlayableDetail: undefined},
      null,
      2
    )
  )
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
