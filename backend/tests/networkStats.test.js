const {
  parseProcNetDev,
  pickInterface,
  computeRates,
} = require('../services/networkStats');

describe('networkStats helpers', () => {
  test('parseProcNetDev extracts rx/tx byte counters', () => {
    const sample = [
      'Inter-|   Receive                                                |  Transmit',
      ' face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed',
      '    lo: 1000 10 0 0 0 0 0 0 2000 20 0 0 0 0 0 0',
      '  eth0: 5000 50 0 0 0 0 0 0 8000 80 0 0 0 0 0 0',
      '',
    ].join('\n');

    const interfaces = parseProcNetDev(sample);
    expect(interfaces.lo).toEqual({ rxBytes: 1000, txBytes: 2000 });
    expect(interfaces.eth0).toEqual({ rxBytes: 5000, txBytes: 8000 });
  });

  test('pickInterface prefers NETWORK-style names and skips lo', () => {
    const interfaces = {
      lo: { rxBytes: 1, txBytes: 1 },
      wlan0: { rxBytes: 2, txBytes: 2 },
      eth0: { rxBytes: 3, txBytes: 3 },
    };

    expect(pickInterface(interfaces, null)).toBe('eth0');
    expect(pickInterface(interfaces, 'wlan0')).toBe('wlan0');
    expect(pickInterface({ lo: { rxBytes: 1, txBytes: 1 } }, null)).toBeNull();
  });

  test('computeRates returns bytes per second between samples', () => {
    const previous = { rxBytes: 1000, txBytes: 2000, at: 1_000 };
    const current = { rxBytes: 3000, txBytes: 4000 };
    expect(computeRates(current, previous, 3_000)).toEqual({
      rxBps: 1000,
      txBps: 1000,
    });
  });

  test('computeRates returns null without a previous sample', () => {
    expect(computeRates({ rxBytes: 10, txBytes: 10 }, null, Date.now())).toEqual({
      rxBps: null,
      txBps: null,
    });
  });
});
