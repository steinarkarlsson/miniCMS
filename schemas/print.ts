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
        list: ['Rulebook', 'Expansion', 'Magazine', 'Catalogue', 'Other'],
      },
    },
  ],
}
