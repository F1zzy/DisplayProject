import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as THREE from 'three';
import { getGlobeWeather, weatherIconUrl } from '../../api/client';
import { fadeTransition } from '../../lib/dashboard-motion';
import { useWidgetLoadSequence } from '../../hooks/useWidgetLoadSequence';
import { useSettings } from '../../context/SettingsContext';
import WidgetSkeleton from '../ui/WidgetSkeleton';
import ErrorState from '../ui/ErrorState';
import EmptyState from '../ui/EmptyState';
import './WorldGlobe.css';

const POLL_MS = 15 * 60 * 1000;
const FOCUS_MS = 6500;
const MANUAL_HOLD_MS = 14000;
const FOCUS_LERP = 0.08;
const IDLE_SPIN = 0.00055;
const EARTH_RADIUS = 1;
const CAMERA_AXIS = new THREE.Vector3(0, 0, 1);
const EARTH_TEXTURE_URL = `${process.env.PUBLIC_URL || ''}/globe/earth-day.jpg`;

/** Local sphere position for lat/lon (equirectangular; lon=0 on +X). */
function latLonToVector3(lat, lon, radius = EARTH_RADIUS) {
  const phi = (90 - Number(lat)) * (Math.PI / 180);
  const theta = (Number(lon) + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/**
 * Rotation that maps a city onto the camera axis (+Z).
 * Uses a full quaternion — yaw/pitch alone cannot center eastern longitudes under YXZ.
 */
function focusQuaternion(lat, lon, target = new THREE.Quaternion()) {
  const from = latLonToVector3(lat, lon, 1).normalize();
  return target.setFromUnitVectors(from, CAMERA_AXIS);
}

function formatTemp(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Math.round(Number(value))}°`;
}

function formatWind(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Math.round(Number(value))} km/h`;
}

const MARKER = {
  idleCore: 0xf2f4f7,
  idleRing: 0x8b93a0,
  activeCore: 0xffffff,
  activeRing: 0xff7a33,
  activeHalo: 0xff6a1a,
};

function orientOutward(group, position) {
  group.position.copy(position);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize());
}

