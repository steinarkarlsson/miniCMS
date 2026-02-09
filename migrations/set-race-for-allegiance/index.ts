//@ts-nocheck
import {defineMigration, set, patch, at} from 'sanity/migrate'

// ============================================
// CONFIGURATION - Edit these values as needed
// ============================================
const ALLEGIANCE_NAME = 'Númenor' // The allegiance to filter by
const RACE_NAME = 'Man'                 // The race to set for matching figures
// ============================================

export default defineMigration({
  title: `Set race to "${RACE_NAME}" for figures with "${ALLEGIANCE_NAME}" allegiance`,
  documentTypes: ['figure'],

  async *migrate(documents, context) {
    // Fetch all allegiances and races to build mappings
    const allegiances = (await context.client.fetch('*[_type == "allegiance"]{_id, name}')) || []
    const races = (await context.client.fetch('*[_type == "race"]{_id, name}')) || []

    console.log('Allegiances found:', allegiances.length)
    console.log('Races found:', races.length)

    // Find the target allegiance
    const targetAllegiance = allegiances.find(
      (a) => a && a.name && a.name.toLowerCase() === ALLEGIANCE_NAME.toLowerCase()
    )

    if (!targetAllegiance) {
      console.log(`Warning: "${ALLEGIANCE_NAME}" allegiance not found`)
      return
    }

    console.log(`Found "${ALLEGIANCE_NAME}" allegiance:`, targetAllegiance._id)

    // Find the target race
    const targetRace = races.find((r) => r && r.name && r.name.toLowerCase() === RACE_NAME.toLowerCase())

    if (!targetRace) {
      console.log(`Warning: "${RACE_NAME}" race not found`)
      return
    }

    console.log(`Found "${RACE_NAME}" race:`, targetRace._id)

    // Process all figure documents
    for await (const figure of documents()) {
      // Skip if figure already has a race set
      if (figure.race && figure.race.length > 0) {
        continue
      }

      // Skip if figure has no allegiances
      if (!figure.allegiance || figure.allegiance.length === 0) {
        continue
      }

      // Check if figure has the target allegiance
      const hasTargetAllegiance = figure.allegiance.some(
        (allegianceRef) =>
          allegianceRef && allegianceRef._ref === targetAllegiance._id
      )

      if (hasTargetAllegiance) {
        console.log(
          `Setting race to "${RACE_NAME}" for figure:`,
          figure.mainName || figure._id
        )

        yield patch(
          figure._id,
          set([{_type: 'reference', _ref: targetRace._id}], at('race'))
        )
      }
    }

    console.log('Migration completed')
  },
})
