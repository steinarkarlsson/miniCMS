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
      name: 'faction',
      title: 'Faction',
      type: 'string'
    },
    {
      name: 'image',
      title: 'Image',
      type: 'image'
    },
    {
      name: 'characterName',
      title: 'Character Name',
      type: 'string'
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
      title: 'Material',
      type: 'string',
      options: {
        list: ['Metal', 'Plastic', 'Resin']
      }
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
      name: 'releaseDate',
      title: 'Release Date',
      type: 'date'
    }

  ]
}