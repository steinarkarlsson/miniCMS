export default {
  name: 'set',
  title: 'Set',
  type: 'document',
  fields: [
    {
      name: 'mainName',
      title: 'Main Name',
      type: 'string'
    },
    {
      name: 'figures',
      title: 'Figures',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [
            {type: 'figure'},
          ]
        }
      ]
    },
    {
      name: 'print',
      title: 'Print',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [
            {type: 'print'},
          ]
        }
      ]
    },
    {
      name: 'terrain',
      title: 'Terrain',
      type: 'array',
      of: [
        {
          type: 'reference',
          to: [
            {type: 'terrain'},
          ]
        }
      ]
    },
    {
      name: 'description',
      title: 'Description',
      type: 'array',
      of: [{type: 'block'}]
    },
  ]
}