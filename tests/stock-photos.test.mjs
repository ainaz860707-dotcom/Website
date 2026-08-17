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

test('музейный скан не проходит по названию, даже помеченный фотографией', () => {
  const payload = [
    { url: 'https://x/swatch.jpg', title: 'Upholstery fabric (1950s)', category: 'photograph' },
    { url: 'https://x/graffiti.jpg', title: 'Art Sofa', category: 'photograph' },
    { url: 'https://x/carpet.jpg', title: 'Medallion Carpet (16th century)', category: 'photograph' },
    { url: 'https://x/sofa.jpg', title: 'Black Sofa', category: 'photograph', width: 3000, height: 2000 },
  ];

  const kept = photographsOnly(payload, 'sofa');

  assert.deepEqual(
    kept.map((p) => p.url),
    ['https://x/sofa.jpg'],
  );
});

test('крупногабарит не уезжает в одежду', () => {
  const queries = photoQueries('Химчистка мебели на дому в Москве: диваны, матрасы, ковры');

  assert.ok(queries.includes('velvet fabric'), queries.join(', '));
  assert.ok(!queries.includes('hanging clothes'), queries.join(', '));
});

test('уход за одеждой не уезжает в свадебную фотографию', () => {
  const queries = photoQueries('Химчистка-ателье в Москве: кашемир, шёлк, свадебные платья');

  assert.ok(queries.every((q) => !q.includes('wedding')), queries.join(', '));
  assert.ok(queries.includes('hanging clothes'));
});
