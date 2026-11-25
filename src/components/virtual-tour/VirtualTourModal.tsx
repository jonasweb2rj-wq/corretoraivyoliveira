import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import 'pannellum/build/pannellum.css';
import 'pannellum/build/pannellum.js';
import {
  ArrowLeft,
  Box,
  ChevronLeft,
  ChevronRight,
  Compass,
  Images,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Property } from '../../types/realestate';

interface PannellumViewerInstance {
  destroy: () => void;
  setHfov: (hfov: number, animated?: boolean | number) => void;
  getHfov: () => number;
  startAutoRotate: (speed?: number) => void;
  stopAutoRotate: () => void;
  setPitch: (pitch: number, animated?: boolean | number) => void;
  setYaw: (yaw: number, animated?: boolean | number) => void;
  resize: () => void;
  on: (event: string, listener: (arg?: unknown) => void) => void;
}

declare global {
  interface Window {
    pannellum?: {
      viewer: (container: HTMLElement | string, config: Record<string, unknown>) => PannellumViewerInstance;
    };
  }
}

interface VirtualTourModalProps {
  property: Property;
  onClose: () => void;
}

type TourMode = 'photo' | 'panorama360' | '3d';

function detectSoftwareWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function VirtualTourModal({ property, onClose }: VirtualTourModalProps) {
  const has360 = (property.panorama360Images?.length || 0) > 0;
  const allow3dTab = property.virtualTourType === '3d';

  const initialMode: TourMode =
    property.virtualTourType === 'panorama360' && has360
      ? 'panorama360'
      : property.virtualTourType === '3d'
        ? '3d'
        : 'photo';

  const [mode, setMode] = useState<TourMode>(initialMode);
  const [selectedRoom, setSelectedRoom] = useState<string>('Todos');
  const [photoIdx, setPhotoIdx] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDraggingPan, setIsDraggingPan] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [cinematicMotion, setCinematicMotion] = useState(true);

  // 360° Pannellum state
  const [panoIdx, setPanoIdx] = useState(0);
  const [panoAutoRotate, setPanoAutoRotate] = useState(true);
  const [panoError, setPanoError] = useState<string | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);

  const modalRef = useRef<HTMLDivElement | null>(null);
  const panoContainerRef = useRef<HTMLDivElement | null>(null);
  const pannellumInstanceRef = useRef<PannellumViewerInstance | null>(null);
  const canvas3dRef = useRef<HTMLDivElement | null>(null);
  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const touchStartXRef = useRef<number | null>(null);
  const dragStartRef = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null);

  const photos = property.images || [];

  const roomStats = useMemo(() => {
    const counts = new Map<string, number>();
    photos.forEach((p) => {
      const tag = p.roomTag?.trim() || 'Outros ambientes';
      counts.set(tag, (counts.get(tag) || 0) + 1);
    });
    return [
      { name: 'Todos', count: photos.length },
      ...Array.from(counts.entries()).map(([name, count]) => ({ name, count })),
    ];
  }, [photos]);

  const filteredPhotos = useMemo(() => {
    if (selectedRoom === 'Todos') return photos;
    return photos.filter((p) => (p.roomTag?.trim() || 'Outros ambientes') === selectedRoom);
  }, [photos, selectedRoom]);

  const currentPhoto = filteredPhotos[photoIdx] || filteredPhotos[0];

  const resetZoom = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const goNext = useCallback(() => {
    if (filteredPhotos.length <= 1) return;
    resetZoom();
    setPhotoIdx((i) => (i + 1) % filteredPhotos.length);
  }, [filteredPhotos.length, resetZoom]);

  const goPrev = useCallback(() => {
    if (filteredPhotos.length <= 1) return;
    resetZoom();
    setPhotoIdx((i) => (i - 1 + filteredPhotos.length) % filteredPhotos.length);
  }, [filteredPhotos.length, resetZoom]);

  useEffect(() => {
    setPhotoIdx(0);
    resetZoom();
  }, [selectedRoom, resetZoom]);

  // Preload adjacent photos for zero-stutter transitions
  useEffect(() => {
    if (filteredPhotos.length <= 1) return;
    const next = filteredPhotos[(photoIdx + 1) % filteredPhotos.length];
    const prev = filteredPhotos[(photoIdx - 1 + filteredPhotos.length) % filteredPhotos.length];
    if (next?.url) {
      const img = new Image();
      img.src = next.url;
    }
    if (prev?.url) {
      const img = new Image();
      img.src = prev.url;
    }
  }, [photoIdx, filteredPhotos]);

  // Auto-scroll active thumbnail into view
  useEffect(() => {
    const el = thumbRefs.current[photoIdx];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, [photoIdx]);

  // Guided Tour Auto-Play (stops when user zooms in)
  useEffect(() => {
    if (!autoPlay || mode !== 'photo' || filteredPhotos.length <= 1 || zoomLevel > 1) return;
    const timer = window.setInterval(() => {
      setPhotoIdx((i) => (i + 1) % filteredPhotos.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [autoPlay, mode, filteredPhotos.length, zoomLevel]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else {
          onClose();
        }
      }
      if (mode === 'photo') {
        if (e.key === 'ArrowRight') goNext();
        if (e.key === 'ArrowLeft') goPrev();
        if (e.key === ' ') {
          e.preventDefault();
          setAutoPlay((p) => !p);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, goNext, goPrev, onClose]);

  // Fullscreen sync
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Real 360° Equirectangular Panorama Viewer via Pannellum (MIT free open-source)
  useEffect(() => {
    if (mode !== 'panorama360' || !has360 || !panoContainerRef.current) return;
    const container = panoContainerRef.current;
    const pano = property.panorama360Images[panoIdx] || property.panorama360Images[0];
    if (!pano?.url || !window.pannellum) {
      setPanoError('Visualizador panorâmico 360° indisponível neste dispositivo.');
      return;
    }

    setPanoError(null);
    if (pannellumInstanceRef.current) {
      try {
        pannellumInstanceRef.current.destroy();
      } catch {
        // ignore cleanup error
      }
      pannellumInstanceRef.current = null;
    }

    try {
      const viewer = window.pannellum.viewer(container, {
        type: 'equirectangular',
        panorama: pano.url,
        autoLoad: true,
        autoRotate: panoAutoRotate ? -2 : 0,
        showControls: false,
        showFullscreenCtrl: false,
        showZoomCtrl: false,
        mouseZoom: true,
        draggable: true,
        compass: true,
        hfov: 95,
        minHfov: 45,
        maxHfov: 120,
        crossOrigin: 'anonymous',
        strings: {
          loadingLabel: 'Carregando panorama 360°...',
          loadButtonLabel: 'Carregar 360°',
          noPanoramaError: 'Nenhuma fotografia panorâmica especificada.',
          fileAccessError: 'Não foi possível carregar a fotografia panorâmica.',
        },
      });
      viewer.on('error', () => {
        setPanoError('Não foi possível renderizar esta imagem 360° via WebGL.');
      });
      pannellumInstanceRef.current = viewer;
    } catch {
      setPanoError('WebGL indisponível para renderização 360° neste navegador.');
    }

    return () => {
      if (pannellumInstanceRef.current) {
        try {
          pannellumInstanceRef.current.destroy();
        } catch {
          // ignore
        }
        pannellumInstanceRef.current = null;
      }
    };
  }, [mode, has360, panoIdx, property.panorama360Images]);

  useEffect(() => {
    const viewer = pannellumInstanceRef.current;
    if (!viewer || mode !== 'panorama360') return;
    try {
      if (panoAutoRotate) {
        viewer.startAutoRotate(-2);
      } else {
        viewer.stopAutoRotate();
      }
    } catch {
      // ignore
    }
  }, [panoAutoRotate, mode]);

  // Optional Proportional Volumetric Architectural Study (when explicitly configured)
  useEffect(() => {
    if (mode !== '3d' || !canvas3dRef.current) return;
    const container = canvas3dRef.current;
    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || 960;
    const height = container.clientHeight || 540;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111110);
    scene.fog = new THREE.Fog(0x111110, 18, 45);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(11, 8, 12);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.setSize(width, height);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x292524, 0.8));
    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.2);
    keyLight.position.set(10, 16, 8);
    keyLight.castShadow = !isSoftwareGl;
    scene.add(keyLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.minDistance = 6;
    controls.maxDistance = 24;

    const archGroup = new THREE.Group();
    const scaleFactor = Math.max(0.8, Math.min(1.6, Math.sqrt((property.builtArea || 160) / 160)));

    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xe6e1d8, roughness: 0.72, metalness: 0.05 });
    const timberMat = new THREE.MeshStandardMaterial({ color: 0x6f4e37, roughness: 0.55, metalness: 0.08 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: 0x9a744b, roughness: 0.28, metalness: 0.85 });
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xdbeafe,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.42,
    });
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x1e4e5f, roughness: 0.15, metalness: 0.25 });

    const plinth = new THREE.Mesh(new THREE.BoxGeometry(10 * scaleFactor, 0.35, 7 * scaleFactor), stoneMat);
    plinth.position.y = 0.175;
    plinth.receiveShadow = true;
    archGroup.add(plinth);

    const livingFloor = new THREE.Mesh(new THREE.BoxGeometry(7.2 * scaleFactor, 0.25, 4.8 * scaleFactor), timberMat);
    livingFloor.position.set(-0.6 * scaleFactor, 0.47, -0.5 * scaleFactor);
    archGroup.add(livingFloor);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(7.2 * scaleFactor, 2.5, 0.24), stoneMat);
    backWall.position.set(-0.6 * scaleFactor, 1.85, -2.78 * scaleFactor);
    archGroup.add(backWall);

    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, 2.5, 4.8 * scaleFactor), stoneMat);
    sideWall.position.set(-4.08 * scaleFactor, 1.85, -0.5 * scaleFactor);
    archGroup.add(sideWall);

    const glassWall = new THREE.Mesh(new THREE.BoxGeometry(6.8 * scaleFactor, 2.4, 0.08), glassMat);
    glassWall.position.set(-0.5 * scaleFactor, 1.8, 1.85 * scaleFactor);
    archGroup.add(glassWall);

    const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(8.2 * scaleFactor, 0.28, 5.8 * scaleFactor), stoneMat);
    roofSlab.position.set(-0.4 * scaleFactor, 3.24, -0.3 * scaleFactor);
    archGroup.add(roofSlab);

    const bronzeFascia = new THREE.Mesh(new THREE.BoxGeometry(8.26 * scaleFactor, 0.08, 5.86 * scaleFactor), bronzeMat);
    bronzeFascia.position.set(-0.4 * scaleFactor, 3.38, -0.3 * scaleFactor);
    archGroup.add(bronzeFascia);

    const pool = new THREE.Mesh(new THREE.BoxGeometry(6.4 * scaleFactor, 0.14, 1.6 * scaleFactor), waterMat);
    pool.position.set(0.4 * scaleFactor, 0.41, 2.55 * scaleFactor);
    archGroup.add(pool);

    scene.add(archGroup);

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        controls.update();
        renderer.render(scene, camera);
        renderBusy = false;
        if (renderDirty) requestRender();
      });
    }

    controls.addEventListener('change', requestRender);
    const onResize = () => {
      const w = container.clientWidth || 960;
      const h = container.clientHeight || 540;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);
    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      stoneMat.dispose();
      timberMat.dispose();
      bronzeMat.dispose();
      glassMat.dispose();
      waterMat.dispose();
      renderer.dispose();
    };
  }, [mode, property.builtArea]);

  const toggleFullscreen = async () => {
    if (!modalRef.current) return;
    if (!document.fullscreenElement) {
      await modalRef.current.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  };

  // Zoom & Pan handlers for photo viewer
  const handleStageMouseDown = (e: React.MouseEvent) => {
    if (zoomLevel <= 1) return;
    setIsDraggingPan(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      originX: panOffset.x,
      originY: panOffset.y,
    };
  };

  const handleStageMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingPan || !dragStartRef.current || zoomLevel <= 1) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanOffset({
      x: Math.max(-260, Math.min(260, dragStartRef.current.originX + dx)),
      y: Math.max(-180, Math.min(180, dragStartRef.current.originY + dy)),
    });
  };

  const handleStageMouseUp = () => {
    setIsDraggingPan(false);
    dragStartRef.current = null;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || zoomLevel > 1) return;
    const delta = e.changedTouches[0].clientX - touchStartXRef.current;
    if (delta > 45) goPrev();
    if (delta < -45) goNext();
    touchStartXRef.current = null;
  };

  const handlePanoZoom = (delta: number) => {
    const viewer = pannellumInstanceRef.current;
    if (!viewer) return;
    const next = Math.max(45, Math.min(120, viewer.getHfov() + delta));
    viewer.setHfov(next, 250);
  };

  const handlePanoReset = () => {
    const viewer = pannellumInstanceRef.current;
    if (!viewer) return;
    viewer.setPitch(0, 300);
    viewer.setYaw(0, 300);
    viewer.setHfov(95, 300);
  };

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Visita virtual — ${property.title}`}
      className="fixed inset-0 z-50 bg-[#0C0C0B] text-white flex flex-col justify-between select-none"
    >
      {/* Top Architectural Navigation Bar */}
      <header className="px-4 sm:px-6 py-3.5 border-b border-white/10 bg-black/40 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white/10 hover:bg-white/20 rounded-md whitespace-nowrap shrink-0 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Retornar à galeria
          </button>
          <div className="min-w-0 hidden sm:block">
            <p className="text-[11px] text-white/60 truncate">
              Visita Virtual Guiada · {property.neighborhood}, {property.city} · Cód. {property.code}
            </p>
            <h2 className="font-editorial text-xl font-semibold truncate text-white">
              {property.title}
            </h2>
          </div>
        </div>

        {/* Modality Switcher (Only shows real available modalities) */}
        <div className="flex items-center gap-1 p-1 bg-white/10 rounded-lg shrink-0">
          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              mode === 'photo' ? 'bg-white text-neutral-950' : 'text-white/80 hover:text-white'
            }`}
          >
            <Images className="w-3.5 h-3.5" />
            Tour por Ambientes
          </button>
          {has360 && (
            <button
              type="button"
              onClick={() => setMode('panorama360')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                mode === 'panorama360' ? 'bg-white text-neutral-950' : 'text-white/80 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              Panorama 360° ({property.panorama360Images.length})
            </button>
          )}
          {allow3dTab && (
            <button
              type="button"
              onClick={() => setMode('3d')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                mode === '3d' ? 'bg-white text-neutral-950' : 'text-white/80 hover:text-white'
              }`}
            >
              <Box className="w-3.5 h-3.5" />
              Estudo Volumétrico
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Sair da tela cheia' : 'Modo tela cheia'}
            title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            className="p-2.5 bg-white/10 rounded-md hover:bg-white/20 transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar visita virtual"
            className="p-2.5 bg-white/10 rounded-md hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Viewer Body */}
      {mode === 'photo' && (
        <div className="flex-1 min-h-0 flex flex-col justify-between p-3 sm:p-5 gap-3">
          {/* Room Navigation Strip + Guided Playback Controls */}
          <div className="max-w-7xl mx-auto w-full flex flex-wrap items-center justify-between gap-3">
            <nav
              aria-label="Navegação entre ambientes"
              className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full"
            >
              {roomStats.map((r) => (
                <button
                  key={r.name}
                  type="button"
                  onClick={() => setSelectedRoom(r.name)}
                  className={`px-3 py-1.5 text-xs rounded-md whitespace-nowrap shrink-0 transition-colors ${
                    selectedRoom === r.name
                      ? 'bg-[var(--site-accent)] text-white font-medium'
                      : 'bg-white/10 text-white/75 hover:bg-white/20 hover:text-white'
                  }`}
                >
                  {r.name} <span className="opacity-70 tabular-nums">({r.count})</span>
                </button>
              ))}
            </nav>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setAutoPlay((p) => !p)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                  autoPlay ? 'bg-white text-neutral-950 font-medium' : 'bg-white/10 text-white/85 hover:bg-white/20'
                }`}
              >
                {autoPlay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {autoPlay ? 'Pausar tour' : 'Visita guiada'}
              </button>
              <button
                type="button"
                onClick={() => setCinematicMotion((m) => !m)}
                title="Movimento suave cinematográfico"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md whitespace-nowrap transition-colors ${
                  cinematicMotion ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Movimento</span>
              </button>
              <button
                type="button"
                aria-label="Ampliar zoom"
                onClick={() => setZoomLevel((z) => (z < 1.5 ? 1.5 : 2.2))}
                disabled={zoomLevel >= 2.2}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-md disabled:opacity-40"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Reduzir zoom"
                onClick={() => {
                  if (zoomLevel > 1.5) setZoomLevel(1.5);
                  else resetZoom();
                }}
                disabled={zoomLevel <= 1}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-md disabled:opacity-40"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              {zoomLevel > 1 && (
                <button
                  type="button"
                  aria-label="Resetar enquadramento"
                  onClick={resetZoom}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-md"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* High-Resolution Interactive Stage */}
          <div className="flex-1 min-h-[260px] max-w-7xl mx-auto w-full relative rounded-lg overflow-hidden bg-black border border-white/10 flex items-center justify-center">
            {currentPhoto ? (
              <div
                onMouseDown={handleStageMouseDown}
                onMouseMove={handleStageMouseMove}
                onMouseUp={handleStageMouseUp}
                onMouseLeave={handleStageMouseUp}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onDoubleClick={() => (zoomLevel > 1 ? resetZoom() : setZoomLevel(1.6))}
                className={`relative w-full h-full flex items-center justify-center overflow-hidden ${
                  zoomLevel > 1
                    ? isDraggingPan
                      ? 'cursor-grabbing'
                      : 'cursor-grab'
                    : 'cursor-zoom-in'
                }`}
              >
                <img
                  key={currentPhoto.id || currentPhoto.url}
                  src={currentPhoto.url}
                  alt={currentPhoto.caption || `${property.title} — ${currentPhoto.roomTag || 'Ambiente'}`}
                  referrerPolicy="no-referrer"
                  draggable={false}
                  style={{
                    transform:
                      zoomLevel > 1
                        ? `translate3d(${panOffset.x}px, ${panOffset.y}px, 0) scale(${zoomLevel})`
                        : undefined,
                  }}
                  className={`max-h-full max-w-full object-contain transition-transform duration-300 ease-out animate-tour-fade ${
                    zoomLevel === 1 && cinematicMotion ? 'animate-tour-kenburns' : ''
                  }`}
                />

                {/* Contrast Scrim & Room Info Overlay */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-5 pt-12 pb-4 flex flex-wrap items-end justify-between gap-3">
                  <div className="space-y-1 max-w-2xl">
                    <p className="text-xs font-medium text-white/95">
                      {currentPhoto.roomTag || 'Ambiente'}
                      {zoomLevel > 1 ? ` · Zoom ${zoomLevel.toFixed(1)}x (arraste para explorar)` : ''}
                    </p>
                    {currentPhoto.caption && (
                      <p className="text-xs sm:text-sm text-white/80 leading-snug">
                        {currentPhoto.caption}
                      </p>
                    )}
                  </div>
                  <span className="font-mono text-xs tabular-nums text-white/90 bg-black/50 px-3 py-1 rounded">
                    {photoIdx + 1} / {filteredPhotos.length}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-white/60">Nenhuma fotografia cadastrada para este ambiente.</p>
            )}

            {filteredPhotos.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Fotografia anterior"
                  onClick={goPrev}
                  className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 p-3 bg-black/65 hover:bg-black/90 text-white rounded-full border border-white/15 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  aria-label="Próxima fotografia"
                  onClick={goNext}
                  className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 p-3 bg-black/65 hover:bg-black/90 text-white rounded-full border border-white/15 transition-colors"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>

          {/* Interactive Thumbnails Strip with Room Labels */}
          {filteredPhotos.length > 1 && (
            <div className="max-w-7xl mx-auto w-full flex gap-2.5 overflow-x-auto pb-1">
              {filteredPhotos.map((item, idx) => {
                const active = idx === photoIdx;
                return (
                  <button
                    key={item.id || idx}
                    ref={(el) => {
                      thumbRefs.current[idx] = el;
                    }}
                    type="button"
                    onClick={() => {
                      resetZoom();
                      setPhotoIdx(idx);
                    }}
                    className={`relative w-28 h-[68px] shrink-0 rounded-md overflow-hidden border-2 text-left transition-all ${
                      active
                        ? 'border-[var(--site-accent)] opacity-100 scale-[1.02]'
                        : 'border-white/10 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={item.url}
                      alt={item.roomTag || `Ambiente ${idx + 1}`}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute inset-x-0 bottom-0 px-1.5 py-0.5 text-[10px] bg-black/75 text-white truncate">
                      {item.roomTag || `Foto ${idx + 1}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Real 360° Equirectangular Panorama Viewer (Pannellum) */}
      {mode === 'panorama360' && has360 && (
        <div className="flex-1 min-h-0 relative p-3 sm:p-5 flex flex-col gap-3">
          <div className="relative flex-1 min-h-[340px] w-full max-w-7xl mx-auto rounded-lg overflow-hidden border border-white/15 bg-black">
            {panoError ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                <img
                  src={property.panorama360Images[panoIdx]?.url}
                  alt={property.panorama360Images[panoIdx]?.roomTag || 'Panorama 360°'}
                  referrerPolicy="no-referrer"
                  className="max-h-[60vh] w-auto object-contain rounded"
                />
                <p className="text-xs text-white/75">{panoError}</p>
              </div>
            ) : (
              <div ref={panoContainerRef} className="w-full h-full" />
            )}

            {/* Top-left Panorama Caption */}
            <div className="pointer-events-none absolute top-4 left-4 z-10 px-3.5 py-2 bg-black/70 border border-white/15 rounded-md text-xs space-y-0.5">
              <p className="font-medium text-white">
                {property.panorama360Images[panoIdx]?.roomTag || `Panorama 360° ${panoIdx + 1}`}
              </p>
              {property.panorama360Images[panoIdx]?.caption ? (
                <p className="text-white/75">{property.panorama360Images[panoIdx].caption}</p>
              ) : (
                <p className="text-white/60">Arraste para explorar em 360°</p>
              )}
            </div>

            {/* Bottom Controls Bar */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 max-w-[95%] flex flex-wrap items-center justify-center gap-2 px-3 py-2 bg-neutral-950/90 border border-white/15 rounded-lg backdrop-blur-md">
              {property.panorama360Images.map((p, idx) => (
                <button
                  key={p.id || idx}
                  type="button"
                  onClick={() => setPanoIdx(idx)}
                  className={`px-3 py-1.5 text-xs rounded whitespace-nowrap transition-colors ${
                    idx === panoIdx
                      ? 'bg-white text-neutral-950 font-medium'
                      : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  {p.roomTag || `Ambiente 360° ${idx + 1}`}
                </button>
              ))}
              <span className="text-white/25 hidden sm:inline">|</span>
              <button
                type="button"
                onClick={() => setPanoAutoRotate((r) => !r)}
                title={panoAutoRotate ? 'Pausar rotação automática' : 'Rotação automática 360°'}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs hover:bg-white/10 rounded"
              >
                {panoAutoRotate ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>Girar</span>
              </button>
              <button
                type="button"
                aria-label="Aproximar 360°"
                onClick={() => handlePanoZoom(-15)}
                className="p-1.5 hover:bg-white/10 rounded"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Afastar 360°"
                onClick={() => handlePanoZoom(15)}
                className="p-1.5 hover:bg-white/10 rounded"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Centralizar visão 360°"
                onClick={handlePanoReset}
                className="p-1.5 hover:bg-white/10 rounded"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Optional Volumetric Study */}
      {mode === '3d' && allow3dTab && (
        <div className="flex-1 min-h-0 relative p-3 sm:p-5">
          <div className="relative w-full h-full min-h-[340px] max-w-7xl mx-auto rounded-lg overflow-hidden border border-white/15">
            <div ref={canvas3dRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 max-w-xl px-4 py-2.5 bg-neutral-900/90 border border-white/15 rounded-lg text-center text-xs text-white/80">
              Estudo volumétrico proporcional ({property.builtArea || 160} m² de área construída). Para explorar os ambientes reais do imóvel, utilize o Tour por Ambientes ou Panorama 360°.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
