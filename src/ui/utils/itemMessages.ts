import { ItemType } from '@core/constants';
import { countByItemType } from '@data/media/MediaStorage';
import { getCurrentLanguage } from '@core/i18n';

/**
 * Builds precise, type-aware, count-aware user messages for vault operations
 * (export/copy/delete). Internationalized for Arabic and English including the
 * canonical Arabic numeric-noun agreement rules:
 *   1     -> singular, 2-10 -> plural, 11+ -> singular (genitive).
 */

type Category = 'image' | 'video' | 'audio' | 'document' | 'file';

const CATEGORY_ORDER: Category[] = ['image', 'video', 'audio', 'document', 'file'];

function isArabic(): boolean {
  return getCurrentLanguage() === 'ar';
}

/** Localized counted noun phrase, e.g. "25 photos" / "25 صورة". */
export function formatTypeCount(t: (key: string, opts?: Record<string, unknown>) => string, count: number, category: Category): string {
  const enPlural = count !== 1 ? 'many' : 'one';
  const arKey = count === 1 ? 'one' : count >= 2 && count <= 10 ? 'many' : 'one';
  const key = isArabic() ? arKey : enPlural;
  return t(`itemType.${category}.${key}`);
}

/** The demonstrative label for a single item, e.g. "this photo" / "هذه الصورة". */
export function formatSingleDem(t: (key: string, opts?: Record<string, unknown>) => string, category: Category): string {
  return t(`itemType.${category}.dem`);
}

export interface ExpandedCounts {
  image: number;
  video: number;
  audio: number;
  document: number;
  file: number;
  total: number;
}

function expand(items: Array<{ type: ItemType }>): ExpandedCounts {
  const raw = countByItemType(items);
  const total = items.length;
  return {
    image: raw[ItemType.IMAGE] ?? 0,
    video: raw[ItemType.VIDEO] ?? 0,
    audio: raw[ItemType.AUDIO] ?? 0,
    document: raw[ItemType.DOCUMENT] ?? 0,
    file: raw[ItemType.FILE] ?? 0,
    total,
  };
}

/** Single dominant category when all selected items share it, else null. */
function singleCategory(c: ExpandedCounts): Category | null {
  const active = CATEGORY_ORDER.filter((cat) => c[cat] > 0);
  if (active.length === 1) return active[0]!;
  return null;
}

/** Multiline breakdown used for mixed-type operations. */
function mixedLines(t: (key: string, opts?: Record<string, unknown>) => string, c: ExpandedCounts): string {
  const lines: string[] = [];
  for (const cat of CATEGORY_ORDER) {
    if (c[cat] > 0) lines.push(`• ${c[cat]} ${formatTypeCount(t, c[cat], cat)}`);
  }
  return lines.join('\n');
}

/** Creates the confirmation body for a type-aware operation. */
export function confirmBody(
  t: (key: string, opts?: Record<string, unknown>) => string,
  items: Array<{ type: ItemType }>,
  prefix: 'extractConfirm' | 'copyConfirm' | 'deleteConfirm',
): string {
  if (items.length === 0) {
    return t('action.noSelection');
  }
  const c = expand(items);
  const single = singleCategory(c);
  if (c.total === 1 && single) {
    return t(`action.${prefix}One`, { item: formatSingleDem(t, single) });
  }
  if (single) {
    return t(`action.${prefix}Many`, { count: c.total, type: formatTypeCount(t, c.total, single) });
  }
  return `${t(`action.${prefix === 'copyConfirm' ? 'copyPrompt' : prefix === 'deleteConfirm' ? 'deleteConfirm' : 'extractPrompt'}`)} ${mixedLines(t, c)}\n${t('action.continuePrompt')}`;
}

/** A short title for the copy-vs-extract chooser. */
export function extractTitle(t: (key: string, opts?: Record<string, unknown>) => string, items: Array<{ type: ItemType }>): string {
  const c = expand(items);
  const single = singleCategory(c);
  if (c.total === 1 && single) {
    return formatSingleDem(t, single);
  }
  return t(`action.${isArabic() ? 'mixed' : 'mixed'}`);
}

/** Success message after an operation completes. */
export function successBody(
  t: (key: string, opts?: Record<string, unknown>) => string,
  items: Array<{ type: ItemType }>,
  operation: 'extractSuccess' | 'copySuccess',
): string {
  const c = expand(items);
  const single = singleCategory(c);
  if (c.total === 1 && single) {
    return t(`action.${operation}One`, { item: formatSingleDem(t, single) });
  }
  if (single) {
    return t(`action.${operation}Many`, { count: c.total, type: formatTypeCount(t, c.total, single) });
  }
  return t(`action.${operation}Many`, { count: c.total, type: t('action.mixed') });
}

/** Success message for a delete operation. */
export function deleteSuccessBody(
  t: (key: string, opts?: Record<string, unknown>) => string,
  items: Array<{ type: ItemType }>,
): string {
  const c = expand(items);
  const single = singleCategory(c);
  if (c.total === 1 && single) {
    return t('action.deleteSuccessOne', { item: formatSingleDem(t, single) });
  }
  if (single) {
    return t('action.deleteSuccessMany', { count: c.total, type: formatTypeCount(t, c.total, single) });
  }
  return t('action.deleteSuccessMany', { count: c.total, type: t('action.mixed') });
}

/** Compiles a final report after a batch operation, including failures. */
export function batchReportBody(
  t: (key: string, opts?: Record<string, unknown>) => string,
  report: { success: number; failed: number; cancelled: number; errors: Array<{ name: string; message: string }> },
): string {
  if (report.failed === 0 && report.cancelled === 0) {
    return t('action.reportOk');
  }
  const details = report.errors.map((e) => `${e.name}: ${e.message}`).join('\n');
  let msg = t('action.countsSummary', { success: report.success, failed: report.failed + report.cancelled });
  if (details) msg += `\n${details}`;
  return msg;
}