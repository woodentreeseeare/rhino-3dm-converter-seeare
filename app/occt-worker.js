// Classic worker: reads STEP, IGES and BREP with occt-import-js off the main thread.
/* global importScripts, occtimportjs */
importScripts('../vendor/occt-import-js.js');

let occtPromise = null;
function getOcct() {
  if (!occtPromise) {
    occtPromise = occtimportjs({ locateFile: (path) => '../vendor/' + path });
  }
  return occtPromise;
}

onmessage = async (ev) => {
  const { format, buffer } = ev.data;
  try {
    const occt = await getOcct();
    const params = {
      linearUnit: 'millimeter',
      linearDeflectionType: 'bounding_box_ratio',
      linearDeflection: 0.001,
      angularDeflection: 0.5,
    };
    const result = occt.ReadFile(format, new Uint8Array(buffer), params);
    if (!result || !result.success) {
      postMessage({ ok: false, error: 'The file could not be read as ' + format.toUpperCase() + '.' });
      return;
    }
    const meshes = result.meshes.map((m) => {
      const positions = new Float32Array(m.attributes.position.array);
      const indices = new Uint32Array(m.index.array);
      return { name: m.name || '', color: m.color || null, positions, indices };
    });
    const transfer = [];
    for (const m of meshes) transfer.push(m.positions.buffer, m.indices.buffer);
    postMessage({ ok: true, meshes }, transfer);
  } catch (err) {
    postMessage({ ok: false, error: String((err && err.message) || err) });
  }
};
