/**
 * Product detail query for a single figure.
 *
 * Every array is wrapped in coalesce(..., []) because Sanity stores an emptied
 * array field sometimes as [] and sometimes as absent. A figure with no profile
 * in an edition simply has no entry for it; nothing is null-checked downstream.
 *
 * Legendary Legions and Battlehosts are army lists with a different `type`, so
 * the page filters `armyLists[].type` to render them under their own headings.
 */
export const figureDetailQuery = /* groq */ `
*[_type == "figure" && _id == $id][0]{
  _id,
  mainName,
  "factions": coalesce(faction[]->{_id, name}, []),
  "allegiances": coalesce(allegiance[]->{_id, name}, []),
  "profiles": coalesce(profiles[]->{
    _id,
    _type,
    name,
    category,
    points,
    "edition": *[_type == "edition" && profileType == ^._type][0]{_id, name},
    "armyLists": *[_type == "armyList" && references(^._id)]{
      _id, name, type, legacy, "edition": edition->{_id, name},
      "heroicTier": entries[profile._ref == ^.^._id][0].heroicTier
    },
    "formations": *[_type == "formation" && references(^._id)]{
      _id, name,
      "armyList": armyList->{_id, name, type, "edition": edition->{_id, name}}
    }
  }, [])
}
`
