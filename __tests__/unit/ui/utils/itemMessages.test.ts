import { ItemType } from '@core/constants';
import { getCurrentLanguage } from '@core/i18n';
import {
  confirmBody,
  successBody,
  deleteSuccessBody,
  batchReportBody,
  formatTypeCount,
} from '@ui/utils/itemMessages';

jest.mock('@core/i18n', () => ({
  getCurrentLanguage: jest.fn(() => 'en'),
}));

const mockGetLanguage = getCurrentLanguage as jest.Mock;

const en: Record<string, string> = {
  'itemType.image.dem': 'this photo',
  'itemType.video.dem': 'this video',
  'itemType.audio.dem': 'this audio file',
  'itemType.document.dem': 'this document',
  'itemType.file.dem': 'this file',
  'itemType.image.one': 'photo',
  'itemType.image.many': 'photos',
  'itemType.video.one': 'video',
  'itemType.video.many': 'videos',
  'itemType.audio.one': 'audio file',
  'itemType.audio.many': 'audio files',
  'itemType.document.one': 'document',
  'itemType.document.many': 'documents',
  'itemType.file.one': 'file',
  'itemType.file.many': 'files',
  'action.extractConfirmOne': 'Extract {{item}} from the vault?',
  'action.extractConfirmMany': 'Extract {{count}} {{type}} from the vault?',
  'action.copyConfirmOne': 'Copy {{item}} to your device?',
  'action.copyConfirmMany': 'Copy {{count}} {{type}} to your device?',
  'action.deleteConfirmOne': 'Delete {{item}} from the vault?',
  'action.deleteConfirmMany': 'Delete {{count}} {{type}} from the vault?',
  'action.extractPrompt': 'This will extract:',
  'action.continuePrompt': 'Continue?',
  'action.extractSuccessOne': 'Extracted {{item}} successfully.',
  'action.extractSuccessMany': 'Extracted {{count}} {{type}} successfully.',
  'action.copySuccessOne': 'Copied {{item}} to your device.',
  'action.copySuccessMany': 'Copied {{count}} {{type}} to your device.',
  'action.deleteSuccessOne': 'Deleted {{item}}.',
  'action.deleteSuccessMany': 'Deleted {{count}} {{type}}.',
  'action.mixed': 'items',
  'action.reportOk': 'Completed successfully.',
  'action.countsSummary': '{{success}} succeeded, {{failed}} failed',
  'action.noSelection': 'Select at least one item.',
};

function fakeT(key: string, opts?: Record<string, unknown>): string {
  let str = en[key] ?? key;
  if (opts) {
    for (const [k, v] of Object.entries(opts)) {
      str = str.replace(`{{${k}}}`, String(v));
    }
  }
  return str;
}

const img = () => ({ type: ItemType.IMAGE as ItemType });
const doc = () => ({ type: ItemType.DOCUMENT as ItemType });

beforeEach(() => mockGetLanguage.mockReturnValue('en'));

describe('itemMessages (en)', () => {
  it('names a single item with its demonstrative', () => {
    expect(confirmBody(fakeT, [img()], 'extractConfirm')).toBe('Extract this photo from the vault?');
  });

  it('pluralizes a same-type group', () => {
    const items = [img(), img(), img()];
    expect(confirmBody(fakeT, items, 'extractConfirm')).toBe('Extract 3 photos from the vault?');
  });

  it('keeps singular label for exactly one', () => {
    expect(formatTypeCount(fakeT, 1, 'image')).toBe('photo');
    expect(formatTypeCount(fakeT, 2, 'image')).toBe('photos');
    expect(formatTypeCount(fakeT, 25, 'document')).toBe('documents');
  });

  it('produces a per-type breakdown for mixed selections', () => {
    const items = [img(), doc(), doc()];
    const msg = confirmBody(fakeT, items, 'extractConfirm');
    expect(msg).toContain('This will extract:');
    expect(msg).toContain('1 photo');
    expect(msg).toContain('2 documents');
    expect(msg).toContain('Continue?');
  });

  it('builds type-aware success and delete messages', () => {
    expect(successBody(fakeT, [img()], 'extractSuccess')).toBe('Extracted this photo successfully.');
    expect(successBody(fakeT, [img(), img()], 'copySuccess')).toBe('Copied 2 photos to your device.');
    expect(deleteSuccessBody(fakeT, [img()])).toBe('Deleted this photo.');
    expect(deleteSuccessBody(fakeT, [img(), img()])).toBe('Deleted 2 photos.');
  });

  it('reports failures with real counts', () => {
    const report = {
      success: 1,
      failed: 2,
      cancelled: 0,
      errors: [
        { name: 'a.pdf', message: 'verification failed' },
        { name: 'b.zip', message: 'boom' },
      ],
    };
    const msg = batchReportBody(fakeT, report);
    expect(msg).toContain('1 succeeded, 2 failed');
    expect(msg).toContain('a.pdf: verification failed');
    expect(msg).toContain('b.zip: boom');
  });

  it('returns a plain success report when nothing failed', () => {
    expect(batchReportBody(fakeT, { success: 3, failed: 0, cancelled: 0, errors: [] })).toBe('Completed successfully.');
  });

  it('warns when nothing is selected', () => {
    expect(confirmBody(fakeT, [], 'extractConfirm')).toBe('Select at least one item.');
  });
});

describe('itemMessages (ar)', () => {
  beforeEach(() => mockGetLanguage.mockReturnValue('ar'));

  it('uses singular for 1, plural for 2-10, singular again for 11+', () => {
    // The i18n file exposes one/many only; the helper maps count -> key.
    expect(formatTypeCount(fakeT, 1, 'image')).toBe('photo');
    expect(formatTypeCount(fakeT, 3, 'image')).toBe('photos');
    expect(formatTypeCount(fakeT, 12, 'image')).toBe('photo');
  });
});
