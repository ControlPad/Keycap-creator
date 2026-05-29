// Copies the Tabler icon SVGs from the @tabler/icons package into public/icons/
// as flat files plus a manifest.json, so the static site can serve them without
// any backend (mirrors the old /api/keycap/icons endpoint).
//
//   outline icon "home"  -> public/icons/home.svg
//   filled  icon "home"  -> public/icons/home-filled.svg
//
// This naming keeps the SymbolBrowser variant filter (outline = no "-filled"
// suffix, filled = ends with "-filled") working unchanged.
//
// Runs automatically before `dev` and `build` (see package.json), and in CI.

import fs from 'node:fs';
import path from 'node:path';

function findIconsRoot() {
  // @tabler/icons (v3) restricts its `exports` map, so we can't require.resolve
  // its package.json. Walk up from the cwd looking for the installed package's
  // icon dirs (icons/outline + icons/filled) instead.
  let dir = process.cwd();
  while (true) {
    const base = path.join(dir, 'node_modules', '@tabler', 'icons', 'icons');
    if (fs.existsSync(path.join(base, 'outline')) && fs.existsSync(path.join(base, 'filled'))) {
      return base;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    'Could not find @tabler/icons (icons/outline + icons/filled). Run `npm install` first.',
  );
}

function svgFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.svg'))
    .map((f) => f.slice(0, -4)); // strip ".svg"
}

function main() {
  const iconsRoot = findIconsRoot();
  const outDir = path.join(process.cwd(), 'public', 'icons');

  // Fresh output dir.
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const names = [];

  for (const name of svgFiles(path.join(iconsRoot, 'outline'))) {
    fs.copyFileSync(path.join(iconsRoot, 'outline', `${name}.svg`), path.join(outDir, `${name}.svg`));
    names.push(name);
  }

  for (const name of svgFiles(path.join(iconsRoot, 'filled'))) {
    const target = `${name}-filled`;
    fs.copyFileSync(path.join(iconsRoot, 'filled', `${name}.svg`), path.join(outDir, `${target}.svg`));
    names.push(target);
  }

  names.sort();
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(names));

  console.log(`sync-icons: wrote ${names.length} icons + manifest to public/icons/`);
}

main();
