import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { minify } from 'html-minifier-terser';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });

const source = await readFile('public/index.html', 'utf8');
const hardened = await minify(source, {
  collapseWhitespace: true,
  conservativeCollapse: true,
  removeComments: true,
  removeRedundantAttributes: true,
  removeEmptyAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  sortAttributes: true,
  sortClassName: true,
  minifyCSS: true,
  minifyJS: {
    compress: {
      passes: 2,
      drop_console: true
    },
    mangle: true,
    format: { comments: false }
  }
});
await writeFile('dist/index.html', hardened, 'utf8');

const sw = await readFile('public/sw.js', 'utf8');
await writeFile('dist/sw.js', sw.replace(/\/\/.*$/gm, '').replace(/\s+/g, ' ').trim(), 'utf8');

console.log('Production assets built in dist/ without source maps.');
