/**
 * XR Viewer Stub Component
 * Task 188: XR/VR visualization stubs for future expansion
 */

import { useState } from 'react';
import { Glasses, Box, Maximize2, RotateCcw, Play, Pause } from 'lucide-react';

interface XRViewerProps {
  dataUrl?: string;
  type?: '3d-model' | 'point-cloud' | 'network-graph' | 'data-viz';
  title?: string;
}

export function XRViewer({ dataUrl, type = '3d-model', title }: XRViewerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [rotation, setRotation] = useState(0);

  const handlePlay = () => {
    setIsPlaying(!isPlaying);
    if (!isPlaying) {
      const interval = setInterval(() => {
        setRotation((r) => (r + 1) % 360);
      }, 50);
      return () => clearInterval(interval);
    }
  };

  const handleReset = () => {
    setRotation(0);
    setIsPlaying(false);
  };

  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Glasses className="w-5 h-5 text-primary" />
          <span className="font-medium">{title || 'XR Viewer'}</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            Stub Mode
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlay}
            className="p-2 hover:bg-muted rounded"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
          <button
            onClick={handleReset}
            className="p-2 hover:bg-muted rounded"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            className="p-2 hover:bg-muted rounded"
            title="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative aspect-video bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        {/* Placeholder 3D visualization */}
        <div
          className="relative w-32 h-32"
          style={{ transform: `rotateY(${rotation}deg)`, transformStyle: 'preserve-3d' }}
        >
          <Box className="w-full h-full text-primary/50" strokeWidth={1} />
          <div
            className="absolute inset-0 border-2 border-primary/30 rounded"
            style={{ transform: 'translateZ(20px)' }}
          />
        </div>

        {/* Overlay message */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center text-white p-4">
            <Glasses className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="font-medium">XR Visualization</p>
            <p className="text-sm opacity-75 mt-1">
              WebXR support coming in a future release
            </p>
            <p className="text-xs opacity-50 mt-2">
              Type: {type}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-muted/50">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="text-muted-foreground">
              Rotation: {rotation}°
            </span>
            <span className="text-muted-foreground">
              Status: {isPlaying ? 'Playing' : 'Paused'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 bg-primary text-primary-foreground rounded text-sm opacity-50 cursor-not-allowed">
              Enter VR
            </button>
            <button className="px-3 py-1 bg-muted rounded text-sm opacity-50 cursor-not-allowed">
              Enter AR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Check if WebXR is supported
 */
export function isXRSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return 'xr' in navigator;
}

/**
 * Stub XR session types
 */
export type XRSessionType = 'immersive-vr' | 'immersive-ar' | 'inline';

/**
 * Request XR session (stub)
 */
export async function requestXRSession(type: XRSessionType): Promise<null> {
  console.log(`[XR Stub] Session requested: ${type}`);
  console.log('[XR Stub] XR features are not yet implemented');
  return null;
}

/**
 * XR Data Visualization Component (stub)
 */
export function XRDataVisualization({
  data,
  title,
}: {
  data: unknown;
  title?: string;
}) {
  return (
    <XRViewer
      type="data-viz"
      title={title || 'Data Visualization'}
    />
  );
}

/**
 * XR Network Graph Component (stub)
 */
export function XRNetworkGraph({
  nodes,
  edges,
  title,
}: {
  nodes: { id: string; label: string }[];
  edges: { source: string; target: string }[];
  title?: string;
}) {
  return (
    <div className="bg-card border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Glasses className="w-5 h-5 text-primary" />
        <span className="font-medium">{title || 'Network Graph'}</span>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          Stub Mode
        </span>
      </div>
      <div className="bg-muted rounded p-8 text-center">
        <p className="text-muted-foreground">
          3D Network visualization will render {nodes.length} nodes and {edges.length} edges
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          WebXR support coming in a future release
        </p>
      </div>
    </div>
  );
}
