export default {
  name: 'print',
  title: 'Print',
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
      name: 'edition',
      title: 'Edition',
      type: 'reference',
      to: [{type: 'edition'}],
    },
    {
      name: 'featured',
      title: 'Featured',
      type: 'boolean',
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
