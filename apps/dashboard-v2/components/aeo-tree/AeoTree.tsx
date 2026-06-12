'use client';

import { useEffect, useRef } from 'react';

import {
  createAeoTreeEngine,
  type AeoTreeEngine,
} from './aeo-tree-engine';

interface AeoTreeProps {
  /** Number of passing checks (0 – totalChecks). */
  score: number;
  /** Total number of checks; controls branch count. Defaults to 26. */
  totalChecks?: number;
  /** Seed for the procedural generator. Change to get a different tree shape. */
  seed?: number;
  /** Tailwind / custom className for the canvas element (use for sizing). */
  className?: string;
}

export function AeoTree({
  score,
  totalChecks = 26,
  seed = 1118,
  className,
}: AeoTreeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<AeoTreeEngine | null>(null);

  // Mount/unmount the engine when config changes (totalChecks or seed).
  // The canvas element itself is stable across score changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createAeoTreeEngine({ canvas, totalChecks, seed });
    engineRef.current = engine;

    return () => {
      engine.destroy();
      engineRef.current = null;
    };
  }, [totalChecks, seed]);

  // Drive the tree state from the score prop.
  useEffect(() => {
    engineRef.current?.applyScore(score);
  }, [score]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      role="img"
      aria-label={`AEO/GEO readiness tree: ${score} of ${totalChecks} checks passing`}
    />
  );
}
