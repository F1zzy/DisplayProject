import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import * as THREE from 'three';
import { getGlobeWeather, getGlobeLayers, getSatellitePositions, weatherIconUrl } from '../../api/client';
import { fadeTransition } from '../../lib/dashboard-motion';
import { useWidgetLoadSequence } from '../../hooks/useWidgetLoadSequence';
import { useSettings } from '../../context/SettingsContext';
import WidgetSkeleton from '../ui/WidgetSkeleton';
import ErrorState from '../ui/ErrorState';
import EmptyState from '../ui/EmptyState';
import {
  COUNTRIES_HIGHLIGHT_URL,
  buildCountryHighlight,
  disposeCountryHighlights,
  setActiveCountry,
} from './globeCountryHighlight';
import './WorldGlobe.css';

const POLL_MS = 15 * 60 * 1000;
const LAYERS_POLL_MS = 10 * 60 * 1000;
const SAT_POLL_MS = 50 * 1000;
const FOCUS_MS = 6500;
const MANUAL_HOLD_MS = 14000;
const FOCUS_LERP = 0.08;
const IDLE_SPIN = 0.00055;
const EARTH_RADIUS = 1;
const EARTH_KM = 6371;
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

/** Orbit altitude → sphere radius (LEO≈1.02 … GEO≈1.12). */
function altitudeRadius(altKm) {
  const factor = 1 + Math.max(0, Number(altKm) || 0) / EARTH_KM;
  return EARTH_RADIUS * Math.min(1.12, Math.max(1.02, factor));
}

