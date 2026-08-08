const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const LAYER_TTL_MS = 10 * 60 * 1000;
/** Bump when compose settings change so stale low-res caches are rebuilt. */
const COMPOSE_VERSION = 8;
const OUT_W = 2048;
const OUT_H = 1024;
const RADAR_Z = 3;
const RADAR_TILE = 512;
const RADAR_COLOR = 2; // Universal Blue
const RADAR_OPTIONS = '1_1';
/**
 * Polar-orbit true-color layers via single full-earth WMS GetMap (avoids
 * WMTS tile-grid seams). VIIRS first, then Aqua/Terra; merge keeps brightest.
 */
const GIBS_CLOUD_SOURCES = [
  { layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', daysAgo: 2 },
  { layer: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor', daysAgo: 2 },
  { layer: 'MODIS_Aqua_CorrectedReflectance_TrueColor', daysAgo: 2 },
  { layer: 'MODIS_Terra_CorrectedReflectance_TrueColor', daysAgo: 2 },
  { layer: 'VIIRS_SNPP_CorrectedReflectance_TrueColor', daysAgo: 3 },
];
const RAINVIEWER_MANIFEST = 'https://api.rainviewer.com/public/weather-maps.json';
const GIBS_WMS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

const CACHE_DIR = path.join(__dirname, '..', 'data', 'weather-layers');
const RADAR_FILE = path.join(CACHE_DIR, 'radar.png');
const SATELLITE_FILE = path.join(CACHE_DIR, 'satellite.png');
const META_FILE = path.join(CACHE_DIR, 'meta.json');

const ATTRIBUTION = 'Radar © RainViewer · Clouds NASA GIBS (Terra/Aqua/VIIRS)';

let memory = null;
let composePromise = null;

function isEnabled() {
  const raw = process.env.WEATHER_LAYERS;
  if (raw === 'false' || raw === '0' || raw === 'off') return false;
  return true;
}

function emptyPayload(extra = {}) {
  return {
    available: false,
    radarUrl: null,
    satelliteUrl: null,
    radarTs: null,
    satelliteDate: null,
    attribution: ATTRIBUTION,
    ...extra,
  };
}

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readMeta() {
  try {
    if (!fs.existsSync(META_FILE)) return null;
    return JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function writeMeta(meta) {
  ensureCacheDir();
  fs.writeFileSync(META_FILE, `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
}

function cacheFresh(meta) {
  if (!meta?.composedAt) return false;
  if (meta.version !== COMPOSE_VERSION) return false;
  if (!fs.existsSync(RADAR_FILE) && !fs.existsSync(SATELLITE_FILE)) return false;
  return Date.now() - Number(meta.composedAt) < LAYER_TTL_MS;
}

async function fetchBuffer(url, { timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'image/*,application/json' },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const buf = await fetchBuffer(url);
  return JSON.parse(buf.toString('utf8'));
}

function mercatorY(latDeg) {
  const lat = Math.max(-85.05112878, Math.min(85.05112878, latDeg));
  const latRad = (lat * Math.PI) / 180;
  return (1 - Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / Math.PI) / 2;
}

/**
 * Reproject a WebMercator RGBA atlas into equirectangular.
 */
function mercatorToEquirect(raw, mercW, mercH, outW, outH) {
  const out = Buffer.alloc(outW * outH * 4);
  for (let y = 0; y < outH; y += 1) {
    const lat = 90 - ((y + 0.5) / outH) * 180;
    const my = mercatorY(lat) * mercH;
    const my0 = Math.floor(my);
    const my1 = Math.min(mercH - 1, my0 + 1);
    const fy = my - my0;
    for (let x = 0; x < outW; x += 1) {
      const lon = ((x + 0.5) / outW) * 360 - 180;
      const mx = ((lon + 180) / 360) * mercW;
      const mx0 = Math.floor(mx);
      const mx1 = Math.min(mercW - 1, mx0 + 1);
      const fx = mx - mx0;

      const sample = (ix, iy) => {
        const i = (iy * mercW + ix) * 4;
        return [raw[i], raw[i + 1], raw[i + 2], raw[i + 3]];
      };

      const c00 = sample(mx0, my0);
      const c10 = sample(mx1, my0);
      const c01 = sample(mx0, my1);
      const c11 = sample(mx1, my1);
      const o = (y * outW + x) * 4;
      for (let c = 0; c < 4; c += 1) {
        const top = c00[c] * (1 - fx) + c10[c] * fx;
        const bot = c01[c] * (1 - fx) + c11[c] * fx;
        out[o + c] = Math.round(top * (1 - fy) + bot * fy);
      }
      // Treat near-black / empty tiles as transparent for radar.
      if (out[o] < 8 && out[o + 1] < 8 && out[o + 2] < 8) {
        out[o + 3] = 0;
      }
    }
  }
  return out;
}

async function loadTileOrEmpty(url, size) {
  try {
    const buf = await fetchBuffer(url);
    const raw = await sharp(buf).ensureAlpha().resize(size, size, { fit: 'fill' }).raw().toBuffer();
    return { ok: true, raw };
  } catch (error) {
    console.warn('weatherLayers tile failed:', error.message);
    return { ok: false, raw: Buffer.alloc(size * size * 4, 0) };
  }
}

async function composeRadar() {
  const manifest = await fetchJson(RAINVIEWER_MANIFEST);
  const past = manifest?.radar?.past;
  if (!Array.isArray(past) || past.length === 0) {
    throw new Error('RainViewer manifest has no past frames');
  }
  const frame = past[past.length - 1];
  const host = String(manifest.host || '').replace(/\/$/, '');
  const framePath = frame.path;
  const n = 2 ** RADAR_Z;
  const mercW = n * RADAR_TILE;
  const mercH = n * RADAR_TILE;
  const tiles = [];

  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const url = `${host}${framePath}/${RADAR_TILE}/${RADAR_Z}/${x}/${y}/${RADAR_COLOR}/${RADAR_OPTIONS}.png`;
      tiles.push(loadTileOrEmpty(url, RADAR_TILE));
    }
  }

  const tileBufs = await Promise.all(tiles);
  if (!tileBufs.some((t) => t.ok)) {
    throw new Error('RainViewer tiles unavailable');
  }
  const merc = Buffer.alloc(mercW * mercH * 4, 0);
  let i = 0;
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const tile = tileBufs[i].raw;
      i += 1;
      for (let ty = 0; ty < RADAR_TILE; ty += 1) {
        const srcStart = ty * RADAR_TILE * 4;
        const dstStart = ((y * RADAR_TILE + ty) * mercW + x * RADAR_TILE) * 4;
        tile.copy(merc, dstStart, srcStart, srcStart + RADAR_TILE * 4);
      }
    }
  }

  const equirect = mercatorToEquirect(merc, mercW, mercH, OUT_W, OUT_H);
  ensureCacheDir();
  await sharp(equirect, { raw: { width: OUT_W, height: OUT_H, channels: 4 } })
    .png()
    .toFile(RADAR_FILE);

  return {
    radarTs: frame.time ? Number(frame.time) * 1000 : Date.now(),
  };
}

function gibsDate(daysAgo = 2) {
  // Imagery for recent days can lag — prefer a couple days back UTC.
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/**
 * Turn true-color reflectance into a soft cloud veil (bright/white → opaque).
 */
function irToCloudOverlay(raw, width, height) {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const r = raw[i * 4];
    const g = raw[i * 4 + 1];
    const b = raw[i * 4 + 2];
    if (isGibsEmptyPixel(r, g, b, raw[i * 4 + 3])) {
      const o = i * 4;
      out[o] = 220;
      out[o + 1] = 225;
      out[o + 2] = 255;
      out[o + 3] = 0;
      continue;
    }
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // Prefer bright cloud tops; suppress dark ocean/land.
    const whiteness = 1 - (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const cloudiness = Math.max(0, (lum - 0.38) / 0.62) * (0.5 + 0.5 * whiteness);
    const t = Math.min(1, cloudiness);
    const alpha = t > 0.04 ? Math.min(150, Math.round(t * t * 165)) : 0;
    const o = i * 4;
    out[o] = Math.min(255, Math.round(210 + lum * 40));
    out[o + 1] = Math.min(255, Math.round(215 + lum * 35));
    out[o + 2] = 255;
    out[o + 3] = alpha;
  }
  return out;
}

/** Soften hard orbital-swath edges in the cloud veil. */
async function softenCloudOverlay(raw, width, height) {
  // Strong blur: polar-orbit composites always have seams; for a globe veil
  // soft atmosphere reads better than sharp swath cuts.
  return sharp(raw, { raw: { width, height, channels: 4 } })
    .blur(5.5)
    .ensureAlpha()
    .raw()
    .toBuffer();
}

function isGibsEmptyPixel(r, g, b, a = 255) {
  // GIBS no-data is near-black; JPEG can lift pure black into the teens/20s.
  return a < 8 || (r < 28 && g < 28 && b < 28);
}

function pixelLuminance(r, g, b) {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Merge satellite frames for a cloud veil: fill holes, and keep the brighter
 * pixel when both have data (clouds beat dark ocean / weaker passes).
 */
function mergeCloudFrames(target, fill) {
  if (!target || !fill || target.length !== fill.length) return target;
  for (let i = 0; i < target.length; i += 4) {
    const fr = fill[i];
    const fg = fill[i + 1];
    const fb = fill[i + 2];
    const fa = fill[i + 3];
    if (isGibsEmptyPixel(fr, fg, fb, fa)) continue;

    const tr = target[i];
    const tg = target[i + 1];
    const tb = target[i + 2];
    const ta = target[i + 3];
    if (
      isGibsEmptyPixel(tr, tg, tb, ta) ||
      pixelLuminance(fr, fg, fb) > pixelLuminance(tr, tg, tb) + 4
    ) {
      target[i] = fr;
      target[i + 1] = fg;
      target[i + 2] = fb;
      target[i + 3] = fa;
    }
  }
  return target;
}

/** @deprecated use mergeCloudFrames — kept for tests */
function fillEmptyPixels(target, fill) {
  return mergeCloudFrames(target, fill);
}

async function fetchGibsAtlas(layer, date) {
  // One WMS GetMap for the whole globe — no WMTS tile-grid seams.
  const url =
    `${GIBS_WMS}?SERVICE=WMS&REQUEST=GetMap` +
    `&LAYERS=${encodeURIComponent(layer)}` +
    `&STYLES=&FORMAT=image/jpeg&TRANSPARENT=true&VERSION=1.3.0` +
    `&WIDTH=${OUT_W}&HEIGHT=${OUT_H}&CRS=EPSG:4326` +
    `&BBOX=-90,-180,90,180&TIME=${encodeURIComponent(date)}`;

  const buf = await fetchBuffer(url, { timeoutMs: 60000 });
  if (!buf || buf.length < 1000) {
    throw new Error(`NASA GIBS WMS empty (${layer} ${date})`);
  }
  return sharp(buf).ensureAlpha().resize(OUT_W, OUT_H, { fit: 'fill' }).raw().toBuffer();
}

async function composeSatellite() {
  let composite = null;
  const used = [];

  for (const source of GIBS_CLOUD_SOURCES) {
    const date = gibsDate(source.daysAgo);
    try {
      const atlas = await fetchGibsAtlas(source.layer, date);
      if (!composite) {
        composite = atlas;
      } else {
        mergeCloudFrames(composite, atlas);
      }
      used.push(`${source.layer}@${date}`);
    } catch (error) {
      console.warn('weatherLayers satellite source skipped:', error.message);
    }
  }

  if (!composite) {
    throw new Error('NASA GIBS tiles unavailable');
  }

  const overlay = await softenCloudOverlay(
    irToCloudOverlay(composite, OUT_W, OUT_H),
    OUT_W,
    OUT_H
  );
  ensureCacheDir();
  await sharp(overlay, { raw: { width: OUT_W, height: OUT_H, channels: 4 } })
    .png()
    .toFile(SATELLITE_FILE);

  const primaryDate = gibsDate(GIBS_CLOUD_SOURCES[0].daysAgo);
  return { satelliteDate: primaryDate, satelliteSources: used };
}

async function composeAll() {
  const results = { radarTs: null, satelliteDate: null, errors: [] };

  try {
    const radar = await composeRadar();
    results.radarTs = radar.radarTs;
  } catch (error) {
    console.error('weatherLayers radar compose failed:', error.message);
    results.errors.push(`radar: ${error.message}`);
  }

  try {
    const sat = await composeSatellite();
    results.satelliteDate = sat.satelliteDate;
  } catch (error) {
    console.error('weatherLayers satellite compose failed:', error.message);
    results.errors.push(`satellite: ${error.message}`);
  }

  const hasRadar = fs.existsSync(RADAR_FILE);
  const hasSat = fs.existsSync(SATELLITE_FILE);
  if (!hasRadar && !hasSat) {
    throw new Error(results.errors.join('; ') || 'no layers composed');
  }

  const meta = {
    composedAt: Date.now(),
    version: COMPOSE_VERSION,
    radarTs: results.radarTs,
    satelliteDate: results.satelliteDate,
    attribution: ATTRIBUTION,
    size: { width: OUT_W, height: OUT_H },
  };
  writeMeta(meta);
  memory = meta;
  return meta;
}

async function ensureComposed({ force = false } = {}) {
  if (!isEnabled()) return null;

  const meta = memory || readMeta();
  if (!force && cacheFresh(meta)) {
    memory = meta;
    return meta;
  }

  if (!composePromise) {
    composePromise = composeAll().finally(() => {
      composePromise = null;
    });
  }
  return composePromise;
}

function versionQuery(meta) {
  return meta?.composedAt ? `?v=${meta.composedAt}` : '';
}

async function getGlobeLayers() {
  if (!isEnabled()) {
    return emptyPayload({ disabled: true });
  }

  try {
    const meta = await ensureComposed();
    if (!meta) return emptyPayload();

    const hasRadar = fs.existsSync(RADAR_FILE);
    const hasSat = fs.existsSync(SATELLITE_FILE);
    const v = versionQuery(meta);

    return {
      available: hasRadar || hasSat,
      radarUrl: hasRadar ? `/api/weather/globe-layers/radar.png${v}` : null,
      satelliteUrl: hasSat ? `/api/weather/globe-layers/satellite.png${v}` : null,
      radarTs: meta.radarTs || null,
      satelliteDate: meta.satelliteDate || null,
      attribution: meta.attribution || ATTRIBUTION,
    };
  } catch (error) {
    console.error('weatherLayers unavailable:', error.message);
    const stale = memory || readMeta();
    if (stale && (fs.existsSync(RADAR_FILE) || fs.existsSync(SATELLITE_FILE))) {
      const v = versionQuery(stale);
      return {
        available: true,
        radarUrl: fs.existsSync(RADAR_FILE) ? `/api/weather/globe-layers/radar.png${v}` : null,
        satelliteUrl: fs.existsSync(SATELLITE_FILE)
          ? `/api/weather/globe-layers/satellite.png${v}`
          : null,
        radarTs: stale.radarTs || null,
        satelliteDate: stale.satelliteDate || null,
        attribution: stale.attribution || ATTRIBUTION,
        stale: true,
      };
    }
    return emptyPayload({ error: 'unavailable' });
  }
}

function resolveLayerPath(kind) {
  if (kind === 'radar') return RADAR_FILE;
  if (kind === 'satellite') return SATELLITE_FILE;
  return null;
}

function resetWeatherLayersCache() {
  memory = null;
  composePromise = null;
}

module.exports = {
  isEnabled,
  getGlobeLayers,
  ensureComposed,
  resolveLayerPath,
  resetWeatherLayersCache,
  CACHE_DIR,
  LAYER_TTL_MS,
  ATTRIBUTION,
  // Exported for unit tests
  mercatorToEquirect,
  irToCloudOverlay,
  fillEmptyPixels,
  mergeCloudFrames,
  isGibsEmptyPixel,
  emptyPayload,
};
