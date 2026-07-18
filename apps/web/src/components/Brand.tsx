export function BeetBuddy({ nod = false, size = 56 }: { nod?: boolean; size?: number }) {
  return (
    <svg
      className={`buddy${nod ? " nod" : ""}`}
      width={size}
      height={size * 1.2}
      viewBox="0 0 64 78"
      role="img"
      aria-label="Beet Buddy, your music pal"
    >
      {/* leaves */}
      <path d="M30 16 C24 4 12 4 10 10 C16 16 24 18 30 16 Z" fill="#B8F34A" stroke="#0B0618" strokeWidth="2.5" />
      <path d="M34 16 C40 2 54 4 55 11 C48 17 40 18 34 16 Z" fill="#B8F34A" stroke="#0B0618" strokeWidth="2.5" />
      <path d="M32 18 L32 8" stroke="#0B0618" strokeWidth="2.5" strokeLinecap="round" />
      {/* body */}
      <path
        d="M32 14 C50 14 56 30 54 44 C52 58 42 64 34 70 C33 71 31 71 30 70 C22 64 12 58 10 44 C8 30 14 14 32 14 Z"
        fill="#FF3B81"
        stroke="#0B0618"
        strokeWidth="3"
      />
      {/* root tail */}
      <path d="M32 70 C31 74 33 76 32 78" stroke="#0B0618" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* face */}
      <circle cx="24" cy="38" r="3" fill="#0B0618" />
      <circle cx="40" cy="38" r="3" fill="#0B0618" />
      <path d="M25 48 Q32 54 39 48" stroke="#0B0618" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="18" cy="45" r="3" fill="#FFB6CE" opacity="0.9" />
      <circle cx="46" cy="45" r="3" fill="#FFB6CE" opacity="0.9" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <div className="wordmark">
      <span className="wordmark-title">Beet Machin</span>
      <span className="wordmark-tag">Grow a groove.</span>
    </div>
  );
}
