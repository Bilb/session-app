import { countByStatus, type PageResult, type PageStatus } from '#catalog/diff'

/** One side of the comparison, as the report names it. */
interface ReportSide {
  /** What it was asked for as: a ref, or "working tree". */
  label: string
  sha: string
  /** Anything a reader should know about how this side was captured. */
  note?: string | undefined
}

export type ImageKind = 'before' | 'after' | 'diff'

export interface ReportInput {
  base: ReportSide
  head: ReportSide
  tier: string
  sensitivity: number
  results: readonly PageResult[]
  /** Said at the top: a capture that could not be confirmed complete, for instance. */
  warnings: readonly string[]
}

/** Where a page's picture sits, relative to the report: beside it, a folder per kind. */
export function imagePath(kind: ImageKind, id: string): string {
  return `${kind}/${encodeURIComponent(id)}.png`
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? '',
  )

const HEADINGS: Record<PageStatus, string> = {
  changed: 'Changed',
  added: 'Added',
  removed: 'Removed',
  unchanged: 'Unchanged',
}

/** "12,345 pixels differ (0.42%)", or the size change when there was one. */
export function describeChange(result: PageResult): string {
  const share = result.totalPixels === 0 ? 0 : (100 * result.differingPixels) / result.totalPixels
  const pixels = `${result.differingPixels.toLocaleString('en')} pixels differ (${share.toFixed(2)}%)`
  const { before, after } = result
  if (
    before === undefined ||
    after === undefined ||
    (before.width === after.width && before.height === after.height)
  )
    return pixels
  return `${pixels}; size ${String(before.width)}×${String(before.height)} → ${String(after.width)}×${String(after.height)}`
}

function image(kind: ImageKind, id: string, alt: string): string {
  return `<img src="${escapeHtml(imagePath(kind, id))}" alt="${escapeHtml(alt)}" loading="lazy">`
}

function changedCard(result: PageResult): string {
  const id = escapeHtml(result.id)
  return `<article class="page" id="page-${id}" data-mode="slider">
  <header>
    <h3>${id}</h3>
    <span class="detail">${escapeHtml(describeChange(result))}</span>
    <span class="modes" role="group" aria-label="View">
      <button type="button" data-mode="slider" aria-pressed="true">Slider</button>
      <button type="button" data-mode="flip" aria-pressed="false">Flip</button>
      <button type="button" data-mode="side" aria-pressed="false">Side by side</button>
      <button type="button" data-mode="diff" aria-pressed="false">Diff</button>
    </span>
  </header>
  <div class="view slider">
    <div class="stack">
      ${image('before', result.id, `${result.id} before`)}
      <div class="after">${image('after', result.id, `${result.id} after`)}</div>
    </div>
    <label class="range">Before <input type="range" min="0" max="100" value="50" aria-label="Before and after"> After</label>
  </div>
  <div class="view flip">
    <button type="button" class="flipper" aria-label="Show the other side">
      <span class="tag">after</span>
      <img src="${escapeHtml(imagePath('after', result.id))}" data-before="${escapeHtml(imagePath('before', result.id))}" data-after="${escapeHtml(imagePath('after', result.id))}" alt="${id}, flipping between before and after" loading="lazy">
    </button>
  </div>
  <div class="view side">
    <figure><figcaption>Before</figcaption>${image('before', result.id, `${result.id} before`)}</figure>
    <figure><figcaption>After</figcaption>${image('after', result.id, `${result.id} after`)}</figure>
  </div>
  <div class="view diff">${image('diff', result.id, `${result.id}: what differs, in red`)}</div>
</article>`
}

function singleCard(result: PageResult, kind: 'before' | 'after'): string {
  const id = escapeHtml(result.id)
  return `<article class="page single" id="page-${id}">
  <header><h3>${id}</h3><span class="detail">${kind === 'after' ? 'only in the working side' : 'only in the base'}</span></header>
  ${image(kind, result.id, `${result.id} ${kind}`)}
</article>`
}

function section(status: PageStatus, results: readonly PageResult[]): string {
  const pages = results.filter((result) => result.status === status)
  if (pages.length === 0) return ''
  const heading = `<h2>${HEADINGS[status]} <span class="count">${String(pages.length)}</span></h2>`
  if (status === 'unchanged')
    return `<section class="unchanged"><details><summary>${heading}</summary><ul>${pages
      .map(
        (page) =>
          `<li><a href="${escapeHtml(imagePath('after', page.id))}">${escapeHtml(page.id)}</a></li>`,
      )
      .join('')}</ul></details></section>`
  const cards = pages.map((page) =>
    status === 'changed'
      ? changedCard(page)
      : singleCard(page, status === 'added' ? 'after' : 'before'),
  )
  return `<section class="${status}">${heading}${cards.join('\n')}</section>`
}

