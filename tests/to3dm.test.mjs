// Node check: build a .3dm from a cube and read it back with rhino3dm.
import { createRequire } from 'node:module';
import { buildDoc } from '../app/to3dm.js';
const require = createRequire(import.meta.url);
const rhino = await require('../tools/node_modules/rhino3dm/rhino3dm.js')();
const p = [0,0,0, 10,0,0, 10,10,0, 0,10,0, 0,0,10, 10,0,10, 10,10,10, 0,10,10];
const idx = [0,2,1, 0,3,2, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 1,2,6, 1,6,5, 2,3,7, 2,7,6, 3,0,4, 3,4,7];
const r = buildDoc(rhino, [
  { name: 'cube', layer: 'Parts', color: [200, 30, 30], positions: new Float32Array(p), indices: new Uint32Array(idx) },
  { name: 'tri', layer: 'Other', color: null, positions: new Float32Array([0,0,0, 1,0,0, 0,1,0]), indices: null },
], { unit: 'mm' });
const doc = rhino.File3dm.fromByteArray(r.bytes);
const objs = doc.objects();
const m = objs.get(0).geometry();
const ok = objs.count === 2 && doc.layers().count === 2 && m.vertices().count === 8 && m.faces().count === 12
  && doc.settings().modelUnitSystem === rhino.UnitSystem.Millimeters && objs.get(0).attributes().name === "cube" && m.getBoundingBox().max.join() === "10,10,10";
console.log(JSON.stringify({ ...r, bytes: r.bytes.length, objects: objs.count, layers: doc.layers().count,
  verts: m.vertices().count, faces: m.faces().count, bbox: m.getBoundingBox().max }));
if (!ok) { console.error('FAIL'); process.exit(1); }
console.log('PASS');
