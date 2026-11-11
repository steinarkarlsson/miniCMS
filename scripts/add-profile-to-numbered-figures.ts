/**
 * Appends one profile to every figure named "<prefix> <number>".
 *
 *   yarn sanity exec scripts/add-profile-to-numbered-figures.ts --with-user-token -- \
 *     --prefix "Hill Tribesman" --profile "Wild Man of Dunland" --edition profile6e              (dry run)
 *   yarn sanity exec scripts/add-profile-to-numbered-figures.ts --with-user-token -- \
 *     --prefix "Hill Tribesman" --profile "Wild Man of Dunland" --edition profile6e --no-dry-run
 *
 * --edition is the profile document type (profile1e, profile2e, profile5e, profile6e).
 * --also "<exact figure name>" (repeatable) includes extra figures that are not
 * numbered, e.g. --also "Arnor Banner Bearer". The run aborts if one is not found.
 * Existing profiles on the figures are kept; the reference is appended.
 * Figures that already have the profile are skipped, so re-running is safe.
 * Drafts are included and patched under their own ids. Two published figures
 * with the same name abort the run unless --allow-duplicates is given, in
 * which case every copy gets the profile.
 */
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const allowDuplicates = args.includes('--allow-duplicates')
const client = getCliClient({apiVersion: '2025-01-01'})

function option(name: string): string {
  const i = args.indexOf(name)
  const value = i >= 0 ? args[i + 1] : undefined
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`)
  return value
}
const PREFIX = option('--prefix')
const PROFILE_NAME = option('--profile')
const EDITION = option('--edition')
if (!/^profile\d+e$/.test(EDITION)) throw new Error(`--edition must look like profile6e, got "${EDITION}"`)
const NUMBERED = new RegExp(`^${PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\d+$`)
const ALSO: string[] = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--also') {
    const value = args[i + 1]
    if (!value || value.startsWith('--')) throw new Error('--also needs a value')
    ALSO.push(value)
  }
}
const wanted = (name: string) => NUMBERED.test(name) || ALSO.includes(name)

type Figure = {_id: string; mainName: string; refs: string[]}

async function main() {
  const profiles: {_id: string}[] = await client.fetch(
    `*[_type == $type && name == $name && !(_id in path("drafts.**"))]{_id}`,
    {type: EDITION, name: PROFILE_NAME}
  )
  if (profiles.length !== 1) throw new Error(`Expected exactly one ${EDITION} profile named "${PROFILE_NAME}", found ${profiles.length}`)
  const profileId = profiles[0]._id

  const candidates: Figure[] = await client.fetch(
    `*[_type == "figure" && (mainName match $pattern || mainName in $also)] | order(mainName) {_id, mainName, "refs": coalesce(profiles[]._ref, [])}`,
    {pattern: `${PREFIX} *`, also: ALSO}
  )
  const figures = candidates.filter((f) => wanted(f.mainName))
  const ignored = candidates.filter((f) => !wanted(f.mainName))
  if (!figures.length) throw new Error(`No figures named "${PREFIX} <number>" found`)
  const missingAlso = ALSO.filter((n) => !figures.some((f) => f.mainName === n))
  if (missingAlso.length) throw new Error(`--also figures not found: ${missingAlso.join(', ')}`)
  const published = figures.filter((f) => !f._id.startsWith('drafts.'))
  const dupes = [...new Set(published.map((f) => f.mainName))].filter((n) => published.filter((f) => f.mainName === n).length > 1)
  if (dupes.length && !allowDuplicates) throw new Error(`More than one published document for: ${dupes.join(', ')} (pass --allow-duplicates to patch every copy)`)
  for (const n of dupes) console.log(`  ! "${n}" has ${published.filter((f) => f.mainName === n).length} published documents; patching all of them`)

  const toPatch = figures.filter((f) => !f.refs.includes(profileId))
  const skipped = figures.filter((f) => f.refs.includes(profileId))
  console.log(`Profile: "${PROFILE_NAME}" (${EDITION}) = ${profileId}`)
  const alsoNote = ALSO.length ? ` or named ${ALSO.map((n) => `"${n}"`).join(', ')}` : ''
  console.log(`Figures matching "${PREFIX} <number>"${alsoNote}: ${figures.length}, to patch: ${toPatch.length}, already linked: ${skipped.length}`)
  for (const f of toPatch) console.log(`  + ${f.mainName} (${f._id})`)
  for (const f of skipped) console.log(`  = ${f.mainName} already has it`)
  for (const f of ignored) console.log(`  . ${f.mainName} not numbered, ignored`)

  if (dryRun) {
    console.log('Dry run: nothing written.')
    return
  }
  if (!toPatch.length) return
  let tx = client.transaction()
  for (const f of toPatch) {
    tx = tx.patch(f._id, (p) =>
      p.setIfMissing({profiles: []}).append('profiles', [{_type: 'reference', _ref: profileId, _key: profileId}])
    )
  }
  await tx.commit()
  console.log(`Committed ${toPatch.length} patches.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
