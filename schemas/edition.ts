import {defineField, defineType} from 'sanity'
import {PROFILE_TYPES} from './profiles/baseProfile'
import {ARMY_LIST_TYPES} from './armyListTypes'

export default defineType({
  name: 'edition',
  title: 'Edition',
  type: 'document',
  fields: [
    defineField({
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'releaseDate',
      title: 'Release Date',
      type: 'date',
    }),
    defineField({
      name: 'profileType',
      title: 'Profile Type',
      type: 'string',
      description: 'The profile document type used by this edition',
      options: {list: PROFILE_TYPES.map(({type, title}) => ({value: type, title}))},
    }),
    defineField({
      name: 'armyListTypes',
      title: 'Army List Types',
      type: 'array',
      of: [{type: 'string'}],
      options: {list: ARMY_LIST_TYPES},
      description: 'Kinds of army list this edition has. Leave empty to allow any.',
    }),
    defineField({
      name: 'usesFormations',
      title: 'Uses Formations',
      type: 'boolean',
      description: 'Army lists in this edition are built from formations',
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [{type: 'block'}],
    }),
  ],
})
