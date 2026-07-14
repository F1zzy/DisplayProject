require('dotenv').config();

const fs = require('fs');
const cache = require('./cache');

const CACHE_TTL_MS = 15 * 1000;
const CACHE_KEY = 'network:stats';
const DEFAULT_PROBE_URL = 'https://www.gstatic.com/generate_204';
const PROC_NET_DEV = '/proc/net/dev';

let lastOnlineAt = null;
let previousCounters = null;

function getProbeUrl() {
  return process.env.NETWORK_PROBE_URL || DEFAULT_PROBE_URL;
}

function getPreferredIface() {
  return process.env.NETWORK_IFACE || null;
}

/**
 * Parse /proc/net/dev into { name: { rxBytes, txBytes } }.
 * @param {string} content
 */
function parseProcNetDev(content) {
  const interfaces = {};
  const lines = content.split('\n').slice(2);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const colon = trimmed.indexOf(':');
    if (colon === -1) continue;

    const name = trimmed.slice(0, colon).trim();
    const fields = trimmed.slice(colon + 1).trim().split(/\s+/);
    if (fields.length < 9) continue;

    interfaces[name] = {
      rxBytes: Number(fields[0]) || 0,
      txBytes: Number(fields[8]) || 0,
    };
  }

  return interfaces;
}

/**
 * @param {Record<string, { rxBytes: number, txBytes: number }>} interfaces
 * @param {string | null} preferred
 */
function pickInterface(interfaces, preferred) {
  if (preferred && interfaces[preferred]) {
    return preferred;
  }

  const names = Object.keys(interfaces).filter((name) => name !== 'lo');
  if (names.length === 0) return null;

  // Prefer common ethernet/wifi names when present
  const preferredOrder = ['eth0', 'en0', 'wlan0', 'enp0s3', 'ens33'];
  for (const name of preferredOrder) {
    if (interfaces[name]) return name;
  }

  return names[0];
}

/**
 * @param {{ rxBytes: number, txBytes: number } | null} current
 * @param {{ rxBytes: number, txBytes: number, at: number } | null} previous
 * @param {number} now
 */
function computeRates(current, previous, now) {
  if (!current || !previous) {
    return { rxBps: null, txBps: null };
  }

  const elapsedSec = (now - previous.at) / 1000;
  if (elapsedSec <= 0) {
    return { rxBps: null, txBps: null };
  }

  const rxDelta = current.rxBytes - previous.rxBytes;
  const txDelta = current.txBytes - previous.txBytes;

  if (rxDelta < 0 || txDelta < 0) {
    return { rxBps: null, txBps: null };
  }

  return {
    rxBps: Math.round(rxDelta / elapsedSec),
    txBps: Math.round(txDelta / elapsedSec),
  };
}

function readInterfaceCounters() {
  if (!fs.existsSync(PROC_NET_DEV)) {
    return { interface: null, counters: null };
  }

  try {
    const content = fs.readFileSync(PROC_NET_DEV, 'utf8');
    const interfaces = parseProcNetDev(content);
    const name = pickInterface(interfaces, getPreferredIface());
    if (!name) {
      return { interface: null, counters: null };
    }
    return { interface: name, counters: interfaces[name] };
  } catch (error) {
    console.error('Failed to read interface counters:', error.message);
    return { interface: null, counters: null };
  }
}

async function probeLatency() {
  const url = getProbeUrl();
  const started = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(2000),
    });

    // Any HTTP response (including 204) means the network path worked
    if (response.status >= 100 && response.status < 600) {
      return { online: true, latencyMs: Date.now() - started };
    }

    return { online: false, latencyMs: null };
  } catch (error) {
    console.error('Network probe failed:', error.message);
    return { online: false, latencyMs: null };
  }
}

async function collectNetworkStats() {
  const now = Date.now();
  const { online, latencyMs } = await probeLatency();

  if (online) {
    lastOnlineAt = new Date(now).toISOString();
  }

  const { interface: iface, counters } = readInterfaceCounters();
  const previous =
    previousCounters && previousCounters.interface === iface ? previousCounters : null;
  const rates = computeRates(counters, previous, now);

  if (counters && iface) {
    previousCounters = {
      interface: iface,
      rxBytes: counters.rxBytes,
      txBytes: counters.txBytes,
      at: now,
    };
  }

  return {
    online,
    latencyMs,
    checkedAt: new Date(now).toISOString(),
    lastOnlineAt,
    interface: iface,
    rxBps: rates.rxBps,
    txBps: rates.txBps,
  };
}

async function getNetworkStats() {
  const cached = cache.get(CACHE_KEY);
  if (cached) return cached;

  const stats = await collectNetworkStats();
  cache.set(CACHE_KEY, stats, CACHE_TTL_MS);
  return stats;
}

/** Test helpers — not used by production routes. */
function _resetState() {
  lastOnlineAt = null;
  previousCounters = null;
}

module.exports = {
  getNetworkStats,
  parseProcNetDev,
  pickInterface,
  computeRates,
  _resetState,
};
