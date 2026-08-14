#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = join(ROOT, '.agents', 'skills');

const TRIGGERS = {
  'remotion-best-practices':
    'Роутер по скиллам Remotion: бери его, когда неясно, какой именно нужен. Русские триггеры: сделай видео кодом, Remotion, ремоушн, программное видео, видео на React, ролик из вёрстки.',
  'remotion-create':
    'Русские триггеры: сделай ролик, новый ролик, создай видео, промо-ролик, новая композиция, новый видеопроект, собери видео из макета.',
  'remotion-markup':
    'Русские триггеры: свёрстай сцену ролика, анимация текста в видео, титульная плашка, шрифты в ролике, тайминг сцен, эффекты в кадре, звук в ролике.',
  'remotion-studio':
    'Русские триггеры: покажи превью ролика, открой студию Remotion, посмотреть видео до рендера, запусти предпросмотр.',
  'remotion-render':
    'Русские триггеры: отрендери ролик, собери mp4, экспортируй видео, выгрузи ролик файлом, сними кадр из композиции, рендер стилла.',
  'remotion-docs':
    'Русские триггеры: как в Remotion сделать, найди в документации Remotion, какие пропсы у компонента Remotion, справка по API Remotion.',
  'remotion-captions':
    'Русские триггеры: субтитры, титры по речи, расшифровка речи в ролике, подписи к видео, captions, караоке-титры.',
  'remotion-maps':
    'Русские триггеры: карта в ролике, анимация маршрута, облёт карты, точки на карте в видео, географический экскурс, Mapbox, MapLibre, GeoJSON.',
  'remotion-multimedia':
    'Русские триггеры: узнать длительность видео, метаданные медиафайла, разобрать видео в браузере, Mediabunny, кодек и разрешение файла.',
  'remotion-saas':
    'Русские триггеры: редактор видео внутри приложения, рендер по кнопке из интерфейса, видео по данным пользователя, Remotion Lambda, рендер на сервере.',
  'remotion-interactivity':
    'Русские триггеры: не редактируется в студии, сделай параметры ролика редактируемыми, правки текста прямо в превью, элемент не выделяется в Studio.',
  'remotion-upgrade':
    'Русские триггеры: обнови Remotion, вышла новая версия Remotion, обнови скиллы Remotion, апгрейд видеопакетов.',
};

let touched = 0;
let already = 0;
const missing = [];

for (const [skill, ru] of Object.entries(TRIGGERS)) {
  const file = join(SKILLS_DIR, skill, 'SKILL.md');
  if (!existsSync(file)) {
    missing.push(skill);
    continue;
  }
  const src = readFileSync(file, 'utf8');
  const match = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) {
    missing.push(`${skill} (нет frontmatter)`);
    continue;
  }
  const line = match[1].match(/^description:[ \t]*(.*)$/m);
  if (!line) {
    missing.push(`${skill} (нет description)`);
    continue;
  }
  const current = line[1].trim().replace(/^["']|["']$/g, '');
  if (current.includes(ru)) {
    already += 1;
    continue;
  }
  const base = current.split(' Русские триггеры:')[0].replace(/\s*Роутер по скиллам[\s\S]*$/, '').trim();
  const next = `${base} ${ru}`.replace(/\s+/g, ' ').trim();
  const frontmatter = match[1].replace(/^description:[ \t]*.*$/m, `description: ${JSON.stringify(next)}`);
  writeFileSync(file, `---\n${frontmatter}\n---\n${src.slice(match[0].length)}`);
  touched += 1;
}

console.log(`Русские триггеры: вписано ${touched}, уже были ${already}, пропущено ${missing.length}`);
if (missing.length) console.log(`Не найдено: ${missing.join(', ')}`);
