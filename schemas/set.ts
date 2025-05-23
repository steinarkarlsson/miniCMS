export default {
  name: 'set',
  title: 'Set',
  type: 'document',
  fields: [
    {
      name: 'mainName',
      title: 'Main Name',
      type: 'string',
      validation: (rule: {required: () => any}) => rule.required(),
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
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [{type: 'block'}],
    },
    {
      title: 'Release Wave',
      name: 'releaseWave',
      type: 'reference',
      to: [{type: 'releaseWave'}],
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
      title: 'Packaging',
      name: 'packaging',
      type: 'reference',
      to: [{type: 'packaging'}],
    },
    {
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
    },
  ],
}
