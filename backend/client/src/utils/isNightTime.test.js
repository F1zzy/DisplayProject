import {
  isNightTime,
  isWithinHourWindow,
  shouldActivateNightFocus,
} from './isNightTime';

describe('isWithinHourWindow', () => {
  test('handles overnight window', () => {
    expect(isWithinHourWindow(new Date(2026, 0, 1, 22), 20, 6)).toBe(true);
    expect(isWithinHourWindow(new Date(2026, 0, 1, 3), 20, 6)).toBe(true);
    expect(isWithinHourWindow(new Date(2026, 0, 1, 12), 20, 6)).toBe(false);
  });

  test('handles same-day window', () => {
    expect(isWithinHourWindow(new Date(2026, 0, 1, 10), 9, 17)).toBe(true);
    expect(isWithinHourWindow(new Date(2026, 0, 1, 18), 9, 17)).toBe(false);
  });
});

describe('shouldActivateNightFocus', () => {
  test('off when mode disabled', () => {
    expect(
      shouldActivateNightFocus(
        { nightFocusMode: false, nightFocusWhen: 'always' },
        { isDay: false },
        []
      )
    ).toBe(false);
  });

  test('always when enabled', () => {
    expect(
      shouldActivateNightFocus(
        { nightFocusMode: true, nightFocusWhen: 'always' },
        { isDay: true },
        []
      )
    ).toBe(true);
  });

  test('custom hours', () => {
    const settings = {
      nightFocusMode: true,
      nightFocusWhen: 'custom',
      nightFocusStartHour: 20,
      nightFocusEndHour: 6,
    };
    expect(shouldActivateNightFocus(settings, null, [], new Date(2026, 0, 1, 21))).toBe(true);
    expect(shouldActivateNightFocus(settings, null, [], new Date(2026, 0, 1, 12))).toBe(false);
  });

  test('auto uses isNightTime', () => {
    expect(
      shouldActivateNightFocus(
        { nightFocusMode: true, nightFocusWhen: 'auto' },
        { isDay: false },
        []
      )
    ).toBe(true);
    expect(
      shouldActivateNightFocus(
        { nightFocusMode: true, nightFocusWhen: 'auto' },
        { isDay: true },
        []
      )
    ).toBe(false);
  });
});

describe('isNightTime', () => {
  test('uses isDay from current weather', () => {
    expect(isNightTime({ isDay: false }, [])).toBe(true);
    expect(isNightTime({ isDay: true }, [])).toBe(false);
  });
});
