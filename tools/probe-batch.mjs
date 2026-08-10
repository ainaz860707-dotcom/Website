#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const CASES = 'plans/analysis/2026-08-10-proba-yadra-site-gen/cases.yaml';
const wanted = process.argv.slice(2).map(Number).filter(Number.isFinite);
const parallel = Number(process.env.PROBE_PARALLEL ?? 4);

const cases = [];
let id = null;
for (const line of readFileSync(CASES, 'utf8').split('\n')) {
  const m = line.match(/^\s*-\s*id:\s*(\d+)\s*$/);
  if (m) { id = Number(m[1]); continue; }
  const t = line.match(/^\s*input:\s*"(.*)"\s*$/);
  if (t && id) { cases.push({ id, input: t[1] }); id = null; }
}

const queue = wanted.length ? cases.filter((c) => wanted.includes(c.id)) : cases;

function run({ id: cid, input }) {
  return new Promise((resolve) => {
    const started = Date.now();
    const p = spawn('node', ['tools/probe-site-gen.mjs', input], { stdio: ['ignore', 'pipe', 'pipe'] });
    let head = '';
    let err = '';
    p.stdout.on('data', (d) => { if (head.length < 200) head += d.toString(); });
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('close', (code) => {
      const sec = ((Date.now() - started) / 1000).toFixed(0);
      const tag = head.split('\n')[0] ?? '';
      process.stdout.write(code === 0 ? `✓ ${cid} · ${sec}s · ${tag}\n` : `✗ ${cid} · ${err.trim().slice(-200)}\n`);
      resolve();
    });
  });
}

const workers = Array.from({ length: Math.min(parallel, queue.length) }, async () => {
  while (queue.length) await run(queue.shift());
});

await Promise.all(workers);
process.stdout.write('партия закончена\n');
