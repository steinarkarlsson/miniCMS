import {defineField, defineType} from 'sanity'
import {baseProfileFields, baseProfileFieldsets, profilePreview} from './baseProfile'
import {ProfilePreview} from './ProfilePreview'

/** Unit types printed in the TYPE column of War of the Ring stat lines. */
export const UNIT_TYPES_3E = ['Infantry', 'Cavalry', 'Monster', 'Flying Monster', 'Hero']

/**
 * War of the Ring stat lines read RACE TYPE M F S D A R C Mt. Fight and Shoot
 * are printed together in the F column ("4/4+"), Might goes in Heroic Values,
 * and the points cost belongs to the formation rather than the stat line
 * (only single-model entries such as Epic Heroes carry points here).
 */
const warOfTheRingFields = [
  defineField({
    name: 'race',
    title: 'Race',
    type: 'string',
    description: 'As printed in the RACE column, e.g. Man, Orc, Spirit',
    fieldset: 'stats',
  }),
  defineField({
    name: 'unitType',
    title: 'Type',
    type: 'string',
    options: {list: UNIT_TYPES_3E},
    fieldset: 'stats',
  }),
  defineField({
    name: 'defenceBracketed',
    title: 'Defence (bracketed)',
    type: 'number',
    description: 'The value in brackets when Defence is printed as e.g. 5(7)',
    fieldset: 'stats',
  }),
  defineField({name: 'resilience', title: 'Resilience', type: 'number', fieldset: 'stats'}),
]

export default defineType({
  name: 'profile3e',
  title: 'Profile (3rd edition)',
  type: 'document',
  fieldsets: baseProfileFieldsets,
  fields: [...baseProfileFields, ...warOfTheRingFields],
  preview: profilePreview('3rd edition'),
  components: {preview: ProfilePreview},
})
