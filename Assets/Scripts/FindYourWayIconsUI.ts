// FindYourWayIconsUI — the bundled icon set, looked up by name. Maps choose icons by name
// (e.g. a destination node's "icon": "flight"); unknown names fall back to a generic pin.
// Must not: contain any building-specific choice.

const ICONS: {[name: string]: Texture} = {
  directions_walk: requireAsset("../Icons/directions_walk.png") as Texture,
  accessible: requireAsset("../Icons/accessible.png") as Texture,
  qr_code_scanner: requireAsset("../Icons/qr_code_scanner.png") as Texture,
  flight: requireAsset("../Icons/flight.png") as Texture,
  restart_alt: requireAsset("../Icons/restart_alt.png") as Texture,
  elevator: requireAsset("../Icons/elevator.png") as Texture,
  escalator: requireAsset("../Icons/escalator.png") as Texture,
  stairs: requireAsset("../Icons/stairs.png") as Texture,
  map: requireAsset("../Icons/map.png") as Texture,
  block: requireAsset("../Icons/block.png") as Texture,
  info: requireAsset("../Icons/info.png") as Texture,
  location_on: requireAsset("../Icons/location_on.png") as Texture,
  local_hospital: requireAsset("../Icons/local_hospital.png") as Texture,
  school: requireAsset("../Icons/school.png") as Texture,
  science: requireAsset("../Icons/science.png") as Texture,
  menu_book: requireAsset("../Icons/menu_book.png") as Texture,
  construction: requireAsset("../Icons/construction.png") as Texture,
  checkroom: requireAsset("../Icons/checkroom.png") as Texture,
  local_cafe: requireAsset("../Icons/local_cafe.png") as Texture,
  sports_soccer: requireAsset("../Icons/sports_soccer.png") as Texture,
}

// The small set of pictures an offer's "image" can pick (the map file is text; remote images are
// out of scope). Unknown names show no picture.
const PICTURES: {[image: string]: string} = {
  drill: "construction",
  coat: "checkroom",
  coffee: "local_cafe",
  sport: "sports_soccer",
  book: "menu_book",
  health: "local_hospital",
}

export const DEFAULT_ICON = "location_on"

export function icon(name: string | null | undefined): Texture {
  return (name && ICONS[name]) || ICONS[DEFAULT_ICON]
}

export function pictureFor(image: string): Texture | null {
  return PICTURES[image] ? ICONS[PICTURES[image]] : null
}
