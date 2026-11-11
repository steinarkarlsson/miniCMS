/**
 * Creates the 4th edition army lists printed on pages 194-195 of "The Hobbit:
 * An Unexpected Journey" and assigns their profiles (see
 * import-auj-4e-profiles.ts).
 *
 *   yarn sanity exec scripts/import-auj-4e-army-lists.ts --with-user-token                 (dry run)
 *   yarn sanity exec scripts/import-auj-4e-army-lists.ts --with-user-token -- --no-dry-run
 *
 * Idempotent: lists are matched by name within the edition and only missing
 * entries are appended, keyed by the profile name slug like the other lists.
 * Mount profiles (Radagast's Sleigh, The White Warg) sit in their rider's
 * list, as the book's own summary on pages 267-268 groups them.
 */
import {randomUUID} from 'node:crypto'
import {getCliClient} from 'sanity/cli'

const EDITION_ID = '186eb0da-dfa8-4138-8bce-d1e7fdbe5c11' // 4th Ed. The Hobbit (2011-2018)
const dryRun = !process.argv.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

const DWARVES = ['Dwalin', 'Balin', 'Bifur', 'Bofur', 'Bombur', 'Ori', 'Nori', 'Dori', 'Oin', 'Gloin', 'Fili', 'Kili']

const LISTS: {name: string; alignment: 'Good' | 'Evil'; profiles: string[]}[] = [
  {
    name: "Thorin's Company",
    alignment: 'Good',
    profiles: ['Thorin Oakenshield', ...DWARVES.map((d) => `${d} the Dwarf`), 'Bilbo Baggins (The Hobbit)', 'Gandalf the Grey'],
  },
  {
    name: "Elrond's Household",
    alignment: 'Good',
    profiles: ['Elrond (The Hobbit)', 'Lindir', 'Rivendell Knight Captain', 'Knight of Rivendell'],
  },
  {
    name: "Radagast's Alliance",
    alignment: 'Good',
    profiles: ['Radagast the Brown', "Radagast's Sleigh", 'Gwaihir', 'Great Eagle'],
  },
  {
    name: 'Army of Thror',
    alignment: 'Good',
    profiles: ['Thror', 'Thrain', 'Thorin Oakenshield', 'Balin the Dwarf', 'Dwalin the Dwarf', 'Captain of Erebor', 'Grim Hammer Captain', 'Warrior of Erebor', 'Grim Hammer'],
  },
  {
    // Already existed with Saruman, Galadriel Protectress and Radagast; the book adds the rest.
    name: 'The White Council',
    alignment: 'Good',
    profiles: ['Galadriel', 'Galadriel, Protectress of Lothlórien', 'Saruman the White', 'Gandalf the Grey', 'Radagast the Brown', 'Elrond (The Hobbit)'],
  },
  {
    name: "Azog's Hunters",
    alignment: 'Evil',
    profiles: ['Azog', 'The White Warg', 'Bolg', 'Fimbul', 'Narzug', 'Hunter Orc Captain', 'Hunter Orc', 'Fell Warg'],
  },
  {
    name: 'Goblin Town',
    alignment: 'Evil',
    profiles: ['The Goblin King', 'Grinnah', 'The Goblin Scribe', 'Gollum (The Hobbit)', 'Goblin Captain', 'Goblin Warrior'],
  },
  {name: 'The Trolls', alignment: 'Evil', profiles: ['William (Bill)', 'Tom', 'Bert']},
]

function slug(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

type Existing = {_id: string; name: string; refs: string[] | null}

async function main() {
  const profiles = await client.fetch<{_id: string; name: string}[]>(
    `*[_type == "profile4e" && !(_id in path("drafts.**"))]{_id, name}`
  )
  const byName = new Map(profiles.map((p) => [p.name, p._id]))
  const existing = await client.fetch<Existing[]>(
    `*[_type == "armyList" && edition._ref == $ed && !(_id in path("drafts.**"))]{_id, name, "refs": entries[].profile._ref}`,
    {ed: EDITION_ID}
  )
  const lists = new Map(existing.map((l) => [l.name, l]))

  const tx = client.transaction()
  let changes = 0
  for (const list of LISTS) {
    const found = lists.get(list.name)
    const entries = list.profiles
      .map((name) => {
        const id = byName.get(name)
        if (!id) throw new Error(`No profile4e named "${name}" (list ${list.name})`)
        return {name, id}
      })
      .filter(({id}) => !found?.refs?.includes(id))
      .map(({name, id}) => ({_key: slug(name), _type: 'armyListEntry', profile: {_type: 'reference', _ref: id}}))
    if (!found) {
      tx.create({
        _id: randomUUID(),
        _type: 'armyList',
        name: list.name,
        edition: {_type: 'reference', _ref: EDITION_ID},
        type: 'standard',
        alignment: list.alignment,
        entries,
      })
      console.log(`create  ${list.name} (${list.alignment}) with ${entries.length} profiles`)
      changes++
    } else if (entries.length) {
      tx.patch(found._id, (p) => p.setIfMissing({entries: []}).append('entries', entries))
      console.log(`append  ${list.name} += ${entries.map((e) => e._key).join(', ')}`)
      changes++
    } else {
      console.log(`ok      ${list.name}`)
    }
  }
  if (dryRun) return console.log('\nDry run: nothing written. Re-run with -- --no-dry-run to apply.')
  if (changes) await tx.commit()
  console.log('\nCommitted.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
