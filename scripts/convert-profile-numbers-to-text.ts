/**
 * Converts the profile fields that changed from number to free text:
 * points, heroicValues.might / will / fate, and options[].points.
 * A stored 60 becomes "60". Values that are already text are left alone, so
 * the script is safe to re-run.
 *
 *   yarn sanity exec scripts/convert-profile-numbers-to-text.ts --with-user-token                    (dry run)
 *   yarn sanity exec scripts/convert-profile-numbers-to-text.ts --with-user-token -- --no-dry-run
 *
 * A real run first writes every affected document's current values to
 * data/profile-numbers-backup-<timestamp>.json. Each patch is guarded by the
 * document's revision, so a profile edited mid-run fails its batch rather than
 * being overwritten.
 */
import fs from 'node:fs'
import path from 'node:path'
import {getCliClient} from 'sanity/cli'

const dryRun = !process.argv.slice(2).includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

const HEROIC_KEYS = ['might', 'will', 'fate'] as const
const BATCH_SIZE = 100

type Doc = {
  _id: string
  _rev: string
  _type: string
  name?: string
  points?: unknown
  heroicValues?: Record<string, unknown>
  options?: {_key?: string; name?: string; points?: unknown}[]
}

async function main() {
  // The CLI client reads raw, so drafts and release versions are included.
  const docs: Doc[] = await client.fetch(
    `*[_type match "profile*" && (defined(points) || defined(heroicValues) || count(options[defined(points)]) > 0)]
      | order(_id) {_id, _rev, _type, name, points, heroicValues, options}`
  )

  const counts = {points: 0, might: 0, will: 0, fate: 0, optionPoints: 0}
  const problems: string[] = []
  const patches: {doc: Doc; set: Record<string, string>}[] = []

  for (const doc of docs) {
    const set: Record<string, string> = {}
    if (typeof doc.points === 'number') {
      set.points = String(doc.points)
      counts.points++
    }
    for (const key of HEROIC_KEYS) {
      const value = doc.heroicValues?.[key]
      if (typeof value === 'number') {
        set[`heroicValues.${key}`] = String(value)
        counts[key]++
      }
    }
    for (const option of doc.options ?? []) {
      if (typeof option?.points !== 'number') continue
      if (!option._key) {
        problems.push(`${doc._id} (${doc.name}): option "${option.name}" has no _key`)
        continue
      }
      set[`options[_key=="${option._key}"].points`] = String(option.points)
      counts.optionPoints++
    }
    if (Object.keys(set).length) patches.push({doc, set})
  }

  console.log(`Profiles holding any of these fields: ${docs.length}`)
  console.log(`Profiles to patch: ${patches.length}`)
  console.log('Numeric values to convert:', counts)
  console.log('Examples:')
  for (const {doc, set} of patches.slice(0, 5)) console.log(`  ${doc.name} (${doc._id})`, set)

  if (problems.length) {
    console.error(`\n${problems.length} values cannot be addressed:`)
    for (const p of problems) console.error(`  ${p}`)
    throw new Error('Aborting: fix the problems above first. Nothing written.')
  }
  if (dryRun) {
    console.log('\nDry run: nothing written.')
    return
  }
  if (!patches.length) return

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = path.join('data', `profile-numbers-backup-${stamp}.json`)
  fs.writeFileSync(backupFile, JSON.stringify(patches.map((p) => p.doc), null, 2))
  console.log(`\nBackup of ${patches.length} documents written to ${backupFile}`)

  for (let i = 0; i < patches.length; i += BATCH_SIZE) {
    const batch = patches.slice(i, i + BATCH_SIZE)
    let tx = client.transaction()
    for (const {doc, set} of batch) {
      tx = tx.patch(doc._id, (patch) => patch.ifRevisionId(doc._rev).set(set))
    }
    await tx.commit()
    console.log(`Committed ${Math.min(i + BATCH_SIZE, patches.length)} / ${patches.length}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
