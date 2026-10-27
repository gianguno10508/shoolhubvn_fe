// components/common/BrandLogo.jsx — biểu tượng SchoolHub (mũ tốt nghiệp trên nền gradient), dùng chung web
import { useId } from "react";

export default function BrandLogo({ size = 36, className = "" }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={"brand-logo " + className} width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="SchoolHub">
      <defs>
        <linearGradient id={`bg-${id}`} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2563eb" />
          <stop offset="0.55" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#bg-${id})`} />
      <path d="M24 12 7 20.5 24 29l17-8.5L24 12Z" fill="#fff" />
      <path d="M14 25.2v6.3c0 2.6 4.5 5 10 5s10-2.4 10-5v-6.3L24 30.2l-10-5Z" fill="#fff" fillOpacity="0.82" />
      <path d="M39 21.6v8.6" stroke="#fde68a" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="39" cy="31.6" r="2.1" fill="#fde68a" />
    </svg>
  );
}
