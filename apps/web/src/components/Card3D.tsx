import type { CSSProperties, ReactNode } from "react";

type Card3DProps = {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Kept for call-site compatibility; panels no longer tilt or glare (design-taste house rules). */
  intensity?: number;
  glare?: boolean;
};

/** A plain wrapper: panels sit still and are separated by tone, not by motion or glow. */
export function Card3D({ children, className = "", style }: Card3DProps) {
  return (
    <div className={`card-3d ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}
