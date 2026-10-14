import {defineType} from 'sanity'
import {baseProfileFields, baseProfileFieldsets, profilePreview} from './baseProfile'
import {ProfilePreview} from './ProfilePreview'

export default defineType({
  name: 'profile1e',
  title: 'Profile (1st edition)',
  type: 'document',
  fieldsets: baseProfileFieldsets,
  fields: [...baseProfileFields],
  preview: profilePreview('1st edition'),
  components: {preview: ProfilePreview},
})
