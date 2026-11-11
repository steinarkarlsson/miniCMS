/**
 * Adds a print source with page numbers to the profiles of one edition type,
 * driven by a TSV of "Profile<TAB>Page" rows (header row required). Names are
 * matched exactly, then ignoring accents and case. A profile listed on more
 * than one page gets a single source with the pages joined by ", ".
 *
 *   yarn sanity exec scripts/add-print-source-pages.ts --with-user-token -- --print "The Lord of the Rings Rules Manual" --type profile2e --tsv data/rules-manual-2e-pages.tsv
 *   ... --no-dry-run to write. Use --print-id <id> instead of --print when
 *   several prints share a name.
 *
 * If the profile already has a source for the print, its page is set when it
 * was empty; otherwise the profile is left alone. Names that match nothing are
 * printed at the end. Re-running is safe.
 */
import {readFileSync} from 'node:fs'
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

function argValue(flag: string, fallback?: string): string {
  const i = args.indexOf(flag)
  if (i < 0) {
    if (fallback !== undefined) return fallback
    throw new Error(`${flag} is required`)
  }
  const v = args[i + 1]
  if (!v || v.startsWith('--')) throw new Error(`${flag} needs a value`)
  return v
}

const PRINT_NAME = argValue('--print', '')
const PRINT_ID = argValue('--print-id', '')
if (!PRINT_NAME && !PRINT_ID) throw new Error('--print or --print-id is required')
const PROFILE_TYPE = argValue('--type', 'profile2e')
const TSV_PATH = argValue('--tsv')

/** Spellings in the TSV that are known typos for a profile name in the dataset. */
const ALIASES: Record<string, string> = {
  'The Mouth of Sauron0': 'The Mouth of Sauron',
  'Fredegard Bolger': 'Fredegar Bolger',
  'Hobbit Archer': 'Hobbit Archers',
  'Grishnákh, Orc Captain': 'Grishnákh',
}

const norm = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

type Profile = {_id: string; name: string; sources: {_key: string; kind?: string; print?: {_ref: string}; page?: string}[] | null}

async function main() {
  const prints: {_id: string; mainName: string; edition?: string}[] = await client.fetch(
    PRINT_ID
      ? `*[_type == "print" && _id == $id]{_id, mainName, "edition": edition->name}`
      : `*[_type == "print" && mainName == $name && !(_id in path("drafts.**"))]{_id, mainName, "edition": edition->name}`,
    {name: PRINT_NAME, id: PRINT_ID}
  )
  if (prints.length !== 1) {
    const found = prints.map((p) => `${p._id} (${p.edition ?? 'no edition'})`).join(', ')
    throw new Error(`Expected exactly one print ${PRINT_ID ? `with id ${PRINT_ID}` : `named "${PRINT_NAME}"`}, found ${prints.length}${found ? `: ${found}` : ''}. Use --print-id to pick one.`)
  }
  const printId = prints[0]._id
  console.log(`Print: ${prints[0].mainName} ${printId} (${prints[0].edition ?? 'no edition'})`)

  const rows = readFileSync(TSV_PATH, 'utf8')
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim())
    .map((l) => {
      const [name, page] = l.split('\t').map((s) => s.trim())
      return {name, page}
    })

  const profiles: Profile[] = await client.fetch(
    `*[_type == $type && !(_id in path("drafts.**"))]{_id, name, sources}`,
    {type: PROFILE_TYPE}
  )
  const byExact = new Map(profiles.map((p) => [p.name, p]))
  const byNorm = new Map<string, Profile[]>()
  for (const p of profiles) {
    const k = norm(p.name)
    byNorm.set(k, [...(byNorm.get(k) ?? []), p])
  }

  const pagesByProfile = new Map<string, {profile: Profile; pages: string[]; names: Set<string>}>()
  const notFound: {name: string; page: string}[] = []
  for (const {name, page} of rows) {
    // Try the alias first, then the name as written: an alias written for one
    // edition must not hide a profile that has the TSV spelling in another.
    let profile: Profile | undefined
    for (const wanted of [ALIASES[name], name]) {
      if (!wanted || profile) continue
      profile = byExact.get(wanted)
      if (!profile) {
        const cands = byNorm.get(norm(wanted)) ?? []
        if (cands.length === 1) profile = cands[0]
      }
    }
    if (!profile) {
      notFound.push({name, page})
      continue
    }
    const entry = pagesByProfile.get(profile._id) ?? {profile, pages: [], names: new Set<string>()}
    if (!entry.pages.includes(page)) entry.pages.push(page)
    entry.names.add(name)
    pagesByProfile.set(profile._id, entry)
  }

  type Op = {profile: Profile; page: string; action: 'append' | 'set-page' | 'skip'; existing?: string}
  const ops: Op[] = []
  for (const {profile, pages} of pagesByProfile.values()) {
    const page = pages.join(', ')
    const existing = (profile.sources ?? []).find((s) => s.kind === 'print' && s.print?._ref === printId)
    if (!existing) ops.push({profile, page, action: 'append'})
    else if (!existing.page) ops.push({profile, page, action: 'set-page', existing: existing._key})
    else ops.push({profile, page, action: 'skip', existing: existing.page})
  }

  const appends = ops.filter((o) => o.action === 'append')
  const setPages = ops.filter((o) => o.action === 'set-page')
  const skips = ops.filter((o) => o.action === 'skip')
  console.log(`Rows: ${rows.length}, matched profiles: ${pagesByProfile.size}, not found: ${notFound.length}`)
  console.log(`Append source: ${appends.length}, set page on existing source: ${setPages.length}, skip: ${skips.length}`)
  for (const [, e] of pagesByProfile) {
    const renamed = [...e.names].filter((n) => n !== e.profile.name)
    if (renamed.length) console.log(`  ~ "${renamed.join('" / "')}" -> "${e.profile.name}"`)
  }
  for (const o of appends) console.log(`  + ${o.profile.name}  p. ${o.page}`)
  for (const o of setPages) console.log(`  ^ ${o.profile.name}  set page ${o.page} on existing source`)
  for (const o of skips) console.log(`  = ${o.profile.name}  already p. ${o.existing} (wanted ${o.page})`)
  console.log('\nNot found:')
  for (const n of notFound) console.log(`  ? ${n.name}  (p. ${n.page})`)

  if (dryRun) {
    console.log('\nDry run: nothing written.')
    return
  }
  if (!appends.length && !setPages.length) return
  let tx = client.transaction()
  for (const o of appends) {
    tx = tx.patch(o.profile._id, (p) =>
      p.setIfMissing({sources: []}).append('sources', [
        {_type: 'profileSource', _key: `print-${printId.slice(0, 8)}`, kind: 'print', print: {_type: 'reference', _ref: printId}, page: o.page},
      ])
    )
  }
  for (const o of setPages) {
    tx = tx.patch(o.profile._id, (p) => p.set({[`sources[_key=="${o.existing}"].page`]: o.page}))
  }
  await tx.commit()
  console.log(`Committed ${appends.length + setPages.length} patches.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
