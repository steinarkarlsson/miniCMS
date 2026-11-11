/**
 * Links the 4th edition profiles from "The Hobbit: An Unexpected Journey"
 * (see import-auj-4e-profiles.ts) to the figures in the release wave
 * "An Unexpected Journey (2012)".
 *
 *   yarn sanity exec scripts/assign-auj-4e-profiles-by-wave.ts --with-user-token                 (dry run)
 *   yarn sanity exec scripts/assign-auj-4e-profiles-by-wave.ts --with-user-token -- --no-dry-run
 *
 * Figures are matched by mainName through RULES (first match wins). A figure
 * that matches no rule is reported and left alone. Links a figure already has
 * are skipped, so re-running is a no-op. Published and draft figures are both
 * patched.
 */
import {randomUUID} from 'node:crypto'
import {getCliClient} from 'sanity/cli'

const WAVE_ID = '31aa61af-91f4-4367-bed2-6ef124da7e8f' // An Unexpected Journey (2012)
const dryRun = !process.argv.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

/** mainName pattern -> 4th edition profile name(s). [] = deliberately no profile from this book. */
const RULES: [RegExp, string[]][] = [
  // Thorin's Company
  [/^Thorin Oakenshield \(Goblin Town\)$/, ['Thorin Oakenshield']],
  // Decided 2026-11-11: the Young figures wait for a book with their own profiles.
  [/^Young (Thorin Oakenshield|Balin the Dwarf|Dwalin the Dwarf)$/, []],
  [/^F[ií]li the Dwarf/, ['Fili the Dwarf']],
  [/^K[ií]li the Dwarf/, ['Kili the Dwarf']],
  [/^[OÓ]in the Dwarf/, ['Oin the Dwarf']],
  [/^Gl[oó]in the Dwarf/, ['Gloin the Dwarf']],
  [/^(Balin|Bifur|Bofur|Bombur|Dwalin|Dori|Nori|Ori) the Dwarf/, ['$1 the Dwarf']],
  [/^Bilbo Baggins/, ['Bilbo Baggins (The Hobbit)']],
  [/^Gandalf the Grey/, ['Gandalf the Grey']],
  // White Council, Rivendell, Radagast's Alliance
  [/^Saruman the White/, ['Saruman the White']],
  [/^Galadriel/, ['Galadriel']],
  [/^Elrond/, ['Elrond (The Hobbit)']],
  [/^Lindir$/, ['Lindir']],
  [/^Rivendell Knight \d+$/, ['Knight of Rivendell']],
  [/^Radagast the Brown on Sleigh$/, ['Radagast the Brown', "Radagast's Sleigh"]],
  [/^Radagast the Brown/, ['Radagast the Brown']],
  [/^Gwaihir$/, ['Gwaihir']],
  [/^Great Eagle \d+$/, ['Great Eagle']],
  // Army of Thror
  [/^Thror$/, ['Thror']],
  [/^Thr[aá]in$/, ['Thrain']],
  [/^Captain of Erebor$/, ['Captain of Erebor']],
  [/^Grim Hammer Captain$/, ['Grim Hammer Captain']],
  [/^Grim Hammer \d+$/, ['Grim Hammer']],
  [/^Warrior of Erebor \d+$/, ['Warrior of Erebor']],
  // Azog's Hunters
  [/^Fimbul/, ['Fimbul']],
  [/^Narzug$/, ['Narzug']],
  // Decided 2026-11-11: the 2012 book presents this miniature as Bolg (p186).
  [/^The Keeper of the Dungeons \/ Bolg$/, ['Bolg']],
  [/^Hunter Orc( on Fell Warg)? \d+$/, ['Hunter Orc']],
  [/^Fell Warg \d+$/, ['Fell Warg']],
  // The Trolls, Goblin Town
  [/^Bill the Troll$/, ['William (Bill)']],
  [/^Bert the Troll$/, ['Bert']],
  [/^Tom the Troll$/, ['Tom']],
  [/^The Goblin King/, ['The Goblin King']],
  [/^Grinnah the Goblin$/, ['Grinnah']],
  [/^The Goblin Scribe$/, ['The Goblin Scribe']],
  [/^Goblin Town Captain \d+$/, ['Goblin Captain']],
  [/^Goblin Town Warrior \d+$/, ['Goblin Warrior']],
  [/^Gollum/, ['Gollum (The Hobbit)']],
  // No profile in this book: first printed in later 4th edition books.
  [/^Yazneg/, []],
  [/^(Captain|Warrior) of Dale \d+$/, []],
]

type Figure = {_id: string; mainName: string; refs: string[] | null}

async function main() {
  const profiles = await client.fetch<{_id: string; name: string}[]>(
    `*[_type == "profile4e" && !(_id in path("drafts.**"))]{_id, name}`
  )
  const byName = new Map(profiles.map((p) => [p.name, p._id]))
  const figures = await client.fetch<Figure[]>(
    `*[_type == "figure" && releaseWave._ref == $wave] | order(mainName){_id, mainName, "refs": profiles[]._ref}`,
    {wave: WAVE_ID}
  )

  const tx = client.transaction()
  const counts = new Map<string, number>()
  const unmatched: string[] = []
  let patched = 0

  for (const fig of figures) {
    let names: string[] | undefined
    for (const [re, targets] of RULES) {
      const m = fig.mainName.match(re)
      if (m) {
        names = targets.map((t) => t.replace('$1', m[1] ?? ''))
        break
      }
    }
    if (!names) {
      unmatched.push(fig.mainName)
      continue
    }
    const add: {_key: string; _type: 'reference'; _ref: string}[] = []
    for (const name of names) {
      const id = byName.get(name)
      if (!id) throw new Error(`No profile4e named "${name}" (figure ${fig.mainName})`)
      if (fig.refs?.includes(id)) continue
      add.push({_key: randomUUID().replace(/-/g, '').slice(0, 12), _type: 'reference', _ref: id})
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    if (!add.length) continue
    tx.patch(fig._id, (p) => p.setIfMissing({profiles: []}).append('profiles', add))
    patched++
  }

  for (const [name, n] of [...counts].sort()) console.log(`${String(n).padStart(3)}  ${name}`)
  console.log(`\n${patched} of ${figures.length} figure documents to patch`)
  if (unmatched.length) console.log(`\nNo rule:\n  ${unmatched.join('\n  ')}`)
  if (dryRun) return console.log('\nDry run: nothing written. Re-run with -- --no-dry-run to apply.')
  if (patched) await tx.commit()
  console.log('\nCommitted.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
