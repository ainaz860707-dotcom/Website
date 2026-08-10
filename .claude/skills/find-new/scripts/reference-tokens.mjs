#!/usr/bin/env node
import { extractTokens, formatTokens } from '../../../../tools/reference-tokens.mjs';

const urls = process.argv.slice(2);
if (!urls.length) {
  process.stderr.write('использование: node reference-tokens.mjs <url> [<url> ...]\n');
  process.exit(1);
}

for (const url of urls) process.stdout.write(formatTokens(await extractTokens(url)));
