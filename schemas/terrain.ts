export default {
  name: 'terrain',
  title: 'Terrain',
  type: 'document',
  fields: [
    {
      name: 'mainName',
      title: 'Main Name',
      type: 'string',
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image',
    },
    {
      name: 'gallery',
      title: 'Gallery',
      type: 'gallery',
    },
    {
      title: 'Release Wave',
      name: 'releaseWave',
      type: 'reference',
      to: [{type: 'releaseWave'}],
    },
    {
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
    },
  ],
}
