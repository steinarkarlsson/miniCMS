import {defineField, defineType} from 'sanity'
import {baseProfileFields, baseProfileFieldsets, profilePreview} from './baseProfile'
import {ProfilePreview} from './ProfilePreview'

export default defineType({
  name: 'profile5e',
  title: 'Profile (5th edition)',
  type: 'document',
  fieldsets: baseProfileFieldsets,
  fields: [
    ...baseProfileFields,
    defineField({
      name: 'keywords',
      title: 'Keywords',
      type: 'array',
      of: [{type: 'string'}],
      description: 'Race, faction and unit type keywords as printed on the profile',
    }),
  ],
  preview: profilePreview('5th edition'),
  components: {preview: ProfilePreview},
})