function createCityMarker() {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.CircleGeometry(0.011, 24),
    new THREE.MeshBasicMaterial({
      color: MARKER.idleCore,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
    })
  );
  core.position.z = 0.002;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.014, 0.02, 48),
    new THREE.MeshBasicMaterial({
      color: MARKER.idleRing,
      transparent: true,
      opacity: 0.75,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.022, 0.038, 48),
    new THREE.MeshBasicMaterial({
      color: MARKER.activeHalo,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );

  group.add(halo, ring, core);
  return { group, core, ring, halo };
}

function setMarkerActive(marker, active) {
  if (!marker) return;
  const { core, ring, halo, group } = marker;
  group.scale.setScalar(active ? 1.15 : 1);
  core.material.color.set(active ? MARKER.activeCore : MARKER.idleCore);
  core.material.opacity = active ? 1 : 0.92;
  ring.material.color.set(active ? MARKER.activeRing : MARKER.idleRing);
  ring.material.opacity = active ? 0.95 : 0.7;
  halo.material.opacity = active ? 0.28 : 0;
  halo.visible = active;
}

function WorldGlobe() {
  const { settings } = useSettings();
  const reduceMotion = useReducedMotion();
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const citiesRef = useRef([]);
  const focusIndexRef = useRef(0);
  const quatRef = useRef(new THREE.Quaternion());
  const targetQuatRef = useRef(new THREE.Quaternion());
  const spinRef = useRef(0);
  const reduceMotionRef = useRef(reduceMotion);
  const pauseUntilRef = useRef(0);
  const markerMeshesRef = useRef([]);
  const tagRef = useRef(null);
  const projectScratch = useRef({
    world: new THREE.Vector3(),
    outward: new THREE.Vector3(),
    toCam: new THREE.Vector3(),
    spinQ: new THREE.Quaternion(),
    renderQ: new THREE.Quaternion(),
  });
  reduceMotionRef.current = reduceMotion;

  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusIndex, setFocusIndex] = useState(0);

  const globeCitiesKey = (settings?.globeCities || []).join(',');
  const ready = cities.length > 0;
  const { showSkeleton } = useWidgetLoadSequence({ loading, ready, rootRef });
  const focused = cities[focusIndex] || null;
  const markerKey = cities.map((c) => `${c.id}:${c.lat}:${c.lon}`).join('|');

  useEffect(() => {
    citiesRef.current = cities;
  }, [cities]);

  useEffect(() => {
    focusIndexRef.current = focusIndex;
    markerMeshesRef.current.forEach((marker, index) => {
      setMarkerActive(marker, index === focusIndex);
    });
  }, [focusIndex, cities]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getGlobeWeather();
        if (cancelled) return;
        const next = Array.isArray(data?.cities) ? data.cities : [];
        setCities(next);
        setFocusIndex(0);
        focusIndexRef.current = 0;
        if (next[0]) {
          focusQuaternion(next[0].lat, next[0].lon, targetQuatRef.current);
          quatRef.current.copy(targetQuatRef.current);
          spinRef.current = 0;
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Unable to load world weather');
          setCities([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [globeCitiesKey]);

  useEffect(() => {
    if (cities.length <= 1) return undefined;

    const id = setInterval(() => {
      if (Date.now() < pauseUntilRef.current) return;
      setFocusIndex((prev) => {
        const next = (prev + 1) % cities.length;
        focusIndexRef.current = next;
        const city = cities[next];
        if (city) {
          focusQuaternion(city.lat, city.lon, targetQuatRef.current);
        }
        return next;
      });
    }, FOCUS_MS);

    return () => clearInterval(id);
  }, [cities]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const cityList = citiesRef.current;
    if (!canvas || cityList.length === 0 || !markerKey) return undefined;

    const parent = canvas.parentElement;
    let width = parent?.clientWidth || 300;
    let height = parent?.clientHeight || width;
    const size = Math.min(width, height) || width;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 2.85);

    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    const key = new THREE.DirectionalLight(0xffffff, 1.35);
    key.position.set(4, 2, 3);
    const fill = new THREE.DirectionalLight(0x88aacc, 0.35);
    fill.position.set(-3, -1, -2);
    scene.add(ambient, key, fill);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x1a2332,
      roughness: 0.85,
      metalness: 0.05,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earth);

    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.035, 48, 48);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x6ea8ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
    });
    globeGroup.add(new THREE.Mesh(atmosGeo, atmosMat));

    const textureLoader = new THREE.TextureLoader();
    let disposed = false;
    textureLoader.load(
      EARTH_TEXTURE_URL,
      (texture) => {
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy?.() || 1, 8);
        earthMat.map = texture;
        earthMat.color.set(0xffffff);
        earthMat.needsUpdate = true;
      },
      undefined,
      () => {
        // Keep solid fallback color if texture fails (offline / missing asset).
      }
    );

    const markerGroup = new THREE.Group();
    globeGroup.add(markerGroup);
    const markerMeshes = cityList.map((city) => {
      const marker = createCityMarker();
      orientOutward(marker.group, latLonToVector3(city.lat, city.lon, EARTH_RADIUS * 1.012));
      markerGroup.add(marker.group);
      return marker;
    });
    markerMeshesRef.current = markerMeshes;
    markerMeshes.forEach((marker, index) => {
      setMarkerActive(marker, index === focusIndexRef.current);
    });

    const onResize = () => {
      if (!parent) return;
      const next = Math.min(parent.clientWidth, parent.clientHeight) || parent.clientWidth;
      if (!next) return;
      renderer.setSize(next, next, false);
      camera.aspect = 1;
      camera.updateProjectionMatrix();
    };

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    if (parent && resizeObserver) resizeObserver.observe(parent);

    let raf = 0;
    const tick = () => {
      const { spinQ, renderQ } = projectScratch.current;

      if (reduceMotionRef.current) {
        quatRef.current.copy(targetQuatRef.current);
      } else {
        quatRef.current.slerp(targetQuatRef.current, FOCUS_LERP);
        if (quatRef.current.angleTo(targetQuatRef.current) < 0.03) {
          // Spin about the camera axis so the focused city stays centered.
          spinRef.current += IDLE_SPIN;
        }
      }

      spinQ.setFromAxisAngle(CAMERA_AXIS, spinRef.current);
      renderQ.copy(spinQ).multiply(quatRef.current);
      globeGroup.quaternion.copy(renderQ);

      const active = markerMeshesRef.current[focusIndexRef.current];
      if (active?.halo?.visible && !reduceMotionRef.current) {
        const pulse = 0.22 + Math.sin(performance.now() * 0.0024) * 0.08;
        active.halo.material.opacity = pulse;
        active.halo.scale.setScalar(1 + Math.sin(performance.now() * 0.0024) * 0.06);
      }

      globeGroup.updateMatrixWorld(true);

      const tagEl = tagRef.current;
      const canvasEl = canvasRef.current;
      if (tagEl && canvasEl && active?.group) {
        const { world, outward, toCam } = projectScratch.current;
        active.group.getWorldPosition(world);
        outward.copy(world).normalize();
        world.addScaledVector(outward, 0.03);
        toCam.copy(camera.position).sub(world).normalize();
        const facing = outward.dot(toCam) > 0.12;
        world.project(camera);
        const stage = canvasEl.parentElement;
        if (facing && stage && world.z < 1) {
          const canvasRect = canvasEl.getBoundingClientRect();
          const stageRect = stage.getBoundingClientRect();
          const x =
            (world.x * 0.5 + 0.5) * canvasRect.width + (canvasRect.left - stageRect.left);
          const y =
            (-world.y * 0.5 + 0.5) * canvasRect.height + (canvasRect.top - stageRect.top);
          tagEl.style.opacity = '1';
          tagEl.style.visibility = 'visible';
          tagEl.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, calc(-100% - 10px))`;
        } else {
          tagEl.style.opacity = '0';
          tagEl.style.visibility = 'hidden';
        }
      }

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      markerMeshesRef.current = [];
      earthGeo.dispose();
      atmosGeo.dispose();
      earthMat.map?.dispose();
      earthMat.dispose();
      atmosMat.dispose();
      markerMeshes.forEach((marker) => {
        marker.group.traverse((obj) => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
      });
      renderer.dispose();
    };
  }, [markerKey]);

  function focusCity(index) {
    if (index < 0 || index >= cities.length) return;
    pauseUntilRef.current = Date.now() + MANUAL_HOLD_MS;
    focusIndexRef.current = index;
    setFocusIndex(index);
    const city = cities[index];
    if (city) {
      focusQuaternion(city.lat, city.lon, targetQuatRef.current);
    }
  }

  return (
    <motion.div
      ref={rootRef}
      className="widget-content world-globe-widget"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fadeTransition(reduceMotion, 0.4)}
    >
      <h3 data-load-step="title">World</h3>

      {showSkeleton && <WidgetSkeleton label="Loading globe…" rows={4} />}

      {!loading && error && cities.length === 0 && (
        <ErrorState className="world-globe-empty">{error}</ErrorState>
      )}

      {!loading && !error && cities.length === 0 && (
        <EmptyState className="world-globe-empty">No city weather available</EmptyState>
      )}

      {cities.length > 0 && (
        <div className="world-globe-body" data-load-step="item">
          <div className="world-globe-stage">
            <canvas ref={canvasRef} className="world-globe-canvas" aria-hidden="true" />
            {focused ? (
              <div
                ref={tagRef}
                className="world-globe-tag"
                role="status"
                aria-live="polite"
              >
                <div className="world-globe-tag-body">
                  <div className="world-globe-tag-row">
                    <span className="world-globe-tag-city">{focused.name}</span>
                    <span className="world-globe-tag-temp">{formatTemp(focused.temperature)}</span>
                  </div>
                  <div className="world-globe-tag-meta">
                    <span>{focused.country}</span>
                    {focused.condition ? <span className="world-globe-tag-sep">·</span> : null}
                    {focused.condition ? <span>{focused.condition}</span> : null}
                  </div>
                  <div className="world-globe-tag-stats">
                    <span>
                      Hum <b>{focused.humidity != null ? `${focused.humidity}%` : '—'}</b>
                    </span>
                    <span>
                      Wind <b>{formatWind(focused.windKph)}</b>
                    </span>
                  </div>
                </div>
                <span className="world-globe-tag-pointer" aria-hidden="true" />
              </div>
            ) : null}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            {focused ? (
              <motion.div
                key={focused.id}
                className="world-globe-callout"
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={fadeTransition(reduceMotion, 0.35)}
              >
                <div className="world-globe-callout-head">
                  {focused.iconUrl ? (
                    <img
                      className="world-globe-callout-icon"
                      src={weatherIconUrl(focused.iconUrl)}
                      alt=""
                    />
                  ) : null}
                  <div>
                    <div className="world-globe-callout-city">{focused.name}</div>
                    <div className="world-globe-callout-meta">
                      {focused.country}
                      {focused.condition ? ` · ${focused.condition}` : ''}
                    </div>
                  </div>
                  <strong className="world-globe-callout-temp">{formatTemp(focused.temperature)}</strong>
                </div>
                <div className="world-globe-callout-stats">
                  <span>
                    Humidity <b>{focused.humidity != null ? `${focused.humidity}%` : '—'}</b>
                  </span>
                  <span>
                    Wind <b>{formatWind(focused.windKph)}</b>
                  </span>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="world-globe-cities" role="listbox" aria-label="Globe cities">
            {cities.map((city, index) => (
              <button
                key={city.id}
                type="button"
                role="option"
                aria-selected={index === focusIndex}
                className={`world-globe-city-chip${index === focusIndex ? ' is-active' : ''}`}
                onClick={() => focusCity(index)}
              >
                <span className="world-globe-city-chip-name">{city.name}</span>
                <span className="world-globe-city-chip-temp">{formatTemp(city.temperature)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default WorldGlobe;
