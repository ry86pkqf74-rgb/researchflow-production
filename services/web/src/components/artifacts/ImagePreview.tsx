/**
 * ART-003: Image Preview with Zoom Component
 * Support PNG, JPG, SVG
 * Pinch-to-zoom, fit to window
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  maxHeight?: string;
  className?: string;
  onDownload?: () => void;
}

export function ImagePreview({
  src,
  alt = 'Preview',
  maxHeight = 'max-h-96',
  className,
  onDownload,
}: ImagePreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const minZoom = 25;
  const maxZoom = 400;
  const zoomStep = 25;

  // Handle wheel zoom
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) return;

      e.preventDefault();
      setZoom((prev) => {
        const direction = e.deltaY > 0 ? -1 : 1;
        const newZoom = prev + direction * zoomStep;
        return Math.max(minZoom, Math.min(maxZoom, newZoom));
      });
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, []);

  // Handle pinch zoom
  useEffect(() => {
    let lastDistance = 0;

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;

      const [touch1, touch2] = e.touches;
      const distance = Math.hypot(
        touch1.clientX - touch2.clientX,
        touch1.clientY - touch2.clientY
      );

      if (lastDistance === 0) {
        lastDistance = distance;
        return;
      }

      const delta = distance - lastDistance;
      setZoom((prev) => {
        const newZoom = prev + (delta > 0 ? zoomStep : -zoomStep);
        return Math.max(minZoom, Math.min(maxZoom, newZoom));
      });

      lastDistance = distance;
    };

    const handleTouchEnd = () => {
      lastDistance = 0;
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('touchmove', handleTouchMove, { passive: true });
      container.addEventListener('touchend', handleTouchEnd);
      return () => {
        container.removeEventListener('touchmove', handleTouchMove);
        container.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, []);

  const handleZoom = (direction: 'in' | 'out') => {
    setZoom((prev) => {
      const newZoom = prev + (direction === 'in' ? zoomStep : -zoomStep);
      return Math.max(minZoom, Math.min(maxZoom, newZoom));
    });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleFitWindow = () => {
    setZoom(100);
    setRotation(0);
  };

  const PreviewContent = (
    <div
      ref={containerRef}
      className={cn(
        'relative flex items-center justify-center overflow-auto rounded-lg bg-muted',
        isFullscreen ? 'fixed inset-0 z-50' : maxHeight
      )}
    >
      <img
        ref={imageRef}
        src={src}
        alt={alt}
        style={{
          transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
          transition: 'transform 0.1s ease-out',
        }}
        className="max-w-full max-h-full object-contain"
      />
    </div>
  );

  const Controls = (
    <div className="flex items-center justify-center gap-2 flex-wrap p-2 border-t">
      <Button
        variant="outline"
        size="sm"
        onClick={() => handleZoom('out')}
        disabled={zoom <= minZoom}
      >
        <ZoomOut className="h-4 w-4" />
      </Button>

      <span className="text-sm font-medium w-12 text-center">{zoom}%</span>

      <Button
        variant="outline"
        size="sm"
        onClick={() => handleZoom('in')}
        disabled={zoom >= maxZoom}
      >
        <ZoomIn className="h-4 w-4" />
      </Button>

      <div className="border-r h-6" />

      <Button
        variant="outline"
        size="sm"
        onClick={handleRotate}
        title="Rotate 90 degrees"
      >
        <RotateCw className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={handleFitWindow}
        title="Fit to window"
      >
        <Maximize2 className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className={cn('space-y-2', className)}>
      {isFullscreen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
          {PreviewContent}
          <div className="flex items-center justify-between p-4">
            <h2 className="text-white">{alt}</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(false)}
              className="text-white"
            >
              <Minimize2 className="h-4 w-4" />
            </Button>
          </div>
          {Controls}
        </div>
      )}

      {!isFullscreen && (
        <>
          {PreviewContent}
          {Controls}
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsFullscreen(true)}
              className="flex-1"
            >
              <Maximize2 className="h-4 w-4 mr-2" />
              Fullscreen
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export default ImagePreview;
