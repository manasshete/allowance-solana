"use client";

import "./three-d.css";
import { useEffect, useRef, useState } from "react";

export function Hero3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const size = 380;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    // Interactive rotation states
    let rotX = 0.35;
    let rotY = -0.4;
    let velX = 0;
    let velY = 0.008;
    let isDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      velY = dx * 0.005;
      velX = dy * 0.005;
      rotY += velY;
      rotX += velX;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        lastMouseX = e.touches[0].clientX;
        lastMouseY = e.touches[0].clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - lastMouseX;
      const dy = e.touches[0].clientY - lastMouseY;
      velY = dx * 0.005;
      velX = dy * 0.005;
      rotY += velY;
      rotX += velX;
      lastMouseX = e.touches[0].clientX;
      lastMouseY = e.touches[0].clientY;
    };

    const onTouchEnd = () => {
      isDragging = false;
    };

    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);

    // 3D Ring definition
    const rings = [
      { radius: 130, width: 2.5, color: "#9945FF", tilt: 0.4, speed: 0.015, dots: 8 },
      { radius: 105, width: 2, color: "#14F195", tilt: -0.5, speed: -0.02, dots: 6 },
      { radius: 80, width: 1.5, color: "#ca9ff5", tilt: 0.8, speed: 0.025, dots: 4 },
    ];

    // 3D Shield / Cube core vertices
    const coreSize = 42;
    const coreVertices = [
      [-1, -1, -1],
      [1, -1, -1],
      [1, 1, -1],
      [-1, 1, -1],
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ].map(([x, y, z]) => ({ x: x * coreSize, y: y * coreSize, z: z * coreSize }));

    const coreEdges = [
      [0, 1], [1, 2], [2, 3], [3, 0], // back face
      [4, 5], [5, 6], [6, 7], [7, 4], // front face
      [0, 4], [1, 5], [2, 6], [3, 7], // cross edges
    ];

    let t = 0;
    const fov = 400;
    const cx = size / 2;
    const cy = size / 2;

    const render = () => {
      ctx.clearRect(0, 0, size, size);

      if (!isDragging) {
        rotY += velY;
        rotX += velX;
        velY += (0.006 - velY) * 0.05;
        velX *= 0.95;
      }
      t += 0.02;

      // Outer radial glow
      const glow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 170);
      glow.addColorStop(0, "rgba(153, 69, 255, 0.25)");
      glow.addColorStop(0.5, "rgba(20, 241, 149, 0.12)");
      glow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 170, 0, Math.PI * 2);
      ctx.fill();

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      // Render 3D Rings
      rings.forEach((r, idx) => {
        const ringAngle = t * r.speed;
        const totalPoints = 64;
        const pts: { x: number; y: number; z: number }[] = [];

        for (let i = 0; i < totalPoints; i++) {
          const theta = (i / totalPoints) * Math.PI * 2 + ringAngle;
          // Initial ring on XZ plane with individual tilt
          const rx = Math.cos(theta) * r.radius;
          const rz = Math.sin(theta) * r.radius;
          const ry = Math.sin(theta) * Math.sin(r.tilt) * (r.radius * 0.4);

          // Apply master 3D orientation
          const x1 = rx * cosY - rz * sinY;
          const z1 = rz * cosY + rx * sinY;
          const y1 = ry * cosX - z1 * sinX;
          const z2 = z1 * cosX + ry * sinX;

          const depth = z2 + 350;
          const scale = fov / Math.max(depth, 50);
          pts.push({
            x: x1 * scale + cx,
            y: y1 * scale + cy,
            z: z2,
          });
        }

        // Draw ring path
        ctx.beginPath();
        for (let i = 0; i < pts.length; i++) {
          if (i === 0) ctx.moveTo(pts[i].x, pts[i].y);
          else ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width;
        ctx.shadowBlur = 12;
        ctx.shadowColor = r.color;
        ctx.globalAlpha = 0.75;
        ctx.stroke();

        // Draw orbiting 3D energy nodes along this ring
        for (let d = 0; d < r.dots; d++) {
          const ptIdx = Math.floor(((d / r.dots) * totalPoints + Math.floor(t * 10 * (idx + 1))) % totalPoints);
          const dotPt = pts[ptIdx];
          if (dotPt) {
            ctx.beginPath();
            ctx.arc(dotPt.x, dotPt.y, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = idx === 1 ? "#14F195" : "#ffffff";
            ctx.shadowBlur = 15;
            ctx.shadowColor = "#14F195";
            ctx.fill();
          }
        }
      });

      // Render 3D Vault Core Cube (Pulsing Shield)
      const pulse = Math.sin(t * 2) * 4;
      const projectedCore = coreVertices.map((v) => {
        const factor = (coreSize + pulse) / coreSize;
        const vx = v.x * factor;
        const vy = v.y * factor;
        const vz = v.z * factor;

        // Rotate core with slightly faster dynamic spin
        const cCos = Math.cos(t * 0.8);
        const cSin = Math.sin(t * 0.8);
        const rx = vx * cCos - vz * cSin;
        const rz = vz * cCos + vx * cSin;

        // Master rotation
        const x1 = rx * cosY - rz * sinY;
        const z1 = rz * cosY + rx * sinY;
        const y1 = vy * cosX - z1 * sinX;
        const z2 = z1 * cosX + vy * sinX;

        const depth = z2 + 350;
        const scale = fov / Math.max(depth, 50);
        return {
          x: x1 * scale + cx,
          y: y1 * scale + cy,
          z: z2,
        };
      });

      // Core Edges with Solana neon ramp
      coreEdges.forEach(([i, j]) => {
        const v1 = projectedCore[i];
        const v2 = projectedCore[j];
        if (v1 && v2) {
          const grad = ctx.createLinearGradient(v1.x, v1.y, v2.x, v2.y);
          grad.addColorStop(0, "#9945FF");
          grad.addColorStop(1, "#14F195");
          ctx.beginPath();
          ctx.moveTo(v1.x, v1.y);
          ctx.lineTo(v2.x, v2.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 2.2;
          ctx.shadowBlur = 18;
          ctx.shadowColor = "#9945FF";
          ctx.globalAlpha = 0.95;
          ctx.stroke();
        }
      });

      // Glowing Center Token Icon
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.shadowBlur = 25;
      ctx.shadowColor = "#14F195";
      ctx.globalAlpha = 0.9;
      ctx.fill();

      // Solana S logo shape in center
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#000000";
      ctx.fillRect(cx - 7, cy - 6, 14, 3);
      ctx.fillRect(cx - 5, cy - 1, 12, 3);
      ctx.fillRect(cx - 7, cy + 4, 14, 3);

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      className="hero-3d-wrap"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title="Interactive 3D Spending Firewall - Click & drag to rotate"
    >
      <canvas ref={canvasRef} className="hero-3d-canvas" />
      <div className={`hero-3d-badge ${isHovered ? "is-active" : ""}`}>
        <span className="hero-3d-badge__dot" />
        <span>3D Firewall Active · Solana Devnet</span>
      </div>
      <span className="hero-3d-hint">Drag to inspect 3D shield</span>
    </div>
  );
}
