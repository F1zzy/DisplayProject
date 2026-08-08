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

jest.mock('three/src/extras/Earcut.js', () => ({
  Earcut: { triangulate: () => [] },
}));

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
    clone() {
      return new MockVector3(this.x, this.y, this.z);
    }
    normalize() {
      return this;
    }
    addScaledVector() {
      return this;
    }
    sub() {
      return this;
    }
    project() {
      return this;
    }
    setFromUnitVectors() {
      return this;
    }
  }

  class MockQuaternion {
    copy() {
      return this;
    }
    slerp() {
      return this;
    }
    multiply() {
      return this;
    }
    setFromUnitVectors() {
      return this;
    }
    setFromAxisAngle() {
      return this;
    }
    angleTo() {
      return 0;
    }
  }

  const mesh = () => ({
    position: new MockVector3(),
    scale: { setScalar: jest.fn() },
    visible: true,
    renderOrder: 0,
    material: {
      color: { set: jest.fn() },
      emissive: { set: jest.fn() },
      emissiveIntensity: 0,
      map: null,
      needsUpdate: false,
      opacity: 1,
      dispose: jest.fn(),
    },
    geometry: { dispose: jest.fn() },
    traverse: jest.fn(),
    getWorldPosition: jest.fn(),
    quaternion: new MockQuaternion(),
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
    Group: jest.fn(() => ({
      add: jest.fn(),
      rotation: { x: 0, y: 0 },
      quaternion: new MockQuaternion(),
      updateMatrixWorld: jest.fn(),
      children: [],
      userData: {},
      visible: false,
      traverse: jest.fn(),
    })),
    SphereGeometry: jest.fn(() => ({ dispose: jest.fn() })),
    CircleGeometry: jest.fn(() => ({ dispose: jest.fn() })),
    RingGeometry: jest.fn(() => ({ dispose: jest.fn() })),
    BufferGeometry: jest.fn(() => ({
      setAttribute: jest.fn(),
      setIndex: jest.fn(),
      setFromPoints: jest.fn(function setFromPoints() {
        return this;
      }),
      dispose: jest.fn(),
    })),
    Float32BufferAttribute: jest.fn(),
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
    LineBasicMaterial: jest.fn(() => ({
      color: { set: jest.fn() },
      opacity: 1,
      dispose: jest.fn(),
    })),
    Mesh: jest.fn(() => mesh()),
    Line: jest.fn(() => mesh()),
    TextureLoader: jest.fn(() => ({
      load: jest.fn((_url, onLoad) => {
        if (onLoad) onLoad({ colorSpace: null, anisotropy: 1, dispose: jest.fn() });
      }),
    })),
    Vector3: MockVector3,
    Quaternion: MockQuaternion,
    SRGBColorSpace: 'srgb',
    BackSide: 1,
    DoubleSide: 2,
    FrontSide: 0,
    LinearMipmapLinearFilter: 1008,
    LinearFilter: 1006,
    ClampToEdgeWrapping: 1001,
  };
});
