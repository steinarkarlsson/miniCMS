/**
 * Adds the 6th edition "Rohirrim Traitor" profile to the twelve figures named
 * "<prefix> 1" .. "<prefix> 12". The prefix defaults to "Rohan Warrior" (the
 * newer kit); pass --prefix "Warrior of Rohan" for the older models.
 *
 *   yarn sanity exec scripts/assign-rohirrim-traitor.ts --with-user-token                 (dry run)
 *   yarn sanity exec scripts/assign-rohirrim-traitor.ts --with-user-token -- --no-dry-run
 *   yarn sanity exec scripts/assign-rohirrim-traitor.ts --with-user-token -- --prefix "Warrior of Rohan" --no-dry-run
 *
 * Existing profiles on the figures are kept; the reference is appended.
 * Figures that already have the profile are skipped, so re-running is safe.
 */
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

const PROFILE_NAME = 'Rohirrim Traitor'
const prefixIdx = args.indexOf('--prefix')
const PREFIX = prefixIdx >= 0 ? args[prefixIdx + 1] : 'Rohan Warrior'
if (!PREFIX) throw new Error('--prefix needs a value')
const FIGURE_NAMES = Array.from({length: 12}, (_, i) => `${PREFIX} ${i + 1}`)

type Figure = {_id: string; mainName: string; refs: string[]}

async function main() {
  const profiles: {_id: string; _type: string}[] = await client.fetch(
    `*[_type match "profile*" && name == $name && !(_id in path("drafts.**"))]{_id, _type}`,
    {name: PROFILE_NAME}
  )
  if (profiles.length !== 1) throw new Error(`Expected exactly one "${PROFILE_NAME}" profile, found ${profiles.length}`)
  const profileId = profiles[0]._id

  const figures: Figure[] = await client.fetch(
    `*[_type == "figure" && mainName in $names]{_id, mainName, "refs": coalesce(profiles[]._ref, [])}`,
    {names: FIGURE_NAMES}
  )
  const missing = FIGURE_NAMES.filter((n) => !figures.some((f) => f.mainName === n))
  if (missing.length) throw new Error(`Figures not found: ${missing.join(', ')}`)
  const dupes = FIGURE_NAMES.filter((n) => figures.filter((f) => f.mainName === n).length > 1)
  if (dupes.length) throw new Error(`More than one document for: ${dupes.join(', ')}`)

  const toPatch = figures.filter((f) => !f.refs.includes(profileId))
  const skipped = figures.filter((f) => f.refs.includes(profileId))
  console.log(`Profile: ${profileId} (${profiles[0]._type})`)
  console.log(`Figures found: ${figures.length}, to patch: ${toPatch.length}, already linked: ${skipped.length}`)
  for (const f of toPatch) console.log(`  + ${f.mainName} (${f._id})`)
  for (const f of skipped) console.log(`  = ${f.mainName} already has it`)

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
