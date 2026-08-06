import React from 'react';

// Grandia Granaria mark — glass cube with the interlocking "GG".
// Served from /public/gg-logo.svg so it stays crisp at any size.
export default function GamerGainLogo({ className = "w-10 h-10" }) {
  return (
    <img
      src="/gg-logo.svg"
      alt="Grandia Granaria"
      className={className}
      width={40}
      height={40}
      draggable={false}
    />
  );
}
