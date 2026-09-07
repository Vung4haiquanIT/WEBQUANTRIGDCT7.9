import React, { useState, useEffect } from 'react';
import { 
  AppBanner, 
  Course, 
  Lesson 
} from '../types';
import { api } from '../services/api';
import { 
  Plus, 
  Image as ImageIcon, 
  Upload, 
  Trash2, 
  Edit3, 
  ArrowUp, 
  ArrowDown, 
  Play, 
  Pause, 
  ChevronLeft, 
  ChevronRight, 
  Star,
  CheckCircle,
  XCircle,
  Smartphone,
  AlertTriangle
} from 'lucide-react';

/**
 * Vietnam Navy Crest / Emblem
 * Features: Double Golden Rings, Red Central Roundel, Navy Anchor, 
 * Golden Laurel Branches, and Stylized Ocean Waves.
 */
const NavyEmblem: React.FC<{ className?: string }> = ({ className = "w-14 h-14" }) => {
  return (
    <svg 
      viewBox="0 0 100 100" 
      className={`${className} shrink-0 select-none`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="goldGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#eab308" />
          <stop offset="85%" stopColor="#ca8a04" />
          <stop offset="100%" stopColor="#854d0e" />
        </radialGradient>
        <radialGradient id="redRoundel" cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="70%" stopColor="#991b1b" />
          <stop offset="100%" stopColor="#450a0a" />
        </radialGradient>
        <linearGradient id="seaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="60%" stopColor="#0369a1" />
          <stop offset="100%" stopColor="#0c4a6e" />
        </linearGradient>
      </defs>

      <circle cx="50" cy="50" r="47" fill="url(#goldGrad)" />
      <circle cx="50" cy="50" r="43.5" fill="#450a0a" />
      <circle cx="50" cy="50" r="41.5" fill="url(#goldGrad)" />
      <circle cx="50" cy="50" r="39" fill="url(#redRoundel)" />

      {/* Golden Laurel Branches */}
      <g fill="none" stroke="url(#goldGrad)" strokeWidth="1.8" strokeLinecap="round">
        <path d="M 23,65 C 19,45 27,27 39,21" />
        <path d="M 77,65 C 81,45 73,27 61,21" />
      </g>
      <g fill="url(#goldGrad)">
        <ellipse cx="23" cy="58" rx="2.5" ry="4" transform="rotate(-30 23 58)" />
        <ellipse cx="21" cy="48" rx="2.5" ry="4" transform="rotate(-15 21 48)" />
        <ellipse cx="23" cy="38" rx="2.5" ry="4" transform="rotate(10 23 38)" />
        <ellipse cx="28" cy="29" rx="2.5" ry="4" transform="rotate(30 28 29)" />
        <ellipse cx="36" cy="23" rx="2.5" ry="4" transform="rotate(50 36 23)" />

        <ellipse cx="77" cy="58" rx="2.5" ry="4" transform="rotate(30 77 58)" />
        <ellipse cx="79" cy="48" rx="2.5" ry="4" transform="rotate(15 79 48)" />
        <ellipse cx="77" cy="38" rx="2.5" ry="4" transform="rotate(-10 77 38)" />
        <ellipse cx="72" cy="29" rx="2.5" ry="4" transform="rotate(-30 72 29)" />
        <ellipse cx="64" cy="23" rx="2.5" ry="4" transform="rotate(-50 64 23)" />
      </g>

      {/* Navy Anchor Symbol */}
      <g fill="url(#goldGrad)" stroke="url(#goldGrad)" strokeLinejoin="round">
        <circle cx="50" cy="31" r="5" fill="none" strokeWidth="2.5" />
        <rect x="40" y="37" width="20" height="3" rx="1.5" />
        <rect x="48" y="35" width="4" height="27" rx="1.5" />
        <path 
          d="M 33,52 C 33,67 67,67 67,52" 
          fill="none" 
          stroke="url(#goldGrad)" 
          strokeWidth="4" 
          strokeLinecap="round" 
        />
        <polygon points="36,55 33,62 39,60" />
        <polygon points="64,55 67,62 61,60" />
      </g>

      {/* Ocean Waves */}
      <path 
        d="M 27,67 C 33,63 37,67 43,65 C 49,63 53,67 59,65 C 65,63 69,67 73,67 L 73,73 C 69,73 65,71 59,71 C 53,71 49,73 43,73 C 37,73 33,71 27,73 Z" 
        fill="url(#seaGrad)" 
      />
      <path 
        d="M 28,70 C 34,68 38,71 44,69 C 50,67 54,71 60,69 C 66,67 70,70 72,70 L 72,74 C 70,74 66,72 60,72 C 54,72 50,74 44,74 C 38,74 34,72 28,74 Z" 
        fill="#FFFFFF" 
        opacity="0.8" 
      />
      <circle cx="43" cy="77" r="1.2" fill="url(#goldGrad)" />
      <circle cx="50" cy="77" r="1.5" fill="url(#goldGrad)" />
      <circle cx="57" cy="77" r="1.2" fill="url(#goldGrad)" />
    </svg>
  );
};

interface BannersViewProps {
  banners: AppBanner[];
  courses: Course[];
  lessons: Lesson[];
  onRefresh: () => Promise<void>;
}

export const BannersView: React.FC<BannersViewProps> = ({
  banners,
  onRefresh
}) => {
  // Local synchronized list for optimistic updates
  const [localBanners, setLocalBanners] = useState<AppBanner[]>(banners);

  useEffect(() => {
    setLocalBanners(banners);
  }, [banners]);

  const [activeSlide, setActiveSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<AppBanner | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Delete Confirmation Modal State (Replaces blocked window.confirm)
  const [bannerToDelete, setBannerToDelete] = useState<AppBanner | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Touch / Drag swipe state for mobile preview
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragDistance, setDragDistance] = useState(0);

  // Mode: 'image' (Pure Image, no text/color overlay) | 'slogan' (Navy emblem & text)
  const [bannerMode, setBannerMode] = useState<'image' | 'slogan'>('image');

  // Form State for create/edit
  const [formData, setFormData] = useState<{
    title: string;
    subtitle: string;
    imageUrl: string;
    cloudinaryPublicId: string;
    targetLessonId: string;
    targetCourseId: string;
    targetUrl: string;
    badgeText: string;
    backgroundColor: string;
    order: number;
    isActive: boolean;
  }>({
    title: '',
    subtitle: '',
    imageUrl: '',
    cloudinaryPublicId: '',
    targetLessonId: '',
    targetCourseId: '',
    targetUrl: '',
    badgeText: 'HẢI QUÂN VIỆT NAM',
    backgroundColor: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 50%, #450a0a 100%)',
    order: 1,
    isActive: true,
  });

  const activeBanners = localBanners.filter(b => b.isActive);
  const currentBannerCount = localBanners.length;
  const isMaxReached = currentBannerCount >= 5;

  // Auto-play interval for mobile preview carousel
  useEffect(() => {
    if (!isAutoPlaying || activeBanners.length <= 1 || isDragging) return;

    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % activeBanners.length);
    }, 4000);

    return () => clearInterval(timer);
  }, [isAutoPlaying, activeBanners.length, isDragging]);

  // Keep activeSlide within bounds
  useEffect(() => {
    if (activeSlide >= activeBanners.length && activeBanners.length > 0) {
      setActiveSlide(0);
    }
  }, [activeBanners.length, activeSlide]);

  const handleNextSlide = () => {
    if (activeBanners.length <= 1) return;
    setActiveSlide((prev) => (prev + 1) % activeBanners.length);
  };

  const handlePrevSlide = () => {
    if (activeBanners.length <= 1) return;
    setActiveSlide((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);
  };

  // Drag / Swipe handlers for mobile simulation
  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setDragStartX(clientX);
    setDragDistance(0);
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setDragDistance(clientX - dragStartX);
  };

  const handleTouchEnd = () => {
    if (!isDragging) return;
    setIsDragging(false);
    if (dragDistance < -45) {
      handleNextSlide();
    } else if (dragDistance > 45) {
      handlePrevSlide();
    }
    setDragDistance(0);
  };

  const handleOpenCreate = () => {
    if (isMaxReached) {
      setActionError('Ứng dụng cho phép tối đa 5 poster/banner. Vui lòng chỉnh sửa hoặc xóa poster cũ trước khi thêm mới.');
      return;
    }
    setEditingBanner(null);
    setBannerMode('image');
    setFormData({
      title: '',
      subtitle: '',
      imageUrl: '',
      cloudinaryPublicId: '',
      targetLessonId: '',
      targetCourseId: '',
      targetUrl: '',
      badgeText: '',
      backgroundColor: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 50%, #450a0a 100%)',
      order: currentBannerCount + 1,
      isActive: true,
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b: AppBanner) => {
    setEditingBanner(b);
    setBannerMode(b.imageUrl ? 'image' : 'slogan');
    setFormData({
      title: b.title || '',
      subtitle: b.subtitle || '',
      imageUrl: b.imageUrl || '',
      cloudinaryPublicId: b.cloudinaryPublicId || '',
      targetLessonId: b.targetLessonId || '',
      targetCourseId: b.targetCourseId || '',
      targetUrl: b.targetUrl || '',
      badgeText: b.badgeText || '',
      backgroundColor: b.backgroundColor || 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 50%, #450a0a 100%)',
      order: b.order || 1,
      isActive: b.isActive ?? true,
    });
    setActionError(null);
    setIsModalOpen(true);
  };

  const handleToggleActive = async (b: AppBanner) => {
    try {
      const nextActive = !b.isActive;
      setLocalBanners(prev => prev.map(item => item.id === b.id ? { ...item, isActive: nextActive } : item));
      await api.updateBanner(b.id, { isActive: nextActive });
      await onRefresh();
    } catch (err) {
      console.error('Lỗi đổi trạng thái banner:', err);
    }
  };

  const handleMoveOrder = async (b: AppBanner, direction: 'UP' | 'DOWN') => {
    const sorted = [...localBanners].sort((x, y) => x.order - y.order);
    const index = sorted.findIndex(item => item.id === b.id);
    if (index === -1) return;

    if (direction === 'UP' && index > 0) {
      const prevItem = sorted[index - 1];
      const updatedList = localBanners.map(item => {
        if (item.id === b.id) return { ...item, order: prevItem.order };
        if (item.id === prevItem.id) return { ...item, order: b.order };
        return item;
      });
      setLocalBanners(updatedList);
      await api.updateBanner(b.id, { order: prevItem.order });
      await api.updateBanner(prevItem.id, { order: b.order });
      await onRefresh();
    } else if (direction === 'DOWN' && index < sorted.length - 1) {
      const nextItem = sorted[index + 1];
      const updatedList = localBanners.map(item => {
        if (item.id === b.id) return { ...item, order: nextItem.order };
        if (item.id === nextItem.id) return { ...item, order: b.order };
        return item;
      });
      setLocalBanners(updatedList);
      await api.updateBanner(b.id, { order: nextItem.order });
      await api.updateBanner(nextItem.id, { order: b.order });
      await onRefresh();
    }
  };

  // Safe In-App Delete (Guaranteed to work in iframe)
  const handleConfirmDelete = async () => {
    if (!bannerToDelete) return;
    try {
      setIsDeleting(true);
      setActionError(null);
      // Optimistic delete
      const bannerId = bannerToDelete.id;
      setLocalBanners(prev => prev.filter(item => item.id !== bannerId));
      
      await api.deleteBanner(bannerId);
      await onRefresh();
      setBannerToDelete(null);
    } catch (err: any) {
      console.error('Lỗi xóa banner:', err);
      setActionError(err.message || 'Không thể xóa poster. Vui lòng thử lại.');
      await onRefresh();
    } finally {
      setIsDeleting(false);
    }
  };

  // Upload custom poster image file to Cloudinary
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      setActionError(null);
      const res = await api.uploadBannerImage(file);
      setFormData(prev => ({
        ...prev,
        imageUrl: res.url,
        cloudinaryPublicId: res.publicId,
        title: ''
      }));
      setBannerMode('image');
    } catch (err: any) {
      console.error('Upload ảnh thất bại:', err);
      setActionError(err.message || 'Tải ảnh lên máy chủ thất bại.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);

    if (bannerMode === 'image' && !formData.imageUrl) {
      setActionError('Vui lòng chọn tải file ảnh poster từ máy tính hoặc chuyển sang chế độ Khẩu hiệu.');
      return;
    }

    if (bannerMode === 'slogan' && !formData.title.trim()) {
      setActionError('Vui lòng nhập tiêu đề khẩu hiệu.');
      return;
    }

    try {
      setIsSaving(true);
      const payload: Partial<AppBanner> = {
        ...formData,
        // If image mode, clear overlaid text properties to guarantee pure image display
        title: bannerMode === 'image' ? '' : formData.title.trim(),
        subtitle: bannerMode === 'image' ? '' : formData.subtitle.trim(),
        badgeText: bannerMode === 'image' ? '' : formData.badgeText.trim(),
        imageUrl: bannerMode === 'image' ? formData.imageUrl : '',
        order: Number(formData.order) || 1,
      };

      if (editingBanner) {
        await api.updateBanner(editingBanner.id, payload);
      } else {
        await api.createBanner({
          ...payload,
          order: Number(formData.order) || (currentBannerCount + 1),
        });
      }
      setIsModalOpen(false);
      await onRefresh();
    } catch (err: any) {
      console.error('Lỗi lưu banner:', err);
      setActionError(err.message || 'Có lỗi xảy ra khi lưu poster.');
    } finally {
      setIsSaving(false);
    }
  };

  // Color preset options for Slogan mode
  const colorPresets = [
    {
      name: 'Đỏ Cờ Hải Quân',
      gradient: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 50%, #450a0a 100%)',
      previewClass: 'bg-gradient-to-r from-red-700 via-red-800 to-red-950',
    },
    {
      name: 'Xanh Biển Đảo Trường Sa',
      gradient: 'linear-gradient(135deg, #0284c7 0%, #0369a1 50%, #082f49 100%)',
      previewClass: 'bg-gradient-to-r from-sky-600 via-sky-700 to-sky-950',
    },
    {
      name: 'Đỏ Đậm Cách Mạng',
      gradient: 'linear-gradient(135deg, #991b1b 0%, #581c1c 60%, #2b0b0b 100%)',
      previewClass: 'bg-gradient-to-r from-red-800 via-red-900 to-stone-950',
    },
    {
      name: 'Xanh Thép Hải Quân',
      gradient: 'linear-gradient(135deg, #1e3a8a 0%, #172554 60%, #0b1120 100%)',
      previewClass: 'bg-gradient-to-r from-blue-900 via-blue-950 to-slate-950',
    },
    {
      name: 'Vàng Đồng Quân Kỳ',
      gradient: 'linear-gradient(135deg, #b45309 0%, #78350f 60%, #451a03 100%)',
      previewClass: 'bg-gradient-to-r from-amber-700 via-amber-800 to-amber-950',
    },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Action Error Notification (In-App) */}
      {actionError && (
        <div className="flex items-center justify-between p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{actionError}</span>
          </div>
          <button 
            onClick={() => setActionError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center space-x-3">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            QUẢN LÝ POSTER & BANNER
          </h2>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
            isMaxReached 
              ? 'bg-amber-100 text-amber-800 border border-amber-300' 
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            {currentBannerCount} / 5 Poster
          </span>
        </div>

        <button
          id="btn-add-banner"
          onClick={handleOpenCreate}
          disabled={isMaxReached}
          title={isMaxReached ? 'Đã đạt giới hạn tối đa 5 poster' : 'Thêm poster mới'}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium text-xs shadow-xs transition-colors cursor-pointer ${
            isMaxReached
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Thêm poster / banner</span>
        </button>
      </div>

      {/* Main Grid: Left = Mobile Simulator; Right = List Management */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Realistic Mobile App Carousel Simulator */}
        <div className="lg:col-span-5 bg-slate-900 rounded-3xl p-5 text-white shadow-xl border border-slate-800 flex flex-col items-center">
          <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
            <div className="flex items-center space-x-2 text-amber-400 font-semibold">
              <Smartphone className="w-4 h-4" />
              <span>MÔ PHỎNG APP ĐIỆN THOẠI</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] transition-colors cursor-pointer"
                title={isAutoPlaying ? "Tạm dừng tự động chạy" : "Tiếp tục tự động chạy"}
              >
                {isAutoPlaying ? <Pause className="w-3 h-3 text-amber-400" /> : <Play className="w-3 h-3 text-emerald-400" />}
                <span>{isAutoPlaying ? 'Tự động chạy' : 'Đang tạm dừng'}</span>
              </button>
            </div>
          </div>

          {/* Smartphone Frame */}
          <div className="w-full max-w-[340px] bg-[#0c1424] rounded-[36px] p-3.5 border-4 border-slate-700 my-4 shadow-2xl relative select-none">
            {/* Phone Speaker Notch & Camera */}
            <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-2 flex items-center justify-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-slate-900" />
              <div className="w-8 h-1 rounded-full bg-slate-900" />
            </div>

            {/* Mobile Screen Header */}
            <div className="flex items-center justify-between px-2 py-1 text-[11px] text-slate-400 font-medium">
              <span className="font-bold text-white tracking-wide">GDCT VÙNG 4</span>
              <div className="flex items-center space-x-1">
                <span className="text-[10px]">WiFi • 100%</span>
              </div>
            </div>

            {/* Mobile App Home Greeting */}
            <div className="px-2 py-1.5 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400">Xin chào,</div>
                <div className="text-xs font-bold text-white">Thượng tá Phạm Khắc Thành</div>
              </div>
              <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold text-white border border-blue-400">
                T
              </div>
            </div>

            {/* CAROUSEL CONTAINER */}
            <div className="mt-2 relative">
              <div className="flex items-center justify-between px-1 mb-1.5">
                <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                  TIÊU ĐIỂM CHÍNH TRỊ
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  {activeBanners.length > 0 ? `${activeSlide + 1}/${activeBanners.length}` : '0/0'}
                </span>
              </div>

              {/* Slider Viewport (Exact 2.1 : 1 Aspect Ratio) */}
              <div 
                className="relative overflow-hidden rounded-2xl w-full aspect-[2.1/1] shadow-lg cursor-grab active:cursor-grabbing bg-slate-950"
                onMouseDown={handleTouchStart}
                onMouseMove={handleTouchMove}
                onMouseUp={handleTouchEnd}
                onMouseLeave={handleTouchEnd}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {activeBanners.length === 0 ? (
                  <div className="w-full h-full bg-slate-800 flex flex-col items-center justify-center text-center p-4">
                    <ImageIcon className="w-8 h-8 text-slate-500 mb-1" />
                    <p className="text-xs text-slate-400">Chưa có poster nào hoạt động</p>
                  </div>
                ) : (
                  <div 
                    className="flex h-full transition-transform duration-500 ease-out"
                    style={{
                      transform: `translateX(calc(-${activeSlide * 100}% + ${dragDistance}px))`,
                    }}
                  >
                    {activeBanners.map((banner, idx) => {
                      const hasImage = Boolean(banner.imageUrl);

                      return (
                        <div 
                          key={banner.id || idx}
                          className="w-full h-full shrink-0 relative overflow-hidden"
                          style={{
                            background: hasImage ? '#000000' : (banner.backgroundColor || 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 50%, #450a0a 100%)')
                          }}
                        >
                          {/* CHẾ ĐỘ 1: CHỈ HIỂN THỊ HÌNH ẢNH (KÉO VỪA KÍCH THƯỚC BANNER) */}
                          {hasImage ? (
                            <img 
                              src={banner.imageUrl} 
                              alt={banner.title || 'Poster'}
                              className="w-full h-full object-fill block select-none pointer-events-none"
                            />
                          ) : (
                            /* CHẾ ĐỘ 2: KHẨU HIỆU CHỮ + HUY HIỆU HẢI QUÂN */
                            <div className="w-full h-full flex flex-col justify-between p-3.5 relative">
                              <div className="flex justify-between items-start">
                                <div className="flex-1 pr-2">
                                  <div className="flex items-center space-x-1 mb-1">
                                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 drop-shadow-xs" />
                                    {banner.badgeText && (
                                      <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300 drop-shadow-xs">
                                        {banner.badgeText}
                                      </span>
                                    )}
                                  </div>
                                  <h4 className="text-white font-black text-xs sm:text-[13px] leading-tight drop-shadow-md tracking-tight uppercase">
                                    {banner.title}
                                  </h4>
                                  {banner.subtitle && (
                                    <p className="text-amber-100/90 text-[10px] mt-1 leading-snug drop-shadow-xs line-clamp-2">
                                      {banner.subtitle}
                                    </p>
                                  )}
                                </div>
                                <div className="shrink-0 pl-1">
                                  <NavyEmblem className="w-14 h-14 drop-shadow-lg" />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Pagination Dots indicator on bottom */}
                          <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center space-x-1.5 z-20 pointer-events-none">
                            {activeBanners.map((_, dotIdx) => (
                              <div
                                key={dotIdx}
                                className={`transition-all duration-300 drop-shadow-sm ${
                                  dotIdx === activeSlide 
                                    ? 'w-4 h-1 bg-amber-400 rounded-full' 
                                    : 'w-1 h-1 bg-white/70 rounded-full'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Left/Right manual arrow buttons */}
                {activeBanners.length > 1 && (
                  <>
                    <button 
                      onClick={handlePrevSlide}
                      className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center z-30 transition-colors cursor-pointer"
                      title="Poster trước"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={handleNextSlide}
                      className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/40 hover:bg-black/70 text-white flex items-center justify-center z-30 transition-colors cursor-pointer"
                      title="Poster kế tiếp"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>

              {/* Simulated Mobile Content Beneath Banner */}
              <div className="mt-3 space-y-2 opacity-60">
                <div className="h-3 bg-slate-800 rounded-md w-1/3" />
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[1, 2, 3, 4].map(k => (
                    <div key={k} className="bg-slate-800/80 rounded-xl p-2 flex flex-col items-center">
                      <div className="w-5 h-5 rounded-full bg-slate-700 mb-1" />
                      <div className="w-8 h-2 bg-slate-700 rounded-xs" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Home Bar */}
              <div className="w-24 h-1 bg-slate-600 rounded-full mx-auto mt-4" />
            </div>
          </div>
        </div>

        {/* Right Column: Poster / Banner Management List */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm">
                DANH SÁCH POSTER ĐANG QUẢN TRỊ ({localBanners.length}/5)
              </h3>
              <div className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                Thứ tự ưu tiên: 1 → 5
              </div>
            </div>

            {localBanners.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <ImageIcon className="w-10 h-10 mx-auto mb-2 text-slate-300" />
                <p className="text-xs">Chưa có poster/banner nào.</p>
                <button
                  onClick={handleOpenCreate}
                  className="mt-3 text-xs text-blue-600 hover:underline font-medium cursor-pointer"
                >
                  + Thêm poster đầu tiên ngay
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 mt-3">
                {[...localBanners].sort((a, b) => a.order - b.order).map((b, index) => {
                  const hasImage = Boolean(b.imageUrl);

                  return (
                    <div 
                      key={b.id} 
                      className={`p-3 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                        b.isActive 
                          ? 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs' 
                          : 'bg-slate-50 border-slate-200 opacity-60'
                      }`}
                    >
                      {/* Left: Number, Visual Thumbnail & Title */}
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        {/* Order pill */}
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                          {b.order}
                        </span>

                        {/* Thumbnail: Aspect 2.1:1, Clean preview */}
                        <div 
                          className="w-28 h-13 rounded-lg shrink-0 overflow-hidden relative border border-slate-300 shadow-2xs bg-slate-900"
                          style={{ background: hasImage ? '#000000' : (b.backgroundColor || 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)') }}
                        >
                          {hasImage ? (
                            <img 
                              src={b.imageUrl} 
                              alt="" 
                              className="w-full h-full object-fill block" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-between px-2">
                              <Star className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                              <NavyEmblem className="w-8 h-8" />
                            </div>
                          )}
                        </div>

                        {/* Title & Info */}
                        {hasImage ? (
                          <div className="min-w-0 flex-1 pr-2">
                            <span className="text-xs font-semibold text-slate-700">
                              Poster hình ảnh
                            </span>
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="flex items-center space-x-2">
                              <span className="font-semibold text-slate-800 text-xs truncate">
                                {b.title || 'Khẩu hiệu'}
                              </span>
                              {b.badgeText && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm shrink-0 bg-amber-50 text-amber-800 border border-amber-200">
                                  {b.badgeText}
                                </span>
                              )}
                            </div>
                            {b.subtitle && (
                              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                {b.subtitle}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Right: Actions Row (Strictly Separated to Prevent Overlap) */}
                      <div className="flex items-center space-x-2 shrink-0 self-end md:self-center pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                        {/* Reorder Buttons */}
                        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                          <button
                            onClick={() => handleMoveOrder(b, 'UP')}
                            disabled={index === 0}
                            title="Di chuyển lên trên"
                            className="p-1 text-slate-600 hover:text-blue-600 disabled:opacity-20 cursor-pointer"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleMoveOrder(b, 'DOWN')}
                            disabled={index === localBanners.length - 1}
                            title="Di chuyển xuống dưới"
                            className="p-1 text-slate-600 hover:text-blue-600 disabled:opacity-20 cursor-pointer"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Active Toggle */}
                        <button
                          onClick={() => handleToggleActive(b)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                            b.isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {b.isActive ? 'Đang hiện' : 'Đang ẩn'}
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(b)}
                          title="Chỉnh sửa poster"
                          className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button (Opens In-App Confirmation Modal) */}
                        <button
                          onClick={() => setBannerToDelete(b)}
                          title="Xóa poster"
                          className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: CREATE / EDIT BANNER */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {editingBanner ? 'Chỉnh sửa poster / banner' : 'Thêm poster / banner mới'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Banner Display Mode Selection Tabs */}
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setBannerMode('image')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  bannerMode === 'image'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>Tải ảnh poster (Chỉ hiển thị ảnh)</span>
              </button>
              <button
                type="button"
                onClick={() => setBannerMode('slogan')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  bannerMode === 'slogan'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span>Khẩu hiệu chính trị & Huy hiệu</span>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {/* LIVE PREVIEW INSIDE MODAL */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1.5">
                  Xem trước banner:
                </label>
                <div 
                  className="w-full aspect-[2.1/1] rounded-2xl relative overflow-hidden shadow-xs border border-slate-300 bg-slate-950"
                  style={{ 
                    background: (bannerMode === 'image' && formData.imageUrl) 
                      ? '#000000' 
                      : formData.backgroundColor 
                  }}
                >
                  {/* CHẾ ĐỘ 1: CHỈ HIỂN THỊ HÌNH ẢNH (KÉO VỪA KÍCH THƯỚC BANNER) */}
                  {bannerMode === 'image' ? (
                    formData.imageUrl ? (
                      <img 
                        src={formData.imageUrl} 
                        alt="Preview" 
                        className="w-full h-full object-fill block" 
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4">
                        <ImageIcon className="w-8 h-8 text-slate-500 mb-1" />
                        <span>Chưa tải ảnh poster lên</span>
                      </div>
                    )
                  ) : (
                    /* CHẾ ĐỘ 2: KHẨU HIỆU CHỮ + HUY HIỆU */
                    <div className="w-full h-full flex flex-col justify-between p-3.5 relative">
                      <div className="flex justify-between items-start">
                        <div className="flex-1 pr-2">
                          <div className="flex items-center space-x-1 mb-1">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            {formData.badgeText && (
                              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300">
                                {formData.badgeText}
                              </span>
                            )}
                          </div>
                          <h4 className="text-white font-black text-xs leading-tight uppercase">
                            {formData.title || 'TIÊU ĐỀ KHẨU HIỆU POSTER'}
                          </h4>
                          {formData.subtitle && (
                            <p className="text-amber-100/90 text-[10px] mt-1 leading-tight line-clamp-2">
                              {formData.subtitle}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 pl-1">
                          <NavyEmblem className="w-12 h-12" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Indicator dots preview */}
                  <div className="absolute bottom-1.5 inset-x-0 flex items-center justify-center space-x-1 z-20 pointer-events-none">
                    <div className="w-4 h-1 bg-amber-400 rounded-full" />
                    <div className="w-1 h-1 bg-white/70 rounded-full" />
                    <div className="w-1 h-1 bg-white/70 rounded-full" />
                  </div>
                </div>
              </div>

              {/* FORM FIELDS DEPENDING ON MODE */}
              {bannerMode === 'image' ? (
                /* IMAGE MODE: Only file upload */
                <div className="space-y-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Tải ảnh poster từ máy tính <span className="text-red-500">*</span>
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl border border-dashed border-blue-300 bg-white hover:border-blue-500 hover:bg-blue-50/50 cursor-pointer transition-colors shadow-2xs ${
                        uploadingImage ? 'opacity-50 pointer-events-none' : ''
                      }`}>
                        <Upload className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-slate-700">
                          {uploadingImage ? 'Đang tải lên...' : 'Chọn file ảnh từ máy tính'}
                        </span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleFileUpload} 
                          className="hidden" 
                        />
                      </label>

                      {formData.imageUrl && (
                        <div className="flex items-center space-x-2">
                          <span className="text-emerald-700 font-bold flex items-center space-x-1">
                            <CheckCircle className="w-4 h-4" />
                            <span>Đã tải ảnh thành công</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, imageUrl: '', cloudinaryPublicId: '' }))}
                            className="text-rose-600 hover:underline text-xs cursor-pointer ml-2"
                          >
                            Xóa ảnh
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* SLOGAN MODE: Title, Subtitle, Badge, Color presets */
                <div className="space-y-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Tiêu đề khẩu hiệu <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: HỌC TẬP, RÈN LUYỆN VÌ LÝ TƯỞNG CỘNG SẢN"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Lời dẫn phụ đề (nội dung bổ trợ)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Ví dụ: Kiên định mục tiêu độc lập dân tộc và chủ nghĩa xã hội"
                      value={formData.subtitle}
                      onChange={(e) => setFormData({ ...formData, subtitle: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Nhãn góc trên (Badge)
                      </label>
                      <input
                        type="text"
                        placeholder="HẢI QUÂN VIỆT NAM"
                        value={formData.badgeText}
                        onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-700 font-semibold mb-1">
                        Thứ tự hiển thị (1 - 5)
                      </label>
                      <select
                        value={formData.order}
                        onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden font-medium cursor-pointer"
                      >
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>Vị trí số {n}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Color Preset Selection */}
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1.5">
                      Tông màu nền / Gradient:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {colorPresets.map((preset) => (
                        <button
                          key={preset.name}
                          type="button"
                          onClick={() => setFormData({ ...formData, backgroundColor: preset.gradient })}
                          className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex items-center space-x-2 ${
                            formData.backgroundColor === preset.gradient
                              ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/50'
                              : 'border-slate-200 hover:border-slate-300 bg-white'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full shrink-0 ${preset.previewClass}`} />
                          <span className="text-[11px] font-medium text-slate-700 truncate">
                            {preset.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Order Selection for Image Mode */}
              {bannerMode === 'image' && (
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Thứ tự hiển thị (1 - 5)
                  </label>
                  <select
                    value={formData.order}
                    onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden font-medium cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>Vị trí số {n}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Status toggle */}
              <div className="flex items-center space-x-4 pt-1 border-t border-slate-100">
                <span className="font-semibold text-slate-700">Trạng thái:</span>
                <label className="inline-flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bannerStatus"
                    checked={formData.isActive}
                    onChange={() => setFormData({ ...formData, isActive: true })}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <span className="font-medium text-emerald-700">Hiển thị trên App</span>
                </label>
                <label className="inline-flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="bannerStatus"
                    checked={!formData.isActive}
                    onChange={() => setFormData({ ...formData, isActive: false })}
                    className="text-slate-600 focus:ring-slate-500"
                  />
                  <span className="font-medium text-slate-600">Tạm ẩn</span>
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button 
                  id="btn-save-banner"
                  type="submit" 
                  disabled={isSaving || uploadingImage}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSaving && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{editingBanner ? 'Lưu thay đổi' : 'Tạo poster'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL (In-App, 100% Reliable in iFrame) */}
      {bannerToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h4 className="font-bold text-slate-800 text-sm">Xác nhận xóa poster?</h4>
                <p className="text-slate-500 text-xs">Vị trí số {bannerToDelete.order}</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center space-x-3">
              <div 
                className="w-16 h-8 rounded-md overflow-hidden bg-slate-800 shrink-0 border border-slate-300"
              >
                {bannerToDelete.imageUrl ? (
                  <img src={bannerToDelete.imageUrl} alt="" className="w-full h-full object-fill" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800 text-xs truncate">
                  {bannerToDelete.imageUrl ? 'Poster hình ảnh' : (bannerToDelete.title || 'Khẩu hiệu')}
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              Poster này sẽ được xóa vĩnh viễn khỏi ứng dụng. Bạn có chắc chắn muốn xóa không?
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setBannerToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs transition-colors cursor-pointer flex items-center space-x-1.5"
              >
                {isDeleting && (
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
