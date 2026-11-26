import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SparkRenderer, SplatMesh, SplatEdit, SplatEditSdf } from '@sparkjsdev/spark';

// Spark 2.4.0 / Three r182. Rendering and demand-loop APIs are documented at:
// https://sparkjs.dev/docs/splat-mesh/
// https://sparkjs.dev/docs/on-demand-rendering/
// Hotspots are explicit world-space coordinates authored for this splat asset.
// No stock geometry or product locations are inferred from the catalog.
const vectorArray = (value) =>
  Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const quaternionArray = (value) =>
  Array.isArray(value) && value.length === 4 && value.every(Number.isFinite);
const positive = (value, fallback) => (Number.isFinite(value) && value > 0 ? value : fallback);
const easeMotion = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const angleRange = (value) => {
  if (Number.isFinite(value) && value >= 0) return { min: -value, max: value };
  if (
    value &&
    Number.isFinite(value.min) &&
    Number.isFinite(value.max) &&
    value.min <= 0 &&
    value.max >= 0
  )
    return { min: value.min, max: value.max };
  return null;
};

export function createGaussianShowroom({
  mount,
  config,
  displays = [],
  onSelect = () => {},
  onReady = () => {},
  onError = () => {},
  onProgress = () => {},
  onPinsChange,
  onViewChange = () => {},
}) {
  if (!mount || !config?.url || !vectorArray(config.camera?.position)) {
    throw new Error('A splat URL and an authored camera position are required.');
  }
  if (!vectorArray(config.camera.target) && !quaternionArray(config.camera.quaternion)) {
    throw new Error('The splat camera requires an authored target or quaternion.');
  }
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(config.background || '#181a19');
  const suppliedIntrinsics = config.camera.intrinsics;
  const intrinsics =
    suppliedIntrinsics &&
    ['width', 'height', 'fx', 'fy'].every(
      (key) => Number.isFinite(suppliedIntrinsics[key]) && suppliedIntrinsics[key] > 0
    )
      ? {
          ...suppliedIntrinsics,
          cx: Number.isFinite(suppliedIntrinsics.cx)
            ? suppliedIntrinsics.cx
            : suppliedIntrinsics.width / 2,
          cy: Number.isFinite(suppliedIntrinsics.cy)
            ? suppliedIntrinsics.cy
            : suppliedIntrinsics.height / 2,
        }
      : null;
  const sourceAspect = positive(
    config.camera.sourceAspect,
    intrinsics ? intrinsics.width / intrinsics.height : 0
  );
  const sourceFov = intrinsics
    ? THREE.MathUtils.radToDeg(2 * Math.atan(intrinsics.height / (2 * intrinsics.fy)))
    : THREE.MathUtils.clamp(config.camera.fov || 50, 15, 100);
  const camera = new THREE.PerspectiveCamera(
    sourceFov,
    1,
    positive(config.camera.near, 0.01),
    positive(config.camera.far, 1000)
  );
  camera.position.fromArray(config.camera.position);
  if (vectorArray(config.camera.up)) camera.up.fromArray(config.camera.up).normalize();
  const initialPosition = camera.position.clone();
  const initialTarget = vectorArray(config.camera.target)
    ? new THREE.Vector3().fromArray(config.camera.target)
    : initialPosition
        .clone()
        .add(
          new THREE.Vector3(0, 0, -1)
            .applyQuaternion(new THREE.Quaternion().fromArray(config.camera.quaternion).normalize())
            .multiplyScalar(positive(config.camera.targetDistance, 1))
        );
  if (initialPosition.distanceToSquared(initialTarget) < 0.000001) {
    throw new Error('The splat camera position and target must differ.');
  }
  if (!vectorArray(config.camera.target) && quaternionArray(config.camera.quaternion)) {
    camera.quaternion.fromArray(config.camera.quaternion).normalize();
    // OrbitControls uses camera.up when it reconstructs orientation. Preserve
    // the source camera's roll as well as its forward direction on first frame.
    camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  } else camera.lookAt(initialTarget);
  const initialFov = camera.fov;
  const initialQuaternion = camera.quaternion.clone();
  const homeDistance = initialPosition.distanceTo(initialTarget);
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Interactive guitar wall. Select an instrument to explore.');
  canvas.style.touchAction = 'none';
  canvas.style.cursor = 'grab';
  canvas.style.position = 'absolute';
  mount.appendChild(canvas);

  let disposed = false;
  let failed = false;
  let paused = false;
  let inViewport = true;
  let frame = 0;
  let width = 1;
  let height = 1;
  let canvasLeft = 0;
  let canvasTop = 0;
  let mesh = null;
  let meshDisposed = false;
  let loaded = false;
  let announcedReady = false;
  let sortedFrameReady = false;
  let sparkUpdateNeeded = false;
  let sparkUpdatePending = false;
  let tween = null;
  let cropTween = null;
  let lightTween = null;
  let viewZoom = 1;
  const cropCenter = new THREE.Vector2(0.5, 0.5);
  const coverViewport = config.viewportFit === 'cover';
  let viewIntent = { mode: 'overview', slug: null, frameIndex: 0 };
  let viewTransitioning = false;
  let frameMinimumZoom = 1;
  const allowSpotlightOverscan = config.spotlight?.allowOverscan === true;
  const cropZoom = config.navigation?.zoomMode === 'crop';
  const maxCropZoom = Math.max(1, positive(config.navigation?.maxCropZoom, 2));
  const focusZoom = positive(config.navigation?.focusZoom, 1.5);
  const motionDuration = THREE.MathUtils.clamp(
    positive(config.navigation?.transitionDuration, 900),
    150,
    1600
  );
  const allowLook = config.navigation?.allowLook !== false;
  const relativeOrbitLimits = config.navigation?.relativeOrbitLimits;
  const azimuthRange = angleRange(relativeOrbitLimits?.azimuth);
  const polarRange = angleRange(relativeOrbitLimits?.polar);
  const boundedPivot = Boolean(azimuthRange || polarRange);
  let navigationMode = allowLook && config.navigation?.mode === 'look' ? 'look' : 'orbit';
  const abort = new AbortController();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = motionPreference.matches;
  const pointers = new Map();
  const projected = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(initialTarget);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enablePan = Boolean(config.navigation?.pan);
  controls.enableZoom = !cropZoom;
  controls.rotateSpeed = 0.45;
  controls.zoomSpeed = 0.65;
  controls.minDistance = positive(config.navigation?.minDistance, homeDistance * 0.25);
  controls.maxDistance = positive(config.navigation?.maxDistance, homeDistance * 2.5);
  // Measure source-relative angles before applying limits. Absolute ±angles
  // would silently rotate an arbitrary imported source camera on first load.
  controls.update();
  const sourceAzimuth = controls.getAzimuthalAngle();
  const sourcePolar = controls.getPolarAngle();
  controls.minPolarAngle = Number.isFinite(config.navigation?.minPolarAngle)
    ? config.navigation.minPolarAngle
    : 0.08;
  controls.maxPolarAngle = Number.isFinite(config.navigation?.maxPolarAngle)
    ? config.navigation.maxPolarAngle
    : Math.PI - 0.08;
  controls.minAzimuthAngle = Number.isFinite(config.navigation?.minAzimuthAngle)
    ? config.navigation.minAzimuthAngle
    : -Infinity;
  controls.maxAzimuthAngle = Number.isFinite(config.navigation?.maxAzimuthAngle)
    ? config.navigation.maxAzimuthAngle
    : Infinity;
  if (azimuthRange) {
    controls.minAzimuthAngle = sourceAzimuth + azimuthRange.min;
    controls.maxAzimuthAngle = sourceAzimuth + azimuthRange.max;
  }
  if (polarRange) {
    controls.minPolarAngle = Math.max(0.0001, sourcePolar + polarRange.min);
    controls.maxPolarAngle = Math.min(Math.PI - 0.0001, sourcePolar + polarRange.max);
  }
  controls.enabled = navigationMode === 'orbit';
  controls.update();
  const allowedSlugs = new Set(displays.map((display) => display.slug));
  const hotspots = (config.hotspots || [])
    .filter(
      (spot) =>
        typeof spot.slug === 'string' &&
        vectorArray(spot.position) &&
        (!allowedSlugs.size || allowedSlugs.has(spot.slug))
    )
    .map((spot) => ({
      ...spot,
      center: new THREE.Vector3().fromArray(spot.position),
      radius: positive(spot.radius, homeDistance * 0.025),
    }));
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hitPosition = new THREE.Vector3();
  const hitSphere = new THREE.Sphere();
  const neighborBrightness = Number.isFinite(config.spotlight?.neighborBrightness)
    ? THREE.MathUtils.clamp(config.spotlight.neighborBrightness, 0.1, 1)
    : 1;
  const lightSdfs =
    neighborBrightness < 1
      ? [new SplatEditSdf({ type: 'ellipsoid', color: new THREE.Color(1, 1, 1), opacity: 1 })]
      : [];
  const lightSdf = lightSdfs[0] || null;
  const lightEdit = lightSdf
    ? new SplatEdit({
        name: 'Selected instrument lighting',
        rgbaBlendMode: 'multiply',
        invert: true,
        softEdge: positive(config.spotlight?.softEdge, 0.12),
        sdfs: lightSdfs,
      })
    : null;
  lightSdfs.forEach((sdf) => {
    sdf.quaternion.copy(initialQuaternion);
    sdf.scale.set(0.3, 0.7, 0.45);
  });

  function requestRender() {
    if (!disposed && !failed && !paused && inViewport && !document.hidden && !frame)
      frame = requestAnimationFrame(render);
  }
  function stopMotion() {
    if (disposed) return;
    tween = null;
    cropTween = null;
    // Lighting finishes its independent fade when manual input stops camera
    // travel, so Back cannot leave the overview permanently half-dimmed.
    if (viewTransitioning) {
      viewTransitioning = false;
      onViewChange({ ...viewIntent, transitioning: false });
    }
    requestRender();
  }
  function fail(error) {
    if (disposed || failed) return;
    failed = true;
    loaded = false;
    abort.abort();
    cancelAnimationFrame(frame);
    frame = 0;
    onError(
      error instanceof Error ? error : new Error('The Gaussian showroom could not be displayed.')
    );
  }
  let spark;
  try {
    spark = new SparkRenderer({
      renderer,
      onDirty: requestRender,
      autoUpdate: false,
      enableLod: Boolean(config.lod),
      minSortIntervalMs: 0,
    });
  } catch (error) {
    disposed = true;
    controls.dispose();
    renderer.dispose();
    canvas.remove();
    throw error;
  }
  scene.add(spark);

  function renderScene() {
    if (config.spotlight?.clipSource && intrinsics) {
      // The light falloff overlay can cover unused framing space, but never
      // render invented geometry beyond the authored source-image footprint.
      const fit = projectionFit() * viewZoom;
      const left = Math.max(0, width / 2 - cropCenter.x * intrinsics.width * fit);
      const top = Math.max(0, height / 2 - cropCenter.y * intrinsics.height * fit);
      const right = Math.min(width, width / 2 + (1 - cropCenter.x) * intrinsics.width * fit);
      const bottom = Math.min(height, height / 2 + (1 - cropCenter.y) * intrinsics.height * fit);
      renderer.setScissorTest(false);
      renderer.setClearColor(scene.background, 1);
      renderer.clear();
      renderer.setScissor(
        left,
        height - bottom,
        Math.max(0, right - left),
        Math.max(0, bottom - top)
      );
      renderer.setScissorTest(true);
      try {
        renderer.render(scene, camera);
      } finally {
        renderer.setScissorTest(false);
      }
    } else renderer.render(scene, camera);
  }

  function invalidateView() {
    sparkUpdateNeeded = true;
    requestRender();
  }
  function updateSplats() {
    if (!loaded || disposed || failed || sparkUpdatePending || !sparkUpdateNeeded) return;
    sparkUpdatePending = true;
    sparkUpdateNeeded = false;
    // Own the async sort lifecycle: Spark's automatic update otherwise starts
    // an unawaited Promise inside Three's synchronous render callback.
    spark
      .update({ scene, camera })
      .then(() => {
        if (disposed || failed) return;
        sortedFrameReady = true;
        requestRender();
      })
      .catch(fail)
      .finally(() => {
        sparkUpdatePending = false;
        if (sparkUpdateNeeded) requestRender();
      });
  }

  function updatePins() {
    const pins = hotspots.map((spot) => {
      projected.copy(spot.center).project(camera);
      const canvasX = (projected.x * 0.5 + 0.5) * width;
      const canvasY = (-projected.y * 0.5 + 0.5) * height;
      const x = mount.offsetLeft + canvasLeft + canvasX;
      const y = mount.offsetTop + canvasTop + canvasY;
      return {
        slug: spot.slug,
        x,
        y,
        visible:
          loaded &&
          projected.z >= -1 &&
          projected.z <= 1 &&
          canvasX >= 12 &&
          canvasX <= width - 12 &&
          canvasY >= 0 &&
          canvasY <= height - 20,
      };
    });
    if (onPinsChange) onPinsChange(pins);
    else {
      const pinMap = new Map(pins.map((pin) => [pin.slug, pin]));
      for (const element of mount.parentElement?.querySelectorAll('[data-showroom-pin]') || []) {
        const pin = pinMap.get(element.dataset.showroomPin);
        element.style.visibility = pin?.visible ? 'visible' : 'hidden';
        if (pin) element.style.transform = `translate(${pin.x}px, ${pin.y}px) translate(-50%, 0)`;
      }
    }
  }
  function render(time) {
    frame = 0;
    if (disposed || failed || paused || !inViewport || document.hidden) return;
    if (tween) {
      const t = Math.min(1, (time - tween.start) / tween.duration);
      const eased = easeMotion(t);
      camera.position.lerpVectors(tween.from, tween.to, eased);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      camera.lookAt(controls.target);
      sparkUpdateNeeded = true;
      if (t === 1) tween = null;
      else requestRender();
    }
    if (cropTween) {
      const t = Math.min(1, (time - cropTween.start) / cropTween.duration);
      const eased = easeMotion(t);
      viewZoom = Math.exp(
        THREE.MathUtils.lerp(Math.log(cropTween.fromZoom), Math.log(cropTween.toZoom), eased)
      );
      cropCenter.lerpVectors(cropTween.fromCenter, cropTween.toCenter, eased);
      // Both endpoints are already validated. Re-clamping to the new mode at
      // t=0 would snap an overscanned selection before Back can animate out.
      clampCrop(t === 1);
      updateProjection();
      sparkUpdateNeeded = true;
      if (t === 1) cropTween = null;
      else requestRender();
    }
    if (lightTween && lightSdf) {
      const t = Math.min(1, (time - lightTween.start) / lightTween.duration);
      const eased = easeMotion(t);
      lightSdfs.forEach((sdf, index) => {
        const volume = lightTween.volumes[index];
        sdf.position.lerpVectors(volume.fromPosition, volume.toPosition, eased);
        sdf.scale.lerpVectors(volume.fromScale, volume.toScale, eased);
        sdf.color.setScalar(
          THREE.MathUtils.lerp(lightTween.fromBrightness, lightTween.toBrightness, eased)
        );
      });
      sparkUpdateNeeded = true;
      if (t === 1) lightTween = null;
      else requestRender();
    }
    if (navigationMode === 'orbit') controls.update();
    try {
      renderScene();
      updatePins();
      if (viewTransitioning && !tween && !cropTween && !lightTween) {
        viewTransitioning = false;
        onViewChange({ ...viewIntent, transitioning: false });
      }
      if (loaded && sortedFrameReady && !announcedReady) {
        announcedReady = true;
        onProgress({ phase: 'ready', progress: 1, numSplats: mesh.numSplats });
        onReady({ renderer: 'gaussian-splats', numSplats: mesh.numSplats });
      }
      updateSplats();
    } catch (error) {
      fail(error);
    }
  }
  function updateProjection() {
    camera.aspect = width / height;
    if (intrinsics) {
      // The canvas itself fits the source aspect. A wider frustum would expose
      // untrained content beyond the capture. Crop-center shifts are bounded
      // within that source frame, preserving the calibrated camera origin.
      const fit = projectionFit();
      const fx = intrinsics.fx * fit * viewZoom;
      const fy = intrinsics.fy * fit * viewZoom;
      const cx = (intrinsics.cx - cropCenter.x * intrinsics.width) * fit * viewZoom + width / 2;
      const cy = (intrinsics.cy - cropCenter.y * intrinsics.height) * fit * viewZoom + height / 2;
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(height / (2 * fy)));
      camera.zoom = 1;
      camera.projectionMatrix.makePerspective(
        (-cx * camera.near) / fx,
        ((width - cx) * camera.near) / fx,
        (cy * camera.near) / fy,
        (-(height - cy) * camera.near) / fy,
        camera.near,
        camera.far,
        camera.coordinateSystem
      );
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    } else {
      camera.fov = sourceAspect
        ? THREE.MathUtils.radToDeg(
            2 *
              Math.atan(
                Math.tan(THREE.MathUtils.degToRad(initialFov) / 2) *
                  Math.max(1, sourceAspect / camera.aspect)
              )
          )
        : initialFov;
      camera.zoom = viewZoom;
      camera.updateProjectionMatrix();
    }
  }
  function projectionFit() {
    if (!intrinsics) return 1;
    return (coverViewport ? Math.max : Math.min)(
      width / intrinsics.width,
      height / intrinsics.height
    );
  }
  function resize() {
    if (disposed) return;
    const mountWidth = Math.max(1, mount.clientWidth);
    const mountHeight = Math.max(1, mount.clientHeight);
    width =
      !coverViewport && sourceAspect
        ? Math.min(mountWidth, mountHeight * sourceAspect)
        : mountWidth;
    height = !coverViewport && sourceAspect ? width / sourceAspect : mountHeight;
    canvasLeft = (mountWidth - width) / 2;
    canvasTop = (mountHeight - height) / 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.left = `${canvasLeft}px`;
    canvas.style.top = `${canvasTop}px`;
    renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        positive(config.maxPixelRatio, 2),
        Math.sqrt(positive(config.maxRenderPixels, 3000000) / (width * height))
      )
    );
    clampCrop();
    updateProjection();
    renderer.setSize(width, height, false);
    if (
      loaded &&
      (viewIntent.mode === 'selection' || viewIntent.mode === 'hero' || config.heroFrames?.length)
    ) {
      frameView(viewIntent, announcedReady, announcedReady ? 300 : undefined);
    }
    invalidateView();
  }
  function cropHalfSize(zoom = viewZoom) {
    const fit = projectionFit();
    return intrinsics
      ? new THREE.Vector2(
          width / (2 * intrinsics.width * fit * zoom),
          height / (2 * intrinsics.height * fit * zoom)
        )
      : new THREE.Vector2(0.5 / zoom, 0.5 / zoom);
  }
  function clampCenter(center, zoom) {
    if (allowSpotlightOverscan && (viewIntent.mode === 'selection' || zoom < 1))
      return center.clampScalar(0, 1);
    const half = cropHalfSize(zoom);
    center.x = half.x >= 0.5 ? 0.5 : THREE.MathUtils.clamp(center.x, half.x, 1 - half.x);
    center.y = half.y >= 0.5 ? 0.5 : THREE.MathUtils.clamp(center.y, half.y, 1 - half.y);
    return center;
  }
  function clampCrop(clampPosition = true) {
    if (clampPosition) clampCenter(cropCenter, viewZoom);
    controls.enableRotate = !(cropZoom && (viewZoom > 1.001 || viewIntent.mode === 'selection'));
  }
  function panCrop(dx, dy) {
    if (!cropZoom || (viewZoom <= 1.001 && viewIntent.mode !== 'selection')) return false;
    stopMotion();
    const fit = projectionFit();
    cropCenter.x -= dx / ((intrinsics?.width * fit || width) * viewZoom);
    cropCenter.y -= dy / ((intrinsics?.height * fit || height) * viewZoom);
    clampCrop();
    updateProjection();
    invalidateView();
    return true;
  }
  function transitionCrop(nextZoom, nextCenter, duration = motionDuration, animate = true) {
    if (reducedMotion || !animate) {
      cropTween = null;
      viewZoom = nextZoom;
      cropCenter.copy(nextCenter);
      clampCrop();
      updateProjection();
      invalidateView();
    } else {
      cropTween = {
        fromZoom: viewZoom,
        toZoom: nextZoom,
        fromCenter: cropCenter.clone(),
        toCenter: nextCenter.clone(),
        start: performance.now(),
        duration,
      };
      requestRender();
    }
  }
  function transitionLighting(hotspot, duration, animate) {
    if (!lightSdf) return;
    const nextPosition = lightSdf.position.clone();
    const nextScale = lightSdf.scale.clone();
    const bounds = hotspot?.focusBounds?.filter(vectorArray) || [];
    const nextBrightness = bounds.length >= 2 ? neighborBrightness : 1;
    if (nextBrightness === 1 && lightSdf.color.r === 1) {
      // A neutral edit has no visible work to do. In particular, pausing an
      // overview tour must not leave a 1-to-1 lighting animation running.
      lightTween = null;
      return;
    }
    if (bounds.length >= 2) {
      const inverse = initialQuaternion.clone().invert();
      const box = new THREE.Box3().setFromPoints(
        bounds.map((point) => new THREE.Vector3().fromArray(point).applyQuaternion(inverse))
      );
      box.getCenter(nextPosition).applyQuaternion(initialQuaternion);
      box.getSize(nextScale).multiplyScalar(0.5).addScalar(0.08);
      nextScale.z = Math.max(0.45, nextScale.z);
      if (lightSdf.color.r > 0.999) {
        // At neutral brightness the volume is invisible, so place it before
        // dimming begins rather than sweeping a dark band over the guitar.
        lightSdf.position.copy(nextPosition);
        lightSdf.scale.copy(nextScale);
      }
    }
    const volumes = lightSdfs.map((sdf, index) => {
      const region = hotspot?.lightRegions?.[index];
      const targetPosition = vectorArray(region?.center)
        ? new THREE.Vector3().fromArray(region.center)
        : bounds.length
          ? nextPosition.clone()
          : sdf.position.clone();
      const targetScale = vectorArray(region?.halfSize)
        ? new THREE.Vector3().fromArray(region.halfSize)
        : bounds.length
          ? nextScale.clone()
          : sdf.scale.clone();
      if (sdf.color.r > 0.999 && bounds.length >= 2) {
        sdf.position.copy(targetPosition);
        sdf.scale.copy(targetScale);
      }
      return {
        fromPosition: sdf.position.clone(),
        toPosition: targetPosition,
        fromScale: sdf.scale.clone(),
        toScale: targetScale,
      };
    });
    if (reducedMotion || !animate) {
      lightTween = null;
      lightSdfs.forEach((sdf, index) => {
        sdf.position.copy(volumes[index].toPosition);
        sdf.scale.copy(volumes[index].toScale);
        sdf.color.setScalar(nextBrightness);
      });
      invalidateView();
    } else {
      lightTween = {
        volumes,
        fromBrightness: lightSdf.color.r,
        toBrightness: nextBrightness,
        start: performance.now(),
        duration,
      };
      requestRender();
    }
  }
  function moveTo(
    position,
    target,
    { authored = false, duration = motionDuration, animate = true } = {}
  ) {
    if (disposed || failed) return;
    if (boundedPivot && !authored) target = initialTarget.clone();
    if (reducedMotion || !animate) {
      camera.position.copy(position);
      controls.target.copy(target);
      camera.lookAt(target);
      tween = null;
    } else
      tween = {
        from: camera.position.clone(),
        to: position,
        fromTarget: controls.target.clone(),
        toTarget: target,
        start: performance.now(),
        duration,
      };
    requestRender();
  }
  function reset() {
    if (config.heroFrames?.length && intrinsics && loaded)
      return frameView({ mode: 'overview', slug: null, frameIndex: 0 });
    frameMinimumZoom = 1;
    viewIntent = { mode: 'overview', slug: null, frameIndex: 0 };
    viewTransitioning = !reducedMotion;
    onViewChange({ ...viewIntent, transitioning: viewTransitioning });
    if (cropZoom) transitionCrop(1, new THREE.Vector2(0.5, 0.5));
    else {
      viewZoom = 1;
      cropCenter.set(0.5, 0.5);
      clampCrop();
      updateProjection();
      invalidateView();
    }
    moveTo(initialPosition.clone(), initialTarget.clone());
    transitionLighting(null, motionDuration, true);
  }
  function zoom(factor) {
    if (!Number.isFinite(factor) || factor <= 0 || disposed) return;
    stopMotion();
    if (cropZoom) {
      // Magnify only the existing view. The camera center remains within the
      // reconstructed capture envelope, including for wheel and pinch zoom.
      cropTween = null;
      viewZoom = THREE.MathUtils.clamp(
        viewZoom / factor,
        Math.min(1, frameMinimumZoom),
        maxCropZoom
      );
      clampCrop();
      updateProjection();
      invalidateView();
    } else if (navigationMode === 'look') {
      const baseTan = Math.tan(THREE.MathUtils.degToRad(initialFov) / 2);
      const currentSourceFov = THREE.MathUtils.radToDeg(2 * Math.atan(baseTan / viewZoom));
      const nextSourceFov = THREE.MathUtils.clamp(currentSourceFov * factor, 20, 90);
      viewZoom = baseTan / Math.tan(THREE.MathUtils.degToRad(nextSourceFov) / 2);
      updateProjection();
      requestRender();
    } else {
      const offset = camera.position.clone().sub(controls.target);
      const distance = THREE.MathUtils.clamp(
        offset.length() * factor,
        controls.minDistance,
        controls.maxDistance
      );
      moveTo(controls.target.clone().add(offset.setLength(distance)), controls.target.clone());
    }
  }
  function sourcePoint(point, position) {
    const local = point.clone().sub(position).applyQuaternion(initialQuaternion.clone().invert());
    if (local.z >= 0) return null;
    return new THREE.Vector2(
      (intrinsics.cx + (intrinsics.fx * local.x) / -local.z) / intrinsics.width,
      (intrinsics.cy - (intrinsics.fy * local.y) / -local.z) / intrinsics.height
    );
  }
  function frameView(intent, animate = true, durationOverride) {
    if (!loaded || !intrinsics || disposed || failed) return false;
    const mobile = width <= positive(config.spotlight?.breakpoint, 700);
    const heroFrame =
      intent.mode === 'selection' ? null : config.heroFrames?.[intent.frameIndex || 0];
    const slug = intent.mode === 'selection' ? intent.slug : heroFrame?.slug;
    const hotspot = hotspots.find((spot) => spot.slug === slug);
    if (slug && !hotspot) return false;
    const offset = new THREE.Vector3();
    if (vectorArray(heroFrame?.cameraOffset)) {
      offset.fromArray(heroFrame.cameraOffset);
      // Only tiny authored translations: this is a wall view, not a walkthrough.
      if (offset.length() > 0.03) offset.setLength(0.03);
      offset.applyQuaternion(initialQuaternion);
    }
    const nextPosition = initialPosition.clone().add(offset);
    const nextTarget = initialTarget.clone().add(offset);
    const duration =
      durationOverride ??
      (intent.mode === 'selection'
        ? motionDuration
        : THREE.MathUtils.clamp(positive(heroFrame?.duration, 1800), 400, 4000));
    let nextZoom = mobile ? positive(heroFrame?.mobileZoom, 1) : positive(heroFrame?.zoom, 1);
    let nextCenter = new THREE.Vector2(0.5, 0.5);
    viewIntent = { ...intent, slug: slug || null };
    if (hotspot) {
      const bounds = (hotspot.focusBounds || [])
        .filter(vectorArray)
        .map((point) => sourcePoint(new THREE.Vector3().fromArray(point), nextPosition))
        .filter(Boolean);
      const focusPoint = vectorArray(hotspot.focusTarget)
        ? new THREE.Vector3().fromArray(hotspot.focusTarget)
        : hotspot.center;
      const center = sourcePoint(focusPoint, nextPosition);
      if (!center) return false;
      const selection = intent.mode === 'selection';
      const anchorValues = selection
        ? mobile
          ? config.spotlight?.mobileAnchor || [0.5, 0.31]
          : config.spotlight?.desktopAnchor || [0.34, 0.52]
        : mobile
          ? [0.5, 0.43]
          : [0.5, 0.51];
      const anchor = new THREE.Vector2(...anchorValues);
      if (bounds.length >= 2) {
        const min = new THREE.Vector2(Infinity, Infinity);
        const max = new THREE.Vector2(-Infinity, -Infinity);
        bounds.forEach((point) => {
          min.min(point);
          max.max(point);
        });
        center.addVectors(min, max).multiplyScalar(0.5);
        const fit = projectionFit();
        let heightShare = selection
          ? mobile
            ? positive(config.spotlight?.mobileHeight, 0.42)
            : positive(config.spotlight?.desktopHeight, 0.74)
          : mobile
            ? 0.66
            : 0.72;
        const topLimit = selection ? (mobile ? 76 : 96) / height : 0;
        const bottomLimit = mobile ? 0.53 : 1 - 26 / height;
        if (selection) heightShare = Math.min(heightShare, Math.max(0.2, bottomLimit - topLimit));
        const widthShare = mobile ? 0.8 : selection ? 0.43 : 0.72;
        nextZoom = Math.min(
          (height * heightShare) / ((max.y - min.y) * intrinsics.height * fit),
          (width * widthShare) / ((max.x - min.x) * intrinsics.width * fit),
          maxCropZoom
        );
        nextZoom = Math.max(allowSpotlightOverscan && selection ? 0.4 : 1, nextZoom);
        if (selection) {
          const projectedHeight = ((max.y - min.y) * intrinsics.height * fit * nextZoom) / height;
          anchor.y = THREE.MathUtils.clamp(
            anchor.y,
            topLimit + projectedHeight / 2,
            bottomLimit - projectedHeight / 2
          );
          if (!mobile) {
            const halfWidth = ((max.x - min.x) * intrinsics.width * fit * nextZoom) / (2 * width);
            anchor.x = Math.min(anchor.x, 0.46 - halfWidth);
          }
        }
      } else
        nextZoom = THREE.MathUtils.clamp(positive(hotspot.focusZoom, focusZoom), 1, maxCropZoom);
      const half = cropHalfSize(nextZoom);
      nextCenter
        .copy(center)
        .add(new THREE.Vector2((0.5 - anchor.x) * half.x * 2, (0.5 - anchor.y) * half.y * 2));
    } else if (Array.isArray(heroFrame?.center) && heroFrame.center.length === 2) {
      nextCenter.fromArray(heroFrame.center);
    }
    frameMinimumZoom = nextZoom;
    clampCenter(nextCenter, nextZoom);
    viewTransitioning = animate && !reducedMotion;
    onViewChange({ ...viewIntent, transitioning: viewTransitioning });
    moveTo(nextPosition, nextTarget, { authored: true, duration, animate });
    transitionCrop(nextZoom, nextCenter, duration, animate);
    transitionLighting(intent.mode === 'selection' ? hotspot : null, duration, animate);
    invalidateView();
    return true;
  }
  function lookBy(x, y) {
    stopMotion();
    if (navigationMode === 'orbit' || !allowLook) {
      // Arrow keys and programmatic rotations use the same bounded pivot as
      // dragging; they must not move the target and escape the trained fan.
      const toYUp = new THREE.Quaternion().setFromUnitVectors(
        camera.up.clone().normalize(),
        new THREE.Vector3(0, 1, 0)
      );
      const offset = camera.position.clone().sub(controls.target).applyQuaternion(toYUp);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= x;
      spherical.phi -= y;
      spherical.makeSafe();
      offset.setFromSpherical(spherical).applyQuaternion(toYUp.invert());
      camera.position.copy(controls.target).add(offset);
      controls.update();
      requestRender();
      return;
    }
    lookEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    lookEuler.y -= x;
    lookEuler.x = THREE.MathUtils.clamp(lookEuler.x - y, -Math.PI * 0.47, Math.PI * 0.47);
    camera.quaternion.setFromEuler(lookEuler);
    camera.getWorldDirection(direction);
    controls.target.copy(camera.position).addScaledVector(direction, homeDistance);
    requestRender();
  }
  function setNavigationMode(mode) {
    if (mode !== 'look' && mode !== 'orbit') return;
    if (mode === 'look' && !allowLook) return;
    tween = null;
    navigationMode = mode;
    controls.enabled = mode === 'orbit';
    requestRender();
  }
  function hit(event) {
    if (!loaded || !hotspots.length) return null;
    const bounds = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    let best = null;
    let distance = Infinity;
    for (const spot of hotspots) {
      hitSphere.center.copy(spot.center);
      hitSphere.radius = spot.radius;
      if (raycaster.ray.intersectSphere(hitSphere, hitPosition)) {
        const nextDistance = camera.position.distanceToSquared(hitPosition);
        if (nextDistance < distance) {
          best = spot;
          distance = nextDistance;
        }
      }
    }
    return best;
  }
  function pointerDown(event) {
    stopMotion();
    pointers.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    });
    if (pointers.size > 1) for (const point of pointers.values()) point.moved = true;
    if (navigationMode === 'look' || cropZoom) canvas.setPointerCapture(event.pointerId);
  }
  function pointerMove(event) {
    const active = pointers.get(event.pointerId);
    if (!active) {
      canvas.style.cursor = hit(event) ? 'pointer' : 'grab';
      return;
    }
    const dx = event.clientX - active.x;
    const dy = event.clientY - active.y;
    if (Math.hypot(event.clientX - active.startX, event.clientY - active.startY) > 5)
      active.moved = true;
    if (pointers.size === 2 && (cropZoom || navigationMode === 'look')) {
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)?.[1];
      if (other) {
        const before = Math.hypot(active.x - other.x, active.y - other.y);
        const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        if (before > 0 && after > 0) zoom(before / after);
      }
    } else if (pointers.size === 1 && !panCrop(dx, dy) && navigationMode === 'look')
      lookBy(dx * 0.0026, dy * 0.0026);
    active.x = event.clientX;
    active.y = event.clientY;
  }
  function pointerUp(event) {
    const active = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (!active || active.moved || event.type === 'pointercancel' || pointers.size) return;
    const spot = hit(event);
    if (spot) onSelect(spot.slug);
  }
  function keyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Home') {
      event.preventDefault();
      reset();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoom(0.85);
    } else if (event.key === '-') {
      event.preventDefault();
      zoom(1.15);
    } else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      if (
        panCrop(
          event.key === 'ArrowLeft' ? 36 : event.key === 'ArrowRight' ? -36 : 0,
          event.key === 'ArrowUp' ? 36 : event.key === 'ArrowDown' ? -36 : 0
        )
      )
        return;
      lookBy(
        event.key === 'ArrowLeft' ? -0.08 : event.key === 'ArrowRight' ? 0.08 : 0,
        event.key === 'ArrowUp' ? -0.06 : event.key === 'ArrowDown' ? 0.06 : 0
      );
    }
  }
  function pageScroll(event) {
    event.stopImmediatePropagation();
    if (cropZoom) {
      event.preventDefault();
      const pixels =
        event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1);
      zoom(Math.exp(THREE.MathUtils.clamp(pixels * 0.0015, -0.3, 0.3)));
    }
  }
  function cancelTween() {
    tween = null;
  }
  function visibilityChanged() {
    if (!document.hidden) requestRender();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  }
  function contextLost(event) {
    event.preventDefault();
    fail(new Error('The graphics context was lost. Reload the showroom to continue.'));
  }
  function motionPreferenceChanged() {
    reducedMotion = motionPreference.matches;
    if (!reducedMotion || disposed) return;
    finishMotion();
  }
  function finishMotion() {
    if (disposed) return;
    if (tween) {
      camera.position.copy(tween.to);
      controls.target.copy(tween.toTarget);
      camera.lookAt(controls.target);
      tween = null;
    }
    if (cropTween) {
      viewZoom = cropTween.toZoom;
      cropCenter.copy(cropTween.toCenter);
      cropTween = null;
      clampCrop();
      updateProjection();
    }
    if (lightTween && lightSdf) {
      lightSdfs.forEach((sdf, index) => {
        sdf.position.copy(lightTween.volumes[index].toPosition);
        sdf.scale.copy(lightTween.volumes[index].toScale);
        sdf.color.setScalar(lightTween.toBrightness);
      });
      lightTween = null;
    }
    if (viewTransitioning) {
      viewTransitioning = false;
      onViewChange({ ...viewIntent, transitioning: false });
    }
    invalidateView();
  }
  controls.addEventListener('change', invalidateView);
  controls.addEventListener('start', cancelTween);
  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerUp);
  canvas.addEventListener('wheel', pageScroll, { capture: true, passive: !cropZoom });
  canvas.addEventListener('keydown', keyDown);
  canvas.addEventListener('webglcontextlost', contextLost);
  document.addEventListener('visibilitychange', visibilityChanged);
  motionPreference.addEventListener?.('change', motionPreferenceChanged);
  const observer = new ResizeObserver(resize);
  observer.observe(mount);
  const intersection =
    typeof IntersectionObserver === 'function'
      ? new IntersectionObserver(
          ([entry]) => {
            inViewport = entry.isIntersecting;
            if (inViewport) requestRender();
            else {
              cancelAnimationFrame(frame);
              frame = 0;
            }
          },
          { rootMargin: '100px' }
        )
      : null;
  intersection?.observe(mount);
  resize();
  updatePins();

  function disposeMesh() {
    if (!mesh || meshDisposed) return;
    meshDisposed = true;
    mesh.removeFromParent();
    // Spark 2.4's SplatMesh.dispose does not own this edit-data texture.
    mesh.rgbaDisplaceEdits?.sdfTexture?.dispose();
    mesh.dispose();
  }
  async function load() {
    try {
      onProgress({ phase: 'downloading', loaded: 0, total: 0, progress: 0 });
      const response = await fetch(config.url, {
        signal: abort.signal,
        credentials: config.withCredentials ? 'include' : 'same-origin',
      });
      if (!response.ok) throw new Error(`The splat file could not be loaded (${response.status}).`);
      const total = Number(response.headers.get('content-length')) || 0;
      let bytes;
      if (response.body?.getReader) {
        const reader = response.body.getReader();
        const chunks = [];
        let received = 0;
        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.byteLength;
            if (!disposed)
              onProgress({
                phase: 'downloading',
                loaded: received,
                total,
                progress: total ? Math.min(1, received / total) : 0,
              });
          }
        } finally {
          reader.releaseLock();
        }
        bytes = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, offset);
          offset += chunk.byteLength;
        }
      } else bytes = new Uint8Array(await response.arrayBuffer());
      if (disposed || failed) return;
      if (!bytes.byteLength) throw new Error('The splat file is empty.');
      onProgress({
        phase: 'decoding',
        loaded: bytes.byteLength,
        total: bytes.byteLength,
        progress: 1,
      });
      mesh = new SplatMesh({
        fileBytes: bytes,
        fileName: config.url.split('?')[0],
        raycastable: false,
        editable: Boolean(lightEdit),
        lod: Boolean(config.lod),
      });
      await mesh.initialized;
      if (disposed || failed) {
        disposeMesh();
        return;
      }
      if (!mesh.numSplats) throw new Error('The file contains no renderable Gaussian splats.');
      if (lightEdit) mesh.edits = [lightEdit];
      const transform = config.transform || {};
      if (vectorArray(transform.position)) mesh.position.fromArray(transform.position);
      if (quaternionArray(transform.quaternion))
        mesh.quaternion.fromArray(transform.quaternion).normalize();
      else if (vectorArray(transform.rotation))
        mesh.rotation.fromArray([...transform.rotation, 'XYZ']);
      mesh.scale.setScalar(positive(transform.scale, 1));
      scene.add(mesh);
      loaded = true;
      invalidateView();
    } catch (error) {
      if (disposed || error?.name === 'AbortError') {
        // Decoding can fail after unmount too; release any partially allocated
        // buffers even when the error must no longer reach the React surface.
        disposeMesh();
        return;
      }
      disposeMesh();
      fail(error);
    }
  }
  const ready = load();
  return {
    ready,
    refresh: requestRender,
    zoom,
    reset,
    stopMotion,
    showHeroFrame(index) {
      const count = config.heroFrames?.length || 0;
      if (!count || !Number.isInteger(index)) return false;
      const frameIndex = ((index % count) + count) % count;
      return frameView({ mode: 'hero', slug: null, frameIndex });
    },
    setNavigationMode,
    rotateView(degrees) {
      if (Number.isFinite(degrees)) lookBy((degrees * Math.PI) / 180, 0);
    },
    focus(slug) {
      const hotspot = hotspots.find((spot) => spot.slug === slug);
      if (!hotspot || !loaded) return false;
      if (hotspot.focusBounds?.length >= 2 && cropZoom && intrinsics)
        return frameView({ mode: 'selection', slug, frameIndex: null });
      if (cropZoom && intrinsics) {
        camera.updateMatrixWorld();
        const focusPoint = vectorArray(hotspot.focusTarget)
          ? new THREE.Vector3().fromArray(hotspot.focusTarget)
          : hotspot.center.clone();
        const local = focusPoint.applyMatrix4(camera.matrixWorldInverse);
        if (local.z >= 0) return false;
        const nextZoom = THREE.MathUtils.clamp(
          positive(hotspot.focusZoom, focusZoom),
          1,
          maxCropZoom
        );
        const nextCenter = new THREE.Vector2(
          (intrinsics.cx + (intrinsics.fx * local.x) / -local.z) / intrinsics.width,
          (intrinsics.cy - (intrinsics.fy * local.y) / -local.z) / intrinsics.height
        ).clampScalar(0.5 / nextZoom, 1 - 0.5 / nextZoom);
        tween = null;
        transitionCrop(nextZoom, nextCenter);
        return true;
      }
      if (!vectorArray(hotspot.focusPosition)) return false;
      moveTo(
        new THREE.Vector3().fromArray(hotspot.focusPosition),
        vectorArray(hotspot.focusTarget)
          ? new THREE.Vector3().fromArray(hotspot.focusTarget)
          : hotspot.center.clone()
      );
      return true;
    },
    pause() {
      paused = true;
      // A hidden/reference view resumes at the authored destination. User
      // Pause tour uses stopMotion instead and deliberately freezes in place.
      finishMotion();
      cancelAnimationFrame(frame);
      frame = 0;
    },
    resume() {
      if (!disposed) {
        paused = false;
        requestRender();
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection?.disconnect();
      controls.removeEventListener('change', invalidateView);
      controls.removeEventListener('start', cancelTween);
      controls.dispose();
      canvas.removeEventListener('pointerdown', pointerDown);
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerUp);
      canvas.removeEventListener('wheel', pageScroll, true);
      canvas.removeEventListener('keydown', keyDown);
      canvas.removeEventListener('webglcontextlost', contextLost);
      document.removeEventListener('visibilitychange', visibilityChanged);
      motionPreference.removeEventListener?.('change', motionPreferenceChanged);
      // An in-flight decoder may still finish after unmount. Its load() branch
      // frees the mesh immediately without ever adding it back to the scene.
      if (mesh?.isInitialized) disposeMesh();
      spark.dispose();
      scene.clear();
      renderer.dispose();
      canvas.remove();
      pointers.clear();
    },
  };
}
