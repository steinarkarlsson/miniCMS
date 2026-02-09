#!/usr/bin/env node

/**
 * Script to update status field to 'Released' for all figures without a status
 *
 * Usage:
 *   1. Get your auth token from: https://sanity.io/manage/personal/tokens
 *   2. Run: SANITY_AUTH_TOKEN=your_token node set-default-status.js
 */

const config = {
  projectId: '4llymfg7',
  dataset: 'production',
  useCdn: false,
  token: process.env.SANITY_AUTH_TOKEN,
  apiVersion: '2024-01-01',
}

async function setDefaultStatus() {
  if (!config.token) {
    console.error('Error: SANITY_AUTH_TOKEN environment variable is required')
    console.error('Get your token from: https://sanity.io/manage/personal/tokens')
    console.error('Then run: SANITY_AUTH_TOKEN=your_token node set-default-status.js')
    process.exit(1)
  }

  // Import the client from the sanity package
  const {createClient} = require('@sanity/client')
  const client = createClient(config)

  try {
    console.log('\nFetching figures without status...')

    // Fetch all figures without a status set
    const figures = await client.fetch(
      `*[_type == "figure" && !defined(status)]{_id, mainName}`
    )

    console.log(`Found ${figures.length} figures without status\n`)

    if (figures.length === 0) {
      console.log('No figures to update. All done!')
      return
    }

    // Show which figures will be updated
    console.log('The following figures will have their status set to "Released":')
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
          .set({status: 'Released'})
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

setDefaultStatus()
