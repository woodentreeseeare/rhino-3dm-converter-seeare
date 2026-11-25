import rhino3dm from '../vendor/rhino3dm.module.js';
import { buildDoc } from './to3dm.js';
import { formatOf, readFile } from './convert.js';

const $ = (id) => document.getElementById(id);
const fileInput = $('file');
const options = $('options');
const fileInfo = $('file-info');
const unitSel = $('unit');
const unitRow = $('unit-row');
const yupBox = $('yup');
const axisRow = $('axis-row');
const convertBtn = $('convert');
const statusEl = $('status');
const noteEl = $('note');
const download = $('download');

let rhinoPromise = null;
const getRhino = () => (rhinoPromise ||= rhino3dm());

let current = null;
let downloadUrl = null;

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

function resetResult() {
  noteEl.hidden = true;
  download.hidden = true;
  if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = null; }
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

fileInput.addEventListener('change', () => {
  resetResult();
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;
  const fmt = formatOf(file.name);
  if (!fmt) {
    options.hidden = true;
    current = null;
    setStatus('This file type is not supported.', true);
    return;
  }
  current = file;
  fileInfo.textContent = `${file.name} · ${fmt.label} · ${formatBytes(file.size)}`;
  unitSel.value = fmt.unit;
  unitRow.hidden = !!fmt.fixedUnit;
  yupBox.checked = fmt.yUp;
  axisRow.hidden = !!fmt.fixedAxis;
  options.hidden = false;
  setStatus('');
  getRhino(); // start loading early
});

convertBtn.addEventListener('click', async () => {
  if (!current) return;
  resetResult();
  convertBtn.disabled = true;
  const started = performance.now();
  try {
    setStatus('Reading file…');
    const [rhino, result] = await Promise.all([
      getRhino(),
      readFile(current, { unit: unitSel.value, yUp: yupBox.checked }),
    ]);
    if (!result.parts.length) throw new Error('No mesh geometry was found in this file.');
    setStatus('Building .3dm…');
    await new Promise((r) => setTimeout(r, 0)); // let the status paint
    const out = buildDoc(rhino, result.parts, { unit: result.unit });
    if (!out.objects) throw new Error('No mesh geometry could be converted.');

    const blob = new Blob([out.bytes], { type: 'application/octet-stream' });
    downloadUrl = URL.createObjectURL(blob);
    const name = current.name.replace(/\.[^.]+$/, '') + '.3dm';
    download.href = downloadUrl;
    download.download = name;
    download.textContent = `Save ${name} (${formatBytes(out.bytes.length)})`;
    download.hidden = false;
    const secs = ((performance.now() - started) / 1000).toFixed(1);
    const skipped = out.skipped ? `, ${out.skipped} empty skipped` : '';
    setStatus(`Done in ${secs} s: ${out.objects} mesh object${out.objects === 1 ? '' : 's'} on ${out.layers} layer${out.layers === 1 ? '' : 's'}, ${out.faces.toLocaleString()} faces${skipped}.`);
    if (result.note) { noteEl.textContent = result.note; noteEl.hidden = false; }
  } catch (err) {
    console.error(err);
    setStatus(err && err.message ? err.message : 'Conversion failed.', true);
  } finally {
    convertBtn.disabled = false;
  }
});

// Offline support: sw.js caches the app files. Registration needs HTTPS (or localhost).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Service worker not registered:', err));
  });
}
