/**
 * Image Optimization Utilities (PERF-005)
 *
 * Provides utilities for:
 * - Lazy loading wrapper component
 * - WebP format detection and fallback
 * - Responsive image srcset generation
 * - Image placeholder generation
 * - Performance metrics
 */

/**
 * Image optimization options
 */
export interface ImageOptimizationOptions {
  // Maximum image width for srcset
  maxWidth?: number;
  // Image quality for compression (0-100)
  quality?: number;
  // Enable WebP format
  enableWebP?: boolean;
  // Enable lazy loading
  lazyLoad?: boolean;
  // Placeholder strategy
  placeholder?: 'blur' | 'color' | 'dominant' | 'none';
  // Alternative text
  alt?: string;
  // CSS class name
  className?: string;
  // Loading callback
  onLoad?: (event: Event) => void;
  // Error callback
  onError?: (event: Event) => void;
}

/**
 * Detect WebP support in current browser
 */
export function supportsWebP(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
  } catch {
    return false;
  }
}

/**
 * Memoized WebP support (cached)
 */
const webpSupport = typeof window !== 'undefined' ? supportsWebP() : false;

/**
 * Generate responsive image srcset with multiple resolutions
 * @param basePath - Base image path (without extension)
 * @param widths - Array of image widths to generate
 * @param format - Image format ('webp', 'jpg', 'png')
 * @returns srcset string for use in img element
 */
export function generateImageSrcSet(
  basePath: string,
  widths: number[] = [320, 640, 1024, 1280, 1920],
  format: 'webp' | 'jpg' | 'png' = 'jpg'
): string {
  return widths
    .map((width) => {
      // For WebP, use .webp extension; otherwise use provided format
      const ext = format === 'webp' ? '.webp' : `.${format}`;
      return `${basePath}-${width}w${ext} ${width}w`;
    })
    .join(', ');
}

/**
 * Generate image srcset with WebP fallback
 * @param basePath - Base image path (without extension)
 * @param widths - Array of image widths to generate
 * @returns Object with webp and fallback srcsets
 */
export function generateImageSrcSetWithFallback(
  basePath: string,
  widths: number[] = [320, 640, 1024, 1280, 1920]
): { webp: string; fallback: string } {
  return {
    webp: generateImageSrcSet(basePath, widths, 'webp'),
    fallback: generateImageSrcSet(basePath, widths, 'jpg'),
  };
}

/**
 * Generate HTML picture element markup with responsive images and WebP fallback
 * @param basePath - Base image path
 * @param alt - Alt text
 * @param widths - Array of widths for srcset
 * @returns HTML picture element string
 */
export function generatePictureElement(
  basePath: string,
  alt: string = 'Image',
  widths: number[] = [320, 640, 1024, 1280, 1920]
): string {
  const { webp, fallback } = generateImageSrcSetWithFallback(basePath, widths);

  return `
    <picture>
      <source srcset="${webp}" type="image/webp">
      <img src="${basePath}-640w.jpg" srcset="${fallback}" alt="${alt}" loading="lazy">
    </picture>
  `;
}

/**
 * Generate a dominant color placeholder from image
 * Uses a minimal data URL
 */
