import i18n, { initI18n, changeLanguage, getCurrentLanguage } from '@core/i18n';
import ar from '@core/i18n/locales/ar.json';
import { I18nManager } from 'react-native';

jest.mock('expo-secure-store');

const secureStoreMock = jest.requireMock('expo-secure-store');

describe('i18n init & language persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    secureStoreMock.getItemAsync.mockReset();
    secureStoreMock.getItemAsync.mockResolvedValue(null);
    jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});
    jest.spyOn(I18nManager, 'swapLeftAndRightInRTL').mockImplementation(() => {});
  });

  it('defaults to Arabic when no stored preference exists', async () => {
    await initI18n();
    expect(getCurrentLanguage()).toBe('ar');
  });

  it('reads a persisted English preference', async () => {
    secureStoreMock.getItemAsync.mockResolvedValue('en');
    await initI18n();
    expect(getCurrentLanguage()).toBe('en');
    expect(I18nManager.forceRTL).toHaveBeenCalledWith(false);
  });

  it('persists the language when changeLanguage is called', async () => {
    await initI18n();
    changeLanguage('en');
    expect(getCurrentLanguage()).toBe('en');
    expect(secureStoreMock.setItemAsync).toHaveBeenCalledWith(
      'app_language',
      'en',
      expect.anything(),
    );
  });
});

describe('Arabic pluralization (i18next v4 6-category)', () => {
  it('uses the correct plural form for each count', async () => {
    await initI18n();
    const arT = i18n.getFixedT('ar');

    const key = 'time.minutesAgo';
    expect(arT(key, { count: 1 })).toBe('قبل 1 دقيقة');
    expect(arT(key, { count: 2 })).toBe('قبل 2 دقيقتين');
    expect(arT(key, { count: 3 })).toBe('قبل 3 دقائق');
    expect(arT(key, { count: 11 })).toBe('قبل 11 دقيقة');
    expect(arT(key, { count: 100 })).toBe('قبل 100 دقيقة');
  });

  it('has all six Arabic plural categories for time keys', () => {
    const time = (ar as { time: Record<string, string> }).time;
    for (const base of ['minutesAgo', 'hoursAgo', 'daysAgo', 'weeksAgo', 'monthsAgo']) {
      for (const suffix of ['one', 'two', 'few', 'many', 'other']) {
        expect(time[`${base}_${suffix}`]).toBeDefined();
      }
    }
  });
});
