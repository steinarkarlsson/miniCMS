/**
 * Adds 2nd edition profiles to a 2nd edition army list, optionally only those
 * that are not already in another list of the edition.
 *
 *   yarn sanity exec scripts/assign-2e-profiles-to-list.ts --with-user-token -- --list Good                 (dry run)
 *   yarn sanity exec scripts/assign-2e-profiles-to-list.ts --with-user-token -- --list Good --no-dry-run
 *   yarn sanity exec scripts/assign-2e-profiles-to-list.ts --with-user-token -- --list Evil --not-in Good --no-dry-run
 *
 * Idempotent: profiles already in the target list are skipped and existing
 * entries are left untouched, so re-running only appends what is missing.
 * Entries are keyed by the profile name slug, like the ones created by
 * import-profiles.ts. No heroic tier is set, as 2nd edition has none.
 */
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const argValue = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined)
const listName = argValue('--list')
const notInName = argValue('--not-in')
if (!listName) {
  console.error('Usage: --list <army list name> [--not-in <army list name>] [--no-dry-run]')
  process.exit(1)
}

const client = getCliClient({apiVersion: '2025-01-01'})
const PROFILE_TYPE = 'profile2e'

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
    {name, profileType: PROFILE_TYPE}
  )
  if (lists.length !== 1) {
    throw new Error(
      `Expected exactly one published "${name}" army list for ${PROFILE_TYPE}, found ${lists.length}: ` +
        lists.map((l) => `${l._id} (${l.edition})`).join(', ')
    )
  }
  return lists[0]
}

const refsOf = (list: ArmyList) => new Set((list.entries ?? []).map((e) => e.profile?._ref))

async function main() {
  const list = await fetchList(listName!)
  if (list.hasDraft) {
    throw new Error(
      `${list._id} has an unpublished draft. Publish or discard it in the Studio first, ` +
        'otherwise publishing the draft later would overwrite the entries added here.'
    )
  }
  const excluded = notInName ? refsOf(await fetchList(notInName)) : new Set<string>()

  const profiles: Profile[] = await client.fetch(
    `*[_type == $profileType && !(_id in path("drafts.**"))] | order(category asc, name asc){_id, name, category}`,
    {profileType: PROFILE_TYPE}
  )

  const present = refsOf(list)
  const usedKeys = new Set((list.entries ?? []).map((e) => e._key))
  const toAdd: Entry[] = []
  const alreadyInList: string[] = []
  const inExcludedList: string[] = []
  for (const p of profiles) {
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

  console.log(
    JSON.stringify(
      {
        dryRun,
        list: {id: list._id, name: list.name, edition: list.edition, existingEntries: list.entries?.length ?? 0},
        notIn: notInName ?? null,
        profiles: profiles.length,
        alreadyInList: alreadyInList.length,
        skippedAsInOtherList: inExcludedList.length,
        toAdd: toAdd.length,
        adding: toAdd.map((e) => profiles.find((p) => p._id === e.profile._ref)?.name),
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
  console.error(err)
  process.exit(1)
})
