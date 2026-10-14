import {defineMigration, at, patch, setIfMissing} from 'sanity/migrate'

// "6th Ed. War of the Rohirrim (2024-current)"
const SIXTH_EDITION_ID = 'eb900e72-1095-4f60-a4f8-0f54db4002cb'

export default defineMigration({
  title: 'Stamp existing army lists as 6th edition, type standard',
  documentTypes: ['armyList'],

  async *migrate(documents) {
    let count = 0
    for await (const armyList of documents()) {
      if (armyList.edition && armyList.type) continue
      count++
      console.log(`[${count}] ${armyList.name || armyList._id}`)
      yield patch(armyList._id, [
        at('edition', setIfMissing({_type: 'reference', _ref: SIXTH_EDITION_ID})),
        at('type', setIfMissing('standard')),
      ])
    }
    console.log(`Army lists patched: ${count}`)
  },
})
