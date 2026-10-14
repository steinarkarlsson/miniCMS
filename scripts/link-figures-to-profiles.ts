/**
 * Proposes and writes figure -> profile links.
 *
 *   npx sanity exec scripts/link-figures-to-profiles.ts --with-user-token            (dry run)
 *   npx sanity exec scripts/link-figures-to-profiles.ts --with-user-token -- --no-dry-run
 *
 * Rules, applied per figure against the candidate profiles (profiles that sit
 * in one of the figure's legacy army lists when it has any, otherwise every
 * profile of the edition):
 *   exact      figure name (minus sculpt number, parentheses, mount) equals the profile name
 *   character  the figure's character's first name is the profile name's first word, and
 *              exactly one candidate profile qualifies
 *   prefix     the profile name is a leading phrase of the figure name (e.g. "Warrior of
 *              Minas Tirith" for "Warrior of Minas Tirith with shield 3"); longest wins
 * A 6th edition match is carried to the 5th edition profile of the same name when one exists.
 * Figures that already have profiles are left untouched. Everything else is reported.
 */
import fs from 'node:fs'
import path from 'node:path'
import {getCliClient} from 'sanity/cli'

const args = process.argv.slice(2)
const dryRun = !args.includes('--no-dry-run')
const client = getCliClient({apiVersion: '2025-01-01'})

const MOUNT_WORDS =
  /\b(on foot|mounted|on (armoured |armored |war )?(horse|warg|shadowfax|fell beast|eagle|pony|great eagle|bear|wolf|mumak|ass))\b/g

function strip(s: string) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
function words(s: string) {
  return strip(s)
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}
/** Figure name -> comparable phrase: no sculpt number, parentheses or mount suffix. */
function figureKey(name: string) {
  const base = strip(name)
    .replace(/\([^)]*\)/g, ' ')
    .replace(MOUNT_WORDS, ' ')
    .replace(/\s+\d+\s*$/, ' ')
  return words(base).join(' ')
}
const profileKey = (name: string) => words(name).join(' ')
const STOPWORDS = new Set(['the', 'of', 'a', 'an'])
const firstWord = (name: string) => words(name.replace(/\([^)]*\)/g, ' ')).find((w) => !STOPWORDS.has(w)) ?? ''
/** Words that may legitimately follow a profile name on a figure: wargear, mounts, roles. */
const QUALIFIERS = new Set([
  'with', 'and', 'shield', 'shields', 'spear', 'spears', 'bow', 'bows', 'sword', 'swords', 'axe', 'axes',
  'hammer', 'banner', 'bearer', 'horn', 'warhorn', 'war', 'spearman', 'swordsman', 'bowman', 'archer',
  'mace', 'pike', 'lance', 'crossbow', 'whip', 'mattock', 'halberd', 'warrior', 'warriors', 'armour',
  'armoured', 'armor', 'armored', 'heavy', 'light', 'on', 'foot', 'mounted', 'horse', 'warg', 'fell', 'pony',
  'throwing', 'weapons', 'weapon', 'two', 'handed', 'hand', 'glaive', 'javelin', 'javelins', 'club',
])
/** Comparable bag of significant words, so "Rohan Warrior" and "Warrior of Rohan" agree. */
const wordBag = (key: string) =>
  key.split(' ').filter((w) => !STOPWORDS.has(w)).sort().join(' ')

type Profile = {_id: string; _type: string; name: string; category?: string; listNames: string[]}
type Figure = {
  _id: string
  mainName: string
  type?: string
  characters?: string[]
  legacyLists?: string[]
  profiles?: {_ref: string}[]
}
type Match = {profile: Profile; rule: string}

function listKey(name: string) {
  return words(name.replace(/\bthe\b/gi, ' ')).join(' ')
}

function findMatch(figure: Figure, candidates: Profile[]): Match | {ambiguous: Profile[]} | null {
  const key = figureKey(figure.mainName)
  const exact = candidates.filter((p) => profileKey(p.name) === key)
  if (exact.length === 1) return {profile: exact[0], rule: 'exact'}
  if (exact.length > 1) return {ambiguous: exact}

  for (const character of figure.characters ?? []) {
    const first = firstWord(character)
    if (!first) continue
    const byCharacter = candidates.filter((p) => firstWord(p.name) === first)
    if (byCharacter.length === 1) return {profile: byCharacter[0], rule: 'character'}
    if (byCharacter.length > 1) {
      // prefer the one whose full name is a prefix of the figure key, e.g. "Aragorn (Strider)"
      const narrowed = byCharacter.filter((p) => key.startsWith(profileKey(p.name)))
      if (narrowed.length === 1) return {profile: narrowed[0], rule: 'character+prefix'}
      return {ambiguous: byCharacter}
    }
  }

  const prefixed = candidates
    .filter((p) => {
      const pk = profileKey(p.name)
      if (pk.length < 4 || !key.startsWith(pk + ' ')) return false
      const remainder = key.slice(pk.length + 1).split(' ')
      return remainder.every((w) => QUALIFIERS.has(w))
    })
    .sort((a, b) => profileKey(b.name).length - profileKey(a.name).length)
  if (prefixed.length) {
    const longest = profileKey(prefixed[0].name).length
    const top = prefixed.filter((p) => profileKey(p.name).length === longest)
    if (top.length === 1) return {profile: top[0], rule: 'prefix'}
    return {ambiguous: top}
  }

  const bag = wordBag(key)
  const bagged = candidates.filter((p) => {
    const pb = wordBag(profileKey(p.name))
    return pb === bag || pb === wordBag(key + ' warrior') || bag === wordBag(profileKey(p.name) + ' warrior')
  })
  if (bagged.length === 1) return {profile: bagged[0], rule: 'wordset'}
  if (bagged.length > 1) return {ambiguous: bagged}
  return null
}

