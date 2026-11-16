// An update post: site news shown on the "Updates" feed of the frontend
// (/updates), newest first. A post is live as soon as it is published here;
// the frontend is told by the same webhook as for every other document.

type Rule = {required: () => any; max: (n: number) => any; uri: (options: object) => any}

const imageFields = [
  {
    name: 'alt',
    title: 'Alternative text',
    type: 'string',
    description: 'Describes the image for screen readers and search engines.',
  },
]

export default {
  name: 'post',
  title: 'Update post',
  type: 'document',
  fields: [
    {
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule: Rule) => rule.required(),
    },
    {
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      description: 'The address of the post: /updates/<slug>. Changing it later breaks existing links.',
      options: {source: 'title', maxLength: 96},
      validation: (rule: Rule) => rule.required(),
    },
    {
      name: 'publishedAt',
      title: 'Date',
      type: 'datetime',
      description:
        'Shown on the post and used to sort the feed. It does not schedule anything: the post is visible as soon as it is published.',
      initialValue: () => new Date().toISOString(),
      validation: (rule: Rule) => rule.required(),
    },
    {
      name: 'author',
      title: 'Author',
      type: 'object',
      description:
        'Shown on the post. Filled in from your Sanity account when the post is created; both fields can be changed.',
      // Sanity does not expose who created or published a document to the
      // public API, so the name and photo are copied into the post itself.
      initialValue: (_params: unknown, context: {currentUser: {name?: string; profileImage?: string} | null}) => {
        const user = context.currentUser
        if (!user?.name) return undefined
        return user.profileImage ? {name: user.name, photo: user.profileImage} : {name: user.name}
      },
      fields: [
        {name: 'name', title: 'Name', type: 'string'},
        {
          name: 'photo',
          title: 'Photo',
          type: 'url',
          description: 'Address of a profile picture. Leave empty to show the name only.',
        },
      ],
    },
    {
      name: 'summary',
      title: 'Summary',
      type: 'text',
      rows: 3,
      description:
        'Optional. With a summary the feed shows it with a "Read more" link; without one the feed shows the whole post. Use it for long posts.',
      validation: (rule: Rule) => rule.max(300),
    },
    {
      name: 'image',
      title: 'Cover image',
      type: 'image',
      options: {hotspot: true},
      fields: imageFields,
    },
    {
      name: 'body',
      title: 'Body',
      type: 'array',
      of: [
        {
          type: 'block',
          styles: [
            {title: 'Normal', value: 'normal'},
            {title: 'Heading', value: 'h2'},
            {title: 'Subheading', value: 'h3'},
            {title: 'Quote', value: 'blockquote'},
          ],
          marks: {
            decorators: [
              {title: 'Strong', value: 'strong'},
              {title: 'Emphasis', value: 'em'},
            ],
            annotations: [
              {
                name: 'link',
                title: 'Link',
                type: 'object',
                fields: [
                  {
                    name: 'href',
                    title: 'URL',
                    type: 'url',
                    description: 'A full address, or a path on the site such as /miniatures/abc123.',
                    validation: (rule: Rule) =>
                      rule.uri({allowRelative: true, scheme: ['http', 'https', 'mailto']}),
                  },
                ],
              },
            ],
          },
        },
        {
          type: 'image',
          options: {hotspot: true},
          fields: [
            ...imageFields,
            {name: 'caption', title: 'Caption', type: 'string'},
          ],
        },
      ],
      validation: (rule: Rule) => rule.required(),
    },
  ],
  orderings: [
    {
      title: 'Date, newest first',
      name: 'publishedAtDesc',
      by: [{field: 'publishedAt', direction: 'desc'}],
    },
  ],
  preview: {
    select: {title: 'title', publishedAt: 'publishedAt', media: 'image'},
    prepare: ({title, publishedAt, media}: {title?: string; publishedAt?: string; media?: unknown}) => ({
      title,
      subtitle: publishedAt ? publishedAt.slice(0, 10) : 'No date',
      media,
    }),
  },
}
