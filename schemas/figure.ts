import {baseProductFields} from './baseProduct'

export default {
  name: 'figure',
  title: 'Figure',
  type: 'document',
  fields: [
    ...baseProductFields,
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
      name: 'baseSize',
      title: 'Base Size',
      type: 'string',
      options: {
        list: ['25mm', '40mm', '60mm', '80mm'],
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
      name: 'officialDescription',
      title: 'Official Description',
      type: 'array',
      of: [{type: 'block'}],
    },
    {
      name: 'alias',
      title: 'Alias',
      type: 'string',
    },
    {
      name: 'sculptor',
      title: 'Sculptor',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{type: 'sculptor'}],
        },
      ],
    },
  ],
}
