/**
 * Adds profiles of one edition to an army list of that edition.
 *
 * Which profiles are candidates is chosen by, in order of preference:
 *   --names <file>     a JSON array of profile names (the full intended membership of the list)
 *   --not-in <list>    every profile of the edition that is not already in that other list
 *   (neither)          every profile of the edition
 *
 *   yarn sanity exec scripts/assign-profiles-to-list.ts --with-user-token -- \
 *     --profile-type profile1e --list "The Free Peoples" --names data/1e-the-free-peoples.json              (dry run)
 *   yarn sanity exec scripts/assign-profiles-to-list.ts --with-user-token -- \
 *     --profile-type profile1e --list "Forces of Darkness" --names data/1e-forces-of-darkness.json --no-dry-run
 *   yarn sanity exec scripts/assign-profiles-to-list.ts --with-user-token -- \
 *     --profile-type profile2e --list Evil --not-in Good --no-dry-run
 *
 * Idempotent: profiles already in the target list are skipped and existing
 * entries are left untouched, so re-running only appends what is missing.
 * Entries are keyed by the profile name slug, like the ones created by
 * import-profiles.ts. No heroic tier is set. Names are compared after
 * trimming, so a stray trailing space in the dataset does not matter, but
 * every name in --names must match exactly one published profile or the
 * script stops before writing anything. Supersedes assign-2e-profiles-to-list.ts.
 */
import {readFileSync} from 'node:fs'
import {resolve} from 'node:path'
import {getCliClient} from 'sanity/cli'

const PROFILE_TYPES = ['profile1e', 'profile2e', 'profile3e', 'profile4e', 'profile5e', 'profile6e']

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const argValue = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined)
const profileType = argValue('--profile-type')
const listName = argValue('--list')
const namesFile = argValue('--names')
const notInName = argValue('--not-in')
if (!listName || !profileType || !PROFILE_TYPES.includes(profileType)) {
  console.error(
    `Usage: --profile-type <${PROFILE_TYPES.join('|')}> --list <army list name> ` +
      '[--names <json file> | --not-in <army list name>] [--no-dry-run]'
  )
  process.exit(1)
}
if (namesFile && notInName) {
  console.error('--names and --not-in are alternatives; pass only one of them.')
  process.exit(1)
}

const client = getCliClient({apiVersion: '2025-01-01'})

type Profile = {_id: string; name: string; category?: string}
type Entry = {_key: string; _type: 'armyListEntry'; profile: {_type: 'reference'; _ref: string}}
type ArmyList = {_id: string; name: string; edition: string; entries?: Entry[]; hasDraft: boolean}

function slug(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The single published army list of this edition with the given name. */
async function fetchList(name: string): Promise<ArmyList> {
  const lists: ArmyList[] = await client.fetch(
    `*[_type == "armyList" && name == $name && edition->profileType == $profileType && !(_id in path("drafts.**"))]{
      _id, name, "edition": edition->name, entries,
      "hasDraft": defined(*[_id == "drafts." + ^._id][0])
    }`,
    {name, profileType}
  )
  if (lists.length !== 1) {
    throw new Error(
      `Expected exactly one published "${name}" army list for ${profileType}, found ${lists.length}: ` +
        lists.map((l) => `${l._id} (${l.edition})`).join(', ')
    )
  }
  return lists[0]
}

const refsOf = (list: ArmyList) => new Set((list.entries ?? []).map((e) => e.profile?._ref))

/** Reads the --names file and resolves each name to exactly one published profile. */
function selectByName(all: Profile[], file: string): Profile[] {
  const raw = JSON.parse(readFileSync(resolve(file), 'utf8'))
  if (!Array.isArray(raw) || !raw.every((n) => typeof n === 'string')) {
    throw new Error(`${file} must contain a JSON array of profile names`)
  }
  const wanted: string[] = raw.map((n: string) => n.trim()).filter(Boolean)
  const duplicates = wanted.filter((n, i) => wanted.indexOf(n) !== i)
  if (duplicates.length) throw new Error(`Duplicate names in ${file}: ${[...new Set(duplicates)].join(', ')}`)

  const byName = new Map<string, Profile[]>()
  for (const p of all) {
    const key = p.name.trim()
    byName.set(key, [...(byName.get(key) ?? []), p])
  }
  const notFound = wanted.filter((n) => !byName.has(n))
  const ambiguous = wanted.filter((n) => (byName.get(n)?.length ?? 0) > 1)
  if (notFound.length || ambiguous.length) {
    throw new Error(
      [
        notFound.length ? `No published ${profileType} named: ${notFound.join(', ')}` : '',
        ambiguous.length ? `More than one ${profileType} named: ${ambiguous.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n')
    )
  }
  return wanted.map((n) => byName.get(n)![0])
}

async function main() {
  const list = await fetchList(listName!)
  if (list.hasDraft) {
    throw new Error(
      `${list._id} has an unpublished draft. Publish or discard it in the Studio first, ` +
        'otherwise publishing the draft later would overwrite the entries added here.'
    )
  }
  const excluded = notInName ? refsOf(await fetchList(notInName)) : new Set<string>()

  const all: Profile[] = await client.fetch(
    `*[_type == $profileType && !(_id in path("drafts.**"))] | order(category asc, name asc){_id, name, category}`,
    {profileType}
  )
  const candidates = namesFile ? selectByName(all, namesFile) : all

  const present = refsOf(list)
  const usedKeys = new Set((list.entries ?? []).map((e) => e._key))
  const toAdd: Entry[] = []
  const alreadyInList: string[] = []
  const inExcludedList: string[] = []
  for (const p of candidates) {
    if (present.has(p._id)) {
      alreadyInList.push(p.name)
      continue
    }
    if (excluded.has(p._id)) {
      inExcludedList.push(p.name)
      continue
    }
    const key = slug(p.name)
    if (usedKeys.has(key)) throw new Error(`Duplicate entry key "${key}" for profile ${p._id} (${p.name})`)
    usedKeys.add(key)
    toAdd.push({_key: key, _type: 'armyListEntry', profile: {_type: 'reference', _ref: p._id}})
  }

  const nameOf = (e: Entry) => candidates.find((p) => p._id === e.profile._ref)
  const label = (p?: Profile) => (p ? `${p.name.trim()} (${p.category ?? 'no category'})` : '?')
  console.log(
    JSON.stringify(
      {
        dryRun,
        profileType,
        list: {id: list._id, name: list.name, edition: list.edition, existingEntries: list.entries?.length ?? 0},
        selection: namesFile ? {names: namesFile} : notInName ? {notIn: notInName} : 'all',
        profilesInEdition: all.length,
        candidates: candidates.length,
        alreadyInList: alreadyInList.length,
        skippedAsInOtherList: inExcludedList.length,
        toAdd: toAdd.length,
        adding: toAdd.map((e) => label(nameOf(e))),
      },
      null,
      2
    )
  )
  if (!toAdd.length) {
    console.log('Nothing to add.')
    return
  }
  if (dryRun) {
    console.log('Dry run: nothing written.')
    return
  }

  await client.patch(list._id).setIfMissing({entries: []}).append('entries', toAdd).commit()
  const count = await client.fetch<number>(`count(*[_id == $id][0].entries)`, {id: list._id})
  console.log(`Added ${toAdd.length} entries to ${list._id}; the list now has ${count}.`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exit(1)
})
