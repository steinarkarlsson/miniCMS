// Base product fields that are common across all product types
// Used by: figure, set, terrain, accessory, print
export const baseProductFields = [
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
    title: 'Release Wave',
    name: 'releaseWave',
    type: 'reference',
    to: [{type: 'releaseWave'}],
  },
  {
    name: 'references',
    title: 'References',
    type: 'references',
  },
  {
    name: 'featured',
    title: 'Featured',
    type: 'boolean',
  },
  {
    title: 'Release Date',
    name: 'releaseDate',
    type: 'date',
    description: 'The original release date',
  },
  {
    name: 'description',
    title: 'Description',
    type: 'array',
    of: [{type: 'block'}],
  },
  {
    name: 'status',
    title: 'Status',
    type: 'string',
    options: {
      list: ['Released', 'Unreleased', 'Announced'],
    },
  },
]