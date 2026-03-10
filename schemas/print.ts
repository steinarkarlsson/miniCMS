import {baseProductFields} from './baseProduct'

export default {
  name: 'print',
  title: 'Print',
  type: 'document',
  fields: [
    ...baseProductFields,
    {
      name: 'edition',
      title: 'Edition',
      type: 'reference',
      to: [{type: 'edition'}],
    },
    {
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          'Rulebook',
          'Supplement',
          'Compilation',
          'Journeybook',
          'Expansion',
          'Battle Games in Middle-earth',
          'Magazine',
          'Catalogue',
          'Other',
        ],
      },
    },
    {
      name: 'figures',
      title: 'Figures',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{type: 'figure'}],
        },
      ],
    },
  ],
}
