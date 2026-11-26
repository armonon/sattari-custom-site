import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Plus,
  ShoppingBag,
  X,
} from 'lucide-react';
import { useInventory } from '../context/InventoryContext';
import { useCart } from '../context/CartContext';
import { formatPriceRange } from '../data/catalog';
import { MAX_LINE_QUANTITY } from '../utils/cartCatalog';
import { showroomProducts } from '../showroom/showroomCatalog';
import gaussianShowroomConfig from '../showroom/gaussianShowroomConfig';
import './GuitarShowroom.css';

export default function GuitarShowroom({ config = gaussianShowroomConfig }) {
  const { products, isSoldOut, status } = useInventory();
  const { addToCart, cartItems, cartReady } = useCart();
  const displays = useMemo(() => showroomProducts(products), [products]);
  const displayKey = displays.map((item) => item.slug).join('|');
  const mountRef = useRef(null);
  const stageRef = useRef(null);
  const panelRef = useRef(null);
  const returnFocusRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const dockRefs = useRef(new Map());
  const selectionRef = useRef(null);
  const controllerRef = useRef(null);
  const selectRef = useRef(null);
  const [sceneStatus, setSceneStatus] = useState(config.url ? 'loading' : 'concept');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadProgress, setLoadProgress] = useState({ phase: 'downloading', loaded: 0, total: 0 });
  const [selectedSlug, setSelectedSlug] = useState(null);
  const [view, setView] = useState('showroom');
  const [reference, setReference] = useState('guitar');
  const [added, setAdded] = useState(null);
  const [heroFrame, setHeroFrame] = useState(0);
  const [autoPlay, setAutoPlay] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [inViewport, setInViewport] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const selected = displays.find((item) => item.slug === selectedSlug);
  const product = selected?.product;
  const selectedIndex = displays.findIndex((item) => item.slug === selectedSlug);
  const specs = (selected?.specs || product?.specs || []).filter(
    (item) => typeof item === 'string' && item.trim()
  );
  const soldOut = product ? isSoldOut(product) : false;
  const inCart =
    cartItems.find(
      (item) => item.slug === product?.slug && item.size === null && item.color === null
    )?.quantity ?? 0;
  const atCartLimit = inCart >= MAX_LINE_QUANTITY;
  const sceneReady = Boolean(config.url) && sceneStatus === 'ready';
  const sequenceRunning =
    autoPlay &&
    !reduceMotion &&
    inViewport &&
    pageVisible &&
    sceneReady &&
    !selected &&
    view === 'showroom';
  const downloading = loadProgress.phase === 'downloading';
  const downloadPercent =
    loadProgress.total > 0
      ? Math.min(100, Math.round((loadProgress.loaded / loadProgress.total) * 100))
      : null;
  const megabytes = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;
  const visibleHotspots = new Set(
    (config.hotspots || [])
      .filter(
        (spot) =>
          Array.isArray(spot.position) &&
          spot.position.length === 3 &&
          spot.position.every(Number.isFinite)
      )
      .map((spot) => spot.slug)
  );

  function selectProduct(slug, trigger = document.activeElement) {
    if (!displays.some((display) => display.slug === slug)) return;
    if (trigger instanceof HTMLElement && !panelRef.current?.contains(trigger))
      returnFocusRef.current = trigger;
    setSelectedSlug(slug);
    setAutoPlay(false);
    setView('showroom');
    setAdded(null);
    if (autoPlay) controllerRef.current?.stopMotion?.();
    controllerRef.current?.focus(slug);
  }
  selectRef.current = selectProduct;
  selectionRef.current = selectedSlug;

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const motionChange = () => setReduceMotion(Boolean(media?.matches));
    const visibilityChange = () => setPageVisible(document.visibilityState !== 'hidden');
    motionChange();
    visibilityChange();
    media?.addEventListener?.('change', motionChange);
    document.addEventListener('visibilitychange', visibilityChange);
    const observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(
            ([entry]) => setInViewport(entry.isIntersecting && entry.intersectionRatio >= 0.25),
            { threshold: 0.25 }
          )
        : null;
    if (stageRef.current) observer?.observe(stageRef.current);
    return () => {
      media?.removeEventListener?.('change', motionChange);
      document.removeEventListener('visibilitychange', visibilityChange);
      observer?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!sequenceRunning) return undefined;
    const timer = window.setTimeout(() => {
      const next = (heroFrame + 1) % 4;
      setHeroFrame(next);
      controllerRef.current?.showHeroFrame?.(next);
    }, 8000);
    return () => window.clearTimeout(timer);
  }, [sequenceRunning, heroFrame]);

  useEffect(() => {
    if (!config.url) {
      setSceneStatus('concept');
      return undefined;
    }
    let cancelled = false;
    let failed = false;
    let controller;
    setSceneStatus('loading');
    setLoadProgress({ phase: 'downloading', loaded: 0, total: 0 });
    const dispose = () => {
      controller?.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
      controller = null;
    };
    const fail = () => {
      if (cancelled || failed) return;
      failed = true;
      setSceneStatus('unavailable');
      dispose();
    };
    import('../showroom/createGaussianShowroom')
      .then(({ createGaussianShowroom }) => {
        if (cancelled || !mountRef.current) return;
        try {
          controller = createGaussianShowroom({
            mount: mountRef.current,
            displays,
            config,
            onSelect: (slug) => {
              if (!cancelled && !failed) selectRef.current?.(slug);
            },
            onReady: () => {
              if (!cancelled && !failed) setSceneStatus('ready');
            },
            onError: fail,
            onProgress: (progress) => {
              if (cancelled || failed) return;
              const next = {
                phase: progress.phase,
                loaded: Number.isFinite(progress.loaded) ? Math.max(0, progress.loaded) : 0,
                total: Number.isFinite(progress.total) ? Math.max(0, progress.total) : 0,
              };
              // A streamed download can emit hundreds of chunks. Update only
              // when the displayed size changes, or a new phase begins.
              setLoadProgress((previous) =>
                previous.phase === next.phase &&
                previous.total === next.total &&
                Math.floor(previous.loaded / 100000) === Math.floor(next.loaded / 100000)
                  ? previous
                  : next
              );
            },
          });
          // A renderer can report failure synchronously during construction.
          if (cancelled || failed) dispose();
          else controllerRef.current = controller;
        } catch {
          fail();
        }
      })
      .catch(fail);
    return () => {
      cancelled = true;
      dispose();
    };
    // Prices and stock stay live without reloading the 3D asset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, displayKey, loadAttempt]);

  useEffect(() => {
    if (!added) return undefined;
    const timer = setTimeout(() => setAdded(null), 2400);
    return () => clearTimeout(timer);
  }, [added]);

  useEffect(() => {
    if (view === 'reference' || !inViewport || !pageVisible) controllerRef.current?.pause?.();
    else {
      controllerRef.current?.resume?.();
      controllerRef.current?.refresh?.();
      if (sceneStatus === 'ready' && selectionRef.current)
        controllerRef.current?.focus(selectionRef.current);
    }
  }, [view, sceneStatus, inViewport, pageVisible]);

  useEffect(() => {
    if (!selectedSlug || view !== 'showroom') return;
    panelRef.current?.focus({ preventScroll: true });
    if (panelRef.current) panelRef.current.scrollTop = 0;
    stageRef.current?.scrollIntoView?.({
      behavior: reduceMotion ? 'instant' : 'smooth',
      block: 'start',
    });
  }, [selectedSlug, view, reduceMotion]);

  useEffect(() => {
    if (selectedSlug || !restoreFocusRef.current) return;
    const slug = restoreFocusRef.current;
    restoreFocusRef.current = null;
    const candidates = [
      returnFocusRef.current,
      dockRefs.current.get(slug),
      mountRef.current?.querySelector('canvas'),
      stageRef.current?.querySelector('button'),
    ];
    const target = candidates.find(
      (node) =>
        node instanceof HTMLElement &&
        node.matches('a[href], button, select, input, textarea, [tabindex]') &&
        node.isConnected &&
        !node.closest('[inert], [hidden], [aria-hidden="true"]') &&
        node.checkVisibility?.({ checkVisibilityCSS: true }) !== false
    );
    target?.focus();
  }, [selectedSlug]);

  function resetView() {
    setSelectedSlug(null);
    setHeroFrame(0);
    controllerRef.current?.reset();
  }
  function pauseSequence() {
    if (autoPlay) controllerRef.current?.stopMotion?.();
    setAutoPlay(false);
  }
  function closeProduct() {
    restoreFocusRef.current = selectedSlug;
    resetView();
  }
  function selectAdjacent(direction, event) {
    if (!displays.length) return;
    const next = (Math.max(0, selectedIndex) + direction + displays.length) % displays.length;
    selectProduct(displays[next].slug, event.currentTarget);
  }
  function addSelected() {
    if (
      !product ||
      !cartReady ||
      atCartLimit ||
      soldOut ||
      product.colors?.length ||
      product.sizes?.length ||
      product.purchaseInquiry
    )
      return;
    addToCart({ slug: product.slug, quantity: 1 });
    setAdded(product.slug);
  }
  const isReference = view === 'reference';
  const needsDetails =
    product?.colors?.length || product?.sizes?.length || product?.purchaseInquiry;

  return (
    <section
      className="guitar-showroom"
      aria-labelledby="showroom-title"
      style={{ '--showroom-aspect': config.camera?.sourceAspect || 4 / 3 }}
    >
      <div
        ref={stageRef}
        className={`showroom-stage${selected ? ' has-selection' : ''}${isReference ? ' is-reference' : ''}${!sceneReady || isReference ? ' is-image' : ''}`}
        onPointerDownCapture={pauseSequence}
        onWheelCapture={pauseSequence}
        onFocusCapture={pauseSequence}
        onKeyDownCapture={pauseSequence}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          if (selected) {
            event.preventDefault();
            closeProduct();
          }
        }}
      >
        <div
          className={`showroom-canvas${isReference || !sceneReady ? ' is-hidden' : ''}`}
          ref={mountRef}
          aria-hidden={isReference || !sceneReady ? 'true' : undefined}
          inert={isReference || !sceneReady ? '' : undefined}
        />
        {(isReference || !sceneReady) && (
          <div className="showroom-reference">
            <img
              src={
                isReference
                  ? `/images/showroom/${reference === 'violin' ? 'violin' : 'guitar'}-wall-reference.jpg`
                  : config.poster
              }
              alt={
                isReference
                  ? reference === 'violin'
                    ? 'The actual Sattari Music violin display, with green acoustic panels and store posters.'
                    : 'The actual Sattari Music store, with electric guitars, basses and acoustic guitars hanging on the wall.'
                  : 'Guitars on display in the showroom.'
              }
              draggable="false"
            />
            {!isReference && ['loading', 'unavailable'].includes(sceneStatus) && (
              <div
                className="showroom-load-message"
                role={sceneStatus === 'unavailable' ? 'status' : undefined}
              >
                {sceneStatus === 'loading' ? (
                  <>
                    <span role="status">
                      {downloading ? 'Opening the 3D showroom…' : 'Preparing the 3D view…'}
                    </span>
                    <progress
                      aria-label={downloading ? 'Downloading showroom' : 'Preparing 3D view'}
                      max="100"
                      value={downloading && downloadPercent !== null ? downloadPercent : undefined}
                    />
                    <small>
                      {!downloading
                        ? 'Your showroom is almost ready.'
                        : loadProgress.total > 0
                          ? `${megabytes(loadProgress.loaded)} of ${megabytes(loadProgress.total)} · ${downloadPercent}%`
                          : loadProgress.loaded > 0
                            ? `${megabytes(loadProgress.loaded)} downloaded`
                            : 'Connecting…'}
                    </small>
                  </>
                ) : (
                  <>
                    <span>3D could not load. You can still explore the instruments.</span>
                    <button
                      type="button"
                      className="showroom-load-retry"
                      onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                    >
                      Try again
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        <div className="showroom-stage-top">
          {selected ? (
            <>
              <button type="button" className="showroom-back" onClick={closeProduct}>
                <ArrowLeft size={17} aria-hidden="true" /> Back to full wall
              </button>
              <div className="showroom-stepper" role="group" aria-label="Browse instruments">
                <button
                  type="button"
                  aria-label="Previous instrument"
                  disabled={displays.length < 2}
                  onClick={(event) => selectAdjacent(-1, event)}
                >
                  Previous
                </button>
                <span aria-live="polite">
                  {selectedIndex + 1} / {displays.length}
                </span>
                <button
                  type="button"
                  aria-label="Next instrument"
                  disabled={displays.length < 2}
                  onClick={(event) => selectAdjacent(1, event)}
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="showroom-view-toggle" aria-label="Showroom view">
                <button
                  type="button"
                  aria-pressed={!isReference}
                  onClick={() => setView('showroom')}
                >
                  <Box size={16} aria-hidden="true" /> Showroom
                </button>
                <button
                  type="button"
                  aria-pressed={isReference}
                  onClick={() => {
                    setView('reference');
                    resetView();
                  }}
                >
                  <Camera size={16} aria-hidden="true" /> Original store
                </button>
              </div>
            </>
          )}
        </div>

        {!isReference && sceneReady && (
          <div
            className="showroom-pins"
            hidden={Boolean(selected)}
            inert={selected ? '' : undefined}
          >
            {displays
              .filter((display) => visibleHotspots.has(display.slug))
              .map((display) => (
                <button
                  type="button"
                  key={display.slug}
                  data-showroom-pin={display.slug}
                  className={`showroom-pin${selectedSlug === display.slug ? ' is-selected' : ''}`}
                  aria-label={`Explore ${display.product.name}`}
                  aria-pressed={selectedSlug === display.slug}
                  onClick={(event) => selectProduct(display.slug, event.currentTarget)}
                >
                  <Plus size={14} aria-hidden="true" />
                  <span>{display.label}</span>
                </button>
              ))}
          </div>
        )}

        {isReference && (
          <div className="showroom-photo-tabs">
            <button
              type="button"
              aria-pressed={reference === 'guitar'}
              onClick={() => setReference('guitar')}
            >
              Guitar wall
            </button>
            <button
              type="button"
              aria-pressed={reference === 'violin'}
              onClick={() => setReference('violin')}
            >
              Violin wall
            </button>
          </div>
        )}

        {selected && !isReference && (
          <aside
            key={selectedSlug}
            ref={panelRef}
            tabIndex={-1}
            className="showroom-product-panel"
            aria-label={`Selected instrument: ${product.name}`}
          >
            <div className="showroom-panel-top">
              <span>{selected.label}</span>
              <button type="button" onClick={closeProduct} aria-label="Close instrument details">
                <X size={18} />
              </button>
            </div>
            <div className="showroom-product-summary">
              <div className="showroom-product-info">
                <h2>{product.name}</h2>
                <div className="showroom-price-row">
                  <strong>{formatPriceRange(product)}</strong>
                  <span>
                    {soldOut
                      ? 'Out of stock'
                      : status === 'ready'
                        ? 'Available to order'
                        : 'Availability confirmed at checkout'}
                  </span>
                </div>
                {needsDetails ? (
                  <Link className="showroom-buy-button" to={`/product/${product.slug}`}>
                    {product.purchaseInquiry ? 'Confirm product details' : 'Choose options'}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="showroom-buy-button"
                    onClick={addSelected}
                    disabled={soldOut || atCartLimit || !cartReady}
                    aria-describedby={atCartLimit ? 'showroom-cart-limit' : undefined}
                  >
                    {added === product.slug ? <Check size={17} /> : <ShoppingBag size={17} />}
                    {soldOut
                      ? 'Out of stock'
                      : atCartLimit
                        ? 'Cart limit reached'
                        : added === product.slug
                          ? 'Added to cart'
                          : 'Add to cart'}
                  </button>
                )}
                {atCartLimit && !needsDetails && (
                  <p id="showroom-cart-limit" className="showroom-cart-limit">
                    Your cart has {inCart}. Maximum {MAX_LINE_QUANTITY} per item in one online
                    order.
                  </p>
                )}
                <Link className="showroom-detail-link" to={`/product/${product.slug}`}>
                  Product photos <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>
            </div>
            {specs.length > 0 && (
              <div className="showroom-specification">
                <h3>Specifications</h3>
                <dl>
                  {specs.map((spec, index) => {
                    const separator = spec.indexOf(':');
                    return (
                      <div key={`${spec}-${index}`}>
                        <dt>{separator > 0 ? spec.slice(0, separator).trim() : 'Detail'}</dt>
                        <dd>{separator > 0 ? spec.slice(separator + 1).trim() : spec}</dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            )}
            {product.description && (
              <details className="showroom-product-description">
                <summary>About this instrument</summary>
                <p>{product.description}</p>
              </details>
            )}
            <p className="showroom-cart-status" role="status">
              {added === product.slug ? `${product.name} added to cart.` : ''}
            </p>
          </aside>
        )}

        <div className="showroom-hero-bottom" hidden={Boolean(selected) || isReference}>
          <div className="showroom-heading">
            <h1 id="showroom-title">
              Welcome to
              <br className="showroom-mobile-break" /> the shop.
            </h1>
            <a className="showroom-catalog-link" href="#shop-catalog">
              Explore instruments <ArrowDown size={21} aria-hidden="true" />
            </a>
          </div>
          <nav className="showroom-categories" aria-label="Guitar collection">
            {displays.map(({ slug, label, product: item }, index) => (
              <button
                key={slug}
                ref={(node) => {
                  if (node) dockRefs.current.set(slug, node);
                  else dockRefs.current.delete(slug);
                }}
                type="button"
                aria-label={`Select ${item.name}`}
                aria-pressed={selectedSlug === slug}
                onClick={(event) => selectProduct(slug, event.currentTarget)}
              >
                <small aria-hidden="true">0{index + 1}</small>
                <span>{label === 'Steel string' ? 'Acoustic' : label}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
