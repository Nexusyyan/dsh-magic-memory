#!/usr/bin/env node
/**
 * Build script for `dsh-magic-memory`:
 * 1. Bundles Host ESM (`dist/index.js`) with externalized `node:*` and `@deepseek-ai/*`.
 * 2. Emits TypeScript declarations (`dist/index.d.ts`) via `tsc --emitDeclarationOnly`.
 * 3. Bundles Browser/Desktop Client (`dist/client.js`) wrapped in DSH's exact
 *    `window.__ModuleLoader__.load({ id: 'dsh-magic-memory', factory(require) { ... } })`
 *    contract with ONLY `require('react')` externalized and zero forbidden internal UI imports.
 */

import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as esbuild from 'esbuild'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DIST = resolve(ROOT, 'dist')

const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'))
const PLUGIN_ID = pkg.name

function cleanDist() {
  rmSync(DIST, { recursive: true, force: true })
  mkdirSync(DIST, { recursive: true })
}

async function buildHost() {
  await esbuild.build({
    entryPoints: [resolve(ROOT, 'src/index.ts')],
    outfile: resolve(DIST, 'index.js'),
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node24',
    sourcemap: true,
    external: ['node:*', '@deepseek-ai/*'],
    logLevel: 'info',
  })

  // Emit declaration files for Host entry and services
  const tscBin = resolve(ROOT, 'node_modules/.bin/tsc')
  execFileSync(tscBin, ['-p', resolve(ROOT, 'tsconfig.json'), '--emitDeclarationOnly'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
}

async function buildClient() {
  const result = await esbuild.build({
    entryPoints: [resolve(ROOT, 'src/client/index.tsx')],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    external: ['react'],
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    minifySyntax: true,
    logLevel: 'info',
  })

  const output = result.outputFiles?.[0]
  if (!output) {
    throw new Error('esbuild produced no output for client bundle')
  }

  const cjsCode = output.text

  // Audit every require(...) in the compiled browser bundle:
  // ONLY `react` is permitted — zero internal DSH UI package imports and zero node:* builtins.
  const requireMatches = Array.from(cjsCode.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g)).map(m => m[1])
  const disallowed = requireMatches.filter(spec => spec !== 'react')
  if (disallowed.length > 0) {
    throw new Error(
      `Client bundle contains disallowed require() specifiers: ${Array.from(new Set(disallowed)).join(', ')}`,
    )
  }

  const wrapped = [
    `/* ${PLUGIN_ID}@${pkg.version} — DSH browser client bundle */`,
    `window.__ModuleLoader__.load({`,
    `  id: ${JSON.stringify(PLUGIN_ID)},`,
    `  factory: function(require) {`,
    `    var module = { exports: {} };`,
    `    var exports = module.exports;`,
    cjsCode,
    `    return module.exports;`,
    `  }`,
    `});`,
    '',
  ].join('\n')

  writeFileSync(resolve(DIST, 'client.js'), wrapped, 'utf8')
}

async function main() {
  cleanDist()
  await buildHost()
  await buildClient()
  console.log(`[build] Built ${PLUGIN_ID}@${pkg.version} -> dist/index.js, dist/index.d.ts, dist/client.js`)
}

main().catch(err => {
  console.error('[build] Failed:', err)
  process.exit(1)
})
