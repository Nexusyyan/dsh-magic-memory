import React, { useEffect, useMemo, useState } from 'react'
import type {
  AvailableModelInfo,
  MagicMemorySettingsPatch,
  MagicMemorySettingsPayload,
  SettingsGetResponse,
  SettingsReindexEmbeddingsResponse,
  SettingsTestEmbeddingResponse,
  SettingsTestLlmResponse,
} from '../../shared/types.js'
import type { MagicMemoryApi } from '../api.js'
import type { TranslateFn } from '../locales.js'
import { SelectMenu, type SelectOption } from './SelectMenu.js'
import { CheckMiniIcon } from './ui-helpers.js'

export interface SettingsTabProps {
  api: MagicMemoryApi
  projectId: string
  t: TranslateFn
  refreshToken: number
  onMutated: () => void
  onError: (msg: string) => void
  onNotice: (msg: string) => void
}

interface DraftState {
  enabled: boolean
  injectOnStart: boolean
  reanchorAfterCompaction: boolean
  autoSearchEnabled: boolean
  baselineBudgetTokens: number
  userProfileBudgetTokens: number
  deltaBudgetTokens: number

  extractorEnabled: boolean
  extractorTriggerTokens: number
  extractorProvider: string
  extractorModel: string
  extractorCustomMode: boolean

  separateDreamerModel: boolean
  dreamerEnabled: boolean
  dreamerTickMinutes: number
  dreamerProvider: string
  dreamerModel: string
  dreamerCustomMode: boolean

  embeddingProvider: 'off' | 'openai-compatible'
  embeddingEndpoint: string
  embeddingModel: string
  embeddingApiKeyInput: string
  embeddingClearApiKey: boolean
  embeddingApiKeyEnv: string
  embeddingTimeoutMs: number
}

const AUTO_VALUE = '__auto__'
const CUSTOM_VALUE = '__custom__'

function encodeModelKey(provider: string, model: string): string {
  return `${provider}::${model}`
}

function decodeModelKey(val: string): { provider: string; model: string } {
  const idx = val.indexOf('::')
  if (idx < 0) return { provider: '', model: '' }
  return { provider: val.slice(0, idx), model: val.slice(idx + 2) }
}

function isRouteInCatalog(provider: string, model: string, catalog: readonly AvailableModelInfo[]): boolean {
  if (!provider && !model) return false
  return catalog.some(m => m.provider === provider && m.id === model)
}

function buildDraft(
  settings: MagicMemorySettingsPayload,
  catalog: readonly AvailableModelInfo[],
): DraftState {
  const extP = settings.extractor.provider.trim()
  const extM = settings.extractor.model.trim()
  const drmP = settings.dreamer.provider.trim()
  const drmM = settings.dreamer.model.trim()
  const separate = settings.dreamer.separateModel === true || extP !== drmP || extM !== drmM
  return {
    enabled: settings.enabled,
    injectOnStart: settings.injectOnStart,
    reanchorAfterCompaction: settings.reanchorAfterCompaction,
    autoSearchEnabled: settings.autoSearch.enabled,
    baselineBudgetTokens: settings.baselineBudgetTokens,
    userProfileBudgetTokens: settings.userProfileBudgetTokens,
    deltaBudgetTokens: settings.deltaBudgetTokens,

    extractorEnabled: settings.extractor.enabled,
    extractorTriggerTokens: settings.extractor.triggerTokens,
    extractorProvider: extP,
    extractorModel: extM,
    extractorCustomMode: (extP.length > 0 || extM.length > 0) && !isRouteInCatalog(extP, extM, catalog),

    separateDreamerModel: separate,
    dreamerEnabled: settings.dreamer.enabled,
    dreamerTickMinutes: settings.dreamer.tickIntervalMinutes,
    dreamerProvider: drmP,
    dreamerModel: drmM,
    dreamerCustomMode: (drmP.length > 0 || drmM.length > 0) && !isRouteInCatalog(drmP, drmM, catalog),

    embeddingProvider: settings.embedding.provider,
    embeddingEndpoint: settings.embedding.endpoint,
    embeddingModel: settings.embedding.model,
    embeddingApiKeyInput: '',
    embeddingClearApiKey: false,
    embeddingApiKeyEnv: settings.embedding.apiKeyEnv,
    embeddingTimeoutMs: settings.embedding.timeoutMs,
  }
}

