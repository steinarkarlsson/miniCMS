#!/usr/bin/env node

/**
 * Script to set race for figures based on their allegiance
 *
 * Usage:
 *   1. Get your auth token from: https://sanity.io/manage/personal/tokens
 *   2. Edit ALLEGIANCE_NAME and RACE_NAME below
 *   3. Run: SANITY_AUTH_TOKEN=your_token node set-race-for-allegiance.js
 */

// ============================================
// CONFIGURATION - Edit these values as needed
// ============================================
const ALLEGIANCE_NAME = 'The Fellowship' // The allegiance to filter by
const RACE_NAME = 'Dwarf'                 // The race to set for matching figures
// ============================================

const config = {
  projectId: '4llymfg7',
  dataset: 'production',
  useCdn: false,
  token: process.env.SANITY_AUTH_TOKEN,
  apiVersion: '2024-01-01',
}

async function setRaceForAllegiance() {
  if (!config.token) {
    console.error('Error: SANITY_AUTH_TOKEN environment variable is required')
    console.error('Get your token from: https://sanity.io/manage/personal/tokens')
    console.error('Then run: SANITY_AUTH_TOKEN=your_token node set-race-for-allegiance.js')
    process.exit(1)
  }

  // Import the client from the sanity package
  const {createClient} = require('@sanity/client')
  const client = createClient(config)

  try {
    console.log(`\nConfiguration:`)
    console.log(`  Allegiance: "${ALLEGIANCE_NAME}"`)
    console.log(`  Race: "${RACE_NAME}"\n`)

    // Fetch allegiances and races
    console.log('Fetching allegiances and races...')
    const allegiances = await client.fetch('*[_type == "allegiance"]{_id, name}')
    const races = await client.fetch('*[_type == "race"]{_id, name}')

    console.log(`Found ${allegiances.length} allegiances`)
    console.log(`Found ${races.length} races\n`)

    // Find the target allegiance
    const targetAllegiance = allegiances.find(
      (a) => a && a.name && a.name.toLowerCase() === ALLEGIANCE_NAME.toLowerCase()
    )

    if (!targetAllegiance) {
      console.error(`Error: "${ALLEGIANCE_NAME}" allegiance not found`)
      console.log('\nAvailable allegiances:')
      allegiances.forEach(a => console.log(`  - ${a.name}`))
      process.exit(1)
    }

    console.log(`✓ Found "${ALLEGIANCE_NAME}" allegiance (ID: ${targetAllegiance._id})`)

    // Find the target race
    const targetRace = races.find(
      (r) => r && r.name && r.name.toLowerCase() === RACE_NAME.toLowerCase()
    )

    if (!targetRace) {
      console.error(`Error: "${RACE_NAME}" race not found`)
      console.log('\nAvailable races:')
      races.forEach(r => console.log(`  - ${r.name}`))
      process.exit(1)
    }

    console.log(`✓ Found "${RACE_NAME}" race (ID: ${targetRace._id})\n`)

    // Fetch figures that match the criteria:
    // - Has the target allegiance
    // - Does NOT have a race already set (or has empty race array)
    const query = `*[_type == "figure" 
      && references($allegianceId)
      && (!defined(race) || count(race) == 0)
    ]{_id, mainName, allegiance}`

    console.log('Fetching figures that need updating...')
    const figures = await client.fetch(query, {
      allegianceId: targetAllegiance._id
    })

    console.log(`Found ${figures.length} figures with "${ALLEGIANCE_NAME}" allegiance and no race set\n`)

    if (figures.length === 0) {
      console.log('No figures to update. All done!')
      return
    }

    // Show which figures will be updated
    console.log('The following figures will have their race set to "' + RACE_NAME + '":')
    figures.forEach((fig, idx) => {
      console.log(`  ${idx + 1}. ${fig.mainName || fig._id}`)
    })
    console.log('\nStarting updates...\n')

    // Update each figure
    let successCount = 0
    let errorCount = 0

    for (const figure of figures) {
      try {
        await client
          .patch(figure._id)
          .set({
            race: [
              {
                _type: 'reference',
                _ref: targetRace._id,
                _key: `race-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
              }
            ]
          })
          .commit()

        successCount++
        console.log(`✓ [${successCount}/${figures.length}] Updated: ${figure.mainName || figure._id}`)
      } catch (error) {
        errorCount++
        console.error(`✗ Failed to update ${figure._id}:`, error.message)
      }
    }

    console.log(`\n✅ Migration complete!`)
    console.log(`   Success: ${successCount}`)
    console.log(`   Errors: ${errorCount}`)
  } catch (error) {
    console.error('Error running migration:', error)
    process.exit(1)
  }
}

setRaceForAllegiance()
