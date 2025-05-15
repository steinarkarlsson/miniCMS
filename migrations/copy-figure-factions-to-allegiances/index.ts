//@ts-nocheck
import {at, defineMigration, patch, set} from 'sanity/migrate'
export default defineMigration({
  title: 'Copy figure factions to allegiances',
  documentTypes: ['figure'],

  async *migrate(documents, context) {
    // Get all factions and allegiances to build a mapping
    const factions = (await context.client.fetch('*[_type == "faction"]{_id, name}')) || []
    const allegiances = (await context.client.fetch('*[_type == "allegiance"]{_id, name}')) || []
    console.log('factions found: ', factions.length)
    console.log('allegiances found: ', allegiances.length)
    // Create mapping from faction name to allegiance ID
    const factionToAllegianceMap = new Map()

    for (const faction of factions) {
      if (faction && faction._id && faction.name) {
        const matchingAllegiance = allegiances.find((a) => a && a.name === faction.name)
        if (matchingAllegiance && matchingAllegiance._id) {
          factionToAllegianceMap.set(faction._id, matchingAllegiance._id)
        }
      }
    }
    console.log('Map created with entries: ', factionToAllegianceMap.size)

    // Process all figure documents
    for await (const figure of documents()) {
      // Skip if figure has no factions

      if (!figure.faction) {
        continue
      }

      // Build array of allegiance references based on matching faction names
      const allegianceRefs = figure.faction
        .filter(
          (factionRef) =>
            factionRef && factionRef._ref && factionToAllegianceMap.has(factionRef._ref)
        )
        .map((factionRef) => ({
          _type: 'reference',
          _ref: factionToAllegianceMap.get(factionRef._ref),
        }))
      console.log(
        'Processing figure: ',
        figure.mainName,
        ' - Adding allegiances: ',
        allegianceRefs.length
      )

      yield patch(figure._id, [at('allegiance', set(allegianceRefs))])
    }
  },
})