function SwitchControl({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}): React.ReactElement {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="dmm-switch"
      onClick={() => onChange(!checked)}
    />
  )
}

function ModelSelector({
  id,
  label,
  provider,
  model,
  customMode,
  catalog,
  t,
  onSelectAuto,
  onSelectCatalog,
  onSelectCustom,
  onChangeProvider,
  onChangeModel,
}: {
  id: string
  label: string
  provider: string
  model: string
  customMode: boolean
  catalog: readonly AvailableModelInfo[]
  t: TranslateFn
  onSelectAuto: () => void
  onSelectCatalog: (provider: string, model: string) => void
  onSelectCustom: () => void
  onChangeProvider: (provider: string) => void
  onChangeModel: (model: string) => void
}): React.ReactElement {
  const selectOptions = useMemo<SelectOption[]>(() => {
    const list: SelectOption[] = [
      { value: AUTO_VALUE, label: t('settings.routeAuto') },
    ]
    for (const m of catalog) {
      list.push({
        value: encodeModelKey(m.provider, m.id),
        label: m.name.includes(m.id) ? m.name : m.name,
        sublabel: m.name.includes(m.id) ? m.provider : `${m.provider} · ${m.id}`,
        group: m.providerName || m.provider,
      })
    }
    list.push({ value: CUSTOM_VALUE, label: t('settings.routeCustom') })
    return list
  }, [catalog, t])

  const selectValue = customMode
    ? CUSTOM_VALUE
    : provider && model
      ? encodeModelKey(provider, model)
      : AUTO_VALUE

  return (
    <div className="dmm-field">
      <label className="dmm-label" htmlFor={id}>
        {label}
      </label>
      <SelectMenu
        id={id}
        ariaLabel={label}
        value={selectValue}
        options={selectOptions}
        onChange={val => {
          if (val === AUTO_VALUE) {
            onSelectAuto()
          } else if (val === CUSTOM_VALUE) {
            onSelectCustom()
          } else {
            const parsed = decodeModelKey(val)
            onSelectCatalog(parsed.provider, parsed.model)
          }
        }}
      />

      {customMode && (
        <div className="dmm-settings-form-grid" style={{ marginTop: 4 }}>
          <input
            type="text"
            className="dmm-input"
            placeholder={t('settings.providerPlaceholder')}
            value={provider}
            onChange={e => onChangeProvider(e.target.value)}
          />
          <input
            type="text"
            className="dmm-input"
            placeholder={t('settings.modelPlaceholder')}
            value={model}
            onChange={e => onChangeModel(e.target.value)}
          />
        </div>
      )}
    </div>
  )
}

