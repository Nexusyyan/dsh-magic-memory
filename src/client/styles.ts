/**
 * Scoped stylesheet (`.dmm-*`) strictly mapped to real `@deepseek-ai/dsh-client-ui-theme`
 * design tokens (`--dsw-alias-*`) for native Light & Dark parity inside DSH Desktop and Web.
 */

const STYLE_ELEMENT_ID = 'dsh-magic-memory-styles'

export const MAGIC_MEMORY_CSS = `
.dmm-page,
.dmm-root {
  --dmm-bg: var(--dsw-alias-bg-base, #ffffff);
  --dmm-surface: var(--dsw-alias-card-fill, #f7f8fa);
  --dmm-surface-raised: var(--dsw-alias-bg-layer-1, #ffffff);
  --dmm-surface-hover: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.06));
  --dmm-surface-active: var(--dsw-alias-interactive-bg-active, rgba(38, 49, 72, 0.1));
  --dmm-border-subtle: var(--dsw-alias-border-l1, rgba(0, 0, 0, 0.06));
  --dmm-border: var(--dsw-alias-border-l2, rgba(0, 0, 0, 0.12));
  --dmm-border-strong: var(--dsw-alias-border-l3, rgba(0, 0, 0, 0.18));
  --dmm-fg: var(--dsw-alias-label-primary, #0f1115);
  --dmm-fg-secondary: var(--dsw-alias-label-secondary, #4b5563);
  --dmm-fg-muted: var(--dsw-alias-label-tertiary, #6b7280);
  --dmm-primary-fill: var(--dsw-alias-button-primary-fill, #0f1115);
  --dmm-primary-hover: var(--dsw-alias-button-primary-hover, #2b303a);
  --dmm-primary-fg: var(--dsw-alias-label-primary-foreground, #ffffff);
  --dmm-accent: var(--dsw-alias-state-business-primary, #4176e6);
  --dmm-accent-soft: color-mix(in srgb, var(--dmm-accent) 12%, transparent);
  --dmm-accent-border: color-mix(in srgb, var(--dmm-accent) 34%, transparent);
  --dmm-ok: #15803d;
  --dmm-warn: var(--dsw-alias-state-warn-label, #d97706);
  --dmm-danger: var(--dsw-alias-state-error-primary, #dc2626);
  --dmm-focus: var(--dsw-focus-ring-color, rgba(65, 118, 230, 0.45));
  --dmm-card-shadow: 0 1px 2px rgba(15, 17, 21, 0.04);
  --dmm-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  color: var(--dmm-fg);
  background: var(--dmm-bg);
  color-scheme: light;
  font-size: 13px;
  line-height: 1.5;
  box-sizing: border-box;
  -webkit-font-smoothing: antialiased;
}

body[data-ds-dark-theme] .dmm-page,
body[data-ds-dark-theme] .dmm-root {
  --dmm-ok: #4ade80;
  --dmm-warn: #fbbf24;
  --dmm-card-shadow: none;
  color-scheme: dark;
}

.dmm-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  width: 100%;
}

.dmm-root *,
.dmm-root *::before,
.dmm-root *::after {
  box-sizing: border-box;
}

.dmm-page {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dmm-page .dmm-root {
  max-width: 960px;
  margin: 0 auto;
  padding: 20px 28px 0;
}

/* ── Header ── */
.dmm-header {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--dmm-border-subtle);
  flex-shrink: 0;
}

.dmm-page .dmm-header {
  padding: 0 0 16px;
  border-bottom: none;
}

.dmm-title-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.dmm-title-group {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dmm-title-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  background: var(--dmm-accent-soft);
  color: var(--dmm-accent);
  flex-shrink: 0;
}

.dmm-page .dmm-title-icon {
  width: 30px;
  height: 30px;
  border-radius: 8px;
}

.dmm-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.015em;
  color: var(--dmm-fg);
  white-space: nowrap;
}

.dmm-page .dmm-title {
  font-size: 19px;
  letter-spacing: -0.02em;
}

.dmm-subtitle {
  font-size: 12.5px;
  color: var(--dmm-fg-muted);
  margin: 0;
}

.dmm-header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* ── Form Controls & Buttons ── */
.dmm-select,
.dmm-input,
.dmm-textarea {
  font: inherit;
  font-size: 13px;
  color: var(--dmm-fg);
  background: var(--dmm-surface-raised);
  border: 1px solid var(--dmm-border);
  border-radius: 8px;
  padding: 6px 10px;
  outline: none;
  transition: border-color 120ms ease, box-shadow 120ms ease;
}

.dmm-select:hover,
.dmm-input:hover,
.dmm-textarea:hover {
  border-color: var(--dmm-border-strong);
}

.dmm-select:focus-visible,
.dmm-input:focus-visible,
.dmm-textarea:focus-visible {
  border-color: var(--dmm-accent);
  box-shadow: 0 0 0 2.5px var(--dmm-focus);
}

.dmm-select-compact {
  height: 32px;
  max-width: 190px;
  font-size: 12.5px;
  font-weight: 500;
  padding: 5px 10px;
  line-height: 1.4;
  background-color: var(--dmm-surface);
  cursor: pointer;
}

.dmm-select option {
  background: var(--dmm-surface-raised);
  color: var(--dmm-fg);
}

/* ── Custom Accessible Dropdown Menu (replaces native OS <select>) ── */
.dmm-dd {
  position: relative;
  width: 100%;
}

.dmm-dd-compact {
  width: auto;
}

.dmm-dd-trigger {
  width: 100%;
  height: 36px;
  padding: 0 11px;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font: inherit;
  font-size: 13px;
  color: var(--dmm-fg);
  background: var(--dmm-surface-raised);
  border: 1px solid var(--dmm-border);
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  outline: none;
  transition: border-color 120ms ease, background 120ms ease, box-shadow 120ms ease;
}

.dmm-dd-trigger:hover:not(:disabled) {
  border-color: var(--dmm-border-strong);
  background: var(--dmm-surface-hover);
}

.dmm-dd-trigger:focus-visible {
  border-color: var(--dmm-accent);
  box-shadow: 0 0 0 2.5px var(--dmm-focus);
}

.dmm-dd[data-open="true"] .dmm-dd-trigger {
  border-color: var(--dmm-border-strong);
  background: var(--dmm-surface-hover);
}

.dmm-dd-trigger:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.dmm-dd-trigger-compact {
  width: auto;
  min-width: 92px;
  max-width: 196px;
  height: 32px;
  padding: 0 10px;
  font-size: 12.5px;
  font-weight: 500;
  background: var(--dmm-surface-raised);
}

.dmm-dd-value {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
}

.dmm-dd-leading {
  display: inline-flex;
  align-items: center;
  color: var(--dmm-fg-muted);
  flex-shrink: 0;
}

.dmm-dd-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dmm-dd-chevron {
  color: var(--dmm-fg-muted);
  flex-shrink: 0;
  transition: transform 140ms ease, color 120ms ease;
}

.dmm-dd-chevron-open {
  transform: rotate(180deg);
  color: var(--dmm-fg);
}

.dmm-dd-menu {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  right: 0;
  min-width: 210px;
  max-height: 270px;
  overflow-y: auto;
  padding: 5px;
  border-radius: 11px;
  border: 1px solid var(--dmm-border-strong);
  background: var(--dmm-surface-raised);
  box-shadow: 0 10px 28px rgba(15, 17, 21, 0.14), 0 2px 6px rgba(15, 17, 21, 0.06);
  z-index: 120;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

body[data-ds-dark-theme] .dmm-dd-menu {
  background: var(--dsw-alias-bg-layer-2, #2c2c2e);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.48), 0 2px 8px rgba(0, 0, 0, 0.28);
}

.dmm-dd-menu-right {
  left: auto;
  right: 0;
  min-width: 224px;
  max-width: 300px;
}

.dmm-dd-section {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.dmm-dd-section + .dmm-dd-section .dmm-dd-group-label {
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px solid var(--dmm-border-subtle);
}

.dmm-dd-group-label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--dmm-fg-muted);
  padding: 4px 9px 3px;
  user-select: none;
}

.dmm-dd-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 7px 9px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: var(--dmm-fg);
  font: inherit;
  font-size: 12.5px;
  text-align: left;
  cursor: pointer;
  transition: background 100ms ease, color 100ms ease;
}

.dmm-dd-item[data-highlighted="true"],
.dmm-dd-item:hover {
  background: var(--dmm-surface-hover);
}

.dmm-dd-item[data-selected="true"] {
  background: var(--dmm-accent-soft);
  color: var(--dmm-fg);
  font-weight: 500;
}

.dmm-dd-item-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.dmm-dd-item-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}

.dmm-dd-item-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.35;
}

.dmm-dd-item-sub {
  font-family: var(--dmm-mono);
  font-size: 10.5px;
  color: var(--dmm-fg-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
}

.dmm-dd-check {
  display: inline-flex;
  align-items: center;
  color: var(--dmm-accent);
  flex-shrink: 0;
}

.dmm-range {
  width: 100%;
  accent-color: var(--dmm-accent);
  cursor: pointer;
}

.dmm-checkbox {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--dmm-fg-secondary);
  cursor: pointer;
  user-select: none;
}

.dmm-checkbox input[type="checkbox"] {
  accent-color: var(--dmm-accent);
  width: 14px;
  height: 14px;
  margin: 0;
  cursor: pointer;
}

.dmm-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font: inherit;
  font-size: 12.5px;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid var(--dmm-border);
  background: var(--dmm-surface-raised);
  color: var(--dmm-fg);
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease, border-color 120ms ease, color 120ms ease, opacity 120ms ease;
}

.dmm-btn:hover:not(:disabled) {
  background: var(--dmm-surface-hover);
  border-color: var(--dmm-border-strong);
}

.dmm-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2.5px var(--dmm-focus);
}

.dmm-btn:disabled {
  opacity: 0.48;
  cursor: not-allowed;
}

.dmm-btn-sm {
  height: 26px;
  padding: 0 9px;
  font-size: 12px;
  border-radius: 6px;
}

.dmm-btn-primary {
  background: var(--dmm-primary-fill);
  border-color: transparent;
  color: var(--dmm-primary-fg);
  font-weight: 500;
}

.dmm-btn-primary:hover:not(:disabled) {
  background: var(--dmm-primary-hover);
  border-color: transparent;
  color: var(--dmm-primary-fg);
}

.dmm-btn-primary:disabled {
  opacity: 0.34;
}

.dmm-btn-ghost {
  background: transparent;
  border-color: transparent;
  color: var(--dmm-fg-secondary);
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
  border-radius: 6px;
}

.dmm-btn-ghost:hover:not(:disabled) {
  background: var(--dmm-surface-hover);
  border-color: transparent;
  color: var(--dmm-fg);
}

.dmm-btn-danger {
  color: var(--dmm-danger);
}

.dmm-btn-danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dmm-danger) 10%, transparent);
  color: var(--dmm-danger);
}

/* ── Navigation Tabs (Segmented Underline) ── */
.dmm-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 12px;
  border-bottom: 1px solid var(--dmm-border);
  flex-shrink: 0;
  overflow-x: auto;
}

.dmm-page .dmm-tabs {
  padding: 0;
  gap: 6px;
}

.dmm-root[data-variant="sidebar"] .dmm-tabs {
  padding: 0 6px;
  gap: 0;
}

.dmm-root[data-variant="sidebar"] .dmm-tab {
  padding: 8px 6px;
  font-size: 11.5px;
  gap: 3px;
}

.dmm-root[data-variant="sidebar"] .dmm-tab-count {
  min-width: 15px;
  line-height: 15px;
  font-size: 10px;
  padding: 0 4px;
}

.dmm-root[data-variant="sidebar"] .dmm-seg-btn {
  padding: 3px 6px;
  font-size: 11px;
}

.dmm-root[data-variant="sidebar"] .dmm-settings-form-grid,
.dmm-root[data-variant="sidebar"] .dmm-settings-grid-3 {
  grid-template-columns: minmax(0, 1fr);
}

.dmm-tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 12px;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  color: var(--dmm-fg-muted);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  cursor: pointer;
  white-space: nowrap;
  transition: color 120ms ease, border-color 120ms ease;
}

.dmm-tab:hover {
  color: var(--dmm-fg);
}

.dmm-tab:focus-visible {
  outline: none;
  color: var(--dmm-fg);
}

.dmm-tab[aria-selected="true"] {
  color: var(--dmm-fg);
  font-weight: 600;
  border-bottom-color: var(--dmm-accent);
}

.dmm-tab-count {
  font-variant-numeric: tabular-nums;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  min-width: 18px;
  text-align: center;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--dmm-surface);
  border: 1px solid var(--dmm-border-subtle);
  color: var(--dmm-fg-muted);
}

.dmm-tab[aria-selected="true"] .dmm-tab-count {
  background: var(--dmm-accent-soft);
  border-color: var(--dmm-accent-border);
  color: var(--dmm-accent);
}

/* ── Banners ── */
.dmm-banner {
  margin: 12px 14px 0;
  padding: 9px 12px;
  border-radius: 9px;
  font-size: 12.5px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-shrink: 0;
}

.dmm-page .dmm-banner {
  margin: 14px 0 0;
}

.dmm-banner-error {
  background: color-mix(in srgb, var(--dmm-danger) 9%, var(--dmm-bg));
  border: 1px solid color-mix(in srgb, var(--dmm-danger) 28%, transparent);
  color: var(--dmm-danger);
}

.dmm-banner-info {
  background: color-mix(in srgb, var(--dmm-accent) 9%, var(--dmm-bg));
  border: 1px solid var(--dmm-accent-border);
  color: var(--dmm-fg);
}

/* ── Scrollable Body ── */
.dmm-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dmm-page .dmm-body {
  padding: 18px 10px 32px 0;
  margin-right: -10px;
  gap: 16px;
}

.dmm-stack {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dmm-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dmm-row-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

/* ── Filter Bar & Search (Clean Borderless Surface) ── */
.dmm-filter-bar {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dmm-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.dmm-search-wrap {
  position: relative;
  flex: 1;
  min-width: 180px;
  display: flex;
  align-items: center;
}

.dmm-search-icon {
  position: absolute;
  left: 11px;
  color: var(--dmm-fg-muted);
  pointer-events: none;
  display: inline-flex;
}

.dmm-search-wrap .dmm-input {
  width: 100%;
  height: 36px;
  padding-left: 34px;
  padding-right: 68px;
  border-radius: 10px;
  background: var(--dmm-surface);
  border-color: var(--dmm-border-subtle);
}

.dmm-search-wrap .dmm-input:hover {
  border-color: var(--dmm-border);
}

.dmm-search-wrap .dmm-input:focus-visible {
  background: var(--dmm-bg);
  border-color: var(--dmm-accent);
}

.dmm-search-submit {
  position: absolute;
  right: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: 7px;
  border: none;
  background: var(--dmm-surface-hover);
  color: var(--dmm-fg-secondary);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.dmm-search-submit:hover:not(:disabled) {
  background: var(--dmm-surface-active);
  color: var(--dmm-fg);
}

.dmm-search-bar .dmm-btn-primary {
  height: 36px;
  padding: 0 14px;
  border-radius: 10px;
}

.dmm-filter-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding-bottom: 2px;
}

.dmm-segmented {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: 8px;
  background: var(--dmm-surface);
  border: 1px solid var(--dmm-border-subtle);
  gap: 2px;
}

.dmm-seg-btn {
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 3.5px 9px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--dmm-fg-muted);
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease, color 120ms ease;
}

.dmm-seg-btn:hover {
  color: var(--dmm-fg);
}

.dmm-seg-btn[data-active="true"] {
  background: var(--dmm-surface-raised);
  color: var(--dmm-fg);
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.dmm-chips {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.dmm-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  padding: 4px 9px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dmm-fg-secondary);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}

.dmm-chip:hover {
  background: var(--dmm-surface-hover);
  color: var(--dmm-fg);
}

.dmm-chip[data-active="true"] {
  background: var(--dmm-accent-soft);
  color: var(--dmm-accent);
  font-weight: 600;
}

.dmm-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  flex-shrink: 0;
}

/* ── Card Eyebrow & Refined Actions ── */
.dmm-cat-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--dmm-fg);
}

.dmm-id-tag {
  font-family: var(--dmm-mono);
  font-size: 11px;
  color: var(--dmm-fg-muted);
}

.dmm-status-inline {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11.5px;
  font-weight: 500;
  color: var(--dmm-ok);
}

.dmm-card-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  opacity: 0.72;
  transition: opacity 120ms ease;
}

.dmm-card:hover .dmm-card-actions,
.dmm-card:focus-within .dmm-card-actions {
  opacity: 1;
}

/* ── Cards ── */
.dmm-card {
  border: 1px solid var(--dmm-border);
  border-radius: 11px;
  padding: 13px 15px;
  background: var(--dmm-surface-raised);
  box-shadow: var(--dmm-card-shadow);
  display: flex;
  flex-direction: column;
  gap: 9px;
  transition: border-color 120ms ease, background 120ms ease;
}

.dmm-card:hover {
  border-color: var(--dmm-border-strong);
}

.dmm-card-muted {
  background: var(--dmm-surface);
  box-shadow: none;
}

.dmm-card-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--dmm-fg);
  line-height: 1.4;
}

.dmm-decisions {
  font-size: 12px;
  color: var(--dmm-fg-secondary);
  background: var(--dmm-surface);
  border: 1px solid var(--dmm-border-subtle);
  border-radius: 8px;
  padding: 8px 11px;
}

.dmm-decisions-title {
  font-size: 11.5px;
  font-weight: 600;
  color: var(--dmm-fg-muted);
  margin-bottom: 4px;
}

.dmm-decisions ul {
  margin: 0;
  padding-left: 16px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dmm-card-content {
  font-size: 13.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dmm-fg);
  max-width: 74ch;
}

.dmm-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
  color: var(--dmm-fg-muted);
}

.dmm-meta-files {
  font-family: var(--dmm-mono);
  font-size: 11px;
  color: var(--dmm-fg-secondary);
  background: var(--dmm-surface);
  border: 1px solid var(--dmm-border-subtle);
  padding: 1px 6px;
  border-radius: 4px;
}

.dmm-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid var(--dmm-border);
  background: var(--dmm-surface);
  color: var(--dmm-fg-secondary);
}

.dmm-badge-mono {
  font-family: var(--dmm-mono);
  font-size: 11px;
}

.dmm-badge-accent {
  background: var(--dmm-accent-soft);
  border-color: var(--dmm-accent-border);
  color: var(--dmm-accent);
}

.dmm-badge-ok {
  background: color-mix(in srgb, var(--dmm-ok) 11%, transparent);
  border-color: color-mix(in srgb, var(--dmm-ok) 30%, transparent);
  color: var(--dmm-ok);
}

.dmm-badge-warn {
  background: color-mix(in srgb, var(--dmm-warn) 12%, transparent);
  border-color: color-mix(in srgb, var(--dmm-warn) 32%, transparent);
  color: var(--dmm-warn);
}

.dmm-badge-danger {
  background: color-mix(in srgb, var(--dmm-danger) 11%, transparent);
  border-color: color-mix(in srgb, var(--dmm-danger) 30%, transparent);
  color: var(--dmm-danger);
}

/* ── Section Heading ── */
.dmm-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-top: 2px;
}

.dmm-section-title {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--dmm-fg);
  margin: 0;
}

.dmm-section-desc {
  font-size: 12.5px;
  color: var(--dmm-fg-muted);
  margin: 2px 0 0;
}

/* ── Empty State ── */
.dmm-empty {
  padding: 36px 24px;
  text-align: center;
  border: 1px dashed var(--dmm-border-strong);
  border-radius: 12px;
  background: var(--dmm-surface);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.dmm-empty-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--dmm-surface-raised);
  border: 1px solid var(--dmm-border);
  color: var(--dmm-fg-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.dmm-empty-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--dmm-fg);
  margin: 0;
}

.dmm-empty-desc {
  font-size: 12.5px;
  color: var(--dmm-fg-muted);
  max-width: 44ch;
  margin: 0;
  line-height: 1.55;
}

/* ── KPI Stats & Progress ── */
.dmm-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.dmm-page .dmm-stat-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.dmm-stat-card {
  border: 1px solid var(--dmm-border);
  border-radius: 10px;
  padding: 12px 14px;
  background: var(--dmm-surface-raised);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dmm-stat-label {
  font-size: 12px;
  color: var(--dmm-fg-muted);
}

.dmm-stat-value {
  font-variant-numeric: tabular-nums;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--dmm-fg);
}

.dmm-progress {
  width: 100%;
  height: 7px;
  border-radius: 999px;
  background: var(--dmm-surface-active);
  overflow: hidden;
  margin-top: 6px;
}

.dmm-progress-fill {
  height: 100%;
  background: var(--dmm-accent);
  border-radius: 999px;
  transition: width 200ms ease;
}

.dmm-dist-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.dmm-page .dmm-dist-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.dmm-dist-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--dmm-surface);
  border: 1px solid var(--dmm-border-subtle);
  font-size: 12px;
}

/* ── Dreamer Grid ── */
.dmm-dreamer-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 8px;
}

.dmm-page .dmm-dreamer-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

/* ── Modal ── */
.dmm-modal-backdrop {
  position: fixed;
  inset: 0;
  background: var(--dsw-alias-bg-mask-2, rgba(15, 17, 21, 0.48));
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.dmm-modal {
  width: min(520px, 100%);
  max-height: 86vh;
  overflow-y: auto;
  background: var(--dmm-bg);
  color: var(--dmm-fg);
  border: 1px solid var(--dmm-border-strong);
  border-radius: 14px;
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.24);
}

.dmm-modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--dmm-fg);
}

.dmm-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.dmm-field-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.dmm-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--dmm-fg-secondary);
}

.dmm-pre {
  font-family: var(--dmm-mono);
  font-size: 12px;
  line-height: 1.5;
  background: var(--dmm-surface);
  color: var(--dmm-fg);
  border: 1px solid var(--dmm-border);
  border-radius: 8px;
  padding: 12px;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

/* ── Settings Page ── */
.dmm-settings-card {
  border: 1px solid var(--dmm-border);
  border-radius: 12px;
  background: var(--dmm-surface-raised);
  box-shadow: var(--dmm-card-shadow);
  display: flex;
  flex-direction: column;
}

.dmm-settings-head {
  padding: 14px 16px 12px;
  border-radius: 11px 11px 0 0;
  border-bottom: 1px solid var(--dmm-border-subtle);
  background: var(--dmm-surface);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.dmm-settings-body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dmm-settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 10px 0;
  border-top: 1px solid var(--dmm-border-subtle);
}

.dmm-settings-row:first-child {
  border-top: none;
  padding-top: 2px;
}

.dmm-settings-row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dmm-settings-row-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--dmm-fg);
}

.dmm-settings-row-hint {
  font-size: 12px;
  color: var(--dmm-fg-muted);
  line-height: 1.45;
}

.dmm-settings-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.dmm-settings-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.dmm-switch {
  position: relative;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  border: 1px solid var(--dmm-border);
  background: var(--dmm-surface-active);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 140ms ease, border-color 140ms ease;
}

.dmm-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 999px;
  background: var(--dsw-alias-switch-thumb, #ffffff);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
  transition: transform 140ms ease;
}

.dmm-switch[aria-checked="true"] {
  background: var(--dmm-accent);
  border-color: var(--dmm-accent);
}

.dmm-switch[aria-checked="true"]::after {
  transform: translateX(16px);
  background: #ffffff;
}

.dmm-switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2.5px var(--dmm-focus);
}

.dmm-preset-btn {
  font: inherit;
  font-size: 11.5px;
  font-weight: 500;
  padding: 3px 9px;
  border-radius: 6px;
  border: 1px solid var(--dmm-border);
  background: var(--dmm-surface);
  color: var(--dmm-fg-secondary);
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
}

.dmm-preset-btn:hover {
  background: var(--dmm-surface-hover);
  border-color: var(--dmm-border-strong);
  color: var(--dmm-fg);
}

.dmm-test-result {
  font-size: 12px;
  padding: 8px 11px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 1.45;
  word-break: break-word;
}

.dmm-test-ok {
  background: color-mix(in srgb, var(--dmm-ok) 11%, transparent);
  border: 1px solid color-mix(in srgb, var(--dmm-ok) 28%, transparent);
  color: var(--dmm-ok);
}

.dmm-test-fail {
  background: color-mix(in srgb, var(--dmm-danger) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--dmm-danger) 28%, transparent);
  color: var(--dmm-danger);
}

.dmm-save-bar {
  margin-top: 4px;
  padding: 11px 14px;
  border-radius: 11px;
  border: 1px solid var(--dmm-border);
  background: var(--dmm-surface);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.dmm-save-bar[data-dirty="true"] {
  position: sticky;
  bottom: 8px;
  z-index: 10;
  border-color: var(--dmm-accent-border);
  background: var(--dmm-surface-raised);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
}

/* ── Conversation Header Action Button ── */
.dmm-header-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 28px;
  padding: 0 9px;
  border-radius: 7px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5b6270);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 120ms ease, color 120ms ease;
}

.dmm-header-action-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(38, 49, 72, 0.08));
  color: var(--dsw-alias-label-primary, #0f1115);
}

/* ── Scrollbars & Motion ── */
.dmm-body::-webkit-scrollbar,
.dmm-pre::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.dmm-body::-webkit-scrollbar-track,
.dmm-pre::-webkit-scrollbar-track {
  background: transparent;
}

.dmm-body::-webkit-scrollbar-thumb,
.dmm-pre::-webkit-scrollbar-thumb {
  background: var(--dsw-alias-scrollbar-bg-l1, rgba(128, 128, 128, 0.3));
  border-radius: 999px;
}

.dmm-body::-webkit-scrollbar-thumb:hover,
.dmm-pre::-webkit-scrollbar-thumb:hover {
  background: var(--dsw-alias-scrollbar-hover-l1, rgba(128, 128, 128, 0.5));
}

@keyframes dmm-spin {
  to {
    transform: rotate(360deg);
  }
}

.dmm-spin {
  animation: dmm-spin 0.9s linear infinite;
}

@media (max-width: 680px) {
  .dmm-page .dmm-root {
    padding: 12px 14px 0;
  }
  .dmm-page .dmm-stat-grid,
  .dmm-page .dmm-dist-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .dmm-page .dmm-dreamer-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .dmm-field-row,
  .dmm-settings-form-grid,
  .dmm-settings-grid-3 {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  .dmm-root *,
  .dmm-spin {
    transition: none !important;
    animation: none !important;
  }
}
`

export function ensureMagicMemoryStyles(): void {
  if (typeof document === 'undefined' || !document.head) return
  const existing = document.getElementById(STYLE_ELEMENT_ID)
  if (existing) {
    existing.textContent = MAGIC_MEMORY_CSS
    return
  }
  const style = document.createElement('style')
  style.id = STYLE_ELEMENT_ID
  style.setAttribute('data-plugin', 'dsh-magic-memory')
  style.textContent = MAGIC_MEMORY_CSS
  document.head.appendChild(style)
}
