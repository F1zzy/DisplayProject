// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

jest.mock('animejs', () => {
  const noopAnim = {
    pause: jest.fn(),
    cancel: jest.fn(),
    revert: jest.fn(),
    complete: jest.fn(),
    then: (resolve) => Promise.resolve().then(resolve),
    add() {
      return this;
    },
    sync() {
      return this;
    },
    set() {
      return this;
    },
  };

  return {
    animate: jest.fn(() => ({ ...noopAnim })),
    createTimeline: jest.fn(() => ({ ...noopAnim })),
    stagger: jest.fn((value) => value),
  };
});

jest.mock('three', () => {
  class MockVector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    copy() {
      return this;
    }
  }

  const mesh = () => ({
    position: new MockVector3(),
    scale: { setScalar: jest.fn() },
    material: {
      color: { set: jest.fn() },
      emissive: { set: jest.fn() },
      emissiveIntensity: 0,
      map: null,
      needsUpdate: false,
    },
    geometry: { dispose: jest.fn() },
  });

  return {
    WebGLRenderer: jest.fn(() => ({
      setPixelRatio: jest.fn(),
      setSize: jest.fn(),
      render: jest.fn(),
      dispose: jest.fn(),
      outputColorSpace: null,
      capabilities: { getMaxAnisotropy: () => 1 },
    })),
    Scene: jest.fn(() => ({ add: jest.fn() })),
    PerspectiveCamera: jest.fn(() => ({
      position: { set: jest.fn() },
      aspect: 1,
      updateProjectionMatrix: jest.fn(),
    })),
    AmbientLight: jest.fn(),
    DirectionalLight: jest.fn(() => ({ position: { set: jest.fn() } })),
    Group: jest.fn(() => ({ add: jest.fn(), rotation: { x: 0, y: 0 } })),
    SphereGeometry: jest.fn(() => ({ dispose: jest.fn() })),
    CircleGeometry: jest.fn(() => ({ dispose: jest.fn() })),
    RingGeometry: jest.fn(() => ({ dispose: jest.fn() })),
    MeshStandardMaterial: jest.fn(() => ({
      color: { set: jest.fn() },
      map: null,
      needsUpdate: false,
      dispose: jest.fn(),
    })),
    MeshBasicMaterial: jest.fn(() => ({
      color: { set: jest.fn() },
      opacity: 1,
      dispose: jest.fn(),
    })),
    Mesh: jest.fn(() => mesh()),
    TextureLoader: jest.fn(() => ({
      load: jest.fn((_url, onLoad) => {
        if (onLoad) onLoad({ colorSpace: null, anisotropy: 1, dispose: jest.fn() });
      }),
    })),
    Vector3: MockVector3,
    SRGBColorSpace: 'srgb',
    BackSide: 1,
    DoubleSide: 2,
  };
});
