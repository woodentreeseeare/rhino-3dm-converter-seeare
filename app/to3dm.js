// Builds a .3dm file from plain mesh parts. No DOM use, so it also runs in Node for tests.
//
// part = {
//   name: string,          object name
//   layer: string,         layer name (created on first use)
//   color: [r, g, b] 0-255 or null,
//   positions: Float32Array | number[]   flat xyz, already Z-up, in model units
//   indices: Uint32Array | number[] | null  triangles; null = non-indexed triangles
// }

export const UNIT_NAMES = {
  mm: 'Millimeters',
  cm: 'Centimeters',
  m: 'Meters',
  in: 'Inches',
  ft: 'Feet',
};

const DEFAULT_LAYER_COLOR = [128, 128, 128];

function colorObj(c) {
  const [r, g, b] = c || DEFAULT_LAYER_COLOR;
  return { r: Math.round(r), g: Math.round(g), b: Math.round(b), a: 255 };
}

// Rotate a flat xyz array from Y-up to Z-up in place: (x, y, z) -> (x, -z, y).
export function yUpToZUp(positions) {
  for (let i = 0; i < positions.length; i += 3) {
    const y = positions[i + 1];
    positions[i + 1] = -positions[i + 2];
    positions[i + 2] = y;
  }
  return positions;
}

export function scalePositions(positions, factor) {
  if (factor === 1) return positions;
  for (let i = 0; i < positions.length; i++) positions[i] *= factor;
  return positions;
}

function makeMesh(rhino, part) {
  const pos = part.positions;
  const vertexCount = pos.length / 3;
  let index = part.indices;
  if (!index) {
    index = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) index[i] = i;
  }
  // Mesh.createFromThreejsJSON is not used: it rotates Y-up to Z-up on its own,
  // which would rotate Z-up sources a second time.
  const mesh = new rhino.Mesh();
  const verts = mesh.vertices();
  for (let i = 0; i < pos.length; i += 3) verts.add(pos[i], pos[i + 1], pos[i + 2]);
  const faces = mesh.faces();
  for (let i = 0; i + 2 < index.length; i += 3) {
    const a = index[i], b = index[i + 1], c = index[i + 2];
    if (a === b || b === c || a === c) continue;
    faces.addTriFace(a, b, c);
  }
  if (faces.count === 0) { mesh.delete(); return null; }
  mesh.normals().computeNormals();
  mesh.compact();
  return mesh;
}

export function buildDoc(rhino, parts, { unit = 'mm' } = {}) {
  const doc = new rhino.File3dm();
  doc.settings().modelUnitSystem = rhino.UnitSystem[UNIT_NAMES[unit] || 'Millimeters'];

  const layerIndex = new Map();
  const getLayer = (name, color) => {
    const key = name || 'Default';
    if (!layerIndex.has(key)) {
      const layer = new rhino.Layer();
      layer.name = key;
      layer.color = colorObj(color);
      layerIndex.set(key, doc.layers().add(layer));
      layer.delete();
    }
    return layerIndex.get(key);
  };

  let added = 0;
  let skipped = 0;
  let triangles = 0;
  for (const part of parts) {
    if (!part.positions || part.positions.length < 9) { skipped++; continue; }
    const mesh = makeMesh(rhino, part);
    if (!mesh) { skipped++; continue; }
    const attrs = new rhino.ObjectAttributes();
    attrs.layerIndex = getLayer(part.layer, part.color);
    if (part.name) attrs.name = String(part.name).slice(0, 200);
    if (part.color) {
      attrs.objectColor = colorObj(part.color);
      attrs.colorSource = rhino.ObjectColorSource.ColorFromObject;
    }
    doc.objects().add(mesh, attrs);
    triangles += mesh.faces().count;
    mesh.delete();
    attrs.delete();
    added++;
  }
  const bytes = doc.toByteArray();
  doc.delete();
  return { bytes, objects: added, skipped, layers: layerIndex.size, faces: triangles };
}
