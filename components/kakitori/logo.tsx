/** 사이트 로고: 헤드폰 낀 책 + 음표 (public/icon.svg 와 같은 그림) */
export function AppLogo({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} role="img" aria-label="카키토리 노트">
      <rect width="100" height="100" rx="22" fill="#2f3a56" />
      <path d="M22 58 Q22 26 50 26 Q78 26 78 58" fill="none" stroke="#f4efe4" strokeWidth="5" strokeLinecap="round"/>
<path d="M50 48 Q39 43 28 45 V76 Q39 74 50 79 Q61 74 72 76 V45 Q61 43 50 48Z" fill="#f4efe4"/><path d="M50 48V79" stroke="#c9c2b4" strokeWidth="1.3"/>
<rect x="15" y="52" width="12" height="22" rx="5" fill="#f2b84b"/><rect x="73" y="52" width="12" height="22" rx="5" fill="#f2b84b"/>
<g fill="#f2b84b" stroke="#f2b84b"><g transform="translate(68 21)"><ellipse cx="0" cy="0" rx="3" ry="2.3" transform="rotate(-20)"/><ellipse cx="10" cy="-2.5" rx="3" ry="2.3" transform="rotate(-20 10 -2.5)"/><path d="M2.7 -1V-10L12.7 -12.5V-3.5" strokeWidth="1.9" fill="none" strokeLinejoin="round"/></g>
<g transform="translate(21 25) scale(.75)" opacity=".85"><ellipse cx="0" cy="0" rx="3.4" ry="2.6" transform="rotate(-20)"/><path d="M3 -1V-11l4.2 1.9" strokeWidth="1.9" fill="none" strokeLinecap="round" strokeLinejoin="round"/></g></g>
    </svg>
  )
}
