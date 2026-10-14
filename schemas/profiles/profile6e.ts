import {defineField, defineType} from 'sanity'
import {BASE_SIZES} from '../baseSizes'
import {baseProfileFields, baseProfileFieldsets, profilePreview} from './baseProfile'
import {ProfilePreview} from './ProfilePreview'

export const UNIT_TYPES_6E = [
  'Infantry',
  'Cavalry',
  'Monster',
  'Beast',
  'War Beast',
  'Swarm',
  'Chariot',
  'Siege Engine',
  'Small Siege Engine',
  'Siege Weapon',
  'Elite',
  'Unique',
]

const stats = baseProfileFields.findIndex((f) => f.name === 'heroicValues')

export default defineType({
  name: 'profile6e',
  title: 'Profile (6th edition)',
  type: 'document',
  fieldsets: baseProfileFieldsets,
  fields: [
    ...baseProfileFields.slice(0, stats),
    defineField({name: 'intelligence', title: 'Intelligence', type: 'number', fieldset: 'stats'}),
    ...baseProfileFields.slice(stats),
    defineField({
      name: 'race',
      title: 'Race',
      type: 'array',
      of: [{type: 'reference', to: [{type: 'race'}]}],
    }),
    defineField({
      name: 'factionKeywords',
      title: 'Faction Keywords',
      type: 'array',
      of: [{type: 'string'}],
      description: 'The Faction keyword printed on the profile, e.g. Gondor',
    }),
    defineField({
      name: 'unitType',
      title: 'Unit Type',
      type: 'array',
      of: [{type: 'string'}],
      options: {list: UNIT_TYPES_6E},
    }),
    defineField({
      name: 'baseSize',
      title: 'Base Size',
      type: 'string',
      options: {list: BASE_SIZES},
    }),
    defineField({
      name: 'legacy',
      title: 'Legacy',
      type: 'boolean',
      description: 'Only available through the Legacies PDF',
    }),
  ],
  preview: profilePreview('6th edition'),
  components: {preview: ProfilePreview},
})
