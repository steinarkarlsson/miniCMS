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
        list: ['Warrior','Hero']
      }
    },
    // {
    //   name: 'set',
    //   title: 'Set',
    //   type: 'string',
    //   options: {
    //     list: set
    //   }
    // },
    {
      name: 'releaseDate',
      title: 'Release Date',
      type: 'date'
    }

  ]
}