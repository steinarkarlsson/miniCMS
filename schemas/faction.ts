export default {
  name: 'faction',
  title: 'Faction',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Name',
      type: 'string'
    },
    {
      name: 'alignment',
      title: 'Alignment',
      type: 'string',
      options: {
        list: ['Good', 'Evil']
      }
    },
    {
      name: 'icon',
      title: 'Icon',
      type: 'image',
    }
  ]
}