import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createGaussianShowroom } from './createGaussianShowroom';
import showroomConfig from './gaussianShowroomConfig';

const state = vi.hoisted(() => ({ renderers: [], sparks: [], meshes: [], update: null }));

vi.mock('three', async (original) => {
  const actual = await original();
  return {
    ...actual,
    WebGLRenderer: class {
      constructor() {
        this.domElement = document.createElement('canvas');
        this.renders = [];
        this.dispose = vi.fn();
        this.setScissorTest = vi.fn();
        this.setScissor = vi.fn();
        this.setClearColor = vi.fn();
        this.clear = vi.fn();
        state.renderers.push(this);
      }
      setPixelRatio(value) {
        this.pixelRatio = value;
      }
      setSize(width, height) {
        this.size = [width, height];
      }
      render(scene, camera) {
        scene.updateMatrixWorld(true);
        camera.updateMatrixWorld(true);
        this.renders.push({
          position: camera.position.clone(),
          quaternion: camera.quaternion.clone(),
          projection: camera.projectionMatrix.clone(),
        });
      }
    },
  };
});

vi.mock('@sparkjsdev/spark', async () => {
  const actual = await vi.importActual('three');
  return {
    SparkRenderer: class extends actual.Object3D {
      constructor(options) {
        super();
        this.options = options;
        this.update = vi.fn(() => state.update?.() ?? Promise.resolve());
        this.dispose = vi.fn();
        state.sparks.push(this);
      }
    },
    SplatMesh: class extends actual.Object3D {
      constructor(options) {
        super();
        this.options = options;
        this.numSplats = 10;
        this.isInitialized = true;
        this.initialized = Promise.resolve();
        this.dispose = vi.fn();
        state.meshes.push(this);
      }
    },
    SplatEdit: class extends actual.Object3D {
      constructor(options) {
        super();
        Object.assign(this, options);
      }
    },
    SplatEditSdf: class extends actual.Object3D {
      constructor(options) {
        super();
        Object.assign(this, options);
      }
    },
  };
});

vi.mock('three/addons/controls/OrbitControls.js', async () => {
  const actual = await vi.importActual('three');
  return {
    OrbitControls: class extends actual.EventDispatcher {
      constructor(camera) {
        super();
        this.camera = camera;
        this.target = new actual.Vector3();
        this.dispose = vi.fn();
      }
      update() {
        this.camera.lookAt(this.target);
      }
      getAzimuthalAngle() {
        return 0;
      }
      getPolarAngle() {
        return Math.PI / 2;
      }
    },
  };
});

const config = {
  url: '/test.spz',
  camera: {
    position: [0, 0, 0],
    quaternion: [0, 0, 0, 1],
    targetDistance: 4,
    intrinsics: { width: 960, height: 720, fx: 850, fy: 850, cx: 480, cy: 360 },
  },
  navigation: {
    zoomMode: 'crop',
    maxCropZoom: 2,
    allowLook: false,
    minDistance: 4,
    maxDistance: 4,
    relativeOrbitLimits: { azimuth: 0.02, polar: { min: -0.01, max: 0 } },
  },
  maxPixelRatio: 2,
  maxRenderPixels: 3000000,
  hotspots: [{ slug: 'guitar', position: [0.5, 0, -3], radius: 0.1 }],
};

let frames;
let nextFrame;
let controllers;
const settle = async () => {
  for (let i = 0; i < 8; i++) await Promise.resolve();
};
async function frame(time = performance.now() + 1000) {
  const current = [...frames.values()];
  frames.clear();
  current.forEach((callback) => callback(time));
  await settle();
}
function create(width = 1200, height = 600, overrides = {}) {
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  for (const [key, value] of Object.entries({
    clientWidth: width,
    clientHeight: height,
    offsetLeft: 24,
    offsetTop: 60,
  }))
    Object.defineProperty(mount, key, { value });
  const callbacks = {
    onReady: vi.fn(),
    onError: vi.fn(),
    onPinsChange: vi.fn(),
    onViewChange: vi.fn(),
  };
  const controller = createGaussianShowroom({
    mount,
    config: {
      ...config,
      ...overrides,
      navigation: { ...config.navigation, ...overrides.navigation },
    },
    ...callbacks,
  });
  controllers.push(controller);
  return { controller, mount, ...callbacks };
}

