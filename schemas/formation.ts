import {defineField, defineType} from 'sanity'
import {API_VERSION, profileReferenceTargets} from './profiles/baseProfile'

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
      name: 'profiles',
      title: 'Profiles',
      type: 'array',
      of: [{type: 'reference', to: profileReferenceTargets}],
    }),
  ],
  preview: {
    select: {title: 'name', armyList: 'armyList.name', edition: 'armyList.edition.name'},
    prepare({title, armyList, edition}) {
      return {title, subtitle: [armyList, edition].filter(Boolean).join(' · ')}
    },
  },
})
