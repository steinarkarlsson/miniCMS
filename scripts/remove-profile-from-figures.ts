/**
 * Removes one profile reference from every figure that has it.
 *
 *   yarn sanity exec scripts/remove-profile-from-figures.ts --with-user-token -- \
 *     --profile "Frodo, Samwise, and Smeagol" --edition profile5e              (dry run)
 *   yarn sanity exec scripts/remove-profile-from-figures.ts --with-user-token -- \
 *     --profile "Frodo, Samwise, and Smeagol" --edition profile5e --no-dry-run
 *
 * --edition is the profile document type (profile1e, profile2e, profile5e, profile6e).
 * Only the matching reference is removed; the figures' other profiles are kept.
 * Drafts are included and patched under their own ids. Non-figure documents
 * (army lists etc.) that reference the profile are reported but not changed.
 */
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

function option(name: string): string {
  const i = args.indexOf(name)
  const value = i >= 0 ? args[i + 1] : undefined
  if (!value || value.startsWith('--')) throw new Error(`${name} needs a value`)
  return value
}
const PROFILE_NAME = option('--profile')
const EDITION = option('--edition')
if (!/^profile\d+e$/.test(EDITION)) throw new Error(`--edition must look like profile6e, got "${EDITION}"`)

type Figure = {_id: string; mainName: string; others: string[]}

async function main() {
  const profiles: {_id: string}[] = await client.fetch(
    `*[_type == $type && name == $name && !(_id in path("drafts.**"))]{_id}`,
    {type: EDITION, name: PROFILE_NAME}
  )
  if (profiles.length !== 1) throw new Error(`Expected exactly one ${EDITION} profile named "${PROFILE_NAME}", found ${profiles.length}`)
  const profileId = profiles[0]._id

  const figures: Figure[] = await client.fetch(
    `*[_type == "figure" && references($id)] | order(mainName) {_id, mainName, "others": profiles[_ref != $id]->name}`,
    {id: profileId}
  )
  const otherDocs: {_id: string; _type: string; name?: string}[] = await client.fetch(
    `*[_type != "figure" && references($id)]{_id, _type, "name": coalesce(name, mainName, title)}`,
    {id: profileId}
  )

  console.log(`Profile: "${PROFILE_NAME}" (${EDITION}) = ${profileId}`)
  console.log(`Figures referencing it: ${figures.length}`)
  for (const f of figures) console.log(`  - ${f.mainName} (${f._id}); keeps: ${f.others.join(', ') || 'nothing'}`)
  for (const d of otherDocs) console.log(`  . ${d._type} "${d.name}" (${d._id}) also references it; not changed`)

  if (dryRun) {
    console.log('Dry run: nothing written.')
    return
  }
  if (!figures.length) return
  let tx = client.transaction()
  for (const f of figures) tx = tx.patch(f._id, (p) => p.unset([`profiles[_ref == "${profileId}"]`]))
  await tx.commit()
  console.log(`Committed ${figures.length} patches.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
