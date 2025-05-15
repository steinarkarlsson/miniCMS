//@ts-ignore
import {createOrReplace, defineMigration} from 'sanity/migrate'

export default defineMigration({
  title: 'Copy factions to allegiances',
  documentTypes: ['faction'],
  migrate: {
    document(doc) {
      // Create a new allegiance document with the same content as the faction
      const newDoc = {
        _type: 'allegiance',
        name: doc.name,
        alignment: doc.alignment,
        icon: doc.icon,
      }

      // Return a single operation or use a transaction
      return createOrReplace(newDoc)
      // Note: The original document is preserved by default
    },
  },
})
