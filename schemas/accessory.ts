export default {
  name: 'accessory',
  title: 'Accessory',
  type: 'document',
  fields: [
    {
      name: 'mainName',
      title: 'Main Name',
      type: 'string'
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image'
    },
    {
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [{type: 'block'}]
    },
    {
      title: 'Release Wave',
      name: 'releaseWave',
      type: 'reference',
      to: [
        {type: 'releaseWave'}
      ]
    },
    {
      name: 'featured',
      title: 'Featured',
      type: 'boolean'
    },

  ]
}