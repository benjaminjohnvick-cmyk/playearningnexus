import React from 'react';

export default function GamerGainLogo({ className = "w-10 h-10" }) {
  return (
    <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="dollarGreen" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#85bb65', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#6b9b4f', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="whiteGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#f0f0f0', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      
      {/* Background Circle */}
      <circle cx="50" cy="50" r="48" fill="url(#dollarGreen)" />
      
      {/* Abstract Modern "G" */}
      <path
        d="M 50 20 C 35 20, 25 30, 25 45 C 25 60, 35 70, 50 70 L 65 70 L 65 55 L 45 55 L 45 50 L 70 50 L 70 75 L 50 75 C 32 75, 20 63, 20 45 C 20 27, 32 15, 50 15 C 65 15, 75 23, 78 35 L 72 37 C 70 27, 61 20, 50 20 Z"
        fill="url(#whiteGlow)"
        stroke="#ffffff"
        strokeWidth="1.5"
      />
      
      {/* Dynamic Tech Lines */}
      <path
        d="M 55 35 L 75 35"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M 60 42 L 75 42"
        stroke="#ffffff"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}