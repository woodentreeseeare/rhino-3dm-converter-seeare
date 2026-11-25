// Reads a source file into mesh parts for to3dm.js. Runs in the browser.
import {
  Mesh, STLLoader, OBJLoader, PLYLoader, GLTFLoader, ThreeMFLoader, FBXLoader,
} from '../vendor/three-loaders.js';
import { yUpToZUp, scalePositions } from './to3dm.js';

// Per format: reader family, default source unit, and whether it is usually Y-up.
export const FORMATS = {
  stl: { kind: 'three', unit: 'mm', yUp: false, label: 'STL' },
  obj: { kind: 'three', unit: 'mm', yUp: false, label: 'OBJ' },
  ply: { kind: 'three', unit: 'mm', yUp: false, label: 'PLY' },
  glb: { kind: 'three', unit: 'm', yUp: true, label: 'glTF binary' },
  gltf: { kind: 'three', unit: 'm', yUp: true, label: 'glTF' },
  '3mf': { kind: 'three', unit: 'mm', yUp: false, label: '3MF' },
  fbx: { kind: 'three', unit: 'cm', yUp: true, label: 'FBX' },
  step: { kind: 'occt', occt: 'step', unit: 'mm', yUp: false, label: 'STEP', fixedUnit: true },
  stp: { kind: 'occt', occt: 'step', unit: 'mm', yUp: false, label: 'STEP', fixedUnit: true },
  iges: { kind: 'occt', occt: 'iges', unit: 'mm', yUp: false, label: 'IGES', fixedUnit: true },
  igs: { kind: 'occt', occt: 'iges', unit: 'mm', yUp: false, label: 'IGES', fixedUnit: true },
  brep: { kind: 'occt', occt: 'brep', unit: 'mm', yUp: false, label: 'BREP' },
  brp: { kind: 'occt', occt: 'brep', unit: 'mm', yUp: false, label: 'BREP' },
  skp: { kind: 'skp', unit: 'm', yUp: true, label: 'SketchUp', fixedUnit: true, fixedAxis: true },
};

export function formatOf(fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  return FORMATS[ext] ? { ext, ...FORMATS[ext] } : null;
}

function rgb255(c) {
  if (!c) return null;
  return [c.r * 255, c.g * 255, c.b * 255];
}

// ---- three.js formats -------------------------------------------------------

function parseThree(ext, buffer) {
  switch (ext) {
    case 'stl': return new Mesh(new STLLoader().parse(buffer));
    case 'ply': return new Mesh(new PLYLoader().parse(buffer));
    case 'obj': return new OBJLoader().parse(new TextDecoder().decode(buffer));
    case '3mf': return new ThreeMFLoader().parse(buffer);
    case 'fbx': return new FBXLoader().parse(buffer, '');
    case 'glb':
    case 'gltf':
      return new Promise((resolve, reject) => {
        new GLTFLoader().parse(buffer, '', (g) => resolve(g.scene), (e) => reject(e));
      });
    default: throw new Error('Unsupported format');
  }
}

function threeToParts(root, baseName) {
  root.updateMatrixWorld(true);
  const parts = [];
  let n = 0;
  root.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry || !obj.geometry.attributes.position) return;
    n++;
    const geom = obj.geometry.clone();
    geom.applyMatrix4(obj.matrixWorld);
    const positions = new Float32Array(geom.attributes.position.array);
    const indices = geom.index ? new Uint32Array(geom.index.array) : null;
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
    const name = obj.name || (obj.parent && obj.parent !== root && obj.parent.name) || `${baseName} ${n}`;
    parts.push({ name, layer: name, color: mat && mat.color ? rgb255(mat.color) : null, positions, indices });
    geom.dispose();
  });
  if (parts.length === 1) parts[0].layer = baseName;
  return parts;
}

// ---- STEP / IGES / BREP (worker) -------------------------------------------

function readOcct(format, buffer) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./app/occt-worker.js');
    worker.onmessage = (ev) => {
      worker.terminate();
      if (ev.data.ok) resolve(ev.data.meshes);
      else reject(new Error(ev.data.error));
    };
    worker.onerror = (ev) => {
      worker.terminate();
      reject(new Error(ev.message || 'The CAD reader failed to start.'));
    };
    worker.postMessage({ format, buffer }, [buffer]);
  });
}

// ---- SketchUp ---------------------------------------------------------------

let skpModule = null;
async function readSkp(buffer, baseName) {
  if (!skpModule) skpModule = await import('../vendor/openskp.js');
  const scene = skpModule.buildScene(buffer, { includeCurveSets: false });
  const prims = scene.surfacePrimitives || scene.glbPrimitives || [];
  const mats = scene.gltfMaterials || [];
  const counts = new Map();
  return prims.map((p) => {
    const meta = (scene.meshIndex && scene.meshIndex[p.geomName]) || {};
    const mat = mats[p.materialIndex];
    const f = mat && mat.pbrMetallicRoughness && mat.pbrMetallicRoughness.baseColorFactor;
    const color = f ? [f[0] * 255, f[1] * 255, f[2] * 255] : null;
    let name = meta.name || meta.definitionName || baseName;
    const c = (counts.get(name) || 0) + 1;
    counts.set(name, c);
    if (c > 1) name = `${name} (${c})`;
    return {
      name,
      layer: meta.layer || 'Untagged',
      color,
      positions: new Float32Array(p.positions),
      indices: new Uint32Array(p.indices),
    };
  });
}

// ---- entry point ------------------------------------------------------------

// options: { unit: source unit key, yUp: boolean }. Returns { parts, unit, note }.
export async function readFile(file, options) {
  const fmt = formatOf(file.name);
  if (!fmt) throw new Error('This file type is not supported.');
  const baseName = file.name.replace(/\.[^.]+$/, '') || 'Model';
  const buffer = await file.arrayBuffer();

  let parts;
  let note = '';
  if (fmt.kind === 'three') {
    const root = await parseThree(fmt.ext, buffer);
    parts = threeToParts(root, baseName);
  } else if (fmt.kind === 'occt') {
    const meshes = await readOcct(fmt.occt, buffer);
    parts = meshes.map((m, i) => {
      const name = m.name || `${baseName} ${i + 1}`;
      return { name, layer: meshes.length === 1 ? baseName : name, color: m.color, positions: m.positions, indices: m.indices };
    });
    note = 'CAD surfaces were converted to meshes. They are not editable NURBS surfaces.';
  } else {
    try {
      parts = await readSkp(buffer, baseName);
    } catch (err) {
      const e = new Error('This SketchUp file could not be read. In SketchUp, export it as OBJ and convert that, or open it in Rhino.');
      e.cause = err;
      throw e;
    }
  }

  const yUp = fmt.fixedAxis ? fmt.yUp : options.yUp;
  if (yUp) for (const p of parts) yUpToZUp(p.positions);

  // Inches are a better default model unit for SketchUp users than metres.
  let unit = fmt.fixedUnit ? fmt.unit : options.unit;
  if (fmt.kind === 'skp') {
    for (const p of parts) scalePositions(p.positions, 1 / 0.0254);
    unit = 'in';
  }
  return { parts, unit, note, format: fmt };
}