beforeEach(() => {
  state.renderers.length = 0;
  state.sparks.length = 0;
  state.meshes.length = 0;
  state.update = null;
  frames = new Map();
  nextFrame = 0;
  controllers = [];
  vi.stubGlobal('requestAnimationFrame', (callback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id) => frames.delete(id));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    }
  );
  vi.stubGlobal('IntersectionObserver', undefined);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      headers: new Headers(),
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }))
  );
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
});

afterEach(() => {
  controllers.forEach((controller) => controller.dispose());
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Gaussian showroom render lifecycle and framing', () => {
  it('waits for a sorted frame, fits the source, offsets pins and then becomes idle', async () => {
    const view = create();
    await view.controller.ready;
    expect(view.onReady).not.toHaveBeenCalled();
    await frame();
    expect(view.onReady).not.toHaveBeenCalled();
    await frame();
    expect(view.onReady).toHaveBeenCalledOnce();
    expect(state.sparks[0].options.autoUpdate).toBe(false);
    expect(state.renderers[0].size).toEqual([800, 600]);
    const canvas = view.mount.querySelector('canvas');
    expect(canvas.style.left).toBe('200px');
    const pin = view.onPinsChange.mock.lastCall[0][0];
    expect(pin.x).toBeCloseTo(24 + 200 + (480 + (850 * 0.5) / 3) * (800 / 960));
    expect(pin.y).toBeCloseTo(60 + 300);
    expect(frames.size).toBe(0);
    expect(state.sparks[0].update).toHaveBeenCalledOnce();
  });

  it('routes asynchronous sort failures to the fallback without announcing readiness', async () => {
    state.update = () => Promise.reject(new Error('sort failed'));
    const view = create();
    await view.controller.ready;
    await frame();
    expect(view.onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'sort failed' }));
    expect(view.onReady).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });

  it('serializes pending updates and ignores completion after disposal', async () => {
    let finish;
    state.update = () =>
      new Promise((resolve) => {
        finish = resolve;
      });
    const view = create();
    await view.controller.ready;
    await frame();
    view.controller.zoom(0.75);
    await frame();
    expect(state.sparks[0].update).toHaveBeenCalledOnce();
    view.controller.dispose();
    finish();
    await settle();
    expect(view.onReady).not.toHaveBeenCalled();
    expect(view.onError).not.toHaveBeenCalled();
    expect(state.sparks[0].dispose).toHaveBeenCalledOnce();
    expect(state.meshes[0].dispose).toHaveBeenCalledOnce();
    expect(frames.size).toBe(0);
  });

  it('focuses by crop, preserves camera pose, stays in source bounds and resets', async () => {
    const view = create(390, 640);
    await view.controller.ready;
    await frame();
    await frame();
    const renderer = state.renderers[0];
    const home = renderer.renders.at(-1);
    expect(renderer.size).toEqual([390, 292.5]);
    expect(view.controller.focus('guitar')).toBe(true);
    await frame();
    const focused = renderer.renders.at(-1);
    expect(focused.position.equals(home.position)).toBe(true);
    expect(focused.quaternion.equals(home.quaternion)).toBe(true);
    const product = new THREE.Vector3(...config.hotspots[0].position).applyMatrix4(
      focused.projection
    );
    expect(product.x).toBeCloseTo(0);
    expect(product.y).toBeCloseTo(0);
    const inverse = focused.projection.clone().invert();
    for (const x of [-1, 1])
      for (const y of [-1, 1]) {
        const ray = new THREE.Vector3(x, y, 0).applyMatrix4(inverse);
        const u = 480 + (850 * ray.x) / -ray.z;
        const v = 360 - (850 * ray.y) / -ray.z;
        expect(u).toBeGreaterThanOrEqual(-1e-9);
        expect(u).toBeLessThanOrEqual(960 + 1e-9);
        expect(v).toBeGreaterThanOrEqual(-1e-9);
        expect(v).toBeLessThanOrEqual(720 + 1e-9);
      }
    view.controller.reset();
    await frame();
    expect(renderer.renders.at(-1).projection.elements).toEqual(home.projection.elements);
  });

  it('caps physical drawing pixels while retaining a 4:3 source frame', async () => {
    const view = create(2200, 1800);
    await view.controller.ready;
    const renderer = state.renderers[0];
    expect(renderer.size[0] / renderer.size[1]).toBeCloseTo(4 / 3);
    expect(renderer.size[0] * renderer.size[1] * renderer.pixelRatio ** 2).toBeLessThanOrEqual(
      3000000.001
    );
  });

  it('preserves modified browser shortcuts without changing the view', async () => {
    const view = create();
    await view.controller.ready;
    await frame();
    await frame();
    const renderer = state.renderers[0];
    const renderCount = renderer.renders.length;
    const canvas = view.mount.querySelector('canvas');
    for (const shortcut of [
      { key: 'ArrowUp', metaKey: true },
      { key: '+', ctrlKey: true },
      { key: '-', ctrlKey: true },
      { key: 'ArrowLeft', altKey: true },
      { key: 'Home', ctrlKey: true },
    ]) {
      const event = new KeyboardEvent('keydown', { ...shortcut, cancelable: true });
      canvas.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    await frame();
    expect(renderer.renders).toHaveLength(renderCount);
    expect(frames.size).toBe(0);
  });

  it('eases cinematic focus and back over 900ms and lets direct zoom interrupt', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const view = create(1200, 600, {
      navigation: { maxCropZoom: 3.2, focusZoom: 2.7, transitionDuration: 900 },
    });
    await view.controller.ready;
    await frame(1000);
    await frame(1000);
    const renderer = state.renderers[0];
    const home = renderer.renders.at(-1);
    const ratio = () =>
      renderer.renders.at(-1).projection.elements[0] / home.projection.elements[0];
    view.controller.focus('guitar');
    await frame(1450);
    expect(ratio()).toBeCloseTo(Math.sqrt(2.7));
    await frame(1900);
    expect(ratio()).toBeCloseTo(2.7);
    now.mockReturnValue(1900);
    view.controller.reset();
    await frame(2350);
    expect(ratio()).toBeCloseTo(Math.sqrt(2.7));
    await frame(2800);
    expect(ratio()).toBeCloseTo(1);
    now.mockReturnValue(2800);
    view.controller.focus('guitar');
    await frame(3250);
    view.controller.zoom(1.1);
    await frame(5000);
    expect(ratio()).toBeCloseTo(Math.sqrt(2.7) / 1.1);
    expect(renderer.renders.at(-1).position.equals(home.position)).toBe(true);
  });

  it('respects reduced motion for cinematic focus and back', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const view = create(1200, 600, { navigation: { maxCropZoom: 3.2, focusZoom: 2.7 } });
    await view.controller.ready;
    await frame();
    await frame();
    const renderer = state.renderers[0];
    const originalScale = renderer.renders.at(-1).projection.elements[0];
    view.controller.focus('guitar');
    await frame(performance.now());
    expect(renderer.renders.at(-1).projection.elements[0] / originalScale).toBeCloseTo(2.7);
    view.controller.reset();
    await frame(performance.now());
    expect(renderer.renders.at(-1).projection.elements[0] / originalScale).toBeCloseTo(1);
  });

  it('uses an authored higher focus target and per-product closeup scale', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const target = [0.5, 0.15, -3];
    const view = create(1200, 600, {
      navigation: { maxCropZoom: 3.2, focusZoom: 2.7 },
      hotspots: [{ ...config.hotspots[0], focusTarget: target, focusZoom: 2.4 }],
    });
    await view.controller.ready;
    await frame();
    await frame();
    const renderer = state.renderers[0];
    const originalScale = renderer.renders.at(-1).projection.elements[0];
    view.controller.focus('guitar');
    await frame();
    const projection = renderer.renders.at(-1).projection;
    const centered = new THREE.Vector3(...target).applyMatrix4(projection);
    expect(centered.x).toBeCloseTo(0);
    expect(centered.y).toBeCloseTo(0);
    expect(projection.elements[0] / originalScale).toBeCloseTo(2.4);
  });

  it.each([
    [1440, 900],
    [390, 844],
    [960, 600],
    [717, 831],
    [320, 740],
  ])('fits complete authored instruments in the %ix%i spotlight', async (width, height) => {
    const view = create(width, height, showroomConfig);
    await view.controller.ready;
    await frame();
    await frame();
    const renderer = state.renderers[0];
    expect(renderer.size).toEqual([width, height]);
    expect(view.mount.querySelector('canvas').style.left).toBe('0px');
    for (const hotspot of showroomConfig.hotspots) {
      expect(view.controller.focus(hotspot.slug)).toBe(true);
      await frame(performance.now() + 1700);
      const rendered = renderer.renders.at(-1);
      const projectedBounds = hotspot.focusBounds.map((point) =>
        new THREE.Vector3(...point)
          .sub(rendered.position)
          .applyQuaternion(rendered.quaternion.clone().invert())
          .applyMatrix4(rendered.projection)
      );
      const ys = projectedBounds.map((point) => 0.5 - point.y / 2);
      const xs = projectedBounds.map((point) => 0.5 + point.x / 2);
      const mobile = width < 700;
      expect(Math.min(...ys) * height).toBeGreaterThanOrEqual((mobile ? 76 : 96) - 1e-5);
      expect(Math.max(...ys)).toBeLessThanOrEqual(mobile ? 0.530001 : 1 - 26 / height + 1e-6);
      expect(Math.min(...xs)).toBeGreaterThan(0.01);
      expect(Math.max(...xs)).toBeLessThanOrEqual(mobile ? 0.95 : 0.460001);
      expect(
        rendered.position.distanceTo(new THREE.Vector3(...showroomConfig.camera.position))
      ).toBeLessThan(1e-8);
    }
    expect(renderer.clear).toHaveBeenCalled();
    expect(renderer.setScissorTest).toHaveBeenLastCalledWith(false);
    expect(view.onViewChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'selection', transitioning: false })
    );
  });

  it('renders hero frames with bounded real camera translation and cancels motion when paused', async () => {
    const view = create(1440, 900, showroomConfig);
    await view.controller.ready;
    await frame();
    await frame();
    expect(view.controller.showHeroFrame(1)).toBe(true);
    await frame(performance.now() + 2400);
    const rendered = state.renderers[0].renders.at(-1);
    const displacement = rendered.position.distanceTo(
      new THREE.Vector3(...showroomConfig.camera.position)
    );
    expect(displacement).toBeGreaterThan(0.005);
    expect(displacement).toBeLessThanOrEqual(0.03);
    expect(view.onViewChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'hero', frameIndex: 1, transitioning: false })
    );
    view.controller.showHeroFrame(2);
    view.controller.pause();
    const count = state.renderers[0].renders.length;
    await frame(performance.now() + 3000);
    expect(state.renderers[0].renders).toHaveLength(count);
    expect(view.onViewChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ transitioning: false })
    );
  });

  it('applies live reduced-motion changes to active and future transitions', async () => {
    let change;
    const media = {
      matches: false,
      addEventListener: vi.fn((type, callback) => {
        change = callback;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', () => media);
    const view = create(1200, 600, { navigation: { maxCropZoom: 3.2, focusZoom: 2.7 } });
    await view.controller.ready;
    await frame();
    await frame();
    const renderer = state.renderers[0];
    const initialScale = renderer.renders.at(-1).projection.elements[0];
    view.controller.focus('guitar');
    media.matches = true;
    change();
    await frame(performance.now());
    expect(renderer.renders.at(-1).projection.elements[0] / initialScale).toBeCloseTo(2.7);
    view.controller.reset();
    await frame(performance.now());
    expect(renderer.renders.at(-1).projection.elements[0] / initialScale).toBeCloseTo(1);
    view.controller.dispose();
    expect(media.removeEventListener).toHaveBeenCalledWith('change', change);
  });

  it('freezes an active tour immediately without disabling subsequent interaction', async () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const view = create(1440, 900, showroomConfig);
    await view.controller.ready;
    await frame(1000);
    await frame(1000);
    view.controller.showHeroFrame(1);
    await frame(1550);
    const renderer = state.renderers[0];
    const frozen = renderer.renders.at(-1);
    view.controller.stopMotion();
    expect(view.onViewChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ mode: 'hero', frameIndex: 1, transitioning: false })
    );
    await frame(5000);
    const stopped = renderer.renders.at(-1);
    expect(stopped.position.equals(frozen.position)).toBe(true);
    expect(stopped.quaternion.equals(frozen.quaternion)).toBe(true);
    expect(stopped.projection.elements).toEqual(frozen.projection.elements);
    view.controller.zoom(0.9);
    await frame(5001);
    expect(renderer.renders.at(-1).projection.elements).not.toEqual(frozen.projection.elements);
    expect(renderer.renders.at(-1).position.equals(frozen.position)).toBe(true);
    expect(view.controller.showHeroFrame(2)).toBe(true);
    await frame(5002);
    expect(renderer.renders.at(-1).position.distanceTo(frozen.position)).toBeGreaterThan(0.001);
  });

  const optionalLightingConfig = {
    ...showroomConfig,
    spotlight: { ...showroomConfig.spotlight, neighborBrightness: 0.19, softEdge: 2.65 },
  };

  it('animates real edit volumes without changing opacity and restores overview after interruption', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const view = create(1440, 900, optionalLightingConfig);
    await view.controller.ready;
    await frame(1000);
    await frame(1000);
    const mesh = state.meshes[0];
    const edit = mesh.edits[0];
    expect(mesh.options.editable).toBe(true);
    expect(edit.invert).toBe(true);
    expect(edit.rgbaBlendMode).toBe('multiply');
    expect(edit.sdfs).toHaveLength(1);
    expect(edit.sdfs[0].type).toBe('ellipsoid');
    expect(edit.sdfs.every((sdf) => sdf.color.r === 1 && sdf.opacity === 1)).toBe(true);
    view.controller.focus('flame-stratocaster-electric-guitar');
    await frame(2400);
    expect(edit.sdfs[0].color.r).toBeCloseTo(optionalLightingConfig.spotlight.neighborBrightness, 12);
    expect(edit.sdfs[0].opacity).toBe(1);
    const renderer = state.renderers[0];
    const selected = renderer.renders.at(-1).projection.elements.slice();
    now.mockReturnValue(2400);
    view.controller.reset();
    await frame(2400);
    renderer.renders
      .at(-1)
      .projection.elements.forEach((value, i) => expect(value).toBeCloseTo(selected[i], 12));
    await frame(3000);
    expect(edit.sdfs[0].color.r).toBeGreaterThan(optionalLightingConfig.spotlight.neighborBrightness);
    expect(edit.sdfs[0].color.r).toBeLessThan(1);
    view.controller.zoom(0.9);
    await frame(5000);
    expect(edit.sdfs.every((sdf) => sdf.color.r === 1)).toBe(true);
    now.mockReturnValue(5000);
    view.controller.focus('steel-string-acoustic-guitar');
    await frame(6400);
    now.mockReturnValue(6400);
    const beforeNext = renderer.renders.at(-1).projection.elements.slice();
    view.controller.focus('five-string-bass-guitar');
    await frame(6400);
    renderer.renders
      .at(-1)
      .projection.elements.forEach((value, i) => expect(value).toBeCloseTo(beforeNext[i], 12));
    view.controller.focus('classic-nylon-string-guitar');
    await frame(7800);
    const expected = showroomConfig.hotspots.find(
      (item) => item.slug === 'classic-nylon-string-guitar'
    );
    edit.sdfs.forEach((sdf, i) =>
      expect(
        sdf.position.distanceTo(new THREE.Vector3(...expected.lightRegions[i].center))
      ).toBeLessThan(1e-9)
    );
    await frame(7801);
    expect(frames.size).toBe(0);
    now.mockReturnValue(8000);
    view.controller.reset();
    await frame(8400);
    expect(edit.sdfs[0].color.r).toBeLessThan(1);
    view.controller.pause();
    expect(edit.sdfs.every((sdf) => sdf.color.r === 1)).toBe(true);
    view.controller.resume();
    await frame(8500);
    expect(edit.sdfs.every((sdf) => sdf.color.r === 1 && sdf.opacity === 1)).toBe(true);
    const disposeTexture = vi.fn();
    mesh.rgbaDisplaceEdits = { sdfTexture: { dispose: disposeTexture } };
    view.controller.dispose();
    view.controller.dispose();
    expect(disposeTexture).toHaveBeenCalledOnce();
  });

  it('settles spatial lighting immediately when reduced motion becomes enabled', async () => {
    let change;
    const media = {
      matches: false,
      addEventListener: vi.fn((type, listener) => {
        change = listener;
      }),
      removeEventListener: vi.fn(),
    };
    vi.stubGlobal('matchMedia', () => media);
    const view = create(1440, 900, optionalLightingConfig);
    await view.controller.ready;
    await frame();
    await frame();
    view.controller.focus('five-string-bass-guitar');
    media.matches = true;
    change();
    const sdfs = state.meshes[0].edits[0].sdfs;
    expect(sdfs[0].color.r).toBeCloseTo(optionalLightingConfig.spotlight.neighborBrightness, 12);
    expect(sdfs[0].opacity).toBe(1);
    view.controller.reset();
    expect(sdfs.every((sdf) => sdf.color.r === 1)).toBe(true);
  });

  it('keeps each instrument body and headstock in its own oval while softly dimming the blue neighbor', async () => {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    const view = create(1440, 900, optionalLightingConfig);
    await view.controller.ready;
    await frame();
    await frame();
    // Independent source-photo headstock measurements, not the light-region
    // data itself. A region accidentally assigned to another product must fail.
    const headstocks = {
      'classic-nylon-string-guitar': [-1.51327647, 2.0511934, 0.61493658],
      'flame-stratocaster-electric-guitar': [-1.60018973, 2.16526923, 1.48573472],
      'five-string-bass-guitar': [-1.61629813, 2.21063955, 1.0310475],
      'steel-string-acoustic-guitar': [-1.52444908, 1.99488325, -0.41244372],
    };
    const edit = state.meshes[0].edits[0];
    const gainAt = (point) => {
      const sdf = edit.sdfs[0];
      const local = new THREE.Vector3(...point)
        .sub(sdf.position)
        .applyQuaternion(sdf.quaternion.clone().invert());
      // Spark 2.4's evaluateSdfArray ellipsoid formula and inverted multiply
      // feather; this checks authored geometry against the shipped shader.
      const k0 = local.clone().divide(sdf.scale).length();
      const k1 = local.length() / sdf.scale.lengthSq();
      const distance = (k0 * (k0 - 1)) / k1;
      const amount = THREE.MathUtils.clamp(distance / edit.softEdge + 0.5, 0, 1);
      return 1 - (1 - sdf.color.r) * amount;
    };
    for (const hotspot of showroomConfig.hotspots) {
      view.controller.focus(hotspot.slug);
      expect(gainAt(hotspot.position)).toBeGreaterThan(0.8);
      expect(gainAt(headstocks[hotspot.slug])).toBeGreaterThan(0.69);
    }
    view.controller.focus('flame-stratocaster-electric-guitar');
    const selectedRedBodyEdge = [-1.586428, 1.390483, 1.712101];
    const adjacentBlueBody = [-1.580693, 1.546426, 1.782057];
    // These nearby samples straddle the feather. Retain separation while
    // limiting the brightness jump that previously made a hard shadow.
    const contrast = gainAt(selectedRedBodyEdge) - gainAt(adjacentBlueBody);
    expect(contrast).toBeGreaterThan(0.1);
    expect(contrast).toBeLessThan(0.2);
    expect(gainAt(adjacentBlueBody)).toBeGreaterThan(0.5);
  });

  it('stops demand rendering after a neutral hero tour is paused', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(1000);
    const view = create(1440, 900, showroomConfig);
    await view.controller.ready;
    await frame(1000);
    await frame(1000);
    view.controller.showHeroFrame(2);
    await frame(1300);
    now.mockReturnValue(1300);
    view.controller.stopMotion();
    await frame(1301);
    await frame(1302);
    expect(frames.size).toBe(0);
    view.controller.focus('five-string-bass-guitar');
    await frame(3000);
    expect(state.meshes[0].options.editable).toBe(false);
    expect(state.meshes[0].edits ?? []).toHaveLength(0);
  });
  it('allows page scrolling over the showroom without changing camera zoom', async () => {
    const view = create(1440, 900, showroomConfig);
    await view.controller.ready;
    await frame();
    await frame();
    const canvas = view.mount.querySelector('canvas');
    const projection = state.renderers[0].renders.at(-1).projection.clone();
    const wheel = new WheelEvent('wheel', { deltaY: 240, bubbles: true, cancelable: true });
    canvas.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(canvas.style.touchAction).toBe('pan-y');
    await frame();
    expect(state.renderers[0].renders.at(-1).projection.elements).toEqual(projection.elements);
  });
});