const STYLE = `
:root {
  color-scheme: light dark;
  --bg: Canvas; --text: CanvasText; --muted: GrayText;
  --surface: color-mix(in srgb, CanvasText 4%, Canvas);
  --line: color-mix(in srgb, CanvasText 18%, Canvas);
  --checker: color-mix(in srgb, CanvasText 8%, Canvas);
  --accent: light-dark(seagreen, mediumaquamarine);
  --changed: light-dark(firebrick, salmon);
  --added: var(--accent);
  --removed: light-dark(darkgoldenrod, khaki);
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text);
  font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
main { max-width: 1400px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 22px; margin: 0 0 4px; }
h2 { font-size: 18px; margin: 32px 0 12px; }
h3 { font-size: 15px; margin: 0; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
.meta { color: var(--muted); margin: 0 0 16px; }
.meta code { color: var(--text); }
.summary { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.summary li { background: var(--surface); border: 1px solid var(--line); border-radius: 999px; padding: 2px 12px; }
.summary .changed b { color: var(--changed); } .summary .added b { color: var(--added); }
.summary .removed b { color: var(--removed); }
.warnings { border: 1px solid var(--removed); border-radius: 8px; padding: 8px 16px; margin: 16px 0; }
.count { color: var(--muted); font-weight: normal; }
.page { background: var(--surface); border: 1px solid var(--line); border-radius: 10px;
  padding: 12px; margin: 0 0 16px; }
.page header { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; margin-bottom: 12px; }
.detail { color: var(--muted); }
.modes { display: inline-flex; gap: 4px; margin-left: auto; }
.modes button { font: inherit; font-size: 13px; padding: 2px 10px; border-radius: 6px; cursor: pointer;
  border: 1px solid var(--line); background: transparent; color: var(--text); }
.modes button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: Canvas; }
img { display: block; max-width: 100%; height: auto;
  background: repeating-conic-gradient(var(--checker) 0 25%, transparent 0 50%) 0 0 / 16px 16px; }
.view { display: none; overflow-x: auto; }
.page[data-mode="slider"] .view.slider, .page[data-mode="flip"] .view.flip,
.page[data-mode="side"] .view.side, .page[data-mode="diff"] .view.diff { display: block; }
.stack { position: relative; display: inline-block; max-width: 100%; }
.stack .after { position: absolute; inset: 0; clip-path: inset(0 0 0 var(--split, 50%)); }
.stack::after { content: ''; position: absolute; top: 0; bottom: 0; left: var(--split, 50%);
  width: 2px; margin-left: -1px; background: var(--accent); pointer-events: none; }
.stack .after img { width: 100%; }
.range { display: flex; align-items: center; gap: 8px; color: var(--muted); margin-top: 8px; }
.range input { flex: 1; }
.view.side { display: none; }
.page[data-mode="side"] .view.side { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (max-width: 700px) { .page[data-mode="side"] .view.side { grid-template-columns: 1fr; } }
figure { margin: 0; } figcaption { color: var(--muted); font-size: 13px; }
.flipper { position: relative; display: inline-block; padding: 0; border: 0; background: none; cursor: pointer; max-width: 100%; }
.flipper .tag { position: absolute; top: 4px; left: 4px; background: var(--accent); color: Canvas;
  font-size: 12px; padding: 0 6px; border-radius: 4px; }
.unchanged ul { columns: 3 260px; padding-left: 20px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 13px; }
.unchanged summary h2 { display: inline; }
a { color: var(--accent); }
`

const SCRIPT = `
for (const page of document.querySelectorAll('.page[data-mode]')) {
  const buttons = page.querySelectorAll('.modes button');
  for (const button of buttons)
    button.addEventListener('click', () => {
      page.dataset.mode = button.dataset.mode;
      for (const other of buttons) other.setAttribute('aria-pressed', String(other === button));
    });
  const range = page.querySelector('.range input');
  const stack = page.querySelector('.stack');
  range.addEventListener('input', () => stack.style.setProperty('--split', range.value + '%'));
  const flipper = page.querySelector('.flipper');
  const shown = flipper.querySelector('img');
  const tag = flipper.querySelector('.tag');
  flipper.addEventListener('click', () => {
    const next = tag.textContent === 'after' ? 'before' : 'after';
    tag.textContent = next;
    shown.setAttribute('src', shown.dataset[next]);
  });
}
`

/** The whole report: one file, its pictures in folders beside it. */
export function renderReport(input: ReportInput): string {
  const counts = countByStatus(input.results)
  const statuses: PageStatus[] = ['changed', 'added', 'removed', 'unchanged']
  const side = (label: string, s: ReportSide) =>
    `${label} <code>${escapeHtml(s.label)}</code> (${escapeHtml(s.sha.slice(0, 10))})${
      s.note === undefined ? '' : ` — ${escapeHtml(s.note)}`
    }`
  const warnings =
    input.warnings.length === 0
      ? ''
      : `<div class="warnings"><ul>${input.warnings
          .map((warning) => `<li>${escapeHtml(warning)}</li>`)
          .join('')}</ul></div>`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Catalog comparison</title>
<style>${STYLE}</style>
</head>
<body>
<main>
<h1>Catalog comparison</h1>
<p class="meta">${side('Before:', input.base)}<br>${side('After:', input.head)}<br>Tier <code>${escapeHtml(input.tier)}</code>, sensitivity ${String(input.sensitivity)}, both sides captured on this machine.</p>
<ul class="summary">${statuses
    .map((status) => `<li class="${status}"><b>${String(counts[status])}</b> ${status}</li>`)
    .join('')}</ul>
${warnings}
${statuses.map((status) => section(status, input.results)).join('\n')}
</main>
<script>${SCRIPT}</script>
</body>
</html>
`
}