function formatAltKm(value) {
  if (value == null || Number.isNaN(Number(value))) return '—';
  return `${Math.round(Number(value))} km`;
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

const SAT_MARKER = {
  core: 0xb8ecff,
  ring: 0x4cb8e8,
  trail: 0x5ec8ff,
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

/** Distinct from city pins: diamond core + square ring. */
function createSatMarker() {
  const group = new THREE.Group();

  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.022, 0),
    new THREE.MeshBasicMaterial({
      color: SAT_MARKER.core,
      transparent: true,
      opacity: 0.98,
      depthWrite: false,
    })
  );

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.026, 0.038, 4),
    new THREE.MeshBasicMaterial({
      color: SAT_MARKER.ring,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.z = Math.PI / 4;

  group.add(ring, core);
  return { group, core, ring };
}

function syncSatVisuals(satGroup, sats) {
  clearGroup(satGroup);
  const visuals = [];

  for (const sat of sats) {
    if (sat?.lat == null || sat?.lon == null) continue;
    const marker = createSatMarker();
    orientOutward(marker.group, latLonToVector3(sat.lat, sat.lon, altitudeRadius(sat.altKm)));
    satGroup.add(marker.group);

    // Ground footprint pin so the location is visible even when the orbiter is high.
    const footprint = new THREE.Mesh(
      new THREE.RingGeometry(0.012, 0.02, 32),
      new THREE.MeshBasicMaterial({
        color: SAT_MARKER.trail,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    orientOutward(footprint, latLonToVector3(sat.lat, sat.lon, EARTH_RADIUS * 1.008));
    satGroup.add(footprint);

    const stemPoints = [
      latLonToVector3(sat.lat, sat.lon, EARTH_RADIUS * 1.01),
      latLonToVector3(sat.lat, sat.lon, altitudeRadius(sat.altKm)),
    ];
    const stemGeo = new THREE.BufferGeometry().setFromPoints(stemPoints);
    const stemMat = new THREE.LineBasicMaterial({
      color: SAT_MARKER.trail,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    satGroup.add(new THREE.Line(stemGeo, stemMat));

    const track = Array.isArray(sat.track) ? sat.track : [];
    if (track.length >= 2) {
      const points = track.map((p) =>
        latLonToVector3(p.lat, p.lon, altitudeRadius(p.altKm ?? sat.altKm))
      );
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: SAT_MARKER.trail,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      satGroup.add(new THREE.Line(geometry, material));
    }

    visuals.push({ id: sat.id, group: marker.group, name: sat.name, altKm: sat.altKm });
  }

  return visuals;
}

function disposeObject3D(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children[0];
    group.remove(child);
    disposeObject3D(child);
  }
}

/**
 * Canvas getContext('webgl2') reuses the prior context across React effect remounts.
 * Three.js then uploads empty TEXTURE_3D data while FLIP_Y/PREMULTIPLY may still be on,
 * which Chrome rejects. Reset unpack flags before constructing the renderer.
 */
function createGlobeRenderer(canvas) {
  const attributes = {
    alpha: true,
    antialias: true,
    powerPreference: 'low-power',
  };
  const gl = canvas.getContext('webgl2', attributes) || canvas.getContext('webgl2');
  if (gl) {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }
  return new THREE.WebGLRenderer({
    canvas,
    context: gl || undefined,
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
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
  const satGroupRef = useRef(null);
  const satVisualsRef = useRef([]);
  const satLabelElsRef = useRef(new Map());
  const overlayRef = useRef({
    satelliteMat: null,
    radarMat: null,
    textures: [],
  });
  const tagRef = useRef(null);
  const countryHighlightRef = useRef({ byIso: new Map() });
  const projectScratch = useRef({
    world: new THREE.Vector3(),
    outward: new THREE.Vector3(),
    toCam: new THREE.Vector3(),
    spinQ: new THREE.Quaternion(),
    renderQ: new THREE.Quaternion(),
  });
  reduceMotionRef.current = reduceMotion;

  const [cities, setCities] = useState([]);
  const [satellites, setSatellites] = useState([]);
  const satellitesRef = useRef([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const [layerAttribution, setLayerAttribution] = useState('');
  const [satAttribution, setSatAttribution] = useState('');

  const globeCitiesKey = (settings?.globeCities || []).join(',');
  const globeLayersMode = settings?.globeLayers || 'both';
  const ready = cities.length > 0;
  const { showSkeleton } = useWidgetLoadSequence({ loading, ready, rootRef });
  const focused = cities[focusIndex] || null;
  const markerKey = cities.map((c) => `${c.id}:${c.lat}:${c.lon}`).join('|');
  const attributionText = [layerAttribution, satAttribution].filter(Boolean).join(' · ');

  useEffect(() => {
    citiesRef.current = cities;
  }, [cities]);

  useEffect(() => {
    satellitesRef.current = satellites;
  }, [satellites]);

  useEffect(() => {
    focusIndexRef.current = focusIndex;
    markerMeshesRef.current.forEach((marker, index) => {
      setMarkerActive(marker, index === focusIndex);
    });
    const city = cities[focusIndex];
    setActiveCountry(countryHighlightRef.current.byIso, city?.countryIso);
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
    let cancelled = false;

    async function loadSats() {
      try {
        const data = await getSatellitePositions();
        if (cancelled) return;
        const next = Array.isArray(data?.satellites) ? data.satellites : [];
        setSatellites(next);
        setSatAttribution(next.length > 0 ? data?.attribution || 'Tracking © n2yo.com' : '');
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setSatellites([]);
          setSatAttribution('');
        }
      }
    }

    loadSats();
    const interval = setInterval(loadSats, SAT_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

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

    const renderer = createGlobeRenderer(canvas);
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

    const satelliteMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const radarMat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.FrontSide,
    });
    const satelliteMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.002, 64, 64),
      satelliteMat
    );
    const radarMesh = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_RADIUS * 1.005, 64, 64),
      radarMat
    );
    satelliteMesh.visible = false;
    radarMesh.visible = false;
    globeGroup.add(satelliteMesh, radarMesh);
    overlayRef.current = {
      satelliteMat,
      radarMat,
      satelliteMesh,
      radarMesh,
      textures: [],
    };

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

    const countryGroup = new THREE.Group();
    globeGroup.add(countryGroup);
    const countryByIso = new Map();
    countryHighlightRef.current = { byIso: countryByIso };

    fetch(COUNTRIES_HIGHLIGHT_URL)
      .then((response) => {
        if (!response.ok) throw new Error(`countries ${response.status}`);
        return response.json();
      })
      .then((collection) => {
        if (disposed || !Array.isArray(collection?.features)) return;
        for (const feature of collection.features) {
          const highlight = buildCountryHighlight(feature, latLonToVector3, EARTH_RADIUS);
          if (!highlight.children.length) continue;
          const iso = String(feature.id).padStart(3, '0');
          countryByIso.set(iso, highlight);
          countryGroup.add(highlight);
        }
        const focusedCity = citiesRef.current[focusIndexRef.current];
        setActiveCountry(countryByIso, focusedCity?.countryIso);
      })
      .catch((err) => {
        console.warn('WorldGlobe country boundaries unavailable:', err.message);
      });

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

    const satGroup = new THREE.Group();
    globeGroup.add(satGroup);
    satGroupRef.current = satGroup;
    satVisualsRef.current = syncSatVisuals(satGroup, satellitesRef.current);

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

      const stage = canvasEl?.parentElement;
      const canvasRect = canvasEl?.getBoundingClientRect?.();
      const stageRect = stage?.getBoundingClientRect?.();
      if (stage && canvasRect && stageRect) {
        const { world, outward, toCam } = projectScratch.current;
        for (const visual of satVisualsRef.current) {
          const labelEl = satLabelElsRef.current.get(visual.id);
          if (!labelEl || !visual.group) continue;
          visual.group.getWorldPosition(world);
          outward.copy(world).normalize();
          world.addScaledVector(outward, 0.04);
          toCam.copy(camera.position).sub(world).normalize();
          const facing = outward.dot(toCam) > 0.08;
          world.project(camera);
          if (facing && world.z < 1) {
            const x =
              (world.x * 0.5 + 0.5) * canvasRect.width + (canvasRect.left - stageRect.left);
            const y =
              (-world.y * 0.5 + 0.5) * canvasRect.height + (canvasRect.top - stageRect.top);
            labelEl.style.opacity = '1';
            labelEl.style.visibility = 'visible';
            labelEl.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, calc(-100% - 6px))`;
          } else {
            labelEl.style.opacity = '0';
            labelEl.style.visibility = 'hidden';
          }
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
      if (satGroupRef.current) {
        clearGroup(satGroupRef.current);
      }
      satGroupRef.current = null;
      satVisualsRef.current = [];
      disposeCountryHighlights(countryByIso);
      countryHighlightRef.current = { byIso: new Map() };
      const overlay = overlayRef.current;
      overlay.textures?.forEach((tex) => tex.dispose());
      overlay.textures = [];
      overlay.satelliteMat = null;
      overlay.radarMat = null;
      overlay.satelliteMesh = null;
      overlay.radarMesh = null;
      earthGeo.dispose();
      atmosGeo.dispose();
      satelliteMesh.geometry.dispose();
      radarMesh.geometry.dispose();
      satelliteMat.dispose();
      radarMat.dispose();
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

  useEffect(() => {
    const satGroup = satGroupRef.current;
    if (!satGroup) return undefined;
    satVisualsRef.current = syncSatVisuals(satGroup, satellites);
    return undefined;
  }, [satellites, markerKey]);

  useEffect(() => {
    if (cities.length === 0) return undefined;
    let cancelled = false;
    const loader = new THREE.TextureLoader();

    function clearOverlayTextures() {
      const overlay = overlayRef.current;
      overlay.textures?.forEach((tex) => tex.dispose());
      overlay.textures = [];
      if (overlay.satelliteMat) {
        overlay.satelliteMat.map = null;
        overlay.satelliteMat.opacity = 0;
        overlay.satelliteMat.needsUpdate = true;
      }
      if (overlay.radarMat) {
        overlay.radarMat.map = null;
        overlay.radarMat.opacity = 0;
        overlay.radarMat.needsUpdate = true;
      }
      if (overlay.satelliteMesh) overlay.satelliteMesh.visible = false;
      if (overlay.radarMesh) overlay.radarMesh.visible = false;
    }

    function loadMap(url) {
      return new Promise((resolve, reject) => {
        loader.load(
          url,
          (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.anisotropy = Math.min(8, 4);
            texture.generateMipmaps = true;
            texture.minFilter = THREE.LinearMipmapLinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            resolve(texture);
          },
          undefined,
          reject
        );
      });
    }

    async function refreshLayers() {
      const mode = globeLayersMode;
      if (mode === 'off') {
        clearOverlayTextures();
        if (!cancelled) setLayerAttribution('');
        return;
      }

      try {
        const data = await getGlobeLayers();
        if (cancelled) return;
        const overlay = overlayRef.current;
        if (!overlay.satelliteMat || !overlay.radarMat) return;

        clearOverlayTextures();
        const nextTextures = [];
        const wantSat = mode === 'satellite' || mode === 'both';
        const wantRadar = mode === 'radar' || mode === 'both';

        if (wantSat && data?.satelliteUrl) {
          const texture = await loadMap(data.satelliteUrl);
          if (cancelled) {
            texture.dispose();
            return;
          }
          overlay.satelliteMat.map = texture;
          overlay.satelliteMat.opacity = 0.34;
          overlay.satelliteMat.needsUpdate = true;
          overlay.satelliteMesh.visible = true;
          nextTextures.push(texture);
        }

        if (wantRadar && data?.radarUrl) {
          const texture = await loadMap(data.radarUrl);
          if (cancelled) {
            texture.dispose();
            return;
          }
          overlay.radarMat.map = texture;
          overlay.radarMat.opacity = 0.72;
          overlay.radarMat.needsUpdate = true;
          overlay.radarMesh.visible = true;
          nextTextures.push(texture);
        }

        overlay.textures = nextTextures;
        setLayerAttribution(
          nextTextures.length > 0 ? data?.attribution || 'Radar © RainViewer · Imagery NASA GIBS' : ''
        );
      } catch (err) {
        console.error(err);
        if (!cancelled) setLayerAttribution('');
      }
    }

    refreshLayers();
    const id = setInterval(refreshLayers, LAYERS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [cities.length, globeLayersMode, markerKey]);

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

  function focusSatellite(sat) {
    if (!sat || sat.lat == null || sat.lon == null) return;
    pauseUntilRef.current = Date.now() + MANUAL_HOLD_MS;
    focusQuaternion(sat.lat, sat.lon, targetQuatRef.current);
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
            {satellites.map((sat) => (
              <div
                key={sat.id}
                className="world-globe-sat-label"
                ref={(el) => {
                  if (el) satLabelElsRef.current.set(sat.id, el);
                  else satLabelElsRef.current.delete(sat.id);
                }}
              >
                <span className="world-globe-sat-label-name">{sat.name}</span>
                <span className="world-globe-sat-label-alt">{formatAltKm(sat.altKm)}</span>
              </div>
            ))}
          </div>

          {attributionText ? (
            <p className="world-globe-attribution">{attributionText}</p>
          ) : null}

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
            {satellites.map((sat) => (
              <button
                key={`sat-${sat.id}`}
                type="button"
                className="world-globe-city-chip world-globe-sat-chip"
                onClick={() => focusSatellite(sat)}
                title={`${sat.name} · ${formatAltKm(sat.altKm)}`}
              >
                <span className="world-globe-city-chip-name">{sat.name}</span>
                <span className="world-globe-city-chip-temp">{formatAltKm(sat.altKm)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default WorldGlobe;
