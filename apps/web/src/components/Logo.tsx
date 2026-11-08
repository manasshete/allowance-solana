/** The Allowance mark: a budget gauge, a ring with a capped arc and the point where spending stops. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="al-g" x1="4" y1="28" x2="28" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--color-purple)" />
          <stop offset="1" stopColor="var(--color-green)" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeOpacity="0.18" strokeWidth="3" />
      <path className="logo-mark__arc" d="M6.2 22.9A12 12 0 1 1 25.8 22.9" stroke="url(#al-g)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="25.8" cy="22.9" r="2.6" fill="var(--color-refused)" />
    </svg>
  );
}
