/**
 * Imports army lists and profiles from the Now for Wrath JSON exports in /data.
 *
 * Usage (dry run by default, writes nothing):
 *   npx sanity exec scripts/import-profiles.ts --with-user-token -- --edition 6e
 *   npx sanity exec scripts/import-profiles.ts --with-user-token -- --edition 5e --no-dry-run
 *
 * Idempotent: every created document has a deterministic id derived from the
 * edition and the profile or list name, so re-running replaces rather than duplicates.
 * Ids use dashes only: a dot in a Sanity id makes the document a private path
 * (like `drafts.`), invisible to the unauthenticated front end.
 * Existing army lists of the edition are matched by name and patched in place.
 */
import fs from 'node:fs'
import path from 'node:path'
import {getCliClient} from 'sanity/cli'

type EditionConfig = {
  file: string
  editionId: string
  profileType: string
  prefix: string
}

const EDITIONS: Record<string, EditionConfig> = {
  '5e': {
    file: 'data/5thEditionProfiles.json',
    editionId: '44d6cc91-8994-4b07-b465-ffb211f5521f', // 5th Ed. Battle of Pelennor Fields
    profileType: 'profile5e',
    prefix: '5e',
  },
  '6e': {
    file: 'data/6thEditionProfiles.json',
    editionId: 'eb900e72-1095-4f60-a4f8-0f54db4002cb', // 6th Ed. War of the Rohirrim
    profileType: 'profile6e',
    prefix: '6e',
  },
}

/** Army list names in the profile data that are misspelt relative to the armyLists table. */
const LIST_NAME_ALIASES: Record<string, string> = {
  'atop wall': 'atop walls',
  'reclamatin of osgiliath': 'reclamation of osgiliath',
}

const HEROIC_TIERS = new Set([
  'Hero of Legend',
  'Hero of Valour',
  'Hero of Fortitude',
  'Minor Hero',
  'Independent Hero',
])

// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
const editionKey = args[args.indexOf('--edition') + 1]
const dryRun = !args.includes('--no-dry-run')
const config = EDITIONS[editionKey]
if (!config) {
  console.error(`Usage: --edition <${Object.keys(EDITIONS).join('|')}> [--no-dry-run]`)
  process.exit(1)
}

const client = getCliClient({apiVersion: '2025-01-01'})

