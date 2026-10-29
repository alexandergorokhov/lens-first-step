// The airport demo's solid layout that both the 3D model (airport.js) and the tests read: shop
// boxes (x0, x1, z0, z1 in map metres, the floor y, name, colour, the heading their front faces)
// and the glass lifts with the node each landing door faces. Plain data, no three.js.
export const SHOPS = [
  [0, 3, 3, 9, 0, "Café", "#7a4b2a", 90],
  [0, 3, 10, 15.5, 0, "News & Books", "#2d5d8a", 90],
  [16, 23, 37.5, 40, 6, "Duty Free", "#6a2d73", 180],
  [24, 30, 37.5, 40, 6, "Pharmacy", "#2f7d4f", 180],
  [39, 47, 37.5, 40, 6, "Café", "#7a4b2a", 180],
  [24, 27, 14, 17, 0, "Juice bar", "#c2571a", 90],
  [38.5, 44, 22.3, 25, 6, "Toilets", "#36577a", 0],
];

// [lift id, ground node, upper node, node the ground door faces, node the upper door faces]
export const LIFTS = [
  ["lift1", "lift1G", "lift1U", "hall", "bJunction"],
  ["lift2", "lift2G", "lift2U", "hall", "cTop"],
];
export const LIFT_HALF = 1.25;

// Which side of a lift shaft (N/S/E/W) faces the node the door opens toward.
export function doorFace(liftNode, other) {
  const dx = other.x - liftNode.x, dz = other.z - liftNode.z;
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "E" : "W") : dz > 0 ? "N" : "S";
}
