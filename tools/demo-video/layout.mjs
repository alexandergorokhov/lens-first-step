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

// The toilet block's two doors, on its front, where the legs end: [node id, sign, door width m].
// The route and the demo go to the door; nobody walks inside.
export const TOILET_DOORS = [
  ["toiletsD", "Toilets", 1.0],
  ["accToiletD", "Accessible toilet", 1.3],
];

// Solid furniture the route must stay clear of: [x0, x1, z0, z1, floor y, height, colour, label].
export const FURNITURE = [
  // gate desks (beside each gate, like B12's)
  [56.5, 58.8, 37.2, 38, 6, 1.05, 0x2f3a4a, "B12 desk"],
  [67.5, 69.8, 38.2, 39, 6, 1.05, 0x2f3a4a, "B14 desk"],
  [79.5, 81.8, 38.2, 39, 6, 1.05, 0x2f3a4a, "B16 desk"],
  [91.5, 93.8, 38.2, 39, 6, 1.05, 0x2f3a4a, "B18 desk"],
  [94.6, 95.4, 33.5, 35.8, 6, 1.05, 0x2f3a4a, "B20 desk"],
  [8.8, 10.8, 38.7, 39.4, 5, 1.05, 0x2f3a4a, "C12 desk"],
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
  ["liftC", "liftCG", "liftCU", "cJunction", "cLiftHall"],
];
export const LIFT_HALF = 1.25;

// Rows of gate seats: [x0, x1, floor y, z, facing south]. One seat every 0.6 m from x0 to x1.
export const SEATS = [
  [63, 67, 6, 39.2, false], [75, 79, 6, 39.2, false], [87, 91, 6, 39.2, false], // B14, B16, B18
  [94.6, 95.4, 6, 30.5, true], // B20
  [46.5, 51.5, 6, 39.2, false], [46.5, 51.5, 6, 38.0, true], [56.2, 59.2, 6, 30.6, true], // B12
  [0.8, 3.2, 5, 34.0, true], [0.8, 3.2, 5, 35.2, false], // C3
  [11.4, 12.6, 5, 34.5, true], [11.4, 12.6, 5, 35.6, false], // C12, east of the way in
];

// People: [seed, x, y, z, heading, options, walk path or null]. Walkers move in the concept video; the
// Lens model (export-airport.mjs) leaves them out, as they would stand frozen mid-step.
export const PEOPLE = [
  ...[[40, 5.0], [40.3, 6.0], [44, 5.4], [44.2, 6.6], [48, 5.1], [52, 5.6], [52.2, 6.7], [56, 5.2]].map(([x, z], i) => [i + 1, x, 0, z, 180, { suitcase: i % 2 === 0 }, null]),
  [11, 4.2, 0, 6.5, 270, {}, null],
  [12, 4.6, 0, 12.5, 250, { suitcase: true }, null],
  [13, 18, 0, 3.5, 90, { suitcase: true }, { a: [10, 3.5], b: [26, 3.0], T: 14 }],
  [14, 55, 0, 16, 0, {}, { a: [56, 14], b: [56, 30], T: 16 }],
  [15, 14, 0, 30, 0, { suitcase: true }, { a: [16, 36], b: [24, 24], T: 13 }],
  [16, 47, 6, 39.2, 180, { seated: true }, null],
  [17, 49.4, 6, 39.2, 180, { seated: true }, null],
  [18, 48.2, 6, 38.0, 0, { seated: true }, null],
  [19, 57.4, 6, 30.6, 0, { seated: true }, null],
  [20, 1.4, 5, 34.0, 0, { seated: true }, null],
  [21, 2.6, 5, 35.2, 180, { seated: true }, null],
  [22, 22, 6, 36.4, 180, {}, null],
  [23, 36, 6, 36.6, 160, { suitcase: true }, null],
  [24, 40, 6, 26, 0, { suitcase: true }, { a: [40, 25], b: [57, 27], T: 15 }],
  [25, 26, 6, 38.2, 0, {}, { a: [20, 36.5], b: [42, 36.8], T: 22 }],
  [26, 58, 6, 34, 270, {}, null],
  [27, 8, 0, 36, 90, { suitcase: true }, { a: [3, 36], b: [22, 34], T: 17 }],
];

// Which side of a lift shaft (N/S/E/W) faces the node the door opens toward.
export function doorFace(liftNode, other) {
  const dx = other.x - liftNode.x, dz = other.z - liftNode.z;
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? "E" : "W") : dz > 0 ? "N" : "S";
}
