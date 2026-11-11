/**
 * Creates the 4th edition profiles printed in "The Hobbit: An Unexpected
 * Journey" rules manual (2012), pages 168-191, transcribed from the book.
 *
 * Usage (dry run by default, writes nothing):
 *   yarn sanity exec scripts/import-auj-4e-profiles.ts --with-user-token
 *   yarn sanity exec scripts/import-auj-4e-profiles.ts --with-user-token -- --no-dry-run
 *
 * Idempotent: profiles are matched by name within profile4e, so a re-run
 * patches rather than duplicates.
 *  - NEW rows are created (or patched in place if the name already exists).
 *  - REPRINTS are profiles already imported from the LotR sourcebooks whose
 *    stat line and points are the same here; they only gain this book as an
 *    extra source.
 * Only the fields the other 4e profiles carry are filled in: name, category,
 * points, character, sources, stat line and Might/Will/Fate.
 */
import {randomUUID} from 'node:crypto'
import {getCliClient} from 'sanity/cli'

const PRINT_ID = '34311776-9d03-4829-935f-bb04bbcc050b' // The Hobbit: An Unexpected Journey
const TYPE = 'profile4e'

const CHAR: Record<string, string> = {
  Thorin: 'a8a070db-863d-4495-998a-260f1be7bf38',
  Fili: '09feba8d-aecd-4f7e-b747-a3208510bd9b',
  Kili: '84062b63-bd07-4bfa-b225-9b37da8ef083',
  Bifur: '8265aef9-75f7-4f50-b599-45db28840ec2',
  Bofur: '4d511445-bb67-40ed-b92b-76c4518a4ddd',
  Bombur: '3057ab0e-48b3-431c-9f40-e801086c41e0',
  Dwalin: 'd68fc4c8-c352-4393-aba8-0cda36be29b4',
  Balin: '6f38f6e2-d125-4b1c-9b37-648d2198dd92',
  Oin: 'f93ba30a-45ee-4b68-a4bb-eb9b242089bb',
  Gloin: 'db153ddc-9677-411b-97e7-6c1327e6ea39',
  Ori: '55d54166-f9c7-482f-87eb-43dc832cfd22',
  Dori: '528ee9e5-aded-4f76-a925-2b6c0683770e',
  Nori: '7f9d7f9e-2725-4687-a53d-896742d61ea4',
  Elrond: '018c0377-cdf6-4cf0-a34a-29b6e26c38eb',
  Lindir: '87c3be8d-3778-4b43-b4f5-eeae4d9aaf6c',
  Thror: '111a1106-deca-435c-9127-517247a40245',
  Thrain: '25546a77-474f-4639-a5e9-1d3db64cafb8',
  Azog: 'ea1cb489-feaf-4a97-9df8-67361dafbdf7',
  Fimbul: '5e5d3505-0b7f-4e1e-8a70-38fb70d736a7',
  Narzug: 'b52ff164-56d3-4ca4-9b53-235c789bfad3',
  Bolg: 'ed151153-cf86-41d8-8283-5dc7571cb8b6',
  'Bill the Troll': 'd192ab7c-eec6-49ce-a1c8-51195c67a190',
  'Bert the Troll': '0d5e6167-0943-4ccd-9d97-86d7cef16fed',
  'Tom the Troll': 'b25a7100-17bf-4ea7-b37f-dcd7a06f9918',
  'Goblin King': 'c5b93477-114e-46e3-87dd-98d6cda62d3f',
  Grinnah: '9e083916-e0c2-41cd-a83e-53020d1b7ef7',
  'Goblin Scribe': '4c9ec065-b6b2-49f3-9081-ca1ca98b61f4',
  Gollum: '82b90538-5342-4d29-a243-b13897517ac7',
  'The White Warg': 'af7aea09-3069-4adc-b616-f7f66df8be6b',
}

type Row = {
  name: string
  page: string
  category: 'Hero' | 'Warrior'
  points: string
  /** Mv, F, Sh (null when printed as "-"), S, D, A, W, C */
  stats: [number, number, number | null, number, number, number, number, number]
  mwf?: [string, string, string]
  character?: keyof typeof CHAR
  /** Reuse this published id (and drop its draft) instead of minting a new one. */
  id?: string
}

