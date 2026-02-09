import {createClient} from '@sanity/client'

const client = createClient({
  projectId: '4llymfg7',
  dataset: 'production',
  useCdn: false,
  token: process.env.SANITY_AUTH_TOKEN, // You'll need to set this
  apiVersion: '2024-01-01',
})

async function updateBaseSize() {
  // Fetch all figures without a baseSize
  const figures = await client.fetch(
    `*[_type == "figure" && !defined(baseSize)]{_id, mainName}`
  )

  console.log(`Found ${figures.length} figures without baseSize`)

  if (figures.length === 0) {
    console.log('No figures to update')
    return
  }

  // Update each figure
  for (const figure of figures) {
    console.log(`Updating ${figure.mainName || figure._id}...`)

    try {
      await client
        .patch(figure._id)
        .set({baseSize: '25mm'})
        .commit()

      console.log(`✓ Updated ${figure.mainName || figure._id}`)
    } catch (error) {
      console.error(`✗ Failed to update ${figure._id}:`, error)
    }
  }

  console.log('Migration complete!')
}

updateBaseSize().catch(console.error)
