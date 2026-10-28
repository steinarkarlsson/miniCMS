import {defineField, defineType, type ValidationContext} from 'sanity'

export const API_VERSION = '2025-01-01'

/**
 * One document type per edition. Every place that references profiles
 * (figure, armyList, formation) points at this list, so adding an edition is
 * a new schema file plus one entry here plus `profileType` on the edition doc.
 */
export const PROFILE_TYPES = [
  {type: 'profile1e', title: '1st edition'},
  {type: 'profile2e', title: '2nd edition'},
  {type: 'profile3e', title: '3rd edition'},
  {type: 'profile4e', title: '4th edition'},
  {type: 'profile5e', title: '5th edition'},
  {type: 'profile6e', title: '6th edition'},
]

export const profileReferenceTargets = PROFILE_TYPES.map(({type}) => ({type}))

export const HEROIC_TIERS = [
  'Hero of Legend',
  'Hero of Valour',
  'Hero of Fortitude',
  'Minor Hero',
  'Independent Hero',
]

/** Name must be unique within a profile type (and therefore within an edition). */
async function nameIsUniqueWithinType(name: string | undefined, context: ValidationContext) {
  if (!name || !context.document) return true
  const client = context.getClient({apiVersion: API_VERSION})
  const id = context.document._id.replace(/^drafts\./, '')
  const count = await client.fetch<number>(
    `count(*[_type == $type && name == $name && !(_id in [$id, "drafts." + $id])])`,
    {type: context.document._type, name, id}
  )
  return count === 0 ? true : `Another ${context.document._type} document is already named "${name}"`
}

export const heroicValues = defineType({
  name: 'heroicValues',
  title: 'Heroic Values',
  type: 'object',
  options: {columns: 3},
  fields: [
    defineField({name: 'might', title: 'Might', type: 'number'}),
    defineField({name: 'will', title: 'Will', type: 'number'}),
    defineField({name: 'fate', title: 'Fate', type: 'number'}),
  ],
})

export const profileOption = defineType({
  name: 'profileOption',
  title: 'Option',
  type: 'object',
  options: {columns: 2},
  fields: [
    defineField({name: 'name', title: 'Name', type: 'string'}),
    defineField({name: 'points', title: 'Points', type: 'number'}),
  ],
  preview: {
    select: {title: 'name', points: 'points'},
    prepare({title, points}) {
      return {title, subtitle: points != null ? `${points} pts` : undefined}
    },
  },
})

/**
 * One place a profile was published. Most come from a printed book, but some
 * were only ever released online (e.g. a free PDF), so a source is either a
 * reference to a Print document or a title + URL. Profiles hold an array of
 * these since the same profile is often reprinted.
 */
export const profileSource = defineType({
  name: 'profileSource',
  title: 'Source',
  type: 'object',
  fields: [
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      initialValue: 'print',
      options: {
        list: [
          {title: 'Print', value: 'print'},
          {title: 'Online', value: 'online'},
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'print',
      title: 'Print',
      type: 'reference',
      to: [{type: 'print'}],
      hidden: ({parent}) => parent?.kind !== 'print',
      validation: (rule) =>
        rule.custom((value, context) => {
          const kind = (context.parent as {kind?: string} | undefined)?.kind
          return kind === 'print' && !value ? 'Select the print this profile was published in' : true
        }),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      description: 'Name of the online release, e.g. "Legacies PDF"',
      hidden: ({parent}) => parent?.kind !== 'online',
      validation: (rule) =>
        rule.custom((value, context) => {
          const kind = (context.parent as {kind?: string} | undefined)?.kind
          return kind === 'online' && !value ? 'Enter a title for the online source' : true
        }),
    }),
    defineField({
      name: 'url',
      title: 'URL',
      type: 'url',
      hidden: ({parent}) => parent?.kind !== 'online',
      validation: (rule) =>
        rule.uri({scheme: ['http', 'https']}).custom((value, context) => {
          const kind = (context.parent as {kind?: string} | undefined)?.kind
          return kind === 'online' && !value ? 'Enter the URL of the online source' : true
        }),
    }),
    defineField({
      name: 'page',
      title: 'Page',
      type: 'string',
      description: 'Page or section where the profile appears, if known',
    }),
  ],
  preview: {
    select: {kind: 'kind', printName: 'print.mainName', title: 'title', url: 'url', page: 'page'},
    prepare({kind, printName, title, url, page}) {
      const name = kind === 'online' ? title || url : printName
      const parts = [kind === 'online' ? 'Online' : 'Print', page ? `p. ${page}` : undefined]
      return {title: name || 'Source', subtitle: parts.filter(Boolean).join(' · ')}
    },
  },
})

