import * as THREE from 'three';
import { Earcut } from 'three/src/extras/Earcut.js';

export const COUNTRIES_HIGHLIGHT_URL = `${process.env.PUBLIC_URL || ''}/globe/countries-highlight.json`;

const FILL = 0xff7a33;
const EDGE = 0xffb070;
/** Max chord length on the unit sphere before a triangle edge is split (~4.5°). */
const MAX_EDGE = 0.08;
/** Max outline step in degrees along a ring edge. */
const OUTLINE_STEP_DEG = 2.5;

function ringOpen(ring) {
  if (!Array.isArray(ring) || ring.length < 3) return [];
  const last = ring[ring.length - 1];
  const first = ring[0];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }
  return ring;
}

function pushVertex(list, x, y, z) {
  list.push(x, y, z);
  return list.length / 3 - 1;
}

function midpointOnSphere(positions, ia, ib, radius) {
  const ax = positions[ia * 3];
  const ay = positions[ia * 3 + 1];
  const az = positions[ia * 3 + 2];
  const bx = positions[ib * 3];
  const by = positions[ib * 3 + 1];
  const bz = positions[ib * 3 + 2];
  let x = ax + bx;
  let y = ay + by;
  let z = az + bz;
  const len = Math.hypot(x, y, z) || 1;
  const s = radius / len;
  return pushVertex(positions, x * s, y * s, z * s);
}

function edgeLen2(positions, ia, ib) {
  const dx = positions[ia * 3] - positions[ib * 3];
  const dy = positions[ia * 3 + 1] - positions[ib * 3 + 1];
  const dz = positions[ia * 3 + 2] - positions[ib * 3 + 2];
  return dx * dx + dy * dy + dz * dz;
}

/**
 * Subdivide planar lon/lat triangles so faces hug the sphere (large countries
 * otherwise chord through the Earth and look only partially filled).
 */
function subdivideSphereTriangles(positions, indices, radius, maxEdge = MAX_EDGE) {
  const maxEdge2 = maxEdge * maxEdge;
  let tris = indices.slice();
  const midCache = new Map();

  const midpoint = (ia, ib) => {
    const key = ia < ib ? `${ia}_${ib}` : `${ib}_${ia}`;
    if (midCache.has(key)) return midCache.get(key);
    const mid = midpointOnSphere(positions, ia, ib, radius);
    midCache.set(key, mid);
    return mid;
  };

  for (let pass = 0; pass < 8; pass += 1) {
    const next = [];
    let split = false;
    for (let i = 0; i < tris.length; i += 3) {
      const a = tris[i];
      const b = tris[i + 1];
      const c = tris[i + 2];
      const ab = edgeLen2(positions, a, b) > maxEdge2;
      const bc = edgeLen2(positions, b, c) > maxEdge2;
      const ca = edgeLen2(positions, c, a) > maxEdge2;
      if (!(ab || bc || ca)) {
        next.push(a, b, c);
        continue;
      }
      split = true;
      const mab = ab ? midpoint(a, b) : -1;
      const mbc = bc ? midpoint(b, c) : -1;
      const mca = ca ? midpoint(c, a) : -1;
      if (ab && bc && ca) {
        next.push(a, mab, mca, b, mbc, mab, c, mca, mbc, mab, mbc, mca);
      } else if (ab && bc) {
        next.push(a, mab, c, mab, b, mbc, mab, mbc, c);
      } else if (bc && ca) {
        next.push(a, b, mbc, a, mbc, mca, mca, mbc, c);
      } else if (ca && ab) {
        next.push(a, mab, mca, mab, b, c, mca, mab, c);
      } else if (ab) {
        next.push(a, mab, c, mab, b, c);
      } else if (bc) {
        next.push(a, b, mbc, a, mbc, c);
      } else {
        next.push(a, b, mca, b, c, mca);
      }
    }
    tris = next;
    if (!split) break;
  }
  return tris;
}

function densifyRing(ring, stepDeg = OUTLINE_STEP_DEG) {
  if (ring.length < 2) return ring.slice();
  const out = [];
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    out.push(a);
    const lon0 = Number(a[0]);
    const lat0 = Number(a[1]);
    const lon1 = Number(b[0]);
    const lat1 = Number(b[1]);
    let dLon = lon1 - lon0;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    const dLat = lat1 - lat0;
    const dist = Math.hypot(dLon, dLat);
    const steps = Math.max(1, Math.ceil(dist / stepDeg));
    for (let s = 1; s < steps; s += 1) {
      const t = s / steps;
      out.push([lon0 + dLon * t, lat0 + dLat * t]);
    }
  }
  return out;
}

function polygonToFillMesh(polygon, radius, latLonToVector3) {
  const vertices2 = [];
  const holeIndices = [];
  const positions = [];

  for (let r = 0; r < polygon.length; r += 1) {
    const ring = densifyRing(ringOpen(polygon[r]));
    if (ring.length < 3) continue;
    if (r > 0) holeIndices.push(vertices2.length / 2);
    for (let i = 0; i < ring.length; i += 1) {
      const lon = Number(ring[i][0]);
      const lat = Number(ring[i][1]);
      vertices2.push(lon, lat);
      const v = latLonToVector3(lat, lon, radius);
      positions.push(v.x, v.y, v.z);
    }
  }

  if (positions.length < 9) return null;

  let indices = Earcut.triangulate(vertices2, holeIndices, 2);
  if (!indices.length) return null;
  indices = subdivideSphereTriangles(positions, indices, radius);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  return new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color: FILL,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
}

function polygonToOutline(polygon, radius, latLonToVector3) {
  const outer = densifyRing(ringOpen(polygon[0]));
  if (outer.length < 3) return null;

  const points = outer.map(([lon, lat]) => latLonToVector3(lat, lon, radius));
  points.push(points[0].clone());
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: EDGE,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    })
  );
}

/**
 * Build a group of fill + outline meshes for one GeoJSON Feature.
 */
export function buildCountryHighlight(feature, latLonToVector3, radius) {
  const group = new THREE.Group();
  group.userData.countryIso = String(feature.id).padStart(3, '0');
  group.visible = false;

  const polygons =
    feature.geometry?.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry?.type === 'MultiPolygon'
        ? feature.geometry.coordinates
        : [];

  const fillRadius = radius * 1.007;
  const edgeRadius = radius * 1.01;

  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) continue;
    const fill = polygonToFillMesh(polygon, fillRadius, latLonToVector3);
    if (fill) {
      fill.renderOrder = 1;
      group.add(fill);
    }
    const outline = polygonToOutline(polygon, edgeRadius, latLonToVector3);
    if (outline) {
      outline.renderOrder = 2;
      group.add(outline);
    }
  }

  return group;
}

export function setActiveCountry(byIso, countryIso) {
  const target = countryIso ? String(countryIso).padStart(3, '0') : null;
  byIso.forEach((group, iso) => {
    group.visible = iso === target;
  });
}

export function disposeCountryHighlights(byIso) {
  byIso.forEach((group) => {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
  });
  byIso.clear();
}
