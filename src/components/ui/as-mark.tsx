export function ASMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="AS"
      className="select-none flex-shrink-0"
    >
      <rect width="32" height="32" rx="7" fill="#059669" />
      <path
        d="M4 26 L10 6 L16 26 M6.5 19 L13.5 19"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M26 9 C26 6.5 24 5.5 22 5.5 C20 5.5 17 7 17 9.5 C17 13 27 14.5 27 19.5 C27 23 24 26.5 21.5 26.5 C19 26.5 17 25 17 22.5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
