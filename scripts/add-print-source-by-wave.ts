/**
 * Adds a print source to every profile of one edition type that is referenced
 * by a figure released in one of the given release waves. Defaults: the 1st
 * edition "The Lord of the Rings: The Return of the King" rulebook for figures
 * in the Fellowship, Two Towers, Shadow & Flame and Return of the King waves.
 * Pass --print "<print mainName>" and one or more --wave "<wave name>" to
 * override them.
 *
 *   yarn sanity exec scripts/add-print-source-by-wave.ts --with-user-token                 (dry run)
 *   yarn sanity exec scripts/add-print-source-by-wave.ts --with-user-token -- --no-dry-run
 *   yarn sanity exec scripts/add-print-source-by-wave.ts --with-user-token -- --print "Siege of Gondor" --wave "Siege of Gondor (2003)" --no-dry-run
 *
 * Existing sources on the profiles are kept; the new source is appended.
 * Profiles that already list the print are skipped, so re-running is safe.
 */
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

function argValues(flag: string): string[] {
  const values: string[] = []
  args.forEach((a, i) => {
    if (a === flag) {
      const v = args[i + 1]
      if (!v || v.startsWith('--')) throw new Error(`${flag} needs a value`)
      values.push(v)
    }
  })
  return values
}

const PROFILE_TYPE = 'profile1e'
const PRINT_NAME = argValues('--print')[0] ?? 'The Lord of the Rings: The Return of the King'
const PRINT_EDITION_PREFIX = '1st Ed.'
const waveArgs = argValues('--wave')
const WAVE_NAMES = waveArgs.length
  ? waveArgs
  : [
      'The Fellowship of the Ring (2001)',
      'The Two Towers (2002)',
      'Shadow & Flame (2003)',
      'The Return of the King (2003)',
    ]

type Profile = {_id: string; name: string; hasPrint: boolean}

async function main() {
  const prints: {_id: string; edition?: string}[] = await client.fetch(
    `*[_type == "print" && mainName == $name && !(_id in path("drafts.**"))]{_id, "edition": edition->name}`,
    {name: PRINT_NAME}
  )
  const matching = prints.filter((p) => p.edition?.startsWith(PRINT_EDITION_PREFIX))
  if (matching.length !== 1) {
    throw new Error(`Expected exactly one ${PRINT_EDITION_PREFIX} print named "${PRINT_NAME}", found ${matching.length}`)
  }
  const printId = matching[0]._id

  const waves: {_id: string; name: string}[] = await client.fetch(
    `*[_type == "releaseWave" && name in $names && !(_id in path("drafts.**"))]{_id, name}`,
    {names: WAVE_NAMES}
  )
  const missing = WAVE_NAMES.filter((n) => !waves.some((w) => w.name === n))
  if (missing.length) throw new Error(`Release waves not found: ${missing.join(', ')}`)
  const waveIds = waves.map((w) => w._id)

  const profiles: Profile[] = await client.fetch(
    `*[_type == $type && !(_id in path("drafts.**")) &&
      count(*[_type == "figure" && !(_id in path("drafts.**")) && releaseWave._ref in $waveIds && references(^._id)]) > 0
    ] | order(name) {
      _id, name,
      "hasPrint": count(sources[kind == "print" && print._ref == $printId]) > 0
    }`,
    {type: PROFILE_TYPE, waveIds, printId}
  )

  const toPatch = profiles.filter((p) => !p.hasPrint)
  const skipped = profiles.filter((p) => p.hasPrint)
  console.log(`Print: ${printId} (${matching[0].edition})`)
  console.log(`Waves: ${waves.map((w) => w.name).join(' | ')}`)
  console.log(`Profiles found: ${profiles.length}, to patch: ${toPatch.length}, already sourced: ${skipped.length}`)
  for (const p of toPatch) console.log(`  + ${p.name} (${p._id})`)
  for (const p of skipped) console.log(`  = ${p.name} already has it`)

  if (dryRun) {
    console.log('Dry run: nothing written.')
    return
  }
  if (!toPatch.length) return
  let tx = client.transaction()
  for (const p of toPatch) {
    tx = tx.patch(p._id, (patch) =>
      patch.setIfMissing({sources: []}).append('sources', [
        {_type: 'profileSource', _key: `print-${printId.slice(0, 8)}`, kind: 'print', print: {_type: 'reference', _ref: printId}},
      ])
    )
  }
  await tx.commit()
  console.log(`Committed ${toPatch.length} patches.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
