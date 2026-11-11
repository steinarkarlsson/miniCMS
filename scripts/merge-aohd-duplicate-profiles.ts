/**
 * Merges two 5e profiles that were exact copies of their base profile into the
 * base: the Assault on Helm's Deep army list entries are repointed and the
 * copies deleted. A backup of the deleted documents is in
 * data/merged-duplicate-profiles-backup-2026-11-11.json.
 *
 *   yarn sanity exec scripts/merge-aohd-duplicate-profiles.ts --with-user-token [-- --no-dry-run]
 */
import {getCliClient} from 'sanity/cli'

const dryRun = !process.argv.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

const LIST = 'armyList-5e-assault-on-helm-s-deep'
const MERGES = [
  {from: 'profile5e-uruk-hai-captain-assault-on-helm-s-deep', to: 'profile5e-uruk-hai-captain', entryKey: 'uruk-hai-captain-assault-on-helm-s-deep'},
  {from: 'profile5e-uruk-hai-shaman-assault-on-helm-s-deep', to: 'profile5e-uruk-hai-shaman', entryKey: 'uruk-hai-shaman-assault-on-helm-s-deep'},
]

async function main() {
  let tx = client.transaction()
  for (const m of MERGES) {
    const refs: {_id: string}[] = await client.fetch(`*[references($id)]{_id}`, {id: m.from})
    const others = refs.filter((r) => r._id !== LIST)
    if (others.length) throw new Error(`${m.from} is also referenced by ${others.map((r) => r._id).join(', ')}`)
    const target = await client.fetch(`*[_id == $id][0]._id`, {id: m.to})
    if (!target) throw new Error(`Missing base profile ${m.to}`)
    console.log(`${m.from} -> ${m.to} (list entry ${m.entryKey})`)
    tx = tx.patch(LIST, (p) => p.set({[`entries[_key=="${m.entryKey}"].profile._ref`]: m.to})).delete(m.from)
  }
  if (dryRun) return console.log('Dry run: nothing written.')
  await tx.commit()
  console.log('Committed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
