import figure from './figure'
import set from './set'
import terrain from './terrain'
import print from './print'
import character from './character'
import faction from './faction'
import releaseWave from './releaseWave'
import race from './race'
import accessory from './accessory'
import allegiance from './allegiance'
import armyList, {armyListEntry} from './armyList'
import formation from './formation'
import gallery from './fieldSchemas/gallery'
import sculptor from './sculptor'
import edition from './edition'
import packaging from './packaging'
import references from './fieldSchemas/references'
import {heroicValues, profileOption} from './profiles/baseProfile'
import profile1e from './profiles/profile1e'
import profile2e from './profiles/profile2e'
import profile3e from './profiles/profile3e'
import profile4e from './profiles/profile4e'
import profile5e from './profiles/profile5e'
import profile6e from './profiles/profile6e'

export const schemaTypes = [
  figure,
  set,
  terrain,
  print,
  character,
  allegiance,
  armyList,
  armyListEntry,
  formation,
  profile1e,
  profile2e,
  profile3e,
  profile4e,
  profile5e,
  profile6e,
  heroicValues,
  profileOption,
  faction,
  releaseWave,
  race,
  accessory,
  gallery,
  references,
  sculptor,
  edition,
  packaging,
]
