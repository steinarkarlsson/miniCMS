import {defineField, defineType, type Reference} from 'sanity'
import {API_VERSION, HEROIC_TIERS, profileReferenceTargets} from './profiles/baseProfile'
import {ARMY_LIST_TYPES} from './armyListTypes'

export {ARMY_LIST_TYPES}

/** One profile's membership of an army list, with the values that depend on the list. */
export const armyListEntry = defineType({
  name: 'armyListEntry',
  title: 'Army List Entry',
  type: 'object',
  fields: [
    defineField({
      name: 'profile',
      title: 'Profile',
      type: 'reference',
      to: profileReferenceTargets,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'heroicTier',
      title: 'Heroic Tier',
      type: 'string',
      options: {list: HEROIC_TIERS},
      description: 'Heroes only. A hero can have a different tier in different lists.',
    }),
  ],
  preview: {
    select: {title: 'profile.name', category: 'profile.category', heroicTier: 'heroicTier'},
    prepare({title, category, heroicTier}) {
      return {title, subtitle: heroicTier || category}
    },
  },
})

type Entry = {profile?: Reference}

export default defineType({
  name: 'armyList',
  title: 'Army List',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'edition',
      title: 'Edition',
      type: 'reference',
      to: [{type: 'edition'}],
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {list: ARMY_LIST_TYPES, layout: 'radio', direction: 'horizontal'},
      initialValue: 'standard',
      validation: (rule) =>
        rule.required().custom(async (type, context) => {
          const editionId = (context.document?.edition as Reference | undefined)?._ref
          if (!type || !editionId) return true
          const client = context.getClient({apiVersion: API_VERSION})
          const edition = await client.fetch<{name?: string; armyListTypes?: string[]}>(
            `*[_type == "edition" && _id == $editionId][0]{name, armyListTypes}`,
            {editionId}
          )
          if (!edition?.armyListTypes?.length || edition.armyListTypes.includes(type)) return true
          const title = ARMY_LIST_TYPES.find((t) => t.value === type)?.title ?? type
          return `${edition.name ?? 'This edition'} has no ${title}s`
        }),
    }),
    defineField({
      name: 'alignment',
      title: 'Alignment',
      type: 'string',
      options: {list: ['Good', 'Evil']},
    }),
    defineField({
      name: 'legacy',
      title: 'Legacy',
      type: 'boolean',
      description: 'Only available through the Legacies PDF',
    }),
    defineField({
      name: 'icon',
      title: 'Icon',
      type: 'image',
    }),
    defineField({
      name: 'parentArmyList',
      title: 'Parent Army List',
      type: 'reference',
      to: [{type: 'armyList'}],
      description: 'The standard list this is a variant of',
      hidden: ({document}) => document?.type === 'standard',
    }),
    defineField({
      name: 'entries',
      title: 'Profiles',
      type: 'array',
      of: [{type: 'armyListEntry'}],
      description:
        'Profiles that can be taken in this list. Leave empty for editions that use formations.',
      validation: (rule) =>
        rule.custom(async (entries: Entry[] | undefined, context) => {
          const editionId = (context.document?.edition as Reference | undefined)?._ref
          const ids = (entries ?? []).map((e) => e.profile?._ref).filter(Boolean)
          if (!ids.length || !editionId) return true
          const client = context.getClient({apiVersion: API_VERSION})
          const result = await client.fetch<{profileType?: string; mismatched: string[]}>(
            `*[_type == "edition" && _id == $editionId][0]{
              profileType,
              "mismatched": *[_id in $ids && _type != ^.profileType].name
            }`,
            {editionId, ids}
          )
          if (!result?.profileType || result.mismatched.length === 0) return true
          return `These profiles are not from this list's edition: ${result.mismatched.join(', ')}`
        }),
    }),
  ],
  preview: {
    select: {title: 'name', type: 'type', edition: 'edition.name', media: 'icon'},
    prepare({title, type, edition, media}) {
      const typeTitle = ARMY_LIST_TYPES.find((t) => t.value === type)?.title
      return {title, subtitle: [edition, typeTitle].filter(Boolean).join(' · '), media}
    },
  },
})
