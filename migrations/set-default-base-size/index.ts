//@ts-ignore
import {defineMigration, at, patch, set} from 'sanity/migrate'

export default defineMigration({
  title: 'Set default base size to 25mm for figures',
  documentTypes: ['figure'],

  async *migrate(documents, context) {
    let count = 0
    // Process all figure documents
    for await (const figure of documents()) {
      // Only update if baseSize is empty/null/undefined
      if (!figure.baseSize) {
        count++
        console.log(`[${count}] Setting baseSize for figure: ${figure.mainName || figure._id}`)
        yield patch(figure._id, [at('baseSize', set('25mm'))])
      }
    }
    console.log(`Total documents to update: ${count}`)
  },
})
