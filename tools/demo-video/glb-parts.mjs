// One mesh of the airport -> its parts for the GLB, one per material, in world space, with only
// position / normal / uv. A floor slab has two materials (tiled top, white underside: geometry groups);
// each group becomes its own part, so nothing is dropped. Used by export-airport.mjs (in the browser)
// and the Node tests, so THREE is passed in.
export function meshParts(THREE, mesh, matrix = mesh.matrixWorld) {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const base = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  for (const k of Object.keys(base.attributes)) if (k !== "position" && k !== "normal" && k !== "uv") base.deleteAttribute(k);
  if (!base.attributes.normal) base.computeVertexNormals();
  if (!base.attributes.uv) base.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(base.attributes.position.count * 2), 2));
  const groups = mats.length === 1 || base.groups.length === 0
    ? [{ start: 0, count: base.attributes.position.count, materialIndex: 0 }]
    : base.groups;
  const out = [];
  for (const gr of groups) {
    const mat = mats[gr.materialIndex ?? 0];
    if (!mat || gr.count <= 0) continue;
    const geo = new THREE.BufferGeometry();
    for (const k of Object.keys(base.attributes)) {
      const a = base.attributes[k];
      geo.setAttribute(k, new THREE.BufferAttribute(a.array.slice(gr.start * a.itemSize, (gr.start + gr.count) * a.itemSize), a.itemSize));
    }
    geo.applyMatrix4(matrix);
    out.push({ mat, geo });
  }
  return out;
}
