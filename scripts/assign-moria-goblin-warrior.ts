/**
 * Makes the twenty Moria goblin figures reference exactly the four
 * "Moria Goblin Warrior" profiles (1st, 2nd, 5th and 6th edition) and nothing
 * else, in particular not the Goblin-town "Goblin Warrior" profiles.
 *
 *   yarn sanity exec scripts/assign-moria-goblin-warrior.ts --with-user-token                 (dry run)
 *   yarn sanity exec scripts/assign-moria-goblin-warrior.ts --with-user-token -- --no-dry-run
 *
 * Existing references to the wanted profiles keep their _key; missing ones are
 * appended; everything else is removed. Figures already in the wanted state
 * are left untouched, so re-running is safe.
 */
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

const PROFILE_NAME = 'Moria Goblin Warrior'
const EXPECTED_EDITIONS = ['profile1e', 'profile2e', 'profile5e', 'profile6e']
const FIGURE_PREFIXES = [
  'Goblin Warrior',
  'Goblin Spearman',
  'Goblin Archer',
  'Moria Armoured Goblin Warrior',
  'Moria Armoured Goblin Archer',
]
const FIGURE_NAMES = FIGURE_PREFIXES.flatMap((prefix) => [1, 2, 3, 4].map((n) => `${prefix} ${n}`))

type Profile = {_id: string; _type: string; name: string}
type FigureProfile = {_key: string; _ref: string; type?: string; name?: string}
type Figure = {_id: string; mainName: string; profiles: FigureProfile[] | null}

async function main() {
  const wanted: Profile[] = await client.fetch(
    `*[_type match "profile*" && name == $name && !(_id in path("drafts.**"))] | order(_type) {_id, _type, name}`,
    {name: PROFILE_NAME}
  )
  const editions = wanted.map((p) => p._type).sort()
  if (JSON.stringify(editions) !== JSON.stringify(EXPECTED_EDITIONS)) {
    throw new Error(`Expected one "${PROFILE_NAME}" profile per edition ${EXPECTED_EDITIONS.join(', ')}; found ${editions.join(', ') || 'none'}`)
  }
  const wantedIds = new Set(wanted.map((p) => p._id))
  console.log(`Profiles: ${wanted.map((p) => `${p._type}=${p._id}`).join(', ')}`)

  // Drafts are included and patched under their own ids.
  const figures: Figure[] = await client.fetch(
    `*[_type == "figure" && mainName in $names] | order(mainName) {_id, mainName, profiles[]{_key, _ref, "type": @->_type, "name": @->name}}`,
    {names: FIGURE_NAMES}
  )
  const published = figures.filter((f) => !f._id.startsWith('drafts.'))
  const missing = FIGURE_NAMES.filter((n) => !published.some((f) => f.mainName === n))
  if (missing.length) throw new Error(`Figures not found: ${missing.join(', ')}`)
  const dupes = FIGURE_NAMES.filter((n) => published.filter((f) => f.mainName === n).length > 1)
  if (dupes.length) throw new Error(`More than one published document for: ${dupes.join(', ')}`)

  const mutations: {figure: Figure; profiles: {_type: 'reference'; _ref: string; _key: string}[]; removed: string[]; added: string[]}[] = []
  for (const figure of figures) {
    const current = figure.profiles ?? []
    const kept = current.filter((p) => wantedIds.has(p._ref))
    const removed = current.filter((p) => !wantedIds.has(p._ref))
    const added = wanted.filter((p) => !kept.some((k) => k._ref === p._id))
    if (!removed.length && !added.length && kept.length === current.length) {
      console.log(`  = ${figure.mainName} already correct`)
      continue
    }
    const profiles = [
      ...kept.map((p) => ({_type: 'reference' as const, _ref: p._ref, _key: p._key})),
      ...added.map((p) => ({_type: 'reference' as const, _ref: p._id, _key: p._id})),
    ]
    const label = (p: {type?: string; name?: string; _type?: string}) => `${p.name ?? ''} (${p.type ?? p._type})`
    console.log(`  ~ ${figure.mainName} (${figure._id})`)
    for (const p of removed) console.log(`      - ${label(p)}`)
    for (const p of added) console.log(`      + ${label(p)}`)
    mutations.push({figure, profiles, removed: removed.map(label), added: added.map(label)})
  }
  console.log(`Figures found: ${figures.length} (${published.length} published), to patch: ${mutations.length}`)

  if (dryRun) {
    console.log('Dry run: nothing written.')
    return
  }
  if (!mutations.length) return
  let tx = client.transaction()
  for (const m of mutations) tx = tx.patch(m.figure._id, (p) => p.set({profiles: m.profiles}))
  await tx.commit()
  console.log(`Committed ${mutations.length} patches.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
