import {defineConfig, isDev} from 'sanity'
import {visionTool} from '@sanity/vision'
import {structureTool} from 'sanity/structure'
import {schemaTypes} from './schemas'
import {armyListTemplate, structure} from './structure'
import {getStartedPlugin} from './plugins/sanity-plugin-tutorial'

const devOnlyPlugins = [getStartedPlugin()]

export default defineConfig({
  name: 'default',
  title: 'deeppink-okapi',

  projectId: '4llymfg7',
  dataset: 'production',

  plugins: [structureTool({structure}), visionTool(undefined), ...(isDev ? devOnlyPlugins : [])],

  schema: {
    types: schemaTypes,
    templates: (prev) => [...prev, armyListTemplate],
  },
})
