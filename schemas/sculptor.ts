export default {
  name: 'sculptor',
  title: 'Sculptor',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Name',
      type: 'string',
      validation: (rule: {required: () => any}) => rule.required(),
    },
  ],
}
