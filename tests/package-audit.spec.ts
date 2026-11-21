import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'

const ROOT = process.cwd()

// Custom js-yaml schema recognizing Cordis's `!!js` expression tag
const CORDIS_JS_TAG = new yaml.Type('tag:yaml.org,2002:js', {
  kind: 'scalar',
  construct: (data: string) => ({ __cordisJs: data }),
})
const CORDIS_SCHEMA = yaml.DEFAULT_SCHEMA.extend([CORDIS_JS_TAG])

describe('DSH Plugin Packaging & Bundle Integrity Audit', () => {
  it('declares valid DSH package.json manifest, exports, files, engines, and zero native deps', () => {
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as Record<string, unknown>

    expect(pkg['name']).toBe('dsh-magic-memory')
    expect(pkg['icon']).toBe('./icon.svg')
    expect(pkg['type']).toBe('module')
    expect(pkg['main']).toBe('./dist/index.js')
    expect(pkg['types']).toBe('./dist/index.d.ts')

    const exportsField = pkg['exports'] as Record<string, unknown>
    expect(exportsField['.']).toBeTruthy()
    expect(exportsField['./client']).toEqual({ default: './dist/client.js' })
    expect(exportsField['./locale/*.json']).toBe('./locale/*.json')
    expect(exportsField['./icon']).toBe('./icon.svg')
    expect(exportsField['./package.json']).toBe('./package.json')

    const dshField = pkg['dsh'] as {
      bundle?: { patch?: string }
      client?: { platform?: string; inject?: string[] }
    }
    expect(dshField.bundle?.patch).toBe('./cordis.patch.yml')
    expect(dshField.client?.platform).toBe('web')
    expect(dshField.client?.inject).toEqual(
      expect.arrayContaining([
        '@deepseek-ai/dsh-client-connection',
        '@deepseek-ai/dsh-client-locale',
        '@deepseek-ai/dsh-client-ui-renderer',
        '@deepseek-ai/dsh-client-ui-layout',
        '@deepseek-ai/dsh-client-ui-sidebar',
        '@deepseek-ai/dsh-client-ui-conversation',
        '@deepseek-ai/dsh-client-ui-sidebar-right',
      ]),
    )
    expect(dshField.client?.inject).not.toContain('@deepseek-ai/dsh-client-ui-slots')

    const engines = pkg['engines'] as Record<string, string>
    expect(engines['node']).toMatch(/>=24\.9/)
    expect(engines['dsh']).toBeTruthy()

    // Guarantee zero native SQLite addons in runtime dependencies
    const deps = Object.keys((pkg['dependencies'] as Record<string, string>) ?? {})
    expect(deps).not.toContain('better-sqlite3')
    expect(deps).not.toContain('sqlite3')
  })

  it('ships valid cordis.patch.yml targeting dsh-magic-memory with dshHomePath dbPath', () => {
    const patchPath = resolve(ROOT, 'cordis.patch.yml')
    expect(existsSync(patchPath)).toBe(true)
    const parsed = yaml.load(readFileSync(patchPath, 'utf8'), { schema: CORDIS_SCHEMA }) as Array<{
      insert?: Array<{ id?: string; name?: string; config?: Record<string, unknown> }>
    }>
    expect(Array.isArray(parsed)).toBe(true)
    const entry = parsed[0]?.insert?.[0]
    expect(entry?.id).toBe('dsh-magic-memory')
    expect(entry?.name).toBe('dsh-magic-memory')
    expect((entry?.config?.['dbPath'] as { __cordisJs?: string })?.__cordisJs).toContain('dshHomePath')
  })

  it('ships valid bilingual locale/*.json, docs/DETAIL.md, and <=16 KiB icon.svg', () => {
    for (const loc of ['en', 'zh']) {
      const p = resolve(ROOT, 'locale', `${loc}.json`)
      expect(existsSync(p)).toBe(true)
      const json = JSON.parse(readFileSync(p, 'utf8')) as { meta?: { title?: string; description?: string } }
      expect(json.meta?.title?.trim().length).toBeGreaterThan(0)
      expect(json.meta?.description?.trim().length).toBeGreaterThan(0)
    }

    const iconPath = resolve(ROOT, 'icon.svg')
    expect(existsSync(iconPath)).toBe(true)
    expect(statSync(iconPath).size).toBeLessThanOrEqual(16 * 1024)
    const svg = readFileSync(iconPath, 'utf8')
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')

    expect(existsSync(resolve(ROOT, 'docs/DETAIL.md'))).toBe(true)
    expect(existsSync(resolve(ROOT, 'README.md'))).toBe(true)
  })

  it('produces clean built artifacts dist/index.js, dist/index.d.ts, and compliant dist/client.js', async () => {
    const hostJs = resolve(ROOT, 'dist/index.js')
    const hostDts = resolve(ROOT, 'dist/index.d.ts')
    const clientJs = resolve(ROOT, 'dist/client.js')

    expect(existsSync(hostJs)).toBe(true)
    expect(existsSync(hostDts)).toBe(true)
    expect(existsSync(clientJs)).toBe(true)

    // Verify built Host ESM exports the exact Cordis plugin surface & valid Schemastery defaults
    const mod = (await import(hostJs)) as Record<string, unknown>
    expect(mod['name']).toBe('dsh-magic-memory')
    expect(mod['inject']).toEqual(['tools', 'sessions'])
    expect(mod['Config']).toBeDefined()
    expect(typeof mod['apply']).toBe('function')
    const parsedConfig = (mod['Config'] as (input: unknown) => Record<string, unknown>)({})
    expect(parsedConfig).toBeDefined()

    // Verify compiled Client bundle satisfies DSH's ModuleLoader & zero-internal-UI-import contract
    const clientCode = readFileSync(clientJs, 'utf8')
    expect(clientCode).toContain('window.__ModuleLoader__.load(')
    expect(clientCode).not.toContain('@deepseek-ai/dsh-client-ui-primitives')
    expect(clientCode).not.toContain('react/jsx-runtime')
    expect(clientCode).not.toContain('node:sqlite')

    const reqs = Array.from(clientCode.matchAll(/\brequire\s*\(\s*["']([^"']+)["']\s*\)/g)).map(m => m[1])
    expect(reqs.length).toBeGreaterThan(0)
    expect(reqs.every(spec => spec === 'react')).toBe(true)
  })
})
