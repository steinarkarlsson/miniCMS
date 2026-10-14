/**
 * One-off repair: documents created with dotted ids (`profile5e.foo`,
 * `armyList.5e.foo`, `race.foo`) are private paths in Sanity and invisible to
 * the public front end. This copies each one to the same id with dashes,
 * rewrites every reference to it, then deletes the dotted original.
 *
 *   npx sanity exec scripts/fix-dotted-ids.ts --with-user-token            (dry run)
 *   npx sanity exec scripts/fix-dotted-ids.ts --with-user-token -- --no-dry-run
 */
import {getCliClient} from 'sanity/cli'

const dryRun = !process.argv.slice(2).includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})
const TYPES = ['profile5e', 'profile6e', 'armyList', 'race']

type Doc = Record<string, any> & {_id: string; _type: string}
const isDotted = (id: string) => id.includes('.') && !id.startsWith('drafts.')
const newIdFor = (id: string) => id.replace(/\./g, '-')

/** Rewrite every `_ref` in a value tree through `map`, returning a new tree. */
function rewriteRefs(value: any, map: Map<string, string>): any {
  if (Array.isArray(value)) return value.map((v) => rewriteRefs(v, map))
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = k === '_ref' && typeof v === 'string' && map.has(v) ? map.get(v) : rewriteRefs(v, map)
    }
    return out
  }
  return value
}

async function commit(label: string, build: (tx: ReturnType<typeof client.transaction>) => number) {
  const tx = client.transaction()
  const n = build(tx)
  console.log(`${label}: ${n} mutations`)
  if (!dryRun && n > 0) await tx.commit()
}

async function main() {
  const docs: Doc[] = await client.fetch(`*[_type in $types]`, {types: TYPES})
  const dotted = docs.filter((d) => isDotted(d._id))
  const map = new Map(dotted.map((d) => [d._id, newIdFor(d._id)]))
  console.log(`dotted documents: ${dotted.length} of ${docs.length}`)
  // A target that already exists is fine only when it is our own earlier copy
  const byId = new Map(docs.map((d) => [d._id, d]))
  const collisions = dotted.filter((d) => {
    const existing = byId.get(map.get(d._id)!)
    return existing && (existing._type !== d._type || existing.name !== d.name)
  })
  if (collisions.length) throw new Error(`target ids already exist: ${collisions.slice(0, 5).map((d) => d._id).join(', ')}`)

  // Everything that references a dotted id: figures, and army lists kept under their original id
  const referrers: Doc[] = await client.fetch(
    `*[_type in ["figure", "armyList", "formation", "profile5e", "profile6e"] && references($ids) && !(_id in $ids)]`,
    {ids: [...map.keys()]}
  )
  console.log(`documents referencing dotted ids: ${referrers.length}`)

  const BATCH = 200
  const chunks = <T,>(arr: T[]) => Array.from({length: Math.ceil(arr.length / BATCH)}, (_, i) => arr.slice(i * BATCH, (i + 1) * BATCH))

  // 1. recreate under dashed ids with internal refs rewritten. Sanity rejects a
  //    reference to a document that does not exist yet, so races and profiles go
  //    first in chunks, then every army list together (they reference each other).
  const create = (tx: ReturnType<typeof client.transaction>, d: Doc) => {
    const {_rev, _createdAt, _updatedAt, ...rest} = d
    tx.createOrReplace({...rewriteRefs(rest, map), _id: map.get(d._id)!})
  }
  const order: Record<string, number> = {race: 0, profile5e: 1, profile6e: 1, armyList: 2}
  const leaves = dotted.filter((d) => d._type !== 'armyList').sort((a, b) => order[a._type] - order[b._type])
  const lists = dotted.filter((d) => d._type === 'armyList')
  for (const [i, chunk] of chunks(leaves).entries()) {
    await commit(`create profiles/races ${i + 1}/${chunks(leaves).length}`, (tx) => {
      for (const d of chunk) create(tx, d)
      return chunk.length
    })
  }
  await commit('create army lists', (tx) => {
    for (const d of lists) create(tx, d)
    return lists.length
  })
  // 2. rewrite references held by other documents (only the fields that carry them)
  const REF_FIELDS: Record<string, string[]> = {
    figure: ['profiles'],
    armyList: ['entries', 'parentArmyList'],
    formation: ['profiles', 'armyList'],
    profile5e: ['basedOn', 'race'],
    profile6e: ['basedOn', 'race'],
  }
  for (const [i, chunk] of chunks(referrers).entries()) {
    await commit(`rewrite refs ${i + 1}/${chunks(referrers).length}`, (tx) => {
      for (const d of chunk) {
        const patch: Record<string, any> = {}
        for (const field of REF_FIELDS[d._type] ?? []) {
          if (d[field] !== undefined) patch[field] = rewriteRefs(d[field], map)
        }
        tx.patch(d._id, (p) => p.set(patch))
      }
      return chunk.length
    })
  }
  // 3. delete the dotted originals
  for (const [i, chunk] of chunks(dotted).entries()) {
    await commit(`delete ${i + 1}/${chunks(dotted).length}`, (tx) => {
      for (const d of chunk) tx.delete(d._id)
      return chunk.length
    })
  }
  console.log(dryRun ? 'Dry run: nothing written.' : 'Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
