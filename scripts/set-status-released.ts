/**
 * Sets status = "Released" on every document of the given type that has no
 * status yet. Documents that already have a status (e.g. "Announced") are
 * left untouched.
 *
 *   yarn sanity exec scripts/set-status-released.ts --with-user-token -- --type print             (dry run)
 *   yarn sanity exec scripts/set-status-released.ts --with-user-token -- --type set --no-dry-run
 */
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const typeIdx = args.indexOf('--type')
const docType = typeIdx >= 0 ? args[typeIdx + 1] : undefined
if (!docType) throw new Error('Pass --type <documentType> (e.g. print or set)')
const client = getCliClient({apiVersion: '2025-01-01'})

const STATUS = 'Released'

async function main() {
  const docs: {_id: string; name?: string}[] = await client.fetch(
    `*[_type == $type && !defined(status)] | order(mainName, name) {_id, "name": coalesce(mainName, name)}`,
    {type: docType}
  )
  console.log(`${docType} documents with no status, to set ${STATUS}: ${docs.length}`)
  for (const d of docs) console.log(`  ${d.name} (${d._id})`)

  if (dryRun) {
    console.log('Dry run: nothing written.')
    return
  }
  if (!docs.length) return
  let tx = client.transaction()
  for (const d of docs) tx = tx.patch(d._id, (patch) => patch.set({status: STATUS}))
  await tx.commit()
  console.log(`Committed ${docs.length} patches.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
