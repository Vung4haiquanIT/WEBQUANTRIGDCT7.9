import React from 'react';

// Authentic High-Fidelity Dong Son Bronze Drum (Trống Đồng Đông Sơn - Ngọc Lũ) Motif
export function DongSonDrum({ 
  className = "w-24 h-24", 
  color = "#D97706",
  opacity = 0.25,
  customSvgUrl
}: { 
  className?: string; 
  color?: string; 
  opacity?: number; 
  customSvgUrl?: string;
}) {
  if (customSvgUrl) {
    return (
      <div 
        className={`relative inline-block ${className}`} 
        style={{ opacity }}
      >
        <img 
          src={customSvgUrl} 
          alt="Trống đồng Đông Sơn" 
          className="w-full h-full object-contain pointer-events-none select-none"
        />
      </div>
    );
  }

  return (
    <svg 
      viewBox="0 0 500 500" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      style={{ opacity, color }}
    >
      <defs>
        {/* Single Chim Lac (Dong Son Crane in flight counter-clockwise) */}
        <g id="ds-chim-lac">
          {/* Head crest & long beak */}
          <path 
            d="M 205,52 Q 222,50 232,54 Q 235,53 240,49 Q 244,46 250,44 C 244,48 240,53 238,57 Q 248,60 258,61 C 268,62 278,63 286,62" 
            stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" 
          />
          {/* Beak lower line & throat */}
          <path 
            d="M 205,52 Q 220,53 230,57 Q 236,62 244,64 Q 256,66 268,65" 
            stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none" 
          />
          {/* Crane Eye */}
          <circle cx="230" cy="53" r="1.4" fill={color} />
          {/* Outstretched primary flight wing */}
          <path 
            d="M 246,60 C 250,48 258,38 270,35 C 265,42 263,50 264,59" 
            stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" 
          />
          {/* Wing feather vanes */}
          <path d="M 252,49 L 268,41 M 256,53 L 272,46 M 260,57 L 274,52" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
          {/* Fanned tail feathers */}
          <path 
            d="M 284,62 C 294,60 302,57 308,54 C 304,59 298,64 288,66" 
            stroke={color} strokeWidth="1.4" strokeLinecap="round" fill="none" 
          />
          <path 
            d="M 286,64 C 296,65 304,65 310,63 C 304,68 296,69 286,67" 
            stroke={color} strokeWidth="1.3" strokeLinecap="round" fill="none" 
          />
          {/* Trailing legs */}
          <path d="M 272,65 Q 282,70 292,72 M 274,66 Q 284,72 294,75" stroke={color} strokeWidth="1.1" strokeLinecap="round" />
        </g>

        {/* Peacock feather / lotus bud ornament between star rays */}
        <g id="ds-star-interspace">
          <path d="M 250,175 L 250,215" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
          <path d="M 245,188 L 250,183 L 255,188" stroke={color} strokeWidth="1.1" fill="none" />
          <path d="M 243,197 L 250,191 L 257,197" stroke={color} strokeWidth="1.1" fill="none" />
          <path d="M 242,206 L 250,200 L 258,206" stroke={color} strokeWidth="1.1" fill="none" />
          <circle cx="250" cy="177" r="1.5" fill={color} />
        </g>
      </defs>

      {/* Outer Rim Bands */}
      <circle cx="250" cy="250" r="246" stroke={color} strokeWidth="2.5" />
      <circle cx="250" cy="250" r="242" stroke={color} strokeWidth="1" strokeDasharray="2.5 3.5" />
      <circle cx="250" cy="250" r="238" stroke={color} strokeWidth="1.8" />

      {/* Outer Sawtooth Ring (Vành hoa văn răng lược ngoài) */}
      <circle cx="250" cy="250" r="234" stroke={color} strokeWidth="1" />
      <circle cx="250" cy="250" r="226" stroke={color} strokeWidth="1" />
      <circle cx="250" cy="250" r="230" stroke={color} strokeWidth="5.5" strokeDasharray="3.5 5.5" fill="none" strokeOpacity="0.85" />

      {/* Outer Tangent Circles Band (Vòng tròn tiếp tuyến ngoài có chấm tâm) */}
      <circle cx="250" cy="250" r="224" stroke={color} strokeWidth="1.4" />
      <circle cx="250" cy="250" r="214" stroke={color} strokeWidth="1.4" />
      <circle cx="250" cy="250" r="219" stroke={color} strokeWidth="3" strokeDasharray="3 6" fill="none" />
      <circle cx="250" cy="250" r="219" stroke={color} strokeWidth="1" strokeDasharray="0.1 9" strokeLinecap="round" />

      {/* Outer Bird Separator Border */}
      <circle cx="250" cy="250" r="212" stroke={color} strokeWidth="1.5" />
      <circle cx="250" cy="250" r="208" stroke={color} strokeWidth="1" strokeDasharray="2 3" />
      <circle cx="250" cy="250" r="205" stroke={color} strokeWidth="1.5" />

      {/* VÀNH CHIM LẠC (16 CHIM HẠC BAY NGƯỢC CHIỀU KIM ĐỒNG HỒ) */}
      <g id="chim-lac-ring">
        {[0, 22.5, 45, 67.5, 90, 112.5, 135, 157.5, 180, 202.5, 225, 247.5, 270, 292.5, 315, 337.5].map((angle, idx) => (
          <use key={idx} href="#ds-chim-lac" transform={`rotate(${angle} 250 250)`} />
        ))}
      </g>

      {/* Middle Inner Separator Ring */}
      <circle cx="250" cy="250" r="168" stroke={color} strokeWidth="1.8" />
      <circle cx="250" cy="250" r="164" stroke={color} strokeWidth="1" strokeDasharray="2 3" />
      <circle cx="250" cy="250" r="160" stroke={color} strokeWidth="1.5" />

      {/* Middle Sawtooth Ring (Răng cưa giữa) */}
      <circle cx="250" cy="250" r="154" stroke={color} strokeWidth="4.5" strokeDasharray="3 4.5" fill="none" />
      <circle cx="250" cy="250" r="148" stroke={color} strokeWidth="1.5" />

      {/* Vành hoa văn chữ S gãy khúc / văn tiếp tuyến trong */}
      <circle cx="250" cy="250" r="146" stroke={color} strokeWidth="1.2" />
      <circle cx="250" cy="250" r="132" stroke={color} strokeWidth="1.2" />
      <circle cx="250" cy="250" r="139" stroke={color} strokeWidth="3" strokeDasharray="2.5 5" fill="none" />
      <circle cx="250" cy="250" r="139" stroke={color} strokeWidth="1" strokeDasharray="0.1 7.5" strokeLinecap="round" />

      {/* Inner Concentric Tangent Circles & Beads */}
      <circle cx="250" cy="250" r="130" stroke={color} strokeWidth="1.6" />
      <circle cx="250" cy="250" r="124" stroke={color} strokeWidth="1" strokeDasharray="2 3" />
      <circle cx="250" cy="250" r="118" stroke={color} strokeWidth="1.5" />
      <circle cx="250" cy="250" r="112" stroke={color} strokeWidth="3.5" strokeDasharray="2.5 3.8" fill="none" />
      <circle cx="250" cy="250" r="106" stroke={color} strokeWidth="1.6" />
      <circle cx="250" cy="250" r="100" stroke={color} strokeWidth="1" strokeDasharray="1.8 2.5" />
      <circle cx="250" cy="250" r="95" stroke={color} strokeWidth="1.8" />

      {/* HOẠ TIẾT LÔNG CÔNG / BÚP SEN XEN KẼ CÁNH SAO (14 VỊ TRÍ) */}
      <g id="star-interspaces">
        {[12.857, 38.571, 64.285, 90, 115.714, 141.428, 167.142, 192.857, 218.571, 244.285, 270, 295.714, 321.428, 347.142].map((angle, idx) => (
          <use key={idx} href="#ds-star-interspace" transform={`rotate(${angle} 250 250)`} />
        ))}
      </g>

      {/* NGÔI SAO TRUNG TÂM 14 CÁNH ĐÔNG SƠN (Đặc trưng Trống đồng Ngọc Lũ) */}
      <g id="sun-star-14" fill={color} stroke={color} strokeWidth="0.8">
        {[0, 25.714, 51.428, 77.142, 102.857, 128.571, 154.285, 180, 205.714, 231.428, 257.142, 282.857, 308.571, 334.285].map((angle, idx) => (
          <polygon 
            key={idx} 
            points="250,158 255.5,232 244.5,232" 
            transform={`rotate(${angle} 250 250)`} 
          />
        ))}
      </g>

      {/* Central Solar Core (Tâm mặt trời trống đồng) */}
      <circle cx="250" cy="250" r="22" stroke={color} strokeWidth="2.5" fill="none" />
      <circle cx="250" cy="250" r="14" fill={color} />
      <circle cx="250" cy="250" r="6" stroke="#FFFFFF" strokeWidth="1.5" fill={color} />
      <circle cx="250" cy="250" r="2" fill="#FFFFFF" />
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
