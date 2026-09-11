import React, { useState, useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import { VUNG4_LOGO_BASE64 } from './vung4LogoData';

interface Vung4LogoProps {
  className?: string;
  size?: number;
  alt?: string;
  allowUpload?: boolean;
}

export const Vung4Logo: React.FC<Vung4LogoProps> = ({ 
  className = "h-12 w-auto",
  size,
  alt = "Huy hiệu Vùng 4 Hải quân Nhân dân Việt Nam",
  allowUpload = false
}) => {
  // Use the verified authentic base64 logo directly so it loads 100% reliably
  const [imgSrc, setImgSrc] = useState<string>(VUNG4_LOGO_BASE64);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Check if a newer version was uploaded to the server
    fetch('/api/system/logo')
      .then(res => res.json())
      .then(data => {
        if (data.exists && data.url) {
          setImgSrc(data.url);
        }
      })
      .catch(() => {});
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadLogoFile(file);
  };

  const uploadLogoFile = async (file: File) => {
    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/system/logo', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok && data.url) {
        setImgSrc(data.url);
      }
    } catch (err) {
      console.error('Lỗi cập nhật logo:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const inlineStyles: React.CSSProperties = size 
    ? { width: size, height: (size * 2560) / 2130 } 
    : {};

  return (
    <div 
      className={`relative inline-flex items-center justify-center shrink-0 group select-none ${className}`}
      style={inlineStyles}
      title="Huy hiệu Vùng 4 Hải quân Nhân dân Việt Nam"
    >
      {allowUpload && (
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/png,image/jpeg,image/svg+xml,image/webp" 
          onChange={handleFileChange} 
        />
      )}

      <img
        src={imgSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        className="w-full h-full object-contain filter drop-shadow-md transition-transform duration-200 group-hover:scale-105"
        onError={() => {
          // If remote URL fails, fallback to verified base64
          setImgSrc(VUNG4_LOGO_BASE64);
        }}
      />

      {allowUpload && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 bg-slate-900/90 text-amber-300 p-1 rounded-full border border-amber-400/60 hover:bg-amber-500 hover:text-slate-950 transition-all shadow-md z-20"
          title="Thay đổi file logo gốc"
        >
          {isUploading ? (
            <div className="w-3 h-3 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="w-3 h-3" />
          )}
        </button>
      )}
    </div>
  );
};
