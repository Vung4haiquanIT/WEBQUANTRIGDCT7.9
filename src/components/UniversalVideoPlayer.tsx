import React, { useState } from 'react';
import { ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import { parseVideoUrl, getEffectiveVideoThumbnail } from '../utils/videoHelper';

interface UniversalVideoPlayerProps {
  videoUrl: string;
  title?: string;
  thumbnail?: string;
  autoPlay?: boolean;
  className?: string;
}

export const UniversalVideoPlayer: React.FC<UniversalVideoPlayerProps> = ({
  videoUrl,
  title = 'Video',
  thumbnail,
  autoPlay = true,
  className = ''
}) => {
  const [hasError, setHasError] = useState(false);
  const parsed = parseVideoUrl(videoUrl);
  const poster = getEffectiveVideoThumbnail(thumbnail, videoUrl);

  if (!parsed.cleanUrl) {
    return (
      <div className="w-full h-full min-h-[260px] bg-slate-900 flex flex-col items-center justify-center p-4 text-center text-slate-400 text-xs">
        <AlertCircle className="w-8 h-8 text-slate-500 mb-2" />
        <p>Đường dẫn video không hợp lệ hoặc đang để trống.</p>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="w-full h-full min-h-[260px] bg-slate-950 flex flex-col items-center justify-center p-6 text-center text-slate-300 space-y-3">
        <AlertCircle className="w-8 h-8 text-amber-400" />
        <div>
          <p className="text-sm font-bold text-white">Không thể tải luồng video trực tiếp</p>
          <p className="text-xs text-slate-400 max-w-sm mt-1">
            Đường dẫn có thể bị hạn chế nhúng từ nhà cung cấp hoặc định dạng chưa tương thích.
          </p>
        </div>
        <div className="flex items-center space-x-2 pt-1">
          <button
            type="button"
            onClick={() => setHasError(false)}
            className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Thử lại</span>
          </button>
          <a
            href={parsed.cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Mở video trong tab mới</span>
          </a>
        </div>
      </div>
    );
  }

  // YouTube
  if (parsed.type === 'youtube') {
    return (
      <div className={`relative w-full h-full min-h-[300px] bg-black ${className}`}>
        <iframe
          src={parsed.embedUrl}
          title={title}
          className="w-full h-full border-0 absolute inset-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  // Google Drive
  if (parsed.type === 'drive') {
    return (
      <div className={`relative w-full h-full min-h-[300px] bg-black ${className}`}>
        <iframe
          src={parsed.embedUrl}
          title={title}
          className="w-full h-full border-0 absolute inset-0"
          allow="autoplay"
          allowFullScreen
        />
      </div>
    );
  }

  // Vimeo
  if (parsed.type === 'vimeo') {
    return (
      <div className={`relative w-full h-full min-h-[300px] bg-black ${className}`}>
        <iframe
          src={parsed.embedUrl}
          title={title}
          className="w-full h-full border-0 absolute inset-0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  // Direct MP4 / WebM / Cloudinary / HLS Stream
  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-black ${className}`}>
      <video
        key={parsed.cleanUrl}
        controls
        playsInline
        autoPlay={autoPlay}
        src={parsed.cleanUrl}
        poster={poster || undefined}
        onError={() => {
          console.error('Direct video playback error for:', parsed.cleanUrl);
          setHasError(true);
        }}
        className="w-full h-full max-h-[60vh] object-contain"
      >
        Trình duyệt của đồng chí không hỗ trợ xem video trực tiếp.
      </video>
    </div>
  );
};
