import {defineType} from 'sanity'
import {baseProfileFields, baseProfileFieldsets, profilePreview} from './baseProfile'
import {ProfilePreview} from './ProfilePreview'

export default defineType({
  name: 'profile4e',
  title: 'Profile (4th edition)',
  type: 'document',
  fieldsets: baseProfileFieldsets,
  fields: [...baseProfileFields],
  preview: profilePreview('4th edition'),
  components: {preview: ProfilePreview},
})
