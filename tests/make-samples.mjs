// Writes small self-made test models to samples/ (a 10 mm cube in several formats).
import { writeFileSync, mkdirSync } from 'node:fs';
import { zipSync, strToU8 } from '../tools/node_modules/fflate/esm/index.mjs';
mkdirSync(new URL('../samples/', import.meta.url), { recursive: true });
const out = (n, d) => writeFileSync(new URL('../samples/' + n, import.meta.url), d);
const V = [[0,0,0],[10,0,0],[10,10,0],[0,10,0],[0,0,10],[10,0,10],[10,10,10],[0,10,10]];
const F = [[0,2,1],[0,3,2],[4,5,6],[4,6,7],[0,1,5],[0,5,4],[1,2,6],[1,6,5],[2,3,7],[2,7,6],[3,0,4],[3,4,7]];
// STL
let stl = 'solid cube\n';
for (const f of F) { stl += ' facet normal 0 0 0\n  outer loop\n'; for (const i of f) stl += `   vertex ${V[i].join(' ')}\n`; stl += '  endloop\n endfacet\n'; }
out('cube.stl', stl + 'endsolid cube\n');
// OBJ
out('cube.obj', 'o Cube\n' + V.map(v => 'v ' + v.join(' ')).join('\n') + '\n' + F.map(f => 'f ' + f.map(i => i + 1).join(' ')).join('\n') + '\n');
// PLY
out('cube.ply', `ply\nformat ascii 1.0\nelement vertex 8\nproperty float x\nproperty float y\nproperty float z\nelement face 12\nproperty list uchar int vertex_indices\nend_header\n` + V.map(v => v.join(' ')).join('\n') + '\n' + F.map(f => '3 ' + f.join(' ')).join('\n') + '\n');
// 3MF
const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><resources><object id="1" type="model" name="Cube"><mesh><vertices>${V.map(v => `<vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`).join('')}</vertices><triangles>${F.map(f => `<triangle v1="${f[0]}" v2="${f[1]}" v3="${f[2]}"/>`).join('')}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`;
out('cube.3mf', zipSync({
  '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'),
  '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'),
  '3D/3dmodel.model': strToU8(model),
}));
// GLB: same cube in metres, Y-up (x, z, -y), as glTF expects.
const pos = new Float32Array(V.flatMap(([x, y, z]) => [x / 1000, z / 1000, -y / 1000]));
const idx = new Uint16Array(F.flat());
const bin = new Uint8Array(pos.byteLength + idx.byteLength + ((4 - idx.byteLength % 4) % 4));
bin.set(new Uint8Array(pos.buffer), 0); bin.set(new Uint8Array(idx.buffer), pos.byteLength);
const gltf = { asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0, name: 'Cube' }],
  meshes: [{ name: 'Cube', primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.8, 0.1, 0.1, 1] } }],
  buffers: [{ byteLength: bin.byteLength }],
  bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: pos.byteLength }, { buffer: 0, byteOffset: pos.byteLength, byteLength: idx.byteLength }],
  accessors: [{ bufferView: 0, componentType: 5126, count: 8, type: 'VEC3', min: [0, 0, -0.01], max: [0.01, 0.01, 0] },
    { bufferView: 1, componentType: 5123, count: idx.length, type: 'SCALAR' }] };
let json = strToU8(JSON.stringify(gltf)); const jpad = (4 - json.length % 4) % 4;
const jsonChunk = new Uint8Array(json.length + jpad).fill(0x20); jsonChunk.set(json);
const total = 12 + 8 + jsonChunk.length + 8 + bin.length;
const glb = new Uint8Array(total); const dv = new DataView(glb.buffer);
dv.setUint32(0, 0x46546c67, true); dv.setUint32(4, 2, true); dv.setUint32(8, total, true);
dv.setUint32(12, jsonChunk.length, true); dv.setUint32(16, 0x4e4f534a, true); glb.set(jsonChunk, 20);
const o = 20 + jsonChunk.length; dv.setUint32(o, bin.length, true); dv.setUint32(o + 4, 0x004e4942, true); glb.set(bin, o + 8);
out('cube.glb', glb);
console.log('samples written');
