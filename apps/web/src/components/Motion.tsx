"use client";

import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from "react";

/**
 * One small runtime for the whole site's motion, so pages (server or client) only add attributes:
 *  - [data-reveal]       fades/slides/unblurs in when it scrolls into view (children of [data-stagger] cascade)
 *  - .spot               a pointer-following glow (sets --mx / --my on the hovered card)
 *  - html[data-scrolled] glass top bar once the page leaves the top
 *  - --scroll on html    a 0..1 progress value for parallax and the progress hairline
 * Everything is transform/opacity, and prefers-reduced-motion turns it off in CSS.
 */
export function MotionRuntime() {
  const path = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("motion-ready");

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    const seen = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll("[data-stagger]").forEach((group) => {
        Array.from(group.children).forEach((child, i) => {
          const el = child as HTMLElement;
          if (!el.hasAttribute("data-reveal")) el.setAttribute("data-reveal", "");
          el.style.setProperty("--i", String(i));
        });
      });
      document.querySelectorAll("[data-reveal]").forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        io.observe(el);
      });
    };
    scan();
    let scanQueued = 0;
    const mo = new MutationObserver(() => {
      if (scanQueued) return;
      scanQueued = requestAnimationFrame(() => {
        scanQueued = 0;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const max = Math.max(1, root.scrollHeight - window.innerHeight);
        root.style.setProperty("--scroll", (window.scrollY / max).toFixed(4));
        root.style.setProperty("--scroll-px", `${Math.round(window.scrollY)}`);
        if (window.scrollY > 8) root.setAttribute("data-scrolled", "");
        else root.removeAttribute("data-scrolled");
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const onMove = (ev: PointerEvent) => {
      const t = (ev.target as Element | null)?.closest?.(".spot") as HTMLElement | null;
      if (!t) return;
      const r = t.getBoundingClientRect();
      t.style.setProperty("--mx", `${ev.clientX - r.left}px`);
      t.style.setProperty("--my", `${ev.clientY - r.top}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
      if (scanQueued) cancelAnimationFrame(scanQueued);
    };
  }, [path]);

  return <div className="scroll-progress" aria-hidden="true" />;
}

/** The ambient background: slow drifting orbs, a fading grid and grain. Fixed, behind everything, pointer-events none. */
export function Ambient({ variant = "app" }: { variant?: "app" | "hero" }) {
  return (
    <div className={`ambient ambient--${variant}`} aria-hidden="true">
      <span className="orb orb--a" />
      <span className="orb orb--b" />
      <span className="orb orb--c" />
      <span className="ambient__grid" />
      <span className="ambient__grain" />
    </div>
  );
}

/** A heading whose words rise in one after another. Screen readers get the plain text. */
export function SplitWords({
  text,
  as: Tag = "h1",
  className,
  accent,
  delay = 0,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  /** words (exact match) painted with the Allowance ramp */
  accent?: string[];
  delay?: number;
}) {
  const words = text.split(" ");
  return (
    <Tag className={`split ${className ?? ""}`.trim()} aria-label={text}>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="split__w" aria-hidden="true">
            <span
              className={`split__i${accent?.includes(w) ? " ramp-text" : ""}`}
              style={{ "--i": i, "--d": `${delay}ms` } as CSSProperties}
            >
              {w}
            </span>
          </span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </Tag>
  );
}

/** Counts up to a number once it is on screen. Renders the final value on the server and for reduced motion. */
export function CountUp({ to, decimals = 0, suffix = "", prefix = "", duration = 1400 }: { to: number; decimals?: number; suffix?: string; prefix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [v, setV] = useState(to);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setV(0);
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 4);
        setV(to * eased);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [to, duration]);
  return (
    <span ref={ref} className="num">
      {prefix}
      {v.toFixed(decimals)}
      {suffix}
    </span>
  );
}

/** An endless, pausable strip (hover or focus pauses it). Content is duplicated for the loop and hidden from AT the second time. */
export function Marquee({ children, speed = 40 }: { children: ReactNode; speed?: number }) {
  return (
    <div className="marquee" style={{ "--marquee-speed": `${speed}s` } as CSSProperties}>
      <div className="marquee__track">
        <div className="marquee__set">{children}</div>
        <div className="marquee__set" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}