const NEW: Row[] = [
  // Good Heroes
  {name: 'Thorin Oakenshield', page: '168', category: 'Hero', points: '100', stats: [5, 6, 4, 4, 7, 3, 3, 6], mwf: ['3', '3', '3'], character: 'Thorin', id: '9191d4af-95a4-4780-bad0-a0bd3e4caeb6'},
  {name: 'Fili the Dwarf', page: '168', category: 'Hero', points: '55', stats: [5, 5, 3, 4, 5, 2, 2, 5], mwf: ['2', '1', '1'], character: 'Fili'},
  {name: 'Kili the Dwarf', page: '169', category: 'Hero', points: '55', stats: [5, 5, 3, 4, 5, 2, 2, 5], mwf: ['2', '1', '1'], character: 'Kili'},
  {name: 'Bifur the Dwarf', page: '169', category: 'Hero', points: '50', stats: [5, 4, 3, 4, 5, 2, 2, 5], mwf: ['2', '1', '1'], character: 'Bifur'},
  {name: 'Bofur the Dwarf', page: '169', category: 'Hero', points: '50', stats: [5, 4, 4, 4, 5, 2, 2, 5], mwf: ['2', '1', '1'], character: 'Bofur'},
  {name: 'Bombur the Dwarf', page: '170', category: 'Hero', points: '45', stats: [5, 3, 4, 4, 4, 2, 3, 5], mwf: ['2', '1', '1'], character: 'Bombur'},
  {name: 'Dwalin the Dwarf', page: '170', category: 'Hero', points: '95', stats: [5, 6, 4, 5, 6, 3, 2, 6], mwf: ['2', '2', '2'], character: 'Dwalin'},
  {name: 'Balin the Dwarf', page: '170', category: 'Hero', points: '45', stats: [5, 4, 4, 3, 5, 1, 2, 6], mwf: ['1', '3', '2'], character: 'Balin'},
  {name: 'Oin the Dwarf', page: '171', category: 'Hero', points: '45', stats: [5, 4, 4, 4, 4, 1, 2, 6], mwf: ['1', '4', '1'], character: 'Oin'},
  {name: 'Gloin the Dwarf', page: '171', category: 'Hero', points: '85', stats: [5, 6, 4, 4, 7, 3, 2, 6], mwf: ['2', '1', '1'], character: 'Gloin'},
  {name: 'Ori the Dwarf', page: '171', category: 'Hero', points: '40', stats: [5, 3, 3, 3, 4, 1, 2, 5], mwf: ['1', '3', '1'], character: 'Ori'},
  {name: 'Dori the Dwarf', page: '172', category: 'Hero', points: '55', stats: [5, 5, 4, 4, 5, 3, 2, 5], mwf: ['2', '1', '1'], character: 'Dori'},
  {name: 'Nori the Dwarf', page: '172', category: 'Hero', points: '60', stats: [5, 5, 4, 4, 5, 2, 2, 5], mwf: ['2', '1', '1'], character: 'Nori'},
  {name: "Radagast's Sleigh", page: '174', category: 'Warrior', points: '45', stats: [10, 3, 6, 2, 3, 4, 4, 2]},
  // Differs from the Free Peoples "Elrond (LotR)" (170 pts, D7): no heavy armour as standard here.
  {name: 'Elrond (The Hobbit)', page: '176', category: 'Hero', points: '160', stats: [6, 6, 3, 4, 5, 3, 3, 7], mwf: ['3', '3', '3'], character: 'Elrond'},
  {name: 'Lindir', page: '177', category: 'Hero', points: '60', stats: [6, 5, 3, 4, 4, 1, 2, 6], mwf: ['1', '3', '1'], character: 'Lindir'},
  {name: 'Rivendell Knight Captain', page: '177', category: 'Hero', points: '85', stats: [6, 6, 3, 4, 6, 2, 2, 6], mwf: ['2', '1', '1']},
  {name: 'Thror', page: '178', category: 'Hero', points: '140', stats: [5, 6, 4, 4, 8, 3, 3, 6], mwf: ['3', '3', '1'], character: 'Thror'},
  {name: 'Thrain', page: '178', category: 'Hero', points: '140', stats: [5, 6, 4, 4, 8, 3, 3, 6], mwf: ['3', '3', '3'], character: 'Thrain'},
  {name: 'Captain of Erebor', page: '179', category: 'Hero', points: '60', stats: [5, 5, 4, 4, 7, 2, 2, 5], mwf: ['2', '1', '1']},
  {name: 'Grim Hammer Captain', page: '179', category: 'Hero', points: '70', stats: [5, 5, 4, 4, 7, 2, 2, 5], mwf: ['2', '1', '1']},
  // Good Warriors
  {name: 'Knight of Rivendell', page: '182', category: 'Warrior', points: '21', stats: [6, 5, 3, 3, 5, 1, 1, 5]},
  {name: 'Warrior of Erebor', page: '183', category: 'Warrior', points: '8', stats: [5, 4, 4, 3, 6, 1, 1, 4]},
  {name: 'Grim Hammer', page: '183', category: 'Warrior', points: '11', stats: [5, 4, 4, 3, 6, 1, 1, 4]},
  // Evil Heroes
  {name: 'Azog', page: '185', category: 'Hero', points: '175', stats: [6, 7, 5, 5, 5, 3, 3, 5], mwf: ['3', '3', '1'], character: 'Azog'},
  {name: 'The White Warg', page: '185', category: 'Hero', points: '50', stats: [10, 5, 5, 4, 5, 2, 2, 4], mwf: ['3', '1', '1'], character: 'The White Warg'},
  {name: 'Fimbul', page: '185', category: 'Hero', points: '50', stats: [6, 5, 5, 4, 5, 2, 2, 4], mwf: ['3', '1', '1'], character: 'Fimbul'},
  {name: 'Narzug', page: '185', category: 'Hero', points: '50', stats: [6, 4, 4, 4, 5, 2, 2, 4], mwf: ['3', '1', '1'], character: 'Narzug'},
  {name: 'Bolg', page: '186', category: 'Hero', points: '175', stats: [6, 7, 5, 5, 7, 3, 3, 5], mwf: ['3', '3', '1'], character: 'Bolg'},
  {name: 'Hunter Orc Captain', page: '186', category: 'Hero', points: '45', stats: [6, 4, 5, 4, 5, 2, 2, 3], mwf: ['2', '1', '1']},
  {name: 'William (Bill)', page: '187', category: 'Hero', points: '150', stats: [6, 7, 5, 7, 7, 3, 3, 4], mwf: ['3', '1', '1'], character: 'Bill the Troll'},
  {name: 'Bert', page: '187', category: 'Hero', points: '110', stats: [6, 6, 5, 6, 6, 3, 3, 3], mwf: ['1', '3', '1'], character: 'Bert the Troll'},
  {name: 'Tom', page: '188', category: 'Hero', points: '130', stats: [6, 7, 5, 7, 7, 3, 3, 4], mwf: ['2', '1', '1'], character: 'Tom the Troll'},
  {name: 'The Goblin King', page: '188', category: 'Hero', points: '120', stats: [6, 6, 5, 5, 5, 3, 3, 3], mwf: ['3', '2', '1'], character: 'Goblin King'},
  {name: 'Grinnah', page: '189', category: 'Hero', points: '40', stats: [5, 3, 5, 4, 4, 2, 2, 3], mwf: ['3', '1', '1'], character: 'Grinnah'},
  {name: 'The Goblin Scribe', page: '189', category: 'Hero', points: '50', stats: [0, 1, 5, 2, 2, 1, 1, 3], mwf: ['0', '1', '1'], character: 'Goblin Scribe'},
  {name: 'Goblin Captain', page: '189', category: 'Hero', points: '35', stats: [5, 3, 5, 4, 4, 2, 2, 3], mwf: ['2', '1', '1']},
  // Differs from the Mordor "Gollum (LotR)" (0 pts, Mv 6", F4/5+) and from "Sméagol" (F4/4+).
  {name: 'Gollum (The Hobbit)', page: '190', category: 'Hero', points: '35', stats: [5, 5, 4, 4, 4, 2, 2, 4], mwf: ['1', '0', '1'], character: 'Gollum'},
  // Evil Warriors
  {name: 'Goblin Warrior', page: '190', category: 'Warrior', points: '4', stats: [5, 2, 5, 3, 3, 1, 1, 2]},
  {name: 'Fell Warg', page: '191', category: 'Warrior', points: '9', stats: [10, 3, null, 4, 4, 1, 1, 2]},
  {name: 'Hunter Orc', page: '191', category: 'Warrior', points: '8', stats: [6, 3, 5, 4, 4, 1, 1, 2]},
]

