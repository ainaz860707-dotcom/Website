import assert from 'node:assert/strict';
import test from 'node:test';
import { photoQueries, photographsOnly, searchUrl } from '../tools/stock-photos.mjs';

test('гравюра Милле на первом экране: запрос к банку просит только фотографии', () => {
  assert.match(searchUrl('hanging clothes', 4), /[?&]category=photograph(&|$)/);
});

test('гравюра Милле на первом экране: оцифрованная живопись отбрасывается по ответу банка', () => {
  const payload = [
    { url: 'https://x/millet.jpg', title: 'Woman Hanging Clothes Jean François', category: null },
    { url: 'https://x/etching.jpg', title: 'Free hanging cloth Venice image', category: 'illustration' },
    { url: 'https://x/rail.jpg', title: 'Laundry hanging clothes line', category: 'photograph', width: 1024, height: 683 },
  ];

  const kept = photographsOnly(payload, 'hanging clothes');

  assert.equal(kept.length, 1);
  assert.equal(kept[0].url, 'https://x/rail.jpg');
});

test('уход за одеждой не уезжает в свадебную фотографию', () => {
  const queries = photoQueries('Химчистка-ателье в Москве: кашемир, шёлк, свадебные платья');

  assert.ok(queries.every((q) => !q.includes('wedding')), queries.join(', '));
  assert.ok(queries.includes('hanging clothes'));
});
