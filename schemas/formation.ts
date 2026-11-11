import {defineField, defineType} from 'sanity'
import {API_VERSION, profileReferenceTargets} from './profiles/baseProfile'

export const FORMATION_KINDS = ['Common Formation', 'Rare Formation', 'Legendary Formation', 'Epic Hero']

/**
 * One headed block of a formation's entry (Wargear, Command, Magic, Special
 * Rules...), kept in printed order. Priced lists under the heading go in
 * `options`.
 */
export const formationSection = defineType({
  name: 'formationSection',
  title: 'Section',
  type: 'object',
  fields: [
    defineField({name: 'heading', title: 'Heading', type: 'string'}),
    defineField({name: 'text', title: 'Text', type: 'text', rows: 4}),
    defineField({name: 'options', title: 'Options', type: 'array', of: [{type: 'profileOption'}]}),
  ],
  preview: {
    select: {title: 'heading', subtitle: 'text'},
  },
})

export default defineType({
  name: 'formation',
  title: 'Formation',
  type: 'document',
  description: 'A unit-level grouping of profiles inside an army list (3rd edition)',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'armyList',
      title: 'Army List',
      type: 'reference',
      to: [{type: 'armyList'}],
      validation: (rule) =>
        rule.required().custom(async (ref, context) => {
          const listId = (ref as {_ref?: string} | undefined)?._ref
          if (!listId) return true
          const client = context.getClient({apiVersion: API_VERSION})
          const edition = await client.fetch<{name?: string; usesFormations?: boolean} | null>(
            `*[_type == "armyList" && _id == $listId][0].edition->{name, usesFormations}`,
            {listId}
          )
          if (!edition || edition.usesFormations) return true
          return `${edition.name ?? "This list's edition"} does not use formations`
        }),
    }),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {list: FORMATION_KINDS},
    }),
    defineField({
      name: 'points',
      title: 'Points',
      type: 'string',
      description: 'As printed, e.g. "15 points per company" or "110 points + 60 per company"',
    }),
    defineField({
      name: 'size',
      title: 'Size',
      type: 'string',
      description: 'As printed, e.g. "One to six companies." or "Single model."',
    }),
    defineField({
      name: 'sources',
      title: 'Sources',
      type: 'array',
      of: [{type: 'profileSource'}],
    }),
    defineField({
      name: 'profiles',
      title: 'Profiles',
      type: 'array',
      of: [{type: 'reference', to: profileReferenceTargets}],
    }),
    defineField({
      name: 'specialRules',
      title: 'Special Rules',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Names only; the full text is in the sections below',
    }),
    defineField({
      name: 'epicActions',
      title: 'Epic Actions',
      type: 'array',
      of: [{type: 'string'}],
    }),
    defineField({
      name: 'sections',
      title: 'Sections',
      type: 'array',
      of: [{type: 'formationSection'}],
      description: 'The entry as printed: Wargear, Command, Magic, Special Rules...',
    }),
  ],
  preview: {
    select: {title: 'name', armyList: 'armyList.name', kind: 'kind', points: 'points'},
    prepare({title, armyList, kind, points}) {
      return {title, subtitle: [armyList, kind, points].filter(Boolean).join(' · ')}
    },
  },
})
