import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, ZoomIn, ZoomOut, X, Building2 } from 'lucide-react';
import { PropertyMediaItem } from '../../types/realestate';

interface ProGalleryProps {
  images: PropertyMediaItem[];
  title: string;
}

export function ProGallery({ images, title }: ProGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const safeImages = images.length > 0 ? images : [];
  const current = safeImages[activeIndex];

  const goNext = () => {
    if (safeImages.length <= 1) return;
    setZoomed(false);
    setActiveIndex((prev) => (prev + 1) % safeImages.length);
  };

  const goPrev = () => {
    if (safeImages.length <= 1) return;
    setZoomed(false);
    setActiveIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length);
  };

  // Intelligent preloading of adjacent images
  useEffect(() => {
    if (safeImages.length <= 1) return;
    const nextIdx = (activeIndex + 1) % safeImages.length;
    const preload = new Image();
    preload.src = safeImages[nextIdx].url;
  }, [activeIndex, safeImages]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen, safeImages.length]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX;
    if (delta > 45) goPrev();
    if (delta < -45) goNext();
    setTouchStartX(null);
  };

  if (safeImages.length === 0) {
    return (
      <div className="aspect-[16/9] w-full rounded-[var(--site-radius)] border border-[var(--site-border)] bg-[var(--site-surface-alt)] flex flex-col items-center justify-center gap-3 text-[var(--site-text-muted)]">
        <Building2 className="w-10 h-10 opacity-40" />
        <p className="text-sm">Nenhuma fotografia anexada a este imóvel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Viewport */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="relative aspect-[16/9] w-full overflow-hidden rounded-[var(--site-radius)] border border-[var(--site-border)] bg-neutral-950 select-none"
      >
        <img
          src={current.url}
          alt={current.caption || `${title} — ${current.roomTag || 'Foto'}`}
          referrerPolicy="no-referrer"
          className={`w-full h-full transition-transform duration-500 ${
            zoomed ? 'scale-125 object-cover cursor-zoom-out' : 'object-contain cursor-zoom-in'
          }`}
          onClick={() => setZoomed((z) => !z)}
        />

        {current.isAiEnhanced && (
          <div className="absolute top-4 left-4 px-3 py-1 bg-black/75 text-white text-xs rounded-[var(--site-radius)]">
            Imagem com tratamento de iluminação ilustrativo
          </div>
        )}

        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            type="button"
            aria-label={zoomed ? 'Reduzir zoom' : 'Ampliar zoom'}
            onClick={() => setZoomed((z) => !z)}
            className="p-2.5 bg-black/65 text-white rounded-[var(--site-radius)] hover:bg-black/85 transition-colors"
          >
            {zoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
          </button>
          <button
            type="button"
            aria-label="Abrir em tela cheia"
            onClick={() => setFullscreen(true)}
            className="p-2.5 bg-black/65 text-white rounded-[var(--site-radius)] hover:bg-black/85 transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {safeImages.length > 1 && (
          <>
            <button
              type="button"
              aria-label="Fotografia anterior"
              onClick={goPrev}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 text-white rounded-full hover:bg-black/85 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              type="button"
              aria-label="Próxima fotografia"
              onClick={goNext}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/60 text-white rounded-full hover:bg-black/85 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-xs text-white/90 pointer-events-none">
          <span className="px-3 py-1 bg-black/60 rounded-[var(--site-radius)]">
            {current.roomTag || 'Ambiente'}
            {current.caption ? ` · ${current.caption}` : ''}
          </span>
          <span className="px-3 py-1 bg-black/60 rounded-[var(--site-radius)] font-mono tabular-nums">
            {activeIndex + 1} / {safeImages.length}
          </span>
        </div>
      </div>

      {/* Thumbnails Strip */}
      {safeImages.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {safeImages.map((item, idx) => (
            <button
              key={item.id || idx}
              type="button"
              onClick={() => {
                setZoomed(false);
                setActiveIndex(idx);
              }}
              className={`relative w-24 h-16 shrink-0 rounded-[var(--site-radius)] overflow-hidden border-2 transition-all ${
                idx === activeIndex
                  ? 'border-[var(--site-accent)] opacity-100'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
            >
              <img
                src={item.url}
                alt={item.roomTag || `Miniatura ${idx + 1}`}
                loading="lazy"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen Lightbox */}
      {fullscreen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-6">
          <div className="flex items-center justify-between text-white">
            <span className="text-sm font-medium">
              {title} — {current.roomTag || 'Galeria'} ({activeIndex + 1}/{safeImages.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomed((z) => !z)}
                className="p-2.5 bg-white/10 rounded-[var(--site-radius)] hover:bg-white/20"
              >
                {zoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setFullscreen(false)}
                className="p-2.5 bg-white/10 rounded-[var(--site-radius)] hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            className="relative flex-1 flex items-center justify-center overflow-hidden my-4"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            <img
              src={current.url}
              alt={current.caption || title}
              referrerPolicy="no-referrer"
              className={`max-h-full max-w-full object-contain transition-transform duration-300 ${
                zoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
              }`}
              onClick={() => setZoomed((z) => !z)}
            />
            {safeImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={goPrev}
                  className="absolute left-2 p-3 bg-white/10 text-white rounded-full hover:bg-white/25"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="absolute right-2 p-3 bg-white/10 text-white rounded-full hover:bg-white/25"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs text-white/80 hover:text-white"
            >
              <Minimize2 className="w-4 h-4" />
              Fechar tela cheia
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
