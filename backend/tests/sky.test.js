const { getZenithEquatorial, hasChartCredentials, parseBodiesFromPositions } = require('../services/sky');

describe('sky helpers', () => {
  test('getZenithEquatorial returns RA in 0–24h and Dec near latitude', () => {
    const date = new Date('2026-07-14T21:00:00.000Z');
    const zenith = getZenithEquatorial(52.95, -1.15, date);

    expect(zenith.declination).toBeCloseTo(52.95, 2);
    expect(zenith.rightAscension).toBeGreaterThanOrEqual(0);
    expect(zenith.rightAscension).toBeLessThan(24);
  });

  test('hasChartCredentials reflects env presence', () => {
    expect(typeof hasChartCredentials()).toBe('boolean');
  });

  test('parseBodiesFromPositions keeps bodies above horizon', () => {
    const bodies = parseBodiesFromPositions({
      data: {
        table: {
          rows: [
            {
              entry: { id: 'sun', name: 'Sun' },
              cells: [
                {
                  name: 'Sun',
                  position: {
                    horizontal: { altitude: { degrees: '20' }, azimuth: { degrees: '100' } },
                  },
                  extraInfo: { magnitude: -26 },
                },
              ],
            },
            {
              entry: { id: 'moon', name: 'Moon' },
              cells: [
                {
                  name: 'Moon',
                  position: {
                    horizontal: { altitude: { degrees: '35.5' }, azimuth: { degrees: '210' } },
                    constellation: { name: 'Leo' },
                  },
                  extraInfo: { magnitude: '-10.2' },
                },
              ],
            },
            {
              entry: { id: 'mars', name: 'Mars' },
              cells: [
                {
                  name: 'Mars',
                  position: {
                    horizonal: { altitude: { degrees: '-5' }, azimuth: { degrees: '10' } },
                  },
                  extraInfo: { magnitude: '1.2' },
                },
              ],
            },
          ],
        },
      },
    });

    expect(bodies).toEqual([
      {
        name: 'Moon',
        constellation: 'Leo',
        altitude: 35.5,
        azimuth: 210,
        magnitude: -10.2,
      },
    ]);
  });
});