export function SettingsTab({
  api,
  projectId,
  t,
  refreshToken,
  onMutated,
  onError,
  onNotice,
}: SettingsTabProps): React.ReactElement {
  const [serverState, setServerState] = useState<SettingsGetResponse | null>(null)
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [baseline, setBaseline] = useState<DraftState | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [testingLlm, setTestingLlm] = useState(false)
  const [llmTestResult, setLlmTestResult] = useState<SettingsTestLlmResponse | null>(null)
  const [testingDreamerLlm, setTestingDreamerLlm] = useState(false)
  const [dreamerTestResult, setDreamerTestResult] = useState<SettingsTestLlmResponse | null>(null)

  const [testingEmb, setTestingEmb] = useState(false)
  const [embTestResult, setEmbTestResult] = useState<SettingsTestEmbeddingResponse | null>(null)

  const [reindexing, setReindexing] = useState(false)
  const [reindexResult, setReindexResult] = useState<SettingsReindexEmbeddingsResponse | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    api
      .getSettings(controller.signal)
      .then(res => {
        if (controller.signal.aborted) return
        setServerState(res)
        const nextDraft = buildDraft(res.settings, res.availableModels)
        setDraft(nextDraft)
        setBaseline(nextDraft)
      })
      .catch(err => {
        if (!controller.signal.aborted) onError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [api, refreshToken, onError])

  const isDirty = useMemo(() => {
    if (!draft || !baseline) return false
    return JSON.stringify(draft) !== JSON.stringify(baseline)
  }, [draft, baseline])

  if (!draft || !serverState) {
    return (
      <div className="dmm-empty">
        <p className="dmm-empty-desc">{loading ? t('header.loading') : t('settings.subtitle')}</p>
      </div>
    )
  }

  const catalog = serverState.availableModels
  const effectiveDreamerProvider = draft.separateDreamerModel ? draft.dreamerProvider : draft.extractorProvider
  const effectiveDreamerModel = draft.separateDreamerModel ? draft.dreamerModel : draft.extractorModel

  const extRouteStr = serverState.resolvedExtractorRoute
    ? `${serverState.resolvedExtractorRoute.provider} / ${serverState.resolvedExtractorRoute.model}`
    : t('settings.routeUnresolved')
  const drmRouteStr = serverState.resolvedDreamerRoute
    ? `${serverState.resolvedDreamerRoute.provider} / ${serverState.resolvedDreamerRoute.model}`
    : t('settings.routeUnresolved')
  const activeRouteLabel =
    extRouteStr === drmRouteStr ? extRouteStr : `Extractor: ${extRouteStr} · Dreamer: ${drmRouteStr}`

  const handleSave = async () => {
    setSaving(true)
    try {
      const patch: MagicMemorySettingsPatch = {
        enabled: draft.enabled,
        injectOnStart: draft.injectOnStart,
        reanchorAfterCompaction: draft.reanchorAfterCompaction,
        baselineBudgetTokens: draft.baselineBudgetTokens,
        userProfileBudgetTokens: draft.userProfileBudgetTokens,
        deltaBudgetTokens: draft.deltaBudgetTokens,
        autoSearch: { enabled: draft.autoSearchEnabled },
        extractor: {
          enabled: draft.extractorEnabled,
          triggerTokens: draft.extractorTriggerTokens,
          provider: draft.extractorProvider.trim(),
          model: draft.extractorModel.trim(),
        },
        dreamer: {
          enabled: draft.dreamerEnabled,
          tickIntervalMinutes: draft.dreamerTickMinutes,
          separateModel: draft.separateDreamerModel,
          provider: effectiveDreamerProvider.trim(),
          model: effectiveDreamerModel.trim(),
        },
        embedding: {
          provider: draft.embeddingProvider,
          endpoint: draft.embeddingEndpoint.trim(),
          model: draft.embeddingModel.trim(),
          apiKeyEnv: draft.embeddingApiKeyEnv.trim(),
          timeoutMs: draft.embeddingTimeoutMs,
          ...(draft.embeddingClearApiKey
            ? { clearApiKey: true }
            : draft.embeddingApiKeyInput.trim().length > 0
              ? { apiKey: draft.embeddingApiKeyInput.trim() }
              : {}),
        },
      }
      const updated = await api.updateSettings(patch)
      setServerState(updated)
      const nextDraft = buildDraft(updated.settings, updated.availableModels)
      setDraft(nextDraft)
      setBaseline(nextDraft)
      onNotice(t('settings.savedNotice'))
      onMutated()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleTestLlm = async () => {
    setTestingLlm(true)
    setLlmTestResult(null)
    try {
      const res = await api.testLlm({
        provider: draft.extractorProvider.trim(),
        model: draft.extractorModel.trim(),
      })
      setLlmTestResult(res)
    } catch (err) {
      setLlmTestResult({
        ok: false,
        latencyMs: 0,
        route: null,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTestingLlm(false)
    }
  }

  const handleTestDreamerLlm = async () => {
    setTestingDreamerLlm(true)
    setDreamerTestResult(null)
    try {
      const res = await api.testLlm({
        provider: draft.dreamerProvider.trim(),
        model: draft.dreamerModel.trim(),
      })
      setDreamerTestResult(res)
    } catch (err) {
      setDreamerTestResult({
        ok: false,
        latencyMs: 0,
        route: null,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTestingDreamerLlm(false)
    }
  }

  const handleTestEmbedding = async () => {
    setTestingEmb(true)
    setEmbTestResult(null)
    try {
      const res = await api.testEmbedding({
        provider: draft.embeddingProvider,
        endpoint: draft.embeddingEndpoint.trim(),
        model: draft.embeddingModel.trim(),
        apiKey: draft.embeddingApiKeyInput.trim() || undefined,
        clearApiKey: draft.embeddingClearApiKey,
        apiKeyEnv: draft.embeddingApiKeyEnv.trim(),
        timeoutMs: draft.embeddingTimeoutMs,
      })
      setEmbTestResult(res)
    } catch (err) {
      setEmbTestResult({
        ok: false,
        latencyMs: 0,
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setTestingEmb(false)
    }
  }

  const handleReindex = async () => {
    setReindexing(true)
    setReindexResult(null)
    try {
      const res = await api.reindexEmbeddings({ projectId })
      setReindexResult(res)
      onMutated()
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err))
    } finally {
      setReindexing(false)
    }
  }

  const applyEmbeddingPreset = (endpoint: string, model: string, apiKeyEnv: string) => {
    setDraft(d =>
      d
        ? {
            ...d,
            embeddingProvider: 'openai-compatible',
            embeddingEndpoint: endpoint,
            embeddingModel: model,
            embeddingApiKeyEnv: apiKeyEnv,
          }
        : d,
    )
  }

  return (
    <div className="dmm-stack" data-testid="magic-memory-settings">
      {/* ── Section 1: Magic Memory Background LLM ── */}
      <section className="dmm-settings-card">
        <div className="dmm-settings-head">
          <div>
            <h3 className="dmm-section-title">{t('settings.llmSection')}</h3>
            <p className="dmm-section-desc">{t('settings.llmDesc')}</p>
          </div>
          <span className="dmm-badge dmm-badge-mono">{t('settings.activeRoute', { route: activeRouteLabel })}</span>
        </div>

        <div className="dmm-settings-body">
          <ModelSelector
            id="dmm-llm-extractor-model"
            label={draft.separateDreamerModel ? t('settings.extractorModelLabel') : t('settings.sharedModelLabel')}
            provider={draft.extractorProvider}
            model={draft.extractorModel}
            customMode={draft.extractorCustomMode}
            catalog={catalog}
            t={t}
            onSelectAuto={() =>
              setDraft(d =>
                d
                  ? {
                      ...d,
                      extractorProvider: '',
                      extractorModel: '',
                      extractorCustomMode: false,
                      ...(d.separateDreamerModel
                        ? {}
                        : { dreamerProvider: '', dreamerModel: '', dreamerCustomMode: false }),
                    }
                  : d,
              )
            }
            onSelectCatalog={(p, m) =>
              setDraft(d =>
                d
                  ? {
                      ...d,
                      extractorProvider: p,
                      extractorModel: m,
                      extractorCustomMode: false,
                      ...(d.separateDreamerModel
                        ? {}
                        : { dreamerProvider: p, dreamerModel: m, dreamerCustomMode: false }),
                    }
                  : d,
              )
            }
            onSelectCustom={() =>
              setDraft(d => (d ? { ...d, extractorCustomMode: true } : d))
            }
            onChangeProvider={p =>
              setDraft(d =>
                d
                  ? {
                      ...d,
                      extractorProvider: p,
                      ...(d.separateDreamerModel ? {} : { dreamerProvider: p }),
                    }
                  : d,
              )
            }
            onChangeModel={m =>
              setDraft(d =>
                d
                  ? {
                      ...d,
                      extractorModel: m,
                      ...(d.separateDreamerModel ? {} : { dreamerModel: m }),
                    }
                  : d,
              )
            }
          />

          <div className="dmm-row-between">
            <label className="dmm-checkbox">
              <input
                type="checkbox"
                checked={draft.separateDreamerModel}
                onChange={e => {
                  const sep = e.target.checked
                  setDraft(d =>
                    d
                      ? {
                          ...d,
                          separateDreamerModel: sep,
                          ...(sep
                            ? {}
                            : {
                                dreamerProvider: d.extractorProvider,
                                dreamerModel: d.extractorModel,
                                dreamerCustomMode: d.extractorCustomMode,
                              }),
                        }
                      : d,
                  )
                }}
              />
              <span>{t('settings.separateDreamerLabel')}</span>
            </label>

            <button
              type="button"
              className="dmm-btn dmm-btn-sm"
              disabled={testingLlm}
              onClick={() => void handleTestLlm()}
            >
              {testingLlm ? t('settings.testing') : t('settings.testLlm')}
            </button>
          </div>

          {draft.separateDreamerModel && (
            <div className="dmm-stack" style={{ gap: 8 }}>
              <ModelSelector
                id="dmm-llm-dreamer-model"
                label={t('settings.dreamerModelLabel')}
                provider={draft.dreamerProvider}
                model={draft.dreamerModel}
                customMode={draft.dreamerCustomMode}
                catalog={catalog}
                t={t}
                onSelectAuto={() =>
                  setDraft(d => (d ? { ...d, dreamerProvider: '', dreamerModel: '', dreamerCustomMode: false } : d))
                }
                onSelectCatalog={(p, m) =>
                  setDraft(d => (d ? { ...d, dreamerProvider: p, dreamerModel: m, dreamerCustomMode: false } : d))
                }
                onSelectCustom={() => setDraft(d => (d ? { ...d, dreamerCustomMode: true } : d))}
                onChangeProvider={p => setDraft(d => (d ? { ...d, dreamerProvider: p } : d))}
                onChangeModel={m => setDraft(d => (d ? { ...d, dreamerModel: m } : d))}
              />
              <div className="dmm-row" style={{ justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="dmm-btn dmm-btn-sm"
                  disabled={testingDreamerLlm}
                  onClick={() => void handleTestDreamerLlm()}
                >
                  {testingDreamerLlm ? t('settings.testing') : t('settings.testDreamerLlm')}
                </button>
              </div>
              {dreamerTestResult && (
                <div className={`dmm-test-result ${dreamerTestResult.ok ? 'dmm-test-ok' : 'dmm-test-fail'}`}>
                  {dreamerTestResult.ok && <CheckMiniIcon size={13} />}
                  <span>{dreamerTestResult.message}</span>
                </div>
              )}
            </div>
          )}

          {llmTestResult && (
            <div className={`dmm-test-result ${llmTestResult.ok ? 'dmm-test-ok' : 'dmm-test-fail'}`}>
              {llmTestResult.ok && <CheckMiniIcon size={13} />}
              <span>{llmTestResult.message}</span>
            </div>
          )}

          <div>
            <div className="dmm-settings-row">
              <div className="dmm-settings-row-info">
                <span className="dmm-settings-row-title">{t('settings.enabledLabel')}</span>
                <span className="dmm-settings-row-hint">{t('settings.enabledHint')}</span>
              </div>
              <SwitchControl
                checked={draft.enabled}
                label={t('settings.enabledLabel')}
                onChange={enabled => setDraft(d => (d ? { ...d, enabled } : d))}
              />
            </div>

            <div className="dmm-settings-row">
              <div className="dmm-settings-row-info">
                <span className="dmm-settings-row-title">{t('settings.extractorEnabledLabel')}</span>
                <span className="dmm-settings-row-hint">{t('settings.extractorEnabledHint')}</span>
              </div>
              <SwitchControl
                checked={draft.extractorEnabled}
                label={t('settings.extractorEnabledLabel')}
                onChange={extractorEnabled => setDraft(d => (d ? { ...d, extractorEnabled } : d))}
              />
            </div>

            <div className="dmm-settings-row">
              <div className="dmm-settings-row-info">
                <span className="dmm-settings-row-title">{t('settings.dreamerEnabledLabel')}</span>
                <span className="dmm-settings-row-hint">{t('settings.dreamerEnabledHint')}</span>
              </div>
              <SwitchControl
                checked={draft.dreamerEnabled}
                label={t('settings.dreamerEnabledLabel')}
                onChange={dreamerEnabled => setDraft(d => (d ? { ...d, dreamerEnabled } : d))}
              />
            </div>
          </div>

          <div className="dmm-settings-form-grid">
            <div className="dmm-field">
              <label className="dmm-label" htmlFor="dmm-trigger-tokens">
                {t('settings.triggerTokensLabel')}
              </label>
              <input
                id="dmm-trigger-tokens"
                type="number"
                className="dmm-input"
                min={1000}
                max={200000}
                step={500}
                value={draft.extractorTriggerTokens}
                onChange={e =>
                  setDraft(d => (d ? { ...d, extractorTriggerTokens: Number(e.target.value) || 12000 } : d))
                }
              />
            </div>
            <div className="dmm-field">
              <label className="dmm-label" htmlFor="dmm-tick-interval">
                {t('settings.tickIntervalLabel')}
              </label>
              <input
                id="dmm-tick-interval"
                type="number"
                className="dmm-input"
                min={1}
                max={1440}
                step={1}
                value={draft.dreamerTickMinutes}
                onChange={e =>
                  setDraft(d => (d ? { ...d, dreamerTickMinutes: Number(e.target.value) || 15 } : d))
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: Embedding Model ── */}
      <section className="dmm-settings-card">
        <div className="dmm-settings-head">
          <div>
            <h3 className="dmm-section-title">{t('settings.embeddingSection')}</h3>
            <p className="dmm-section-desc">{t('settings.embeddingDesc')}</p>
          </div>
          <div className="dmm-segmented" role="group" aria-label={t('settings.embeddingSection')}>
            <button
              type="button"
              className="dmm-seg-btn"
              data-active={draft.embeddingProvider === 'off'}
              onClick={() => setDraft(d => (d ? { ...d, embeddingProvider: 'off' } : d))}
            >
              {t('settings.embModeOff')}
            </button>
            <button
              type="button"
              className="dmm-seg-btn"
              data-active={draft.embeddingProvider === 'openai-compatible'}
              onClick={() => setDraft(d => (d ? { ...d, embeddingProvider: 'openai-compatible' } : d))}
            >
              {t('settings.embModeOpenai')}
            </button>
          </div>
        </div>

        {draft.embeddingProvider === 'openai-compatible' && (
          <div className="dmm-settings-body">
            <div className="dmm-row">
              <span className="dmm-label">{t('settings.embPresets')}:</span>
              <button
                type="button"
                className="dmm-preset-btn"
                onClick={() => applyEmbeddingPreset('https://api.openai.com/v1', 'text-embedding-3-small', 'OPENAI_API_KEY')}
              >
                OpenAI
              </button>
              <button
                type="button"
                className="dmm-preset-btn"
                onClick={() => applyEmbeddingPreset('https://api.siliconflow.cn/v1', 'BAAI/bge-m3', 'SILICONFLOW_API_KEY')}
              >
                SiliconFlow
              </button>
              <button
                type="button"
                className="dmm-preset-btn"
                onClick={() => applyEmbeddingPreset('http://localhost:11434/v1', 'nomic-embed-text', '')}
              >
                Ollama (Local)
              </button>
            </div>

            <div className="dmm-settings-form-grid">
              <div className="dmm-field">
                <label className="dmm-label" htmlFor="dmm-emb-endpoint">
                  {t('settings.embEndpointLabel')}
                </label>
                <input
                  id="dmm-emb-endpoint"
                  type="url"
                  className="dmm-input"
                  placeholder={t('settings.embEndpointPlaceholder')}
                  value={draft.embeddingEndpoint}
                  onChange={e => setDraft(d => (d ? { ...d, embeddingEndpoint: e.target.value } : d))}
                />
              </div>

              <div className="dmm-field">
                <label className="dmm-label" htmlFor="dmm-emb-model">
                  {t('settings.embModelLabel')}
                </label>
                <input
                  id="dmm-emb-model"
                  type="text"
                  className="dmm-input"
                  placeholder={t('settings.embModelPlaceholder')}
                  value={draft.embeddingModel}
                  onChange={e => setDraft(d => (d ? { ...d, embeddingModel: e.target.value } : d))}
                />
              </div>
            </div>

            <div className="dmm-settings-form-grid">
              <div className="dmm-field">
                <div className="dmm-row-between">
                  <label className="dmm-label" htmlFor="dmm-emb-key">
                    {t('settings.embApiKeyLabel')}
                  </label>
                  {serverState.settings.embedding.hasApiKey && !draft.embeddingClearApiKey && (
                    <button
                      type="button"
                      className="dmm-btn dmm-btn-ghost dmm-btn-danger"
                      style={{ height: 20, fontSize: 11, padding: '0 6px' }}
                      onClick={() =>
                        setDraft(d => (d ? { ...d, embeddingClearApiKey: true, embeddingApiKeyInput: '' } : d))
                      }
                    >
                      {t('settings.embClearKey')}
                    </button>
                  )}
                </div>
                <input
                  id="dmm-emb-key"
                  type="password"
                  className="dmm-input"
                  autoComplete="off"
                  placeholder={
                    serverState.settings.embedding.hasApiKey && !draft.embeddingClearApiKey
                      ? t('settings.embApiKeySavedPlaceholder', {
                          preview: serverState.settings.embedding.apiKeyPreview,
                        })
                      : t('settings.embApiKeyPlaceholder')
                  }
                  value={draft.embeddingApiKeyInput}
                  onChange={e =>
                    setDraft(d =>
                      d ? { ...d, embeddingApiKeyInput: e.target.value, embeddingClearApiKey: false } : d,
                    )
                  }
                />
              </div>

              <div className="dmm-field">
                <div className="dmm-row-between">
                  <label className="dmm-label" htmlFor="dmm-emb-env">
                    {t('settings.embApiKeyEnvLabel')}
                  </label>
                  {serverState.hasEnvEmbeddingKey && (
                    <span className="dmm-status-inline">
                      <CheckMiniIcon size={11} />
                      <span>{t('settings.embEnvDetected')}</span>
                    </span>
                  )}
                </div>
                <input
                  id="dmm-emb-env"
                  type="text"
                  className="dmm-input"
                  placeholder="OPENAI_API_KEY"
                  value={draft.embeddingApiKeyEnv}
                  onChange={e => setDraft(d => (d ? { ...d, embeddingApiKeyEnv: e.target.value } : d))}
                />
              </div>
            </div>

            <div className="dmm-row">
              <button
                type="button"
                className="dmm-btn dmm-btn-sm"
                disabled={testingEmb}
                onClick={() => void handleTestEmbedding()}
              >
                {testingEmb ? t('settings.testing') : t('settings.embTest')}
              </button>
              <button
                type="button"
                className="dmm-btn dmm-btn-sm"
                disabled={reindexing || isDirty}
                onClick={() => void handleReindex()}
              >
                {reindexing ? t('settings.embReindexing') : t('settings.embReindex')}
              </button>
            </div>

            {embTestResult && (
              <div className={`dmm-test-result ${embTestResult.ok ? 'dmm-test-ok' : 'dmm-test-fail'}`}>
                {embTestResult.ok && <CheckMiniIcon size={13} />}
                <span>{embTestResult.message}</span>
              </div>
            )}

            {reindexResult && (
              <div className={`dmm-test-result ${reindexResult.failed === 0 ? 'dmm-test-ok' : 'dmm-test-fail'}`}>
                {reindexResult.failed === 0 && <CheckMiniIcon size={13} />}
                <span>{reindexResult.message}</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Section 3: Context Loop & Token Budgets ── */}
      <section className="dmm-settings-card">
        <div className="dmm-settings-head">
          <div>
            <h3 className="dmm-section-title">{t('settings.loopSection')}</h3>
            <p className="dmm-section-desc">{t('settings.loopDesc')}</p>
          </div>
        </div>

        <div className="dmm-settings-body">
          <div>
            <div className="dmm-settings-row">
              <span className="dmm-settings-row-title">{t('settings.injectOnStartLabel')}</span>
              <SwitchControl
                checked={draft.injectOnStart}
                label={t('settings.injectOnStartLabel')}
                onChange={injectOnStart => setDraft(d => (d ? { ...d, injectOnStart } : d))}
              />
            </div>
            <div className="dmm-settings-row">
              <span className="dmm-settings-row-title">{t('settings.reanchorLabel')}</span>
              <SwitchControl
                checked={draft.reanchorAfterCompaction}
                label={t('settings.reanchorLabel')}
                onChange={reanchorAfterCompaction => setDraft(d => (d ? { ...d, reanchorAfterCompaction } : d))}
              />
            </div>
            <div className="dmm-settings-row">
              <span className="dmm-settings-row-title">{t('settings.autoSearchLabel')}</span>
              <SwitchControl
                checked={draft.autoSearchEnabled}
                label={t('settings.autoSearchLabel')}
                onChange={autoSearchEnabled => setDraft(d => (d ? { ...d, autoSearchEnabled } : d))}
              />
            </div>
          </div>

          <div className="dmm-settings-grid-3">
            <div className="dmm-field">
              <label className="dmm-label" htmlFor="dmm-budget-base">
                {t('settings.baselineBudgetLabel')}
              </label>
              <input
                id="dmm-budget-base"
                type="number"
                className="dmm-input"
                min={200}
                max={32000}
                step={100}
                value={draft.baselineBudgetTokens}
                onChange={e =>
                  setDraft(d => (d ? { ...d, baselineBudgetTokens: Number(e.target.value) || 3200 } : d))
                }
              />
            </div>
            <div className="dmm-field">
              <label className="dmm-label" htmlFor="dmm-budget-profile">
                {t('settings.profileBudgetLabel')}
              </label>
              <input
                id="dmm-budget-profile"
                type="number"
                className="dmm-input"
                min={100}
                max={8000}
                step={50}
                value={draft.userProfileBudgetTokens}
                onChange={e =>
                  setDraft(d => (d ? { ...d, userProfileBudgetTokens: Number(e.target.value) || 600 } : d))
                }
              />
            </div>
            <div className="dmm-field">
              <label className="dmm-label" htmlFor="dmm-budget-delta">
                {t('settings.deltaBudgetLabel')}
              </label>
              <input
                id="dmm-budget-delta"
                type="number"
                className="dmm-input"
                min={100}
                max={8000}
                step={50}
                value={draft.deltaBudgetTokens}
                onChange={e =>
                  setDraft(d => (d ? { ...d, deltaBudgetTokens: Number(e.target.value) || 800 } : d))
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Save Bar (floats sticky only when unsaved edits exist) ── */}
      <div className="dmm-save-bar" data-dirty={isDirty}>
        <span className="dmm-meta">
          {isDirty ? t('settings.unsaved') : serverState.dbPath}
        </span>
        <div className="dmm-row">
          <button
            type="button"
            className="dmm-btn"
            disabled={!isDirty || saving}
            onClick={() => baseline && setDraft({ ...baseline })}
          >
            {t('settings.reset')}
          </button>
          <button
            type="button"
            className="dmm-btn dmm-btn-primary"
            disabled={!isDirty || saving}
            onClick={() => void handleSave()}
          >
            {saving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
