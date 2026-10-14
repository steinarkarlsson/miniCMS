import {useEffect, useState} from 'react'
import {useClient, type PreviewProps, type SanityClient} from 'sanity'
import {API_VERSION} from './baseProfile'

/**
 * Sanity spreads a document's prepared preview value into its preview
 * component's props, so the extra keys `profilePreview()` returns from
 * `prepare` arrive here, along with the `_id` Sanity always preserves.
 */
type ProfilePreviewProps = PreviewProps & {
  _id?: string
  editionTitle?: string
  points?: number
}

/** Every army list the profile can be taken in, directly or through a formation. */
const ARMY_LISTS_QUERY = /* groq */ `
  array::unique(
    *[_type == "armyList" && references($id)].name
    + *[_type == "formation" && references($id)].armyList->name
  )[defined(@)]
`

const CACHE_TTL_MS = 30_000
const cache = new Map<string, {fetchedAt: number; names: Promise<string[]>}>()

function fetchArmyLists(client: SanityClient, id: string): Promise<string[]> {
  const cached = cache.get(id)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return cached.names
  const names = client
    .fetch<string[] | null>(ARMY_LISTS_QUERY, {id}, {perspective: 'drafts'})
    .then((list) => [...(list ?? [])].sort((a, b) => a.localeCompare(b)))
  names.catch(() => cache.delete(id))
  cache.set(id, {fetchedAt: Date.now(), names})
  return names
}

/** Army lists reference the published id, whichever id the preview was given. */
function publishedId(id: string) {
  return id.replace(/^(drafts|versions\.[^.]+)\./, '')
}

/**
 * Preview for profiles wherever a form shows one: the picker used to link a
 * profile to a figure or formation, and the linked items themselves. The
 * subtitle reads "edition · army lists · points".
 *
 * Membership lives on the army list (`entries[].profile`), out of reach of
 * `preview.select`, so it is fetched here. Document lists in the structure
 * tool don't go through this component and keep the subtitle from `prepare`.
 */
export function ProfilePreview(props: PreviewProps) {
  const {_id, editionTitle, points} = props as ProfilePreviewProps
  const client = useClient({apiVersion: API_VERSION})
  const [armyLists, setArmyLists] = useState<string[]>()

  useEffect(() => {
    if (!_id) return undefined
    let cancelled = false
    setArmyLists(undefined)
    fetchArmyLists(client, publishedId(_id)).then(
      (names) => {
        if (!cancelled) setArmyLists(names)
      },
      (error) => {
        if (cancelled) return
        console.warn('Could not load army lists for profile preview', error)
        setArmyLists([])
      }
    )
    return () => {
      cancelled = true
    }
  }, [client, _id])

  if (!_id || editionTitle === undefined) return props.renderDefault(props)

  const parts = [editionTitle, armyLists?.join(', '), points != null ? `${points} pts` : undefined]
  return props.renderDefault({...props, subtitle: parts.filter(Boolean).join(' · ')})
}
