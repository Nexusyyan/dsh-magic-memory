/**
 * Scoped stylesheet (`.dmm-*`) inheriting DSH's `--dsw-alias-*` design tokens
 * for seamless Light & Dark theme parity with zero dependency on internal UI packages.
 */

const STYLE_ELEMENT_ID = 'dsh-magic-memory-styles'

export const MAGIC_MEMORY_CSS = `
.dmm-root {
  --dmm-bg: var(--dsw-alias-bg-page, #ffffff);
  --dmm-surface: var(--dsw-alias-bg-layer, #f7f8fa);
  --dmm-surface-hover: var(--dsw-alias-bg-hover, #eef0f4);
  --dmm-border: var(--dsw-alias-border-l2, rgba(127, 134, 152, 0.22));
  --dmm-border-strong: var(--dsw-alias-border-l1, rgba(127, 134, 152, 0.36));
  --dmm-fg: var(--dsw-alias-text-l1, #181a1f);
  --dmm-fg-muted: var(--dsw-alias-text-l2, #5b6270);
  --dmm-fg-subtle: var(--dsw-alias-text-l3, #828a99);
  --dmm-accent: var(--dsw-alias-brand-primary, #4d6bfe);
  --dmm-accent-soft: color-mix(in srgb, var(--dmm-accent) 12%, transparent);
  --dmm-success: #16a34a;
  --dmm-warn: #d97706;
  --dmm-danger: #dc2626;
  --dmm-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  color: var(--dmm-fg);
  background: var(--dmm-bg);
  font-size: 12.5px;
  line-height: 1.45;
  box-sizing: border-box;
}

.dmm-root *, .dmm-root *::before, .dmm-root *::after {
  box-sizing: border-box;
}

.dmm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px 8px;
  border-bottom: 1px solid var(--dmm-border);
  flex-shrink: 0;
}

.dmm-title-group {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.dmm-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.dmm-header-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.dmm-select, .dmm-input, .dmm-textarea {
  font: inherit;
  color: var(--dmm-fg);
  background: var(--dmm-surface);
  border: 1px solid var(--dmm-border);
  border-radius: 6px;
  padding: 5px 8px;
  outline: none;
  transition: border-color 120ms ease;
}

.dmm-select:focus, .dmm-input:focus, .dmm-textarea:focus {
  border-color: var(--dmm-accent);
}

.dmm-select-compact {
  max-width: 150px;
  font-size: 12px;
  padding: 3px 6px;
}

.dmm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 9px;
  border-radius: 6px;
  border: 1px solid var(--dmm-border);
  background: var(--dmm-surface);
  color: var(--dmm-fg);
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease, border-color 120ms ease, opacity 120ms ease;
}

.dmm-btn:hover:not(:disabled) {
  background: var(--dmm-surface-hover);
  border-color: var(--dmm-border-strong);
}

.dmm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dmm-btn-primary {
  background: var(--dmm-accent);
  border-color: var(--dmm-accent);
  color: #ffffff;
}

.dmm-btn-primary:hover:not(:disabled) {
  background: var(--dmm-accent);
  filter: brightness(1.06);
}

.dmm-btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--dmm-fg-muted);
  padding: 3px 6px;
}

.dmm-btn-ghost:hover:not(:disabled) {
  background: var(--dmm-surface-hover);
  color: var(--dmm-fg);
}

.dmm-btn-danger {
  color: var(--dmm-danger);
}

.dmm-tabs {
  display: flex;
  gap: 2px;
  padding: 6px 10px 0;
  border-bottom: 1px solid var(--dmm-border);
  flex-shrink: 0;
  overflow-x: auto;
}

.dmm-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 9px 7px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  color: var(--dmm-fg-muted);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
}

.dmm-tab:hover {
  color: var(--dmm-fg);
}

.dmm-tab[aria-selected="true"] {
  color: var(--dmm-accent);
  border-bottom-color: var(--dmm-accent);
}

.dmm-tab-count {
  font-family: var(--dmm-mono);
  font-size: 10.5px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--dmm-surface);
  color: var(--dmm-fg-muted);
}

.dmm-banner {
  margin: 8px 12px 0;
  padding: 7px 10px;
  border-radius: 6px;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}

.dmm-banner-error {
  background: color-mix(in srgb, var(--dmm-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--dmm-danger) 35%, transparent);
  color: var(--dmm-danger);
}

.dmm-banner-info {
  background: var(--dmm-accent-soft);
  border: 1px solid color-mix(in srgb, var(--dmm-accent) 30%, transparent);
  color: var(--dmm-fg);
}

.dmm-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dmm-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.dmm-row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}

.dmm-search-bar {
  display: flex;
  gap: 6px;
}

.dmm-search-bar .dmm-input {
  flex: 1;
  min-width: 0;
}

.dmm-chips {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.dmm-chip {
  font: inherit;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--dmm-border);
  background: transparent;
  color: var(--dmm-fg-muted);
  cursor: pointer;
}

.dmm-chip[data-active="true"] {
  background: var(--dmm-accent-soft);
  border-color: var(--dmm-accent);
  color: var(--dmm-accent);
  font-weight: 500;
}

.dmm-card {
  border: 1px solid var(--dmm-border);
  border-radius: 8px;
  padding: 9px 10px;
  background: var(--dmm-surface);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dmm-card-content {
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dmm-fg);
}

.dmm-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 11px;
  color: var(--dmm-fg-subtle);
}

.dmm-badge {
  display: inline-flex;
  align-items: center;
  font-family: var(--dmm-mono);
  font-size: 10.5px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 4px;
  border: 1px solid var(--dmm-border);
  background: var(--dmm-bg);
  color: var(--dmm-fg-muted);
}

.dmm-badge-accent {
  background: var(--dmm-accent-soft);
  border-color: color-mix(in srgb, var(--dmm-accent) 30%, transparent);
  color: var(--dmm-accent);
}

.dmm-badge-ok {
  background: color-mix(in srgb, var(--dmm-success) 12%, transparent);
  border-color: color-mix(in srgb, var(--dmm-success) 35%, transparent);
  color: var(--dmm-success);
}

.dmm-badge-warn {
  background: color-mix(in srgb, var(--dmm-warn) 12%, transparent);
  border-color: color-mix(in srgb, var(--dmm-warn) 35%, transparent);
  color: var(--dmm-warn);
}

.dmm-badge-danger {
  background: color-mix(in srgb, var(--dmm-danger) 12%, transparent);
  border-color: color-mix(in srgb, var(--dmm-danger) 35%, transparent);
  color: var(--dmm-danger);
}

.dmm-section-title {
  font-size: 11.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--dmm-fg-muted);
  margin: 4px 0 2px;
}

.dmm-empty {
  padding: 20px 12px;
  text-align: center;
  color: var(--dmm-fg-subtle);
  border: 1px dashed var(--dmm-border);
  border-radius: 8px;
}

.dmm-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.dmm-stat-card {
  border: 1px solid var(--dmm-border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--dmm-surface);
}

.dmm-stat-label {
  font-size: 11px;
  color: var(--dmm-fg-muted);
}

.dmm-stat-value {
  font-family: var(--dmm-mono);
  font-size: 15px;
  font-weight: 600;
  margin-top: 2px;
}

.dmm-progress {
  width: 100%;
  height: 6px;
  border-radius: 999px;
  background: var(--dmm-border);
  overflow: hidden;
  margin-top: 6px;
}

.dmm-progress-fill {
  height: 100%;
  background: var(--dmm-accent);
  border-radius: 999px;
  transition: width 200ms ease;
}

.dmm-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 18, 0.48);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.dmm-modal {
  width: min(480px, 100%);
  max-height: 85vh;
  overflow-y: auto;
  background: var(--dmm-bg);
  color: var(--dmm-fg);
  border: 1px solid var(--dmm-border-strong);
  border-radius: 10px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);
}

.dmm-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dmm-label {
  font-size: 11.5px;
  font-weight: 500;
  color: var(--dmm-fg-muted);
}

.dmm-pre {
  font-family: var(--dmm-mono);
  font-size: 11.5px;
  background: var(--dmm-surface);
  border: 1px solid var(--dmm-border);
  border-radius: 6px;
  padding: 8px;
  max-height: 280px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.dmm-page {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--dsw-alias-bg-page, #ffffff);
}

.dmm-page .dmm-root {
  max-width: 980px;
  width: 100%;
  margin: 0 auto;
  padding: 8px 16px 0;
}

.dmm-page .dmm-stat-grid {
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
}

.dmm-header-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary, var(--dsw-alias-text-l2, #5b6270));
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease, color 120ms ease;
}

.dmm-header-action-btn:hover {
  background: var(--dsw-alias-bg-hover, rgba(127, 134, 152, 0.14));
  color: var(--dsw-alias-text-l1, #181a1f);
}
`

export function ensureMagicMemoryStyles(): void {
  if (typeof document === 'undefined' || !document.head) return
  if (document.getElementById(STYLE_ELEMENT_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ELEMENT_ID
  style.setAttribute('data-plugin', 'dsh-magic-memory')
  style.textContent = MAGIC_MEMORY_CSS
  document.head.appendChild(style)
}
