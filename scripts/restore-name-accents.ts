/**
 * Restores accents and circumflexes in profile names (e.g. "Durburz" ->
 * "Durbûrz") from a JSON list of {_id, from, to}. A rename is applied only when
 * the document's current name still equals "from" and "to" differs from it in
 * diacritics and capitalisation alone.
 *
 *   yarn sanity exec scripts/restore-name-accents.ts --with-user-token -- --file data/restore-5e-name-accents.json [--no-dry-run]
 */
import {readFileSync} from 'node:fs'
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const file = args[args.indexOf('--file') + 1]
const client = getCliClient({apiVersion: '2025-01-01'})
const strip = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '')

async function main() {
  const renames: {_id: string; from: string; to: string}[] = JSON.parse(readFileSync(file, 'utf8'))
  const docs: {_id: string; name: string}[] = await client.fetch(`*[_id in $ids]{_id, name}`, {ids: renames.map((r) => r._id)})
  const current = new Map(docs.map((d) => [d._id, d.name]))
  let tx = client.transaction()
  let n = 0
  for (const r of renames) {
    if (strip(r.from).toLowerCase() !== strip(r.to).toLowerCase()) throw new Error(`"${r.from}" -> "${r.to}" changes more than accents and capitalisation`)
    if (current.get(r._id) !== r.from) {
      console.log(`  skip ${r._id}: name is now "${current.get(r._id)}"`)
      continue
    }
    console.log(`  ${r.from} -> ${r.to}`)
    tx = tx.patch(r._id, (p) => p.set({name: r.to}))
    n++
  }
  if (dryRun) return console.log(`Dry run: ${n} renames, nothing written.`)
  if (n) await tx.commit()
  console.log(`Committed ${n} renames.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
