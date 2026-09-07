import React from 'react';

// Concentric Dong Son Bronze Drum Motif
export function DongSonDrum({ 
  className = "w-24 h-24", 
  color = "#D97706",
  opacity = 0.25 
}: { 
  className?: string; 
  color?: string; 
  opacity?: number; 
}) {
  return (
    <svg 
      viewBox="0 0 200 200" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      style={{ opacity }}
    >
      {/* Outer concentric decorative circles */}
      <circle cx="100" cy="100" r="96" stroke={color} strokeWidth="1.5" strokeDasharray="3 3" />
      <circle cx="100" cy="100" r="90" stroke={color} strokeWidth="2" />
      <circle cx="100" cy="100" r="82" stroke={color} strokeWidth="1" />
      
      {/* Lac Bird Ring (Representing 8 flying cranes/birds in flight) */}
      <g stroke={color} strokeWidth="1.5" fill="none">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
          <path
            key={i}
            d="M95,24 Q108,18 114,24 Q105,27 98,28 Q102,32 108,30"
            transform={`rotate(${angle} 100 100)`}
          />
        ))}
      </g>

      <circle cx="100" cy="100" r="70" stroke={color} strokeWidth="1.5" />
      
      {/* Sawtooth / Zigzag geometric ring */}
      <circle cx="100" cy="100" r="62" stroke={color} strokeWidth="1" strokeDasharray="2 4" />
      <circle cx="100" cy="100" r="54" stroke={color} strokeWidth="1.5" />

      {/* Tangent circles ring */}
      <circle cx="100" cy="100" r="42" stroke={color} strokeWidth="1" />
      
      {/* Inner 14-point Sun Starburst */}
      <g fill={color} fillOpacity="0.8">
        {[0, 25.7, 51.4, 77.1, 102.8, 128.5, 154.2, 180, 205.7, 231.4, 257.1, 282.8, 308.5, 334.2].map((angle, i) => (
          <polygon
            key={i}
            points="100,68 103,96 97,96"
            transform={`rotate(${angle} 100 100)`}
          />
        ))}
      </g>

      {/* Central Star Core */}
      <circle cx="100" cy="100" r="8" fill={color} />
      <circle cx="100" cy="100" r="4" fill="#FFFFFF" fillOpacity="0.6" />
    </svg>
  );
}

// Dong Son Horizontal Border Decorative Ribbon
export function DongSonBorder({ className = "w-full h-3", color = "#D97706" }: { className?: string; color?: string }) {
  return (
    <div className={`overflow-hidden flex items-center justify-between ${className}`}>
      <svg width="100%" height="8" viewBox="0 0 400 8" fill="none" preserveAspectRatio="none">
        <pattern id="dongson-pattern" width="40" height="8" patternUnits="userSpaceOnUse">
          <path d="M0,4 L10,0 L20,4 L30,0 L40,4 L30,8 L20,4 L10,8 Z" stroke={color} strokeWidth="0.75" fill="none" opacity="0.6" />
          <circle cx="20" cy="4" r="1.5" fill={color} opacity="0.8" />
        </pattern>
        <rect width="100%" height="8" fill="url(#dongson-pattern)" />
      </svg>
    </div>
  );
}

// Navy Region 4 Emblem Badge
export function NavyBadge({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div className={`relative flex items-center justify-center rounded-full bg-gradient-to-br from-amber-500 via-amber-600 to-red-900 p-0.5 shadow-md ${className}`}>
      <div className="w-full h-full rounded-full bg-red-950 flex items-center justify-center relative overflow-hidden">
        <DongSonDrum className="absolute inset-0 w-full h-full scale-125 opacity-40" color="#FBBF24" />
        <span className="relative font-bold text-amber-300 text-xs tracking-tighter uppercase drop-shadow">
          HQV4
        </span>
      </div>
    </div>
  );
}