function stripAccents(s: string) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
}
function norm(s: string) {
  let n = stripAccents(s).toLowerCase().replace(/[-–]/g, ' ').replace(/['’`]/g, '')
  n = n.replace(/\bthe\b/g, '').replace(/\s+/g, ' ').trim()
  return LIST_NAME_ALIASES[n] ?? n
}
function slug(s: string) {
  return stripAccents(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
function ref(_ref: string, _key?: string) {
  return {_type: 'reference', _ref, ...(_key ? {_key} : {})}
}
function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}
function strings(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const out = v.filter((x): x is string => typeof x === 'string')
  return out.length ? out : undefined
}
function normalizeBaseSize(v: unknown): string | undefined {
  const raw = Array.isArray(v) ? v[0] : v
  if (typeof raw !== 'string') return undefined
  return raw.replace(/mmm/, 'mm').replace(/oval/i, 'Oval').trim()
}
function normalizeTier(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const tier = v.startsWith('Hero of Legend') ? 'Hero of Legend' : v
  return HEROIC_TIERS.has(tier) ? tier : undefined
}

type Row = Record<string, any>
type Membership = {list: string; heroicTier?: string}

const STAT_KEYS = [
  'points', 'movement', 'fight', 'shoot', 'strength', 'defence', 'attack', 'wounds',
  'courage', 'intelligence', 'might', 'will', 'fate',
]
const statSignature = (r: Row) => JSON.stringify(STAT_KEYS.map((k) => r[k] ?? null))

function memberships(r: Row): Membership[] {
  return (r.factions ?? [])
    .map((f: any) =>
      typeof f === 'string'
        ? {list: f}
        : f && typeof f.name === 'string'
          ? {list: f.name, heroicTier: normalizeTier(f.heroicTier)}
          : null
    )
    .filter(Boolean)
}

// ---------------------------------------------------------------------------

async function main() {
  const raw = JSON.parse(fs.readFileSync(path.resolve(config.file), 'utf8'))
  const data = raw.data
  const report: Record<string, unknown> = {edition: editionKey, dryRun}
  const warnings: string[] = []

  // ----- existing documents ------------------------------------------------
  const existingLists: {_id: string; name: string; figureRefs: number}[] = await client.fetch(
    `*[_type == "armyList" && edition._ref == $editionId]{
      _id, name, "figureRefs": count(*[_type == "figure" && references(^._id)])
    }`,
    {editionId: config.editionId}
  )
  const existingRaces: {_id: string; name: string}[] = await client.fetch(
    `*[_type == "race"]{_id, name}`
  )

  // ----- army lists --------------------------------------------------------
  // Pick one canonical document per normalized name; the most-referenced wins.
  const canonicalByName = new Map<string, {_id: string; name: string}>()
  const duplicateLists: string[] = []
  for (const l of [...existingLists].sort((a, b) => b.figureRefs - a.figureRefs)) {
    const key = norm(l.name)
    if (canonicalByName.has(key)) duplicateLists.push(`${l.name} (${l._id}, ${l.figureRefs} figures)`)
    else canonicalByName.set(key, l)
  }

  type ListDoc = Row & {_id: string; name: string; isNew: boolean}
  const lists = new Map<string, ListDoc>() // by normalized name
  for (const a of data.armyLists as Row[]) {
    const key = norm(a.name)
    const existing = canonicalByName.get(key)
    lists.set(key, {
      _id: existing?._id ?? `armyList-${config.prefix}-${slug(a.name)}`,
      name: existing?.name ?? a.name,
      isNew: !existing,
      alignment: /^good$/i.test(a.alignment) ? 'Good' : /^evil$/i.test(a.alignment) ? 'Evil' : undefined,
      type: a.parentFaction ? 'legendaryLegion' : 'standard',
      parentFaction: a.parentFaction,
      legacy: a.legacy === true ? true : undefined,
      entries: [] as Row[],
    })
  }
  const unmatchedExisting = existingLists.filter((l) => !lists.has(norm(l.name)))

  // ----- races (6e) --------------------------------------------------------
  const raceIdByName = new Map(existingRaces.map((r) => [r.name.toLowerCase(), r._id]))
  const newRaces = new Map<string, Row>()
  function raceRef(name: string, key: string) {
    let id = raceIdByName.get(name.toLowerCase())
    if (!id) {
      id = `race-${slug(name)}`
      raceIdByName.set(name.toLowerCase(), id)
      newRaces.set(id, {_id: id, _type: 'race', name})
    }
    return ref(id, key)
  }

  // ----- profiles ----------------------------------------------------------
  const rows: {row: Row; category: 'Hero' | 'Warrior'}[] = [
    ...(data.heroes as Row[]).map((row) => ({row, category: 'Hero' as const})),
    ...(data.warriors as Row[]).map((row) => ({row, category: 'Warrior' as const})),
  ]
  type Profile = {
    name: string
    category: 'Hero' | 'Warrior'
    row: Row
    memberships: Membership[]
    signature: string
  }
  const profiles: Profile[] = []
  const byName = new Map<string, Profile[]>()
  const mergedRows: string[] = []
  const variantRows: string[] = []
  for (const {row, category} of rows) {
    const signature = statSignature(row)
    const group = byName.get(row.name) ?? []
    const same = group.find((p) => p.signature === signature)
    if (same) {
      same.memberships.push(...memberships(row))
      if (category === 'Hero') same.category = 'Hero'
      mergedRows.push(`${row.name} [${category} row merged]`)
      continue
    }
    const profile: Profile = {
      name: group.length ? `${row.name} (${group.length + 1})` : row.name,
      category,
      row,
      memberships: memberships(row),
      signature,
    }
    if (group.length) variantRows.push(`${row.name} -> "${profile.name}" (different stats, ${profile.memberships.length} lists)`)
    group.push(profile)
    byName.set(row.name, group)
    profiles.push(profile)
  }

  const danglingLists = new Map<string, string[]>()
  const profileDocs: Row[] = profiles.map((p) => {
    const r = p.row
    const id = `${config.profileType}-${slug(p.name)}`
    const heroic =
      r.might != null || r.will != null || r.fate != null
        ? {might: num(r.might), will: num(r.will), fate: num(r.fate)}
        : undefined
    const options = Array.isArray(r.options)
      ? r.options
          .filter((o: Row) => o && typeof o.name === 'string')
          .map((o: Row, i: number) => ({
            _key: `opt-${i}`,
            _type: 'profileOption',
            name: o.name,
            points: num(o.points),
          }))
      : undefined
    const doc: Row = {
      _id: id,
      _type: config.profileType,
      name: p.name,
      category: p.category,
      points: num(r.points),
      unique: r.unique === true ? true : undefined,
      movement: num(r.movement),
      fightValue: num(r.fight),
      shootValue: num(r.shoot),
      strength: num(r.strength),
      defence: num(r.defence),
      attacks: num(r.attack),
      wounds: num(r.wounds),
      courage: num(r.courage),
      heroicValues: heroic,
      heroicActions: strings(r.heroicActions),
      specialRules: strings(r.specialRules),
      wargear: strings(r.wargear),
      magicalPowers: strings(r.magicalPowers),
      options: options?.length ? options : undefined,
    }
    if (config.profileType === 'profile5e') {
      doc.keywords = strings(r.keywords)
    }
    if (config.profileType === 'profile6e') {
      doc.intelligence = num(r.intelligence)
      doc.race = strings(r.race)?.map((name, i) => raceRef(name, `race-${i}`))
      doc.factionKeywords = strings(r.faction)?.filter((f) => f !== 'None')
      const unitType = strings(r.unitType ?? r.uniType ?? r.unitTYpe)
        ?.map((t) => (t === 'hero' ? 'Hero' : t))
        .filter((t) => t !== 'Hero' && t !== 'Warrior')
      doc.unitType = unitType?.length ? unitType : undefined
      doc.baseSize = normalizeBaseSize(r.baseSize ?? r.basseSize)
      doc.legacy = r.legacy === true ? true : undefined
    }
    // memberships -> list entries
    const seen = new Set<string>()
    for (const m of p.memberships) {
      const list = lists.get(norm(m.list))
      if (!list) {
        danglingLists.set(m.list, [...(danglingLists.get(m.list) ?? []), p.name])
        continue
      }
      if (seen.has(list._id)) continue
      seen.add(list._id)
      list.entries.push({
        _key: slug(p.name),
        _type: 'armyListEntry',
        profile: ref(id),
        heroicTier: p.category === 'Hero' ? m.heroicTier : undefined,
      })
    }
    return doc
  })
  // Drop undefined values so createOrReplace stores clean documents
  const clean = (o: Row) => JSON.parse(JSON.stringify(o))

  // ----- mutations ---------------------------------------------------------
  const listDocs = [...lists.values()]
  const listIdByName = new Map(listDocs.map((l) => [norm(l.name), l._id]))
  const mutations: Row[] = []
  for (const r of newRaces.values()) mutations.push({createIfNotExists: r})
  for (const d of profileDocs) mutations.push({createOrReplace: clean(d)})
  for (const l of listDocs) {
    const parentArmyList = l.parentFaction ? listIdByName.get(norm(l.parentFaction)) : undefined
    if (l.parentFaction && !parentArmyList) warnings.push(`Parent list not found for ${l.name}: ${l.parentFaction}`)
    const fields = clean({
      type: l.type,
      alignment: l.alignment,
      legacy: l.legacy,
      parentArmyList: parentArmyList ? ref(parentArmyList) : undefined,
      entries: l.entries,
    })
    if (l.isNew) {
      mutations.push({
        createOrReplace: {_id: l._id, _type: 'armyList', name: l.name, edition: ref(config.editionId), ...fields},
      })
    } else {
      // keep the editor's name, alignment and icon; refresh structure fields
      const {alignment, ...rest} = fields
      mutations.push({patch: {id: l._id, set: rest, ...(alignment ? {setIfMissing: {alignment}} : {})}})
    }
  }
  mutations.push({patch: {id: config.editionId, set: {profileType: config.profileType}}})

  // ----- report ------------------------------------------------------------
  Object.assign(report, {
    profiles: profileDocs.length,
    heroes: profileDocs.filter((d) => d.category === 'Hero').length,
    warriors: profileDocs.filter((d) => d.category === 'Warrior').length,
    profilesWithoutList: profileDocs.filter((d) => !listDocs.some((l) => l.entries.some((e: Row) => e.profile._ref === d._id))).map((d) => d.name),
    armyLists: {
      total: listDocs.length,
      existingPatched: listDocs.filter((l) => !l.isNew).map((l) => l.name),
      created: listDocs.filter((l) => l.isNew).map((l) => `${l.name} [${l.type}${l.legacy ? ', legacy' : ''}]`),
      legendaryLegions: listDocs.filter((l) => l.type === 'legendaryLegion').length,
      emptyLists: listDocs.filter((l) => !l.entries.length).map((l) => l.name),
      duplicateExistingListsKept: duplicateLists,
      existingListsNotInJson: unmatchedExisting.map((l) => l.name),
    },
    newRaces: [...newRaces.values()].map((r) => r.name),
    mergedRows,
    variantRows,
    danglingListNames: Object.fromEntries(danglingLists),
    warnings,
    mutations: mutations.length,
  })
  const reportPath = path.resolve(`data/import-report-${editionKey}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  console.log(JSON.stringify({...report, mergedRows: mergedRows.length, armyLists: {...(report.armyLists as Row), existingPatched: (report.armyLists as Row).existingPatched.length}}, null, 2))
  console.log(`Report written to ${reportPath}`)

  if (dryRun) {
    console.log('\nDry run: nothing written. Re-run with --no-dry-run to commit.')
    return
  }
  const BATCH = 100
  for (let i = 0; i < mutations.length; i += BATCH) {
    const chunk = mutations.slice(i, i + BATCH)
    let tx = client.transaction()
    for (const m of chunk) {
      if (m.createIfNotExists) tx = tx.createIfNotExists(m.createIfNotExists)
      else if (m.createOrReplace) tx = tx.createOrReplace(m.createOrReplace)
      else if (m.patch) {
        let p = client.patch(m.patch.id).set(m.patch.set)
        if (m.patch.setIfMissing) p = p.setIfMissing(m.patch.setIfMissing)
        tx = tx.patch(p)
      }
    }
    await tx.commit()
    console.log(`Committed ${Math.min(i + BATCH, mutations.length)}/${mutations.length}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