/**
 * Ambiguous options that are all the same profile name extended with a
 * qualifier ("Ori the Dwarf" / "Ori the Dwarf, Champion of Erebor") are the
 * same person in different lists, so the figure represents all of them.
 */
function sameNameVariants(options: Profile[]): Profile[] | null {
  const keys = options.map((p) => profileKey(p.name)).sort((a, b) => a.length - b.length)
  const shortest = keys[0]
  return keys.every((k) => k === shortest || k.startsWith(shortest + ' ')) ? options : null
}

async function main() {
  const figures: Figure[] = await client.fetch(`*[_type == "figure"]{
    _id, mainName, type, "characters": character[]->name, "legacyLists": armyList[]->name, profiles
  }`)
  const profiles: Profile[] = await client.fetch(`*[_type in ["profile5e", "profile6e"]]{
    _id, _type, name, category, "listNames": *[_type == "armyList" && references(^._id)].name
  }`)
  const byType = (t: string) => profiles.filter((p) => p._type === t)
  const p6 = byType('profile6e')
  const p5 = byType('profile5e')
  const p5ByKey = new Map<string, Profile[]>()
  for (const p of p5) p5ByKey.set(profileKey(p.name), [...(p5ByKey.get(profileKey(p.name)) ?? []), p])

  const candidatesFor = (figure: Figure, pool: Profile[]) => {
    const lists = new Set((figure.legacyLists ?? []).map(listKey))
    if (!lists.size) return pool
    const inLists = pool.filter((p) => p.listNames.some((n) => lists.has(listKey(n))))
    return inLists.length ? inLists : pool
  }

  const linked: {figure: string; profiles: string[]; rules: string[]; scope: string}[] = []
  const ambiguous: {figure: string; options: string[]}[] = []
  const unmatched: string[] = []
  const skipped: string[] = []
  const mutations: {id: string; refs: string[]}[] = []
  const ruleCount: Record<string, number> = {}

  for (const figure of figures) {
    if (figure.profiles?.length) {
      skipped.push(figure.mainName)
      continue
    }
    const refs: string[] = []
    const rules: string[] = []
    const scope = figure.legacyLists?.length ? 'lists' : 'all'

    const resolve = (m: ReturnType<typeof findMatch>): Match[] | 'ambiguous' | null => {
      if (!m) return null
      if (!('ambiguous' in m)) return [m]
      const variants = sameNameVariants(m.ambiguous)
      return variants ? variants.map((profile) => ({profile, rule: 'variants'})) : 'ambiguous'
    }
    const m6 = resolve(findMatch(figure, candidatesFor(figure, p6)))
    if (m6 === 'ambiguous') {
      const options = (findMatch(figure, candidatesFor(figure, p6)) as {ambiguous: Profile[]}).ambiguous
      ambiguous.push({figure: figure.mainName, options: options.map((p) => p.name)})
      continue
    }
    for (const m of m6 ?? []) {
      refs.push(m.profile._id)
      rules.push(`6e:${m.rule}`)
      const same5 = p5ByKey.get(profileKey(m.profile.name)) ?? []
      if (same5.length === 1 && !refs.includes(same5[0]._id)) {
        refs.push(same5[0]._id)
        rules.push('5e:same-name')
      }
    }
    if (!refs.some((r) => r.startsWith('profile5e'))) {
      const raw5 = findMatch(figure, candidatesFor(figure, p5))
      const m5 = resolve(raw5)
      // With a 6th edition match in hand only accept a confident 5th edition match
      const confident = (rule: string) => !refs.length || ['exact', 'character', 'variants'].includes(rule)
      if (Array.isArray(m5) && m5.every((m) => confident(m.rule))) {
        for (const m of m5) {
          refs.push(m.profile._id)
          rules.push(`5e:${m.rule}`)
        }
      } else if (m5 === 'ambiguous' && !refs.length) {
        ambiguous.push({figure: figure.mainName, options: (raw5 as {ambiguous: Profile[]}).ambiguous.map((p) => p.name)})
        continue
      }
    }
    if (!refs.length) {
      unmatched.push(figure.mainName)
      continue
    }
    for (const r of rules) ruleCount[r] = (ruleCount[r] ?? 0) + 1
    linked.push({figure: figure.mainName, profiles: refs, rules, scope})
    mutations.push({id: figure._id, refs})
  }

  const report = {
    dryRun,
    figures: figures.length,
    linked: linked.length,
    linkedWithLegacyLists: linked.filter((l) => l.scope === 'lists').length,
    ambiguous: ambiguous.length,
    unmatched: unmatched.length,
    skippedAlreadyLinked: skipped.length,
    rules: ruleCount,
    ambiguousDetail: ambiguous,
    unmatchedDetail: unmatched,
    linkedDetail: linked,
  }
  const reportPath = path.resolve('data/link-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
  const {ambiguousDetail, unmatchedDetail, linkedDetail, ...summary} = report
  console.log(JSON.stringify(summary, null, 2))
  console.log(`Report written to ${reportPath}`)
  if (dryRun) {
    console.log('Dry run: nothing written.')
    return
  }
  const BATCH = 100
  for (let i = 0; i < mutations.length; i += BATCH) {
    let tx = client.transaction()
    for (const m of mutations.slice(i, i + BATCH)) {
      tx = tx.patch(m.id, (p) =>
        p.set({profiles: m.refs.map((_ref) => ({_type: 'reference', _ref, _key: _ref}))})
      )
    }
    await tx.commit()
    console.log(`Committed ${Math.min(i + BATCH, mutations.length)}/${mutations.length}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
