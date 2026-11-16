import React from 'react';

interface LogoProps {
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ className = 'h-7 w-7' }) => {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Vintage outer frame */}
      <rect x="4" y="4" width="56" height="56" stroke="currentColor" strokeWidth="4" />

      {/* Left upright L */}
      <rect x="11" y="19" width="3" height="26" fill="currentColor" />
      <rect x="11" y="42" width="7" height="3" fill="currentColor" />

      {/* Numeral 4 */}
      <rect x="21" y="21" width="3" height="13" fill="currentColor" />
      <rect x="21" y="31" width="9" height="3" fill="currentColor" />
      <rect x="27" y="21" width="3" height="22" fill="currentColor" />

      {/* Numeral 5 */}
      <rect x="33" y="21" width="10" height="3" fill="currentColor" />
      <rect x="33" y="21" width="3" height="12" fill="currentColor" />
      <rect x="33" y="30" width="10" height="3" fill="currentColor" />
      <rect x="40" y="30" width="3" height="13" fill="currentColor" />
      <rect x="33" y="40" width="10" height="3" fill="currentColor" />

      {/* Right mirrored L */}
      <rect x="50" y="19" width="3" height="26" fill="currentColor" />
      <rect x="46" y="42" width="7" height="3" fill="currentColor" />
    </svg>
  );
};
