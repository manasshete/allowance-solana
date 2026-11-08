"use client";

import "./three-d.css";
import { useEffect, useRef } from "react";

type Point3D = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
};

export function Scene3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    // Mouse parallax tracking
    let targetRotX = 0;
    let targetRotY = 0;
    let rotX = 0;
    let rotY = 0;

    const onMouseMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1;
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      targetRotY = nx * 0.35;
      targetRotX = -ny * 0.35;
    };
    window.addEventListener("mousemove", onMouseMove);

    // Generate 3D Star/Particle field
    const particleCount = 75;
    const particles: Point3D[] = [];
    const colors = ["#9945FF", "#14F195", "#ca9ff5", "#55e9ab", "#80ecff"];

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: (Math.random() - 0.5) * 1600,
        y: (Math.random() - 0.5) * 1200,
        z: (Math.random() - 0.5) * 1000,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        vz: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    // 3D Wireframe Icosahedron definition
    const phi = (1 + Math.sqrt(5)) / 2;
    const rawVertices = [
      [-1, phi, 0],
      [1, phi, 0],
      [-1, -phi, 0],
      [1, -phi, 0],
      [0, -1, phi],
      [0, 1, phi],
      [0, -1, -phi],
      [0, 1, -phi],
      [phi, 0, -1],
      [phi, 0, 1],
      [-phi, 0, -1],
      [-phi, 0, 1],
    ].map(([x, y, z]) => {
      const mag = Math.hypot(x, y, z);
      return { x: (x / mag) * 180, y: (y / mag) * 180, z: (z / mag) * 180 };
    });

    // Edges between vertices
    const edges: [number, number][] = [];
    for (let i = 0; i < rawVertices.length; i++) {
      for (let j = i + 1; j < rawVertices.length; j++) {
        const d = Math.hypot(
          rawVertices[i].x - rawVertices[j].x,
          rawVertices[i].y - rawVertices[j].y,
          rawVertices[i].z - rawVertices[j].z,
        );
        // Normalized icosahedron edge distance is ~189
        if (d < 210) {
          edges.push([i, j]);
        }
      }
    }

    let globalAngle = 0;
    const fov = 700;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Smooth camera dampening
      rotX += (targetRotX - rotX) * 0.05;
      rotY += (targetRotY - rotY) * 0.05;
      globalAngle += 0.005;

      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);

      // Render 3D Background Particles
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Boundary wrap
        if (p.x > 800) p.x = -800;
        if (p.x < -800) p.x = 800;
        if (p.y > 600) p.y = -600;
        if (p.y < -600) p.y = 600;
        if (p.z > 500) p.z = -500;
        if (p.z < -500) p.z = 500;

        // Apply mouse rotation
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.z * cosY + p.x * sinY;
        const y1 = p.y * cosX - z1 * sinX;
        const z2 = z1 * cosX + p.y * sinX;

        const depth = z2 + 750;
        if (depth > 50) {
          const scale = fov / depth;
          const px = x1 * scale + width / 2;
          const py = y1 * scale + height / 2;

          const alpha = Math.min(1, Math.max(0.1, (depth - 100) / 800));
          ctx.beginPath();
          ctx.arc(px, py, p.size * scale, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = alpha * 0.6;
          ctx.shadowBlur = 10;
          ctx.shadowColor = p.color;
          ctx.fill();
        }
      }

      // Draw subtle connecting 3D laser lines between nearest particles
      ctx.shadowBlur = 0;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < Math.min(i + 4, particles.length); j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z);
          if (dist < 180) {
            const z1 = p1.z * cosY + p1.x * sinY + 750;
            const z2 = p2.z * cosY + p2.x * sinY + 750;
            if (z1 > 50 && z2 > 50) {
              const s1 = fov / z1;
              const s2 = fov / z2;
              const px1 = (p1.x * cosY - p1.z * sinY) * s1 + width / 2;
              const py1 = (p1.y * cosX - (p1.z * cosY + p1.x * sinY) * sinX) * s1 + height / 2;
              const px2 = (p2.x * cosY - p2.z * sinY) * s2 + width / 2;
              const py2 = (p2.y * cosX - (p2.z * cosY + p2.x * sinY) * sinX) * s2 + height / 2;

              ctx.beginPath();
              ctx.moveTo(px1, py1);
              ctx.lineTo(px2, py2);
              ctx.strokeStyle = "#9945FF";
              ctx.globalAlpha = (1 - dist / 180) * 0.15;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
      }

      // Render Floating 3D Geometric Crystal (top right background accent)
      const crystalCenterX = width > 900 ? width * 0.32 : width * 0.2;
      const crystalCenterY = -height * 0.15;
      const cCos = Math.cos(globalAngle);
      const cSin = Math.sin(globalAngle);
      const cCos2 = Math.cos(globalAngle * 0.7);
      const cSin2 = Math.sin(globalAngle * 0.7);

      const projectedVertices = rawVertices.map((v) => {
        // Rotate around Y and X
        const rx = v.x * cCos - v.z * cSin;
        const rz = v.z * cCos + v.x * cSin;
        const ry = v.y * cCos2 - rz * cSin2;
        const rz2 = rz * cCos2 + v.y * cSin2;

        // Apply mouse tilt
        const fx = rx * cosY - rz2 * sinY;
        const fz = rz2 * cosY + rx * sinY;
        const fy = ry * cosX - fz * sinX;
        const fz2 = fz * cosX + ry * sinX;

        const depth = fz2 + 700;
        const scale = fov / depth;
        return {
          x: fx * scale + width / 2 + crystalCenterX,
          y: fy * scale + height / 2 + crystalCenterY,
          depth,
        };
      });

      // Draw crystal wireframe edges
      for (const [i, j] of edges) {
        const v1 = projectedVertices[i];
        const v2 = projectedVertices[j];
        if (v1 && v2 && v1.depth > 50 && v2.depth > 50) {
          const grad = ctx.createLinearGradient(v1.x, v1.y, v2.x, v2.y);
          grad.addColorStop(0, "rgba(153, 69, 255, 0.4)");
          grad.addColorStop(1, "rgba(20, 241, 149, 0.4)");

          ctx.beginPath();
          ctx.moveTo(v1.x, v1.y);
          ctx.lineTo(v2.x, v2.y);
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.2;
          ctx.globalAlpha = 0.55;
          ctx.shadowBlur = 8;
          ctx.shadowColor = "#9945FF";
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="scene-3d-canvas"
      aria-hidden="true"
    />
  );
}