/** Same stat line and points as the already-imported profile: add this book as a source. */
const REPRINTS: {name: string; page: string}[] = [
  {name: 'Gandalf the Grey', page: '173'},
  {name: 'Saruman the White', page: '173'},
  {name: 'Radagast the Brown', page: '174'},
  {name: 'Galadriel', page: '176'}, // Will printed as 6 on p176 but 6* in the p267 summary
  {name: 'Gwaihir', page: '182'},
  {name: 'Great Eagle', page: '183'},
  // Already created by hand from the worked example on p167; the real entry is on p172.
  {name: 'Bilbo Baggins (The Hobbit)', page: '167, 172'},
]

// ---------------------------------------------------------------------------

const dryRun = !process.argv.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

const key = () => randomUUID().replace(/-/g, '').slice(0, 12)
const source = (page: string) => ({
  _key: key(),
  _type: 'profileSource',
  kind: 'print',
  page,
  print: {_type: 'reference', _ref: PRINT_ID},
})

type Existing = {
  _id: string
  name: string
  sources?: {_key: string; page?: string; print?: {_ref: string}}[]
}

function fields(row: Row) {
  const [movement, fightValue, shootValue, strength, defence, attacks, wounds, courage] = row.stats
  return {
    name: row.name,
    category: row.category,
    points: row.points,
    movement,
    fightValue,
    ...(shootValue === null ? {} : {shootValue}),
    strength,
    defence,
    attacks,
    wounds,
    courage,
    ...(row.mwf
      ? {heroicValues: {_type: 'heroicValues', might: row.mwf[0], will: row.mwf[1], fate: row.mwf[2]}}
      : {}),
    ...(row.character ? {character: {_type: 'reference', _ref: CHAR[row.character]}} : {}),
  }
}

