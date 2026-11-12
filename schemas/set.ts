import {baseProductFields} from './baseProduct'

export default {
  name: 'set',
  title: 'Set',
  type: 'document',
  fields: [
    ...baseProductFields,
    {
      name: 'contentType',
      title: 'Contents',
      type: 'string',
      description:
        'Whether this set introduced new products, or only repackages products that were already available in other sets.',
      options: {
        list: [
          {title: 'New (contains products first released in this set)', value: 'new'},
          {title: 'Repackaging (only previously released products)', value: 'repackaging'},
        ],
        layout: 'radio',
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
    {
      name: 'print',
      title: 'Print',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{type: 'print'}],
        },
      ],
    },
    {
      name: 'terrain',
      title: 'Terrain',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{type: 'terrain'}],
        },
      ],
    },
    {
      name: 'accessories',
      title: 'Accessories',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [{type: 'accessory'}],
        },
      ],
    },
    {
      title: 'Packaging',
      name: 'packaging',
      type: 'reference',
      to: [{type: 'packaging'}],
    },
  ],
}
