export interface ParsedVideoInfo {
  type: 'youtube' | 'drive' | 'vimeo' | 'direct';
  cleanUrl: string;
  embedUrl: string;
  thumbnailUrl: string;
}

export function parseVideoUrl(rawUrl: string = ''): ParsedVideoInfo {
  const url = (rawUrl || '').trim();
  if (!url) {
    return { type: 'direct', cleanUrl: '', embedUrl: '', thumbnailUrl: '' };
  }

  // 1. YouTube
  // Matches:
  // - https://www.youtube.com/watch?v=VIDEO_ID
  // - https://m.youtube.com/watch?v=VIDEO_ID
  // - https://youtu.be/VIDEO_ID
  // - https://www.youtube.com/embed/VIDEO_ID
  // - https://www.youtube.com/shorts/VIDEO_ID
  // - https://www.youtube-nocookie.com/embed/VIDEO_ID
  const youtubeMatch = url.match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([a-zA-Z0-9_-]{11})/i);
  if (youtubeMatch && youtubeMatch[1]) {
    const id = youtubeMatch[1];
    return {
      type: 'youtube',
      cleanUrl: url,
      embedUrl: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${id}/hqdefault.jpg`
    };
  }

  // 2. Google Drive
  // Matches:
  // - https://drive.google.com/file/d/FILE_ID/view...
  // - https://drive.google.com/open?id=FILE_ID
  const driveMatch = url.match(/drive\.google\.com\/(?:file\/d\/([a-zA-Z0-9_-]+)|open\?id=([a-zA-Z0-9_-]+))/i);
  if (driveMatch) {
    const id = driveMatch[1] || driveMatch[2];
    return {
      type: 'drive',
      cleanUrl: url,
      embedUrl: `https://drive.google.com/file/d/${id}/preview`,
      thumbnailUrl: ''
    };
  }

  // 3. Vimeo
  // Matches:
  // - https://vimeo.com/123456789
  const vimeoMatch = url.match(/vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|)(\d+)/i);
  if (vimeoMatch && vimeoMatch[3]) {
    const id = vimeoMatch[3];
    return {
      type: 'vimeo',
      cleanUrl: url,
      embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1`,
      thumbnailUrl: ''
    };
  }

  // 4. Direct video URL (MP4, WebM, Cloudinary, etc.)
  return {
    type: 'direct',
    cleanUrl: url,
    embedUrl: url,
    thumbnailUrl: ''
  };
}

export function getEffectiveVideoThumbnail(customThumbnail?: string, videoUrl?: string): string {
  if (customThumbnail && customThumbnail.trim() && !customThumbnail.endsWith('.mp4')) {
    return customThumbnail.trim();
  }
  if (videoUrl) {
    const parsed = parseVideoUrl(videoUrl);
    if (parsed.thumbnailUrl) {
      return parsed.thumbnailUrl;
    }
  }
  return '';
}
