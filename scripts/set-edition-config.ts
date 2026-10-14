/**
 * One-off: records which army list kinds each edition has and whether it uses
 * formations. Run with: npx sanity exec scripts/set-edition-config.ts --with-user-token
 */
import {getCliClient} from 'sanity/cli'

const client = getCliClient({apiVersion: '2025-01-01'})

const CONFIG: Record<string, {armyListTypes: string[]; usesFormations: boolean}> = {
  'd54830b2-e4ff-42e3-bde6-e9bc85531a52': {armyListTypes: ['standard'], usesFormations: false}, // 2nd
  'b0b076d4-cc91-4a1a-8258-d9547a53807b': {armyListTypes: ['standard', 'battlehost'], usesFormations: true}, // 3rd
  '44d6cc91-8994-4b07-b465-ffb211f5521f': {armyListTypes: ['standard', 'legendaryLegion'], usesFormations: false}, // 5th
  'eb900e72-1095-4f60-a4f8-0f54db4002cb': {armyListTypes: ['standard'], usesFormations: false}, // 6th
}

async function main() {
  let tx = client.transaction()
  for (const [id, config] of Object.entries(CONFIG)) tx = tx.patch(id, (p) => p.set(config))
  await tx.commit()
  const editions = await client.fetch(`*[_type == "edition"] | order(releaseDate asc){name, profileType, armyListTypes, usesFormations}`)
  console.log(JSON.stringify(editions, null, 2))
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
