import {defineType} from 'sanity'
import {baseProfileFields, baseProfileFieldsets, profilePreview} from './baseProfile'
import {ProfilePreview} from './ProfilePreview'

export default defineType({
  name: 'profile2e',
  title: 'Profile (2nd edition)',
  type: 'document',
  fieldsets: baseProfileFieldsets,
  fields: [...baseProfileFields],
  preview: profilePreview('2nd edition'),
  components: {preview: ProfilePreview},
})