export function generateColorPlaceholder(color: string): string {
  // Create a minimal SVG placeholder with the dominant color
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1" fill="${color}"/></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * Generate a blur placeholder using LQIP (Low Quality Image Placeholder)
 * This creates a tiny blurred version of the image
 */
export function generateBlurPlaceholder(
  basePath: string,
  width: number = 10,
  height: number = 10
): string {
  // Return a tiny low-quality version that can be displayed as blur
  // In production, you'd generate this server-side
  return `${basePath}-blur.jpg`;
}

/**
 * Image responsive object for React/Vue components
 */
export interface ResponsiveImage {
  src: string;
  srcSet: string;
  webpSrcSet?: string;
  alt: string;
  width?: number;
  height?: number;
  placeholder?: string;
  sizes?: string;
}

/**
 * Generate responsive image object
 * @param basePath - Base image path
 * @param alt - Alt text
 * @param options - Additional options
 * @returns ResponsiveImage object
 */
export function generateResponsiveImage(
  basePath: string,
  alt: string = 'Image',
  options: Partial<ImageOptimizationOptions> = {}
): ResponsiveImage {
  const {
    maxWidth = 1920,
    enableWebP = webpSupport,
    placeholder = 'blur',
  } = options;

  const widths = [320, 640, 1024, Math.min(1280, maxWidth), Math.min(1920, maxWidth)].filter(
    (w) => w <= maxWidth
  );

  const { webp, fallback } = generateImageSrcSetWithFallback(basePath, widths);

  let placeholderUrl: string | undefined;
  if (placeholder === 'blur') {
    placeholderUrl = generateBlurPlaceholder(basePath);
  } else if (placeholder === 'color') {
    placeholderUrl = generateColorPlaceholder('#e0e0e0');
  }

  return {
    src: `${basePath}-640w.jpg`,
    srcSet: fallback,
    ...(enableWebP && { webpSrcSet: webp }),
    alt,
    placeholder: placeholderUrl,
    // Responsive sizes: adjust based on typical layout
    sizes: '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
  };
}

/**
 * Image lazy loading implementation for React
 * This can be used as a hook or utility
 */
export function useImageIntersectionObserver(
  ref: React.RefObject<HTMLImageElement>,
  options: { rootMargin?: string; threshold?: number | number[] } = {}
): void {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return;
  }

  React.useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;

            // Load from data-src to actual src
            if (img.dataset.src) {
              img.src = img.dataset.src;
            }

            // Load WebP srcset if available
            if (img.dataset.srcset) {
              img.srcset = img.dataset.srcset;
            }

            // Remove data attributes
            img.removeAttribute('data-src');
            img.removeAttribute('data-srcset');

            observer.unobserve(img);
          }
        });
      },
      {
        rootMargin: options.rootMargin || '50px',
        threshold: options.threshold || 0.01,
      }
    );

    observer.observe(ref.current);

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [ref, options]);
}

/**
 * Lazy Loading Image Component Props
 */
export interface LazyImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcSet'> {
  src: string;
  srcSet?: string;
  webpSrcSet?: string;
  placeholder?: string;
  onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
  onError?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}

/**
 * Lazy Loading Image Component
 * Loads images on-demand using Intersection Observer API
 *
 * Usage:
 * <LazyImage
 *   src="image.jpg"
 *   srcSet={srcset}
 *   placeholder={placeholderUrl}
 *   alt="Description"
 * />
 */
export const LazyImage = React.forwardRef<HTMLImageElement, LazyImageProps>(
  ({ src, srcSet, webpSrcSet, placeholder, onLoad, onError, ...props }, ref) => {
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [imageSrc, setImageSrc] = React.useState(placeholder || src);
    const imgRef = React.useRef<HTMLImageElement>(null);

    // Use provided ref or internal ref
    const finalRef = ref || imgRef;

    // Set up intersection observer for lazy loading
    useImageIntersectionObserver(finalRef as React.RefObject<HTMLImageElement>);

    const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
      setIsLoaded(true);
      setImageSrc(src);
      onLoad?.(event);
    };

    const handleError = (event: React.SyntheticEvent<HTMLImageElement>) => {
      console.warn(`Failed to load image: ${src}`);
      onError?.(event);
    };

    return (
      <picture>
        {/* WebP source for better compression */}
        {webpSrcSet && <source srcSet={webpSrcSet} type="image/webp" />}

        {/* Main image element */}
        <img
          ref={finalRef}
          // Use data-src for lazy loading, src for immediate loading
          data-src={src}
          src={placeholder || src}
          data-srcset={srcSet}
          srcSet={isLoaded ? srcSet : undefined}
          onLoad={handleLoad}
          onError={handleError}
          // Add loaded state class for CSS animations
          className={`${props.className || ''} ${isLoaded ? 'loaded' : 'loading'}`}
          {...props}
        />
      </picture>
    );
  }
);

LazyImage.displayName = 'LazyImage';

/**
 * Image Placeholder Component
 * Displays while image is loading
 */
export interface ImagePlaceholderProps {
  width?: number | string;
  height?: number | string;
  backgroundColor?: string;
  className?: string;
}

