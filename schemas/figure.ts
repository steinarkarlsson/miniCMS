export default {
  name: 'figure',
  title: 'Figure',
  type: 'document',
  fields: [
    {
      name: 'mainName',
      title: 'Main Name',
      type: 'string'
    },
    {
      title: 'Faction',
      name: 'faction',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [
            {type: 'faction'}
          ]
        }
      ]
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image'
    },
    {
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {
        list: ['Warrior', 'Hero']
      }
    },
    {
      name: 'material',
      type: 'array',
      of: [
        {
          type: 'string',
          options: {
            list: ['metal', 'plastic', 'resin']
          }
        }
      ]
    },
    {
      title: 'Character',
      name: 'character',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [
            {type: 'character'}
          ]
        }
      ]
    },
    {
      title: 'Release Wave',
      name: 'releaseWave',
      type: 'reference',
      to: [
        {type: 'releaseWave'}
      ]
    }
  ]
}