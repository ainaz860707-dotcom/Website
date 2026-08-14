#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { statSync, existsSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

const BUDGET_MB = 1.5;

const args = process.argv.slice(2);
const input = args.find((a) => !a.startsWith('--'));
const crf = Number(args.find((a) => a.startsWith('--crf='))?.split('=')[1] ?? 26);
const outDir = args.find((a) => a.startsWith('--out='))?.split('=')[1];

if (!input || !existsSync(input)) {
  console.error('Использование: node tools/video-package.mjs <видео> [--crf=26] [--out=папка]');
  process.exit(1);
}

const dir = outDir ?? dirname(input);
const stem = basename(input, extname(input));
const target = (ext) => {
  const plain = join(dir, `${stem}.${ext}`);
  return resolve(plain) === resolve(input) ? join(dir, `${stem}-web.${ext}`) : plain;
};
const webm = target('webm');
const mp4 = target('mp4');
const poster = target('jpg');

const run = (args) => {
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
  } catch (error) {
    console.error(`ffmpeg упал: ${String(error.stderr ?? error.message).trim()}`);
    process.exit(1);
  }
};
const mb = (file) => statSync(file).size / 1024 / 1024;

run(['-i', input, '-c:v', 'libvpx-vp9', '-crf', String(crf), '-b:v', '0', '-row-mt', '1', '-an', webm]);
run(['-i', input, '-c:v', 'libx264', '-crf', String(crf), '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', mp4]);
run(['-ss', '0', '-i', input, '-frames:v', '1', '-q:v', '4', poster]);

const probe = JSON.parse(
  execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate:format=duration', '-of', 'json', input], { encoding: 'utf8' }),
);
const stream = probe.streams[0];
const [num, den] = stream.r_frame_rate.split('/');

console.log(`Исходник: ${stream.width}×${stream.height}, ${(Number(num) / Number(den)).toFixed(0)} fps, ${Number(probe.format.duration).toFixed(1)} с`);
for (const file of [webm, mp4, poster]) {
  const size = mb(file);
  const over = file !== poster && size > BUDGET_MB;
  console.log(`${over ? '✗' : '✓'} ${file} — ${size.toFixed(2)} МБ${over ? ` (бюджет ${BUDGET_MB} МБ: резать длительность, а не разрешение)` : ''}`);
}