export const ImagePlaceholder = React.forwardRef<HTMLDivElement, ImagePlaceholderProps>(
  ({ width = 400, height = 300, backgroundColor = '#e0e0e0', className }, ref) => {
    return (
      <div
        ref={ref}
        className={`image-placeholder ${className || ''}`}
        style={{
          width: typeof width === 'number' ? `${width}px` : width,
          height: typeof height === 'number' ? `${height}px` : height,
          backgroundColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      >
        <div style={{ fontSize: '12px', color: '#999' }}>Loading image...</div>
      </div>
    );
  }
);

ImagePlaceholder.displayName = 'ImagePlaceholder';

/**
 * Responsive Image Component with Progressive Loading
 */
export interface ProgressiveImageProps extends LazyImageProps {
  placeholderColor?: string;
  showPlaceholder?: boolean;
  aspectRatio?: number;
}

export const ProgressiveImage = React.forwardRef<HTMLImageElement, ProgressiveImageProps>(
  (
    {
      src,
      srcSet,
      webpSrcSet,
      placeholder,
      placeholderColor = '#e0e0e0',
      showPlaceholder = true,
      aspectRatio = 16 / 9,
      ...props
    },
    ref
  ) => {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = React.useState(true);

    return (
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          paddingBottom: `${(1 / aspectRatio) * 100}%`,
          overflow: 'hidden',
          backgroundColor: placeholderColor,
        }}
      >
        {isLoading && showPlaceholder && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: placeholderColor,
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
            }}
          />
        )}

        <LazyImage
          ref={ref}
          src={src}
          srcSet={srcSet}
          webpSrcSet={webpSrcSet}
          placeholder={placeholder}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          onLoad={() => {
            setIsLoading(false);
            props.onLoad?.({} as any);
          }}
          {...props}
        />
      </div>
    );
  }
);

ProgressiveImage.displayName = 'ProgressiveImage';

/**
 * Image optimization metrics and monitoring
 */
export interface ImageMetrics {
  totalImages: number;
  lazyLoadedImages: number;
  webpImages: number;
  averageLoadTime: number;
  totalBytesLoaded: number;
}

export class ImageMetricsCollector {
  private metrics: ImageMetrics = {
    totalImages: 0,
    lazyLoadedImages: 0,
    webpImages: 0,
    averageLoadTime: 0,
    totalBytesLoaded: 0,
  };

  private loadTimes: number[] = [];

  recordImageLoad(loadTime: number, size: number, isLazy: boolean = false, isWebP: boolean = false): void {
    this.metrics.totalImages++;
    this.metrics.totalBytesLoaded += size;

    if (isLazy) {
      this.metrics.lazyLoadedImages++;
    }

    if (isWebP) {
      this.metrics.webpImages++;
    }

    this.loadTimes.push(loadTime);
    this.metrics.averageLoadTime =
      this.loadTimes.reduce((a, b) => a + b, 0) / this.loadTimes.length;
  }

  getMetrics(): ImageMetrics {
    return {
      ...this.metrics,
      lazyLoadPercentage: (this.metrics.lazyLoadedImages / this.metrics.totalImages) * 100,
      webpPercentage: (this.metrics.webpImages / this.metrics.totalImages) * 100,
    };
  }

  reset(): void {
    this.metrics = {
      totalImages: 0,
      lazyLoadedImages: 0,
      webpImages: 0,
      averageLoadTime: 0,
      totalBytesLoaded: 0,
    };
    this.loadTimes = [];
  }
}

/**
 * Global metrics collector instance
 */
export const imageMetrics = new ImageMetricsCollector();

// Import React (this file assumes React is available)
import React from 'react';

export default {
  supportsWebP,
  generateImageSrcSet,
  generateImageSrcSetWithFallback,
  generatePictureElement,
  generateColorPlaceholder,
  generateBlurPlaceholder,
  generateResponsiveImage,
  useImageIntersectionObserver,
  LazyImage,
  ImagePlaceholder,
  ProgressiveImage,
  ImageMetricsCollector,
  imageMetrics,
};
