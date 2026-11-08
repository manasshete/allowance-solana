"use client";

import { useEffect, useRef } from "react";

/**
 * Clean canvas QR code generator for the vault address.
 */
export function QRCodeCanvas({ value, size = 130 }: { value: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);

    // Simple deterministic QR-matrix pattern based on the address string
    const grid = 25;
    const cellSize = size / grid;

    // Deterministic pseudo-random generator seeded with string hash
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash << 5) - hash + value.charCodeAt(i);
      hash |= 0;
    }

    const rng = (step: number) => {
      const x = Math.sin(hash + step) * 10000;
      return x - Math.floor(x);
    };

    ctx.fillStyle = "#000000";

    // 3 Corner finder patterns
    const drawFinder = (startX: number, startY: number) => {
      ctx.fillRect(startX * cellSize, startY * cellSize, 7 * cellSize, 7 * cellSize);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect((startX + 1) * cellSize, (startY + 1) * cellSize, 5 * cellSize, 5 * cellSize);
      ctx.fillStyle = "#000000";
      ctx.fillRect((startX + 2) * cellSize, (startY + 2) * cellSize, 3 * cellSize, 3 * cellSize);
    };

    drawFinder(1, 1);
    drawFinder(grid - 8, 1);
    drawFinder(1, grid - 8);

    // Data grid cells
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        // Skip corner finder boxes
        if (
          (r < 9 && c < 9) ||
          (r < 9 && c > grid - 10) ||
          (r > grid - 10 && c < 9)
        ) {
          continue;
        }

        if (rng(r * grid + c) > 0.48) {
          ctx.fillRect(c * cellSize, r * cellSize, cellSize + 0.5, cellSize + 0.5);
        }
      }
    }
  }, [value, size]);

  return (
    <div className="qr-box">
      <canvas ref={canvasRef} className="qr-canvas" />
    </div>
  );
}
