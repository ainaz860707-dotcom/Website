#!/usr/bin/env node
import fs from 'node:fs';
import readline from 'node:readline';
import { pathToFileURL } from 'node:url';

const HELP = `obj-to-web-mesh — тяжёлый .obj в геометрию, которая влезает в страницу

  node tools/obj-to-web-mesh.mjs <вход.obj> <выход.json> [--grid 150] [--scale 2.6]

Кластеризация по решётке: вершины схлопываются в ячейки, треугольники перестраиваются на
представителях. Позиции пишутся int16, индексы uint16 или uint32 — что влезет. Результат
кладётся в JSON с base64 внутри: строку можно встроить прямо в HTML и разобрать через atob,
поэтому страница работает с file:// без загрузчика формата и без запроса к серверу.`;

export async function readObj(file) {
  const positions = [];
  const faces = [];
  const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.charCodeAt(0) === 118 && line.charCodeAt(1) === 32) {
      const p = line.split(/\s+/);
      positions.push(+p[1], +p[2], +p[3]);
    } else if (line.charCodeAt(0) === 102 && line.charCodeAt(1) === 32) {
      const parts = line.trim().split(/\s+/);
      const ids = [];
      for (let i = 1; i < parts.length; i += 1) {
        const raw = parts[i].split('/')[0];
        let n = Number.parseInt(raw, 10);
        if (Number.isNaN(n)) continue;
        if (n < 0) n = positions.length / 3 + n; else n -= 1;
        ids.push(n);
      }
      for (let i = 1; i + 1 < ids.length; i += 1) faces.push(ids[0], ids[i], ids[i + 1]);
    }
  }
  return { positions: Float32Array.from(positions), faces: Uint32Array.from(faces) };
}

export function cluster({ positions, faces }, grid) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a += 1) {
      const v = positions[i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const step = span / grid;
  const cellOf = (x, y, z) => {
    const cx = Math.min(grid, Math.floor((x - min[0]) / step));
    const cy = Math.min(grid, Math.floor((y - min[1]) / step));
    const cz = Math.min(grid, Math.floor((z - min[2]) / step));
    return (cx * (grid + 1) + cy) * (grid + 1) + cz;
  };

  const sum = new Map();
  const vertexCell = new Uint32Array(positions.length / 3);
  for (let i = 0, v = 0; i < positions.length; i += 3, v += 1) {
    const key = cellOf(positions[i], positions[i + 1], positions[i + 2]);
    vertexCell[v] = key;
    const acc = sum.get(key);
    if (acc) {
      acc[0] += positions[i]; acc[1] += positions[i + 1]; acc[2] += positions[i + 2]; acc[3] += 1;
    } else {
      sum.set(key, [positions[i], positions[i + 1], positions[i + 2], 1]);
    }
  }

  const index = new Map();
  const outPos = [];
  for (const [key, acc] of sum) {
    index.set(key, outPos.length / 3);
    outPos.push(acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3]);
  }

  const seen = new Set();
  const outIdx = [];
  for (let f = 0; f < faces.length; f += 3) {
    const a = index.get(vertexCell[faces[f]]);
    const b = index.get(vertexCell[faces[f + 1]]);
    const c = index.get(vertexCell[faces[f + 2]]);
    if (a === b || b === c || a === c) continue;
    const lo = Math.min(a, b, c), hi = Math.max(a, b, c), mid = a + b + c - lo - hi;
    const key = `${lo}_${mid}_${hi}`;
    if (seen.has(key)) continue;
    seen.add(key);
    outIdx.push(a, b, c);
  }
  return { positions: Float32Array.from(outPos), faces: Uint32Array.from(outIdx) };
}

export function pack({ positions, faces }, targetSize) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a += 1) {
      const v = positions[i + a];
      if (v < min[a]) min[a] = v;
      if (v > max[a]) max[a] = v;
    }
  }
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const span = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) || 1;
  const k = targetSize / span;
  const quant = new Int16Array(positions.length);
  const scale = targetSize / 2 / 32767;
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a += 1) {
      quant[i + a] = Math.round(((positions[i + a] - center[a]) * k) / scale);
    }
  }
  const wide = positions.length / 3 > 65535;
  const idx = wide ? Uint32Array.from(faces) : Uint16Array.from(faces);
  return {
    vertices: positions.length / 3,
    triangles: faces.length / 3,
    scale,
    wide,
    positions: Buffer.from(quant.buffer).toString('base64'),
    indices: Buffer.from(idx.buffer).toString('base64')
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!input || !output) {
    console.log(HELP);
    process.exit(1);
  }
  const flag = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? Number(process.argv[i + 1]) : fallback;
  };
  const grid = flag('grid', 150);
  const size = flag('scale', 2.6);

  const raw = await readObj(input);
  console.log(`прочитано: вершин ${raw.positions.length / 3}, треугольников ${raw.faces.length / 3}`);
  const small = cluster(raw, grid);
  console.log(`решётка ${grid}: вершин ${small.positions.length / 3}, треугольников ${small.faces.length / 3}`);
  const packed = pack(small, size);
  fs.writeFileSync(output, JSON.stringify(packed));
  const kb = (s) => (Buffer.byteLength(s, 'utf8') / 1024).toFixed(0);
  console.log(`записано ${output}: позиции ${kb(packed.positions)} КБ, индексы ${kb(packed.indices)} КБ base64`);
}
