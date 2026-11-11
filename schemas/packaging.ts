// A packaging document describes a reusable packaging *format*: the physical container and
// its size. It is deliberately not one document per printed box —
// set-specific artwork is recorded by photographing the box in the set's own gallery.

const packagingTypes = [
  {title: 'Cardboard box', value: 'box'},
  {title: 'Blister pack (card back, sealed plastic blister)', value: 'blister'},
  {title: 'Clamshell (plastic shell with insert card)', value: 'clamshell'},
  {title: 'Bag', value: 'bag'},
  {title: 'Other', value: 'other'},
]

type Dimensions = {width?: number; height?: number; depth?: number; unit?: string}

const formatDimensions = (dimensions?: Dimensions) => {
  const sizes = [dimensions?.width, dimensions?.height, dimensions?.depth].filter(
    (size) => typeof size === 'number'
  )
  if (sizes.length === 0) return undefined
  return `${sizes.join(' × ')} ${dimensions?.unit ?? 'in'}`
}

const positive = (rule: {positive: () => any}) => rule.positive()

export default {
  name: 'packaging',
  title: 'Packaging',
  type: 'document',
  fields: [
    {
      name: 'name',
      title: 'Name',
      type: 'string',
      description: 'E.g. "Cardboard box 12×6×2 in"',
      validation: (rule: {required: () => any}) => rule.required(),
    },
    {
      name: 'packagingType',
      title: 'Type',
      type: 'string',
      options: {list: packagingTypes},
    },
    {
      name: 'dimensions',
      title: 'Dimensions',
      type: 'object',
      options: {columns: 4},
      fields: [
        {name: 'width', title: 'Width', type: 'number', validation: positive},
        {name: 'height', title: 'Height', type: 'number', validation: positive},
        {name: 'depth', title: 'Depth', type: 'number', validation: positive},
        {
          name: 'unit',
          title: 'Unit',
          type: 'string',
          options: {
            list: [
              {title: 'Inches', value: 'in'},
              {title: 'Millimetres', value: 'mm'},
            ],
          },
          initialValue: 'in',
        },
      ],
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
      of: [
        {
          type: 'block',
        },
      ],
    },
  ],
  preview: {
    select: {
      title: 'name',
      packagingType: 'packagingType',
      dimensions: 'dimensions',
      media: 'image',
    },
    prepare({
      title,
      packagingType,
      dimensions,
      media,
    }: {
      title?: string
      packagingType?: string
      dimensions?: Dimensions
      media?: unknown
    }) {
      const typeTitle = packagingTypes.find((type) => type.value === packagingType)?.title
      const subtitle = [typeTitle?.split(' (')[0], formatDimensions(dimensions)]
        .filter(Boolean)
        .join(' · ')
      return {title, subtitle, media}
    },
  },
}
