import type {StructureResolver} from 'sanity/structure'
import type {Template} from 'sanity'
import {ARMY_LIST_TYPES} from './schemas/armyListTypes'
import {API_VERSION} from './schemas/profiles/baseProfile'
import {PROFILE_TYPES} from './schemas/profiles/baseProfile'

const PRODUCT_TYPES = ['figure', 'set', 'terrain', 'print', 'accessory']
const GAME_TYPES = ['armyList', 'formation', 'edition', ...PROFILE_TYPES.map((p) => p.type)]

/** Pre-fills edition and type when creating an army list from a filtered list. */
export const armyListTemplate: Template = {
  id: 'armyList-for-edition',
  title: 'Army list',
  schemaType: 'armyList',
  parameters: [
    {name: 'editionId', type: 'string'},
    {name: 'type', type: 'string'},
  ],
  value: ({editionId, type}: {editionId: string; type: string}) => ({
    edition: {_type: 'reference', _ref: editionId},
    type,
  }),
}

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Content')
    .items([
      ...PRODUCT_TYPES.map((type) => S.documentTypeListItem(type)),
      S.divider(),
      S.listItem()
        .title('Army Lists')
        .child(
          S.documentTypeList('edition')
            .title('Army Lists by Edition')
            .child(async (editionId, context) => {
              const client = context.structureContext.getClient({apiVersion: API_VERSION})
              const allowed: string[] | null = await client.fetch(
                `*[_type == "edition" && _id == $editionId][0].armyListTypes`,
                {editionId}
              )
              const types = allowed?.length
                ? ARMY_LIST_TYPES.filter((t) => allowed.includes(t.value))
                : ARMY_LIST_TYPES
              return S.list()
                .title('Army Lists')
                .items(
                  types.map(({value, title}) =>
                    S.listItem()
                      .title(`${title}s`)
                      .child(
                        S.documentList()
                          .title(`${title}s`)
                          .schemaType('armyList')
                          .filter('_type == "armyList" && edition._ref == $editionId && type == $type')
                          .params({editionId, type: value})
                          .initialValueTemplates([
                            S.initialValueTemplateItem(armyListTemplate.id, {editionId, type: value}),
                          ])
                      )
                  )
                )
            })
        ),
      S.listItem()
        .title('Profiles')
        .child(
          S.list()
            .title('Profiles by Edition')
            .items(
              PROFILE_TYPES.map(({type, title}) => S.documentTypeListItem(type).title(title))
            )
        ),
      S.documentTypeListItem('formation'),
      S.documentTypeListItem('edition'),
      S.divider(),
      ...S.documentTypeListItems().filter(
        (item) => !PRODUCT_TYPES.includes(item.getId() ?? '') && !GAME_TYPES.includes(item.getId() ?? '')
      ),
    ])
