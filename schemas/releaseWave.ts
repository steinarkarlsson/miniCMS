export default {
  name: 'releaseWave',
  title: 'Release Wave',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule: {required: () => any}) => rule.required(),
    },
    {
      name: 'releaseDate',
      title: 'Release Date',
      type: 'date',
    },
    {
      name: 'edition',
      title: 'Edition',
      type: 'reference',
      to: [{type: 'edition'}],
    },
  ],
}
