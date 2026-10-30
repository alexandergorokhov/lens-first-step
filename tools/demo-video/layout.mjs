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
  // B pier
  [52, 58, 24, 28, 6, "Bookshop", "#2d5d8a", 0],
  [65, 68.5, 24, 28, 6, "Sweets & toys", "#c2408a", 0],
  [70, 75, 37.5, 40, 6, "Café", "#7a4b2a", 180],
  [82, 87, 37.5, 40, 6, "Tech store", "#3a3f8f", 180],
  [87, 93, 21.5, 25.8, 6, "Family lounge", "#2f7d4f", 0],
];

// Solid furniture the route must stay clear of: [x0, x1, z0, z1, floor y, height, colour, label].
export const FURNITURE = [
  // gate desks (beside each gate, like B12's)
  [56.5, 58.8, 37.2, 38, 6, 1.05, 0x2f3a4a, "B12 desk"],
  [67.5, 69.8, 38.2, 39, 6, 1.05, 0x2f3a4a, "B14 desk"],
  [79.5, 81.8, 38.2, 39, 6, 1.05, 0x2f3a4a, "B16 desk"],
  [91.5, 93.8, 38.2, 39, 6, 1.05, 0x2f3a4a, "B18 desk"],
  [94.6, 95.4, 33.5, 35.8, 6, 1.05, 0x2f3a4a, "B20 desk"],
  // Sky Lounge (y 9): reception desk, sofas
  [78.8, 81.2, 20.6, 21.6, 9, 1.05, 0x5b4636, "Sky Lounge desk"],
  [76.5, 79, 27, 28, 9, 0.75, 0x7a8fa6, "sofa"],
  [69.6, 70.4, 20.5, 23.5, 9, 0.75, 0x7a8fa6, "sofa"],
  [82.8, 83.6, 20.5, 24, 9, 0.75, 0x7a8fa6, "sofa"],
];

// [lift id, ground node, upper node, node the ground door faces, node the upper door faces]
export const LIFTS = [
  ["lift1", "lift1G", "lift1U", "hall", "bJunction"],
  ["lift2", "lift2G", "lift2U", "hall", "cTop"],
  ["loungeLift", "loungeLiftG", "loungeLiftU", "bPier2", "skyLounge"],
];
export const LIFT_HALF = 1.25;

// Which side of a lift shaft (N/S/E/W) faces the node the door opens toward.
export function doorFace(liftNode, other) {
  const dx = other.x - liftNode.x, dz = other.z - liftNode.z;
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "E" : "W") : dz > 0 ? "N" : "S";
}
