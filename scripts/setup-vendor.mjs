import { mkdir, writeFile } from 'node:fs/promises';

const files = [
  ['https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js', 'leaflet.js'],
  ['https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css', 'leaflet.css'],
  ['https://cdn.jsdelivr.net/npm/leaflet@1.9.4/LICENSE', 'LICENSE'],
];
const root = new URL('../dist/vendor/leaflet/', import.meta.url);
await mkdir(root, { recursive: true });
for (const [url, name] of files) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Leaflet ${name}: HTTP ${response.status}`);
  await writeFile(new URL(name, root), new Uint8Array(await response.arrayBuffer()));
  console.log(`Leaflet 1.9.4: ${name}`);
}
