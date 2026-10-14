import {defineType} from 'sanity'
import {baseProfileFields, baseProfileFieldsets, profilePreview} from './baseProfile'
import {ProfilePreview} from './ProfilePreview'

export default defineType({
  name: 'profile3e',
  title: 'Profile (3rd edition)',
  type: 'document',
  fieldsets: baseProfileFieldsets,
  fields: [...baseProfileFields],
  preview: profilePreview('3rd edition'),
  components: {preview: ProfilePreview},
})
