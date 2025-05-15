export default {
  name: 'figure',
  title: 'Figure',
  type: 'document',
  fields: [
    {
      name: 'mainName',
      title: 'Main Name',
      type: 'string',
    },
    {
      name: 'allegiance',
      title: 'Allegiance',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{type: 'allegiance'}],
        },
      ],
    },
    {
      name: 'armyList',
      title: 'Army List',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{type: 'armyList'}],
        },
      ],
    },
    {
      title: 'Faction',
      name: 'faction',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{type: 'faction'}],
        },
      ],
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
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {
        list: ['Warrior', 'Hero'],
      },
    },
    {
      name: 'material',
      type: 'array',
      of: [
        {
          type: 'string',
          options: {
            list: ['metal', 'plastic', 'resin'],
          },
        },
      ],
    },
    {
      title: 'Character',
      name: 'character',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{type: 'character'}],
        },
      ],
    },
    {
      title: 'Release Wave',
      name: 'releaseWave',
      type: 'reference',
      to: [{type: 'releaseWave'}],
    },
    {
      name: 'baseSize',
      title: 'Base Size',
      type: 'string',
      options: {
        list: ['25mm', '40mm', '60mm'],
      },
    },
    {
      title: 'Race',
      name: 'race',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{type: 'race'}],
        },
      ],
    },
    {
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [{type: 'block'}],
    },
    {
      name: 'alias',
      title: 'Alias',
      type: 'string',
    },
    {
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
    },
  ],
}