const stringList = (name: string, title: string) =>
  defineField({name, title, type: 'array', of: [{type: 'string'}], fieldset: 'rules'})

/** Fields shared by every edition's profile type. */
export const baseProfileFields = [
  defineField({
    name: 'name',
    title: 'Name',
    type: 'string',
    validation: (rule) => rule.required().custom(nameIsUniqueWithinType),
  }),
  defineField({
    name: 'category',
    title: 'Category',
    type: 'string',
    options: {list: ['Hero', 'Warrior'], layout: 'radio', direction: 'horizontal'},
  }),
  defineField({name: 'points', title: 'Points', type: 'number'}),
  defineField({
    name: 'unique',
    title: 'Unique',
    type: 'boolean',
    description: 'Only one may be taken in an army',
  }),
  defineField({
    name: 'character',
    title: 'Character',
    type: 'reference',
    to: [{type: 'character'}],
    description: 'Set when this profile represents a named character',
  }),
  defineField({
    name: 'basedOn',
    title: 'Based On',
    type: 'reference',
    to: profileReferenceTargets,
    description: 'The same profile in an earlier edition, if it continued from one',
  }),
  defineField({
    name: 'sources',
    title: 'Sources',
    type: 'array',
    of: [{type: 'profileSource'}],
    description: 'Every print or online release this profile was published in',
  }),
  defineField({
    name: 'movement',
    title: 'Movement',
    type: 'number',
    description: 'In inches',
    fieldset: 'stats',
  }),
  defineField({name: 'fightValue', title: 'Fight', type: 'number', fieldset: 'stats'}),
  defineField({
    name: 'shootValue',
    title: 'Shoot',
    type: 'number',
    description: 'The number before the plus, e.g. 3 for 3+',
    fieldset: 'stats',
  }),
  defineField({name: 'strength', title: 'Strength', type: 'number', fieldset: 'stats'}),
  defineField({name: 'defence', title: 'Defence', type: 'number', fieldset: 'stats'}),
  defineField({name: 'attacks', title: 'Attacks', type: 'number', fieldset: 'stats'}),
  defineField({name: 'wounds', title: 'Wounds', type: 'number', fieldset: 'stats'}),
  defineField({name: 'courage', title: 'Courage', type: 'number', fieldset: 'stats'}),
  defineField({name: 'heroicValues', title: 'Heroic Values', type: 'heroicValues'}),
  stringList('heroicActions', 'Heroic Actions'),
  stringList('specialRules', 'Special Rules'),
  stringList('wargear', 'Wargear'),
  stringList('magicalPowers', 'Magical Powers'),
  defineField({
    name: 'options',
    title: 'Options',
    type: 'array',
    of: [{type: 'profileOption'}],
    fieldset: 'rules',
  }),
  defineField({
    name: 'notes',
    title: 'Notes',
    type: 'array',
    of: [{type: 'block'}],
  }),
]

export const baseProfileFieldsets = [
  {name: 'stats', title: 'Stats', options: {columns: 4}},
  {name: 'rules', title: 'Rules', options: {collapsible: true, collapsed: true}},
]

/**
 * Document lists show "edition · category · points". Forms render profiles
 * through ProfilePreview instead, which swaps category for the army lists the
 * profile belongs to; the extra keys returned here are passed on to it.
 */
export function profilePreview(editionTitle: string) {
  return {
    select: {title: 'name', category: 'category', points: 'points'},
    prepare({title, category, points}: {title?: string; category?: string; points?: number}) {
      const parts = [editionTitle, category, points != null ? `${points} pts` : undefined]
      return {title, subtitle: parts.filter(Boolean).join(' · '), editionTitle, points}
    },
  }
}
