"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface ImageGalleryProps {
  images: { id: string; url: string }[];
  title: string;
}

export default function ImageGallery({ images, title }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lightboxOpen) return;

    const previousOverflow = document.body.style.overflow;
    const triggerButton = triggerButtonRef.current;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLightboxOpen(false);
      } else if (event.key === "ArrowLeft" && images.length > 1) {
        setCurrentIndex((previous) => (previous === 0 ? images.length - 1 : previous - 1));
      } else if (event.key === "ArrowRight" && images.length > 1) {
        setCurrentIndex((previous) => (previous === images.length - 1 ? 0 : previous + 1));
      } else if (event.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll<HTMLButtonElement>(
          "button:not([disabled])"
        );
        if (!controls?.length) return;

        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerButton?.focus();
    };
  }, [images.length, lightboxOpen]);

  if (images.length === 0) {
    return (
      <div
        className="aspect-[16/9] rounded-xl flex items-center justify-center"
        style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}
      >
        <span style={{ color: "var(--text-muted)" }}>Sem imagens</span>
      </div>
    );
  }

  return (
    <>
      {/* Main Image */}
      <div className="space-y-3">
        <div className="relative aspect-[16/9] rounded-xl overflow-hidden group">
          <button
            ref={triggerButtonRef}
            type="button"
            className="absolute inset-0 block h-full w-full cursor-zoom-in"
            onClick={() => setLightboxOpen(true)}
            aria-label={`Abrir galeria de ${title}, foto ${currentIndex + 1} de ${images.length}`}
          >
            <Image
              src={images[currentIndex].url}
              alt={`${title} — Foto ${currentIndex + 1}`}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 1024px) 100vw, 60vw"
              preload
            />
            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" aria-hidden="true" />
          </button>

          {/* Nav arrows */}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-sm shadow-lg transition-all hover:scale-110"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 dark:bg-black/50 backdrop-blur-sm shadow-lg transition-all hover:scale-110"
                aria-label="Próxima foto"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Counter */}
          <div className="absolute bottom-3 right-3 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
            {currentIndex + 1} / {images.length}
          </div>
        </div>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, idx) => (
              <button
                type="button"
                key={img.id}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Mostrar foto ${idx + 1} de ${images.length}`}
                aria-pressed={idx === currentIndex}
                className={`gallery-thumb relative w-20 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                  idx === currentIndex
                    ? "active opacity-100"
                    : "border-transparent opacity-60 hover:opacity-90"
                }`}
                style={idx === currentIndex ? { borderColor: "#0F172A" } : {}}
              >
                <Image
                  src={img.url}
                  alt={`${title} — Miniatura ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center animate-fade-in"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Galeria de imagens de ${title}`}
        >
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            aria-label="Fechar"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="relative w-full h-full max-w-5xl max-h-[85vh] m-4" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[currentIndex].url}
              alt={`${title} — Foto ${currentIndex + 1}`}
              fill
              className="object-contain"
              sizes="100vw"
            />
          </div>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Foto anterior"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                aria-label="Próxima foto"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            </>
          )}

          <div aria-live="polite" className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </>
  );
}