async function main() {
  const existing = await client.fetch<Existing[]>(`*[_type == $type]{_id, name, sources}`, {type: TYPE})
  const published = new Map(existing.filter((d) => !d._id.startsWith('drafts.')).map((d) => [d.name, d]))
  const drafts = new Map(existing.filter((d) => d._id.startsWith('drafts.')).map((d) => [d._id, d]))

  const missingChars = await client.fetch<string[]>(
    `$ids[!(@ in *[_type == "character"]._id)]`,
    {ids: Object.values(CHAR)}
  )
  if (missingChars.length) throw new Error(`Character ids not found: ${missingChars.join(', ')}`)

  const tx = client.transaction()
  let created = 0
  let patched = 0
  let sourced = 0

  for (const row of NEW) {
    const found = published.get(row.name)
    if (found) {
      const mine = found.sources?.find((s) => s.print?._ref === PRINT_ID)
      const patch = client.patch(found._id).set(fields(row))
      if (row.stats[2] === null) patch.unset(['shootValue'])
      if (mine) patch.set({[`sources[_key=="${mine._key}"].page`]: row.page})
      else patch.setIfMissing({sources: []}).append('sources', [source(row.page)])
      tx.patch(patch)
      patched++
      console.log(`patch   ${row.name} (${found._id})`)
      continue
    }
    const _id = row.id ?? randomUUID()
    tx.create({_id, _type: TYPE, ...fields(row), sources: [source(row.page)]})
    if (row.id && drafts.has(`drafts.${row.id}`)) {
      tx.delete(`drafts.${row.id}`)
      console.log(`create  ${row.name} (${_id}) and drop its half-filled draft`)
    } else {
      console.log(`create  ${row.name} p${row.page} ${row.points} pts`)
    }
    created++
  }

  for (const {name, page} of REPRINTS) {
    const found = published.get(name)
    if (!found) throw new Error(`Expected an existing ${TYPE} named "${name}"`)
    const mine = found.sources?.find((s) => s.print?._ref === PRINT_ID)
    if (mine?.page === page) {
      console.log(`ok      ${name} already lists p${page}`)
      continue
    }
    const patch = client.patch(found._id)
    if (mine) patch.set({[`sources[_key=="${mine._key}"].page`]: page})
    else patch.setIfMissing({sources: []}).append('sources', [source(page)])
    tx.patch(patch)
    sourced++
    console.log(`source  ${name} += p${page}`)
  }

  console.log(`\n${created} to create, ${patched} to patch, ${sourced} to gain a source`)
  if (dryRun) {
    console.log('Dry run: nothing written. Re-run with -- --no-dry-run to apply.')
    return
  }
  await tx.commit()
  console.log('Committed.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
