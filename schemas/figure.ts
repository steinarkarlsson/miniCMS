import {baseProductFields} from './baseProduct'
import {BASE_SIZES} from './baseSizes'
import {profileReferenceTargets} from './profiles/baseProfile'

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
      name: 'profiles',
      title: 'Profiles',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: profileReferenceTargets,
        },
      ],
      description: 'The game profiles this miniature represents, across all editions',
    },
    {
      name: 'armyList',
      title: 'Army List (legacy)',
      type: 'array',
      readOnly: true,
      description:
        'Superseded by Profiles. Kept read-only until every figure is linked to its profiles.',
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
      options: {list: BASE_SIZES},
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
