import React, { useState, useEffect } from 'react';
import { 
  MessageSquareText, 
  Search, 
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  MessageCircle, 
  Send, 
  Trash2, 
  Download, 
  Plus, 
  RefreshCw,
  Building2,
  User as UserIcon,
  HelpCircle,
  FileSpreadsheet,
  Check,
  Edit3,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  Eye
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { UserFeedback, FeedbackType, FeedbackStatus, Unit, FeedbackReplyItem } from '../types';
import { api } from '../services/api';
import { matchSearch } from '../utils/vietnamese';

// Helper to extract all responses cleanly
export const getFeedbackResponses = (fb?: UserFeedback | null): FeedbackReplyItem[] => {
  if (!fb) return [];
  if (Array.isArray(fb.responses) && fb.responses.length > 0) {
    return fb.responses;
  }
  if (Array.isArray(fb.replies) && fb.replies.length > 0) {
    return fb.replies;
  }
  if (fb.adminResponse) {
    return [{
      id: 'legacy-resp',
      content: fb.adminResponse,
      respondedBy: fb.respondedBy || 'Ban Quản Trị',
      respondedAt: fb.respondedAt || fb.updatedAt || ''
    }];
  }
  return [];
};

// Helper to extract all attached images cleanly from any client version or field format
export const getFeedbackImages = (fb?: UserFeedback | null): string[] => {
  if (!fb) return [];
  const rawList: string[] = [];

  // 1. Array-based fields
  const arraySources = [
    fb.images,
    fb.imageUrls,
    fb.attachedImages,
    fb.danhSachHinhAnh,
    fb.hinhAnh,
    (fb as any).attachments,
    (fb as any).files
  ];

  for (const arr of arraySources) {
    if (Array.isArray(arr)) {
      for (const item of arr) {
        if (typeof item === 'string' && item.trim()) {
          rawList.push(item.trim());
        } else if (item && typeof item === 'object') {
          const u = item.url || item.downloadUrl || item.imageUrl || item.src || item.uri || item.path || item.base64;
          if (typeof u === 'string' && u.trim()) {
            rawList.push(u.trim());
          }
        }
      }
    }
  }

  // 2. String-based fields
  const strSources = [
    fb.imageUrl,
    fb.image,
    typeof fb.hinhAnh === 'string' ? fb.hinhAnh : undefined,
    (fb as any).attachmentUrl,
    (fb as any).fileUrl
  ];

  for (const s of strSources) {
    if (typeof s === 'string' && s.trim()) {
      rawList.push(s.trim());
    }
  }

  // Deduplicate while preserving order
  const uniqueImages: string[] = [];
  for (const img of rawList) {
    if (!uniqueImages.includes(img)) {
      uniqueImages.push(img);
    }
  }

  return uniqueImages;
};

// Formats image src to handle raw base64 or complete data-URI / URL
export const formatImageSrc = (src: string): string => {
  if (!src) return '';
  const trimmed = src.trim();
  if (trimmed.startsWith('data:') || trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  // Base64 without data URI scheme header
  if (trimmed.startsWith('/9j/')) {
    return `data:image/jpeg;base64,${trimmed}`;
  }
  if (trimmed.startsWith('iVBORw0KGgo')) {
    return `data:image/png;base64,${trimmed}`;
  }
  if (trimmed.startsWith('R0lGOD')) {
    return `data:image/gif;base64,${trimmed}`;
  }
  if (trimmed.startsWith('UklGR')) {
    return `data:image/webp;base64,${trimmed}`;
  }
  return `data:image/jpeg;base64,${trimmed}`;
};

// Helper to trigger safe image download to local computer
export const handleDownloadImage = (imgSrc: string, fileName?: string) => {
  try {
    const formatted = formatImageSrc(imgSrc);
    const link = document.createElement('a');
    link.href = formatted;
    link.download = fileName || `hinh-anh-phan-anh-${Date.now()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error('Lỗi tải ảnh:', err);
  }
};

interface FeedbacksViewProps {
  currentUser?: any;
  units?: Unit[];
}

export const FeedbacksView: React.FC<FeedbacksViewProps> = ({ currentUser, units = [] }) => {
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');

  // Compute clean unique unit options list with guaranteed unique keys
  const allUnitOptions = React.useMemo(() => {
    const set = new Set<string>();
    units.forEach((u) => {
      if (u && u.name) set.add(u.name);
    });
    set.add('Lữ đoàn 162');
    set.add('Tiểu đoàn 454');
    set.add('Đảo Trường Sa');
    return Array.from(set);
  }, [units]);

  // Response Modal State
  const [activeFeedbackForResponse, setActiveFeedbackForResponse] = useState<UserFeedback | null>(null);
  const [responseStatus, setResponseStatus] = useState<FeedbackStatus>('RESOLVED');
  const [responseText, setResponseText] = useState<string>('');
  const [respondedByText, setRespondedByText] = useState<string>('');
  const [isSubmittingResponse, setIsSubmittingResponse] = useState<boolean>(false);

  // Create Feedback Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [newFeedbackForm, setNewFeedbackForm] = useState({
    userName: currentUser?.name || currentUser?.fullName || 'Thượng úy Nguyễn Văn Hoàng',
    userRank: currentUser?.rank || 'Thượng úy',
    userPosition: currentUser?.position || 'Trợ lý Tuyên huấn',
    unitName: currentUser?.unitName || currentUser?.unit || 'Lữ đoàn 162',
    type: 'QUESTION_ERROR' as FeedbackType,
    title: '',
    content: '',
    relatedExamTitle: '',
    relatedQuestionText: ''
  });

  // Image Lightbox Modal State
  const [selectedImageModal, setSelectedImageModal] = useState<{
    images: string[];
    currentIndex: number;
    feedbackTitle?: string;
    userName?: string;
    unitName?: string;
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [filterOnlyWithImages, setFilterOnlyWithImages] = useState<boolean>(false);

  // Load Feedbacks
  const loadFeedbacks = async () => {
    setIsLoading(true);
    try {
      const data = await api.getFeedbacks();
      setFeedbacks(data);
    } catch (err) {
      console.error('Lỗi tải danh sách phản ánh:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFeedbacks();

    // Listen for realtime feedbacks
    const unsub = api.listenFeedbacks((data) => {
      setFeedbacks(data);
    });

    return () => unsub();
  }, []);

  // Keyboard controls for image lightbox (Esc to close, ArrowLeft/ArrowRight to switch)
  useEffect(() => {
    if (!selectedImageModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedImageModal(null);
      } else if (e.key === 'ArrowRight') {
        setSelectedImageModal(prev => {
          if (!prev || prev.images.length <= 1) return prev;
          const nextIdx = (prev.currentIndex + 1) % prev.images.length;
          return { ...prev, currentIndex: nextIdx };
        });
        setZoomLevel(1);
        setRotation(0);
      } else if (e.key === 'ArrowLeft') {
        setSelectedImageModal(prev => {
          if (!prev || prev.images.length <= 1) return prev;
          const prevIdx = (prev.currentIndex - 1 + prev.images.length) % prev.images.length;
          return { ...prev, currentIndex: prevIdx };
        });
        setZoomLevel(1);
        setRotation(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImageModal]);

  // Filter logic
  const filteredFeedbacks = feedbacks.filter((fb) => {
    if (selectedStatus !== 'ALL' && fb.status !== selectedStatus) return false;
    if (selectedType !== 'ALL' && fb.type !== selectedType) return false;
    if (selectedUnit !== 'ALL' && fb.unitName !== selectedUnit) return false;

    // Filter by presence of images
    if (filterOnlyWithImages && getFeedbackImages(fb).length === 0) {
      return false;
    }

    if (searchQuery.trim()) {
      const matchTitle = matchSearch(fb.title, searchQuery);
      const matchContent = matchSearch(fb.content, searchQuery);
      const matchName = matchSearch(fb.userName, searchQuery);
      const matchUnit = matchSearch(fb.unitName, searchQuery);
      const matchExam = matchSearch(fb.relatedExamTitle, searchQuery);
      if (!matchTitle && !matchContent && !matchName && !matchUnit && !matchExam) {
        return false;
      }
    }
    return true;
  });

  // KPI calculations
  const totalCount = feedbacks.length;
  const pendingCount = feedbacks.filter(f => f.status === 'PENDING').length;
  const processingCount = feedbacks.filter(f => f.status === 'RECEIVED' || f.status === 'PROCESSING').length;
  const resolvedCount = feedbacks.filter(f => f.status === 'RESOLVED').length;
  const questionErrorCount = feedbacks.filter(f => f.type === 'QUESTION_ERROR' || f.type === 'EXAM_ERROR').length;
  const withImagesCount = feedbacks.filter(f => getFeedbackImages(f).length > 0).length;

  // Open Response Modal (Chỉ được thêm phản hồi mới, không sửa phản hồi cũ)
  const handleOpenResponseModal = (fb: UserFeedback) => {
    setActiveFeedbackForResponse(fb);
    setResponseStatus(fb.status === 'PENDING' ? 'RESOLVED' : fb.status);
    setResponseText(''); // Không điền phản hồi cũ để tránh sửa đè, luôn để trống để nhập phản hồi mới thêm
    const activeAdminName = currentUser?.fullName || currentUser?.name || currentUser?.username || 'Phạm Khắc Thành';
    setRespondedByText(activeAdminName);
  };

  // Submit Response
  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFeedbackForResponse) return;

    if (!responseText.trim()) {
      alert('Vui lòng nhập nội dung phản hồi!');
      return;
    }

    setIsSubmittingResponse(true);
    try {
      const finalResponder = currentUser?.fullName || currentUser?.name || respondedByText || 'Phạm Khắc Thành';
      await api.updateFeedbackStatus(
        activeFeedbackForResponse.id,
        responseStatus,
        responseText.trim(),
        finalResponder
      );
      const prevCount = getFeedbackResponses(activeFeedbackForResponse).length;
      alert(prevCount > 0 
        ? `Đã thêm phản hồi mới thành công! Thông báo đã được gửi riêng tới duy nhất tài khoản của đồng chí ${activeFeedbackForResponse.userName || 'quân nhân'}.`
        : `Đã lưu phản hồi thành công! Thông báo đã được gửi riêng tới duy nhất tài khoản của đồng chí ${activeFeedbackForResponse.userName || 'quân nhân'}.`
      );
      setActiveFeedbackForResponse(null);
      loadFeedbacks();
    } catch (err: any) {
      alert(`Lỗi lưu phản hồi: ${err.message}`);
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  // Delete Feedback
  const handleDeleteFeedback = async (id: string, title: string) => {
    if (!confirm(`Đồng chí có chắc chắn muốn xóa phản ánh "${title}"?`)) return;
    try {
      await api.deleteFeedback(id);
      loadFeedbacks();
    } catch (err: any) {
      alert(`Lỗi xóa phản ánh: ${err.message}`);
    }
  };

  // Submit New Feedback
  const handleCreateFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedbackForm.title.trim() || !newFeedbackForm.content.trim()) {
      alert('Vui lòng nhập đầy đủ tiêu đề và nội dung phản ánh');
      return;
    }

    try {
      await api.createFeedback({
        userName: newFeedbackForm.userName.trim(),
        userRank: newFeedbackForm.userRank.trim(),
        userPosition: newFeedbackForm.userPosition.trim(),
        unitName: newFeedbackForm.unitName.trim(),
        type: newFeedbackForm.type,
        title: newFeedbackForm.title.trim(),
        content: newFeedbackForm.content.trim(),
        relatedExamTitle: newFeedbackForm.relatedExamTitle.trim(),
        relatedQuestionText: newFeedbackForm.relatedQuestionText.trim(),
        status: 'PENDING'
      });

      alert('Đã tạo phản ánh mới thành công!');
      setIsCreateModalOpen(false);
      setNewFeedbackForm({
        userName: currentUser?.name || currentUser?.fullName || 'Thượng úy Nguyễn Văn Hoàng',
        userRank: currentUser?.rank || 'Thượng úy',
        userPosition: currentUser?.position || 'Trợ lý Tuyên huấn',
        unitName: currentUser?.unitName || currentUser?.unit || 'Lữ đoàn 162',
        type: 'QUESTION_ERROR',
        title: '',
        content: '',
        relatedExamTitle: '',
        relatedQuestionText: ''
      });
      loadFeedbacks();
    } catch (err: any) {
      alert(`Lỗi gửi phản ánh: ${err.message}`);
    }
  };

  // Export Excel Report
  const handleExportExcel = () => {
    if (filteredFeedbacks.length === 0) {
      alert('Không có dữ liệu phản ánh nào để xuất Excel');
      return;
    }

    const excelRows = filteredFeedbacks.map((item, index) => {
      const imgs = getFeedbackImages(item);
      return {
        'STT': index + 1,
        'Mã Phản Ánh': item.id,
        'Họ và Tên Quân Nhân': item.userName,
        'Cấp Bậc / Chức Vụ': `${item.userRank || ''} ${item.userPosition ? '- ' + item.userPosition : ''}`.trim(),
        'Đơn Vị': item.unitName,
        'Loại Phản Ánh': getTypeLabel(item.type),
        'Tiêu Đề': item.title,
        'Nội Dung Chi Tiết': item.content,
        'Hình Ảnh Đính Kèm': imgs.length > 0 ? `Có (${imgs.length} ảnh)` : 'Không có',
        'Đợt Thi / Bài Học Liên Quan': item.relatedExamTitle || 'N/A',
        'Câu Hỏi Báo Lỗi': item.relatedQuestionText || 'N/A',
        'Trạng Thái Xử Lý': getStatusLabel(item.status),
        'Nội Dung Ban Quản Trị Phản Hồi': item.adminResponse || 'Chưa phản hồi',
        'Người Phản Hồi': item.respondedBy || 'N/A',
        'Thời Gian Gửi': new Date(item.createdAt).toLocaleString('vi-VN'),
        'Thời Gian Cập Nhật': item.updatedAt ? new Date(item.updatedAt).toLocaleString('vi-VN') : ''
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Phan_Anh_Gop_Y');

    // Auto width
    worksheet['!cols'] = [
      { wch: 6 },  // STT
      { wch: 12 }, // ID
      { wch: 25 }, // Name
      { wch: 25 }, // Rank/Pos
      { wch: 18 }, // Unit
      { wch: 22 }, // Type
      { wch: 35 }, // Title
      { wch: 45 }, // Content
      { wch: 30 }, // Exam
      { wch: 35 }, // Question
      { wch: 18 }, // Status
      { wch: 45 }, // Response
      { wch: 25 }, // RespondedBy
      { wch: 20 }, // Time
      { wch: 20 }  // Time
    ];

    XLSX.writeFile(workbook, `BAO_CAO_PHAN_ANH_GOP_Y_VUNG4_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Helper Labels & Badges
  const getTypeLabel = (type: FeedbackType) => {
    switch (type) {
      case 'QUESTION_ERROR': return 'Báo lỗi câu hỏi thi';
      case 'EXAM_ERROR': return 'Báo lỗi đợt kiểm tra';
      case 'APP_SUGGESTION': return 'Góp ý giao diện / App';
      case 'GDCT_CONTENT': return 'Thắc mắc nội dung GDCT';
      case 'OTHER': return 'Ý kiến khác';
      default: return 'Phản ánh';
    }
  };

  const getTypeBadgeClass = (type: FeedbackType) => {
    switch (type) {
      case 'QUESTION_ERROR':
      case 'EXAM_ERROR':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'APP_SUGGESTION':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'GDCT_CONTENT':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusLabel = (status: FeedbackStatus) => {
    switch (status) {
      case 'PENDING': return 'Chờ xử lý';
      case 'RECEIVED': return 'Đã tiếp nhận';
      case 'PROCESSING': return 'Đang giải quyết';
      case 'RESOLVED': return 'Đã xử lý / Phản hồi';
      default: return 'Khác';
    }
  };

  const getStatusBadgeClass = (status: FeedbackStatus) => {
    switch (status) {
      case 'PENDING':
        return 'bg-amber-500 text-slate-950 font-bold';
      case 'RECEIVED':
        return 'bg-blue-600 text-white font-bold';
      case 'PROCESSING':
        return 'bg-purple-600 text-white font-bold';
      case 'RESOLVED':
        return 'bg-emerald-600 text-white font-bold';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="bg-gradient-to-r from-[#0B1E3B] via-[#102A54] to-[#1E3A8A] text-white p-6 rounded-3xl shadow-lg border border-slate-700 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs uppercase tracking-widest mb-1">
              <MessageSquareText className="w-4 h-4" />
              <span>HỆ THỐNG TIẾP NHẬN & PHẢN HỒI Ý KIẾN VÙNG 4 HẢI QUÂN</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">
              SỔ TAY PHẢN ÁNH, BÁO LỖI & GÓP Ý TỪ QUÂN NHÂN
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Nơi tiếp nhận trực tiếp các phản ánh báo lỗi câu hỏi đề thi, thắc mắc bài học Giáo dục chính trị và ý kiến góp ý nâng cấp ứng dụng di động từ cán bộ chiến sĩ toàn Vùng.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleExportExcel}
              className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Báo Cáo Excel (.xlsx)</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">TỔNG SỐ PHẢN ÁNH</span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">{totalCount}</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Tất cả bài gửi từ tài khoản</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-amber-700 uppercase tracking-wider">CHỜ XỬ LÝ</span>
            <span className="text-2xl font-black text-amber-600 mt-0.5 block">{pendingCount}</span>
            <span className="text-[11px] text-amber-600/80 mt-0.5 block">Cần tiếp nhận & giải quyết</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-rose-700 uppercase tracking-wider">BÁO LỖI CÂU HỎI</span>
            <span className="text-2xl font-black text-rose-600 mt-0.5 block">{questionErrorCount}</span>
            <span className="text-[11px] text-rose-600/80 mt-0.5 block">Ngân hàng câu hỏi/đề</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setFilterOnlyWithImages(!filterOnlyWithImages)}
          className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between cursor-pointer transition-all ${
            filterOnlyWithImages 
              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300' 
              : 'bg-white border-slate-200 hover:border-blue-300'
          }`}
          title="Bấm để lọc danh sách có ảnh đính kèm"
        >
          <div>
            <span className="block text-[11px] font-bold text-blue-700 uppercase tracking-wider">CÓ ẢNH ĐÍNH KÈM</span>
            <span className="text-2xl font-black text-blue-600 mt-0.5 block">{withImagesCount}</span>
            <span className="text-[11px] text-blue-600/80 mt-0.5 block">{filterOnlyWithImages ? 'Đang lọc (Bấm bỏ lọc)' : 'Bấm để lọc nhanh'}</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-100/70 text-blue-700 flex items-center justify-center border border-blue-200 shrink-0">
            <ImageIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider">ĐÃ XỬ LÝ & PHẢN HỒI</span>
            <span className="text-2xl font-black text-emerald-600 mt-0.5 block">{resolvedCount}</span>
            <span className="text-[11px] text-emerald-600/80 mt-0.5 block">Hoàn thành giải đáp</span>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo quân nhân, đơn vị, tiêu đề..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium focus:outline-none focus:border-blue-500 focus:bg-white"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Filter by image toggle button */}
            <button
              type="button"
              onClick={() => setFilterOnlyWithImages(!filterOnlyWithImages)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                filterOnlyWithImages
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="Lọc các phản ánh có ảnh đính kèm"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Có ảnh ({withImagesCount})</span>
            </button>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PENDING">⚠️ Chờ xử lý ({feedbacks.filter(f => f.status === 'PENDING').length})</option>
              <option value="RECEIVED">🔵 Đã tiếp nhận</option>
              <option value="PROCESSING">🟣 Đang giải quyết</option>
              <option value="RESOLVED">✅ Đã xử lý / Phản hồi</option>
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả phân loại</option>
              <option value="QUESTION_ERROR">🚨 Báo lỗi câu hỏi thi</option>
              <option value="EXAM_ERROR">📌 Báo lỗi đợt kiểm tra</option>
              <option value="APP_SUGGESTION">💡 Góp ý giao diện / App</option>
              <option value="GDCT_CONTENT">📖 Thắc mắc nội dung GDCT</option>
              <option value="OTHER">💬 Ý kiến khác</option>
            </select>

            {/* Unit Filter */}
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả đơn vị</option>
              {allUnitOptions.map((unitName, idx) => (
                <option key={`filter-unit-${unitName}-${idx}`} value={unitName}>
                  {unitName}
                </option>
              ))}
            </select>

            <button
              onClick={loadFeedbacks}
              title="Tải lại danh sách"
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main List of Feedbacks */}
      {isLoading ? (
        <div className="py-16 text-center text-slate-500 text-xs">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <span>Đang tải danh sách phản ánh từ cơ sở dữ liệu Firestore...</span>
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-md mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto mb-3">
            <MessageSquareText className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Không tìm thấy phản ánh nào</h3>
          <p className="text-xs text-slate-500 mt-1 mb-4">
            Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.
          </p>
          <button
            onClick={() => {
              setSelectedStatus('ALL');
              setSelectedType('ALL');
              setSelectedUnit('ALL');
              setSearchQuery('');
            }}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFeedbacks.map((item, idx) => (
            <div
              key={item.id || `feedback-item-${idx}`}
              className={`bg-white rounded-2xl border shadow-sm p-5 transition-all hover:shadow-md ${
                item.status === 'PENDING' ? 'border-amber-300 ring-2 ring-amber-100' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                {/* User & Sender Metadata */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-amber-400 font-black text-sm flex items-center justify-center shrink-0 border border-slate-700 shadow-sm">
                    {item.userName ? item.userName.charAt(0) : 'Q'}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-black text-slate-900">{item.userName}</span>
                      {item.userRank && (
                        <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.userRank}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                      <span className="flex items-center space-x-1 font-medium">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{item.unitName}</span>
                      </span>
                      {item.userPosition && (
                        <>
                          <span>•</span>
                          <span>{item.userPosition}</span>
                        </>
                      )}
                      <span>•</span>
                      <span className="text-slate-400">{new Date(item.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                  </div>
                </div>

                {/* Status and Type Badges */}
                <div className="flex items-center space-x-2 shrink-0">
                  {getFeedbackImages(item).length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const imgs = getFeedbackImages(item);
                        setSelectedImageModal({
                          images: imgs,
                          currentIndex: 0,
                          feedbackTitle: item.title,
                          userName: item.userName,
                          unitName: item.unitName
                        });
                        setZoomLevel(1);
                        setRotation(0);
                      }}
                      className="text-[11px] px-2.5 py-1 rounded-lg bg-blue-100 text-blue-800 border border-blue-300 font-bold flex items-center space-x-1 hover:bg-blue-200 transition-colors shadow-xs"
                      title="Bấm để xem các hình ảnh đính kèm"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                      <span>{getFeedbackImages(item).length} ảnh đính kèm</span>
                    </button>
                  )}

                  <span className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold ${getTypeBadgeClass(item.type)}`}>
                    {getTypeLabel(item.type)}
                  </span>

                  <span className={`text-[11px] px-3 py-1 rounded-lg shadow-sm ${getStatusBadgeClass(item.status)}`}>
                    {getStatusLabel(item.status)}
                  </span>
                </div>
              </div>

              {/* Feedback Content */}
              <div className="py-3 space-y-2">
                <h3 className="text-base font-bold text-slate-900 leading-snug">{item.title}</h3>

                {/* Related Exam or Question Notice */}
                {(item.relatedExamTitle || item.relatedQuestionText) && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    {item.relatedExamTitle && (
                      <div className="font-bold text-blue-800 flex items-center space-x-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                        <span>Đợt kiểm tra: {item.relatedExamTitle}</span>
                      </div>
                    )}
                    {item.relatedQuestionText && (
                      <div className="text-slate-700 italic bg-white p-2 rounded-lg border border-slate-200">
                        "{item.relatedQuestionText}"
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                  {item.content}
                </p>

                {/* Attached Images Gallery */}
                {(() => {
                  const attachedImages = getFeedbackImages(item);
                  if (attachedImages.length === 0) return null;

                  return (
                    <div className="mt-3 p-3.5 rounded-2xl bg-blue-50/50 border border-blue-200/80 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-xs font-bold text-blue-900">
                          <ImageIcon className="w-4 h-4 text-blue-600" />
                          <span>Hình ảnh đính kèm từ quân nhân ({attachedImages.length} ảnh):</span>
                        </div>
                        <span className="text-[11px] text-slate-500 italic hidden sm:inline">
                          Bấm vào ảnh để xem kích thước lớn, phóng to hoặc tải về
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                        {attachedImages.map((imgSrc, imgIdx) => (
                          <div
                            key={`fb-img-${item.id}-${imgIdx}`}
                            onClick={() => {
                              setSelectedImageModal({
                                images: attachedImages,
                                currentIndex: imgIdx,
                                feedbackTitle: item.title,
                                userName: item.userName,
                                unitName: item.unitName
                              });
                              setZoomLevel(1);
                              setRotation(0);
                            }}
                            className="group relative aspect-video sm:aspect-square bg-slate-900/5 rounded-xl overflow-hidden border border-slate-300/80 hover:border-blue-500 cursor-pointer shadow-xs hover:shadow-md transition-all"
                          >
                            <img
                              src={formatImageSrc(imgSrc)}
                              alt={`Hình ảnh đính kèm ${imgIdx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              loading="lazy"
                            />
                            {/* Hover overlay with zoom icon */}
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white">
                              <Eye className="w-5 h-5 mb-0.5 text-white drop-shadow-sm" />
                              <span className="text-[10px] font-bold">Xem ảnh #{imgIdx + 1}</span>
                            </div>
                            <span className="absolute bottom-1 right-1 bg-slate-900/70 backdrop-blur-xs text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                              #{imgIdx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Admin Official Response Box */}
                {(() => {
                  const replyList = getFeedbackResponses(item);
                  if (replyList.length > 0) {
                    return (
                      <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-2.5">
                        <div className="flex items-center justify-between text-xs border-b border-emerald-200/80 pb-2">
                          <span className="font-bold text-emerald-900 flex items-center space-x-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>
                              {replyList.length > 1 ? `Phản Hồi Từ Ban Quản Trị (${replyList.length} lần):` : 'Phản Hồi Chính Thức Từ Ban Quản Trị:'}
                            </span>
                          </span>
                          <span className="text-[11px] text-emerald-700 font-medium">
                            {item.respondedAt ? new Date(item.respondedAt).toLocaleString('vi-VN') : ''}
                          </span>
                        </div>

                        <div className="space-y-2">
                          {replyList.map((resp, rIdx) => (
                            <div key={resp.id || rIdx} className="bg-white p-2.5 rounded-xl border border-emerald-100 space-y-1">
                              {replyList.length > 1 && (
                                <div className="flex items-center justify-between text-[10px] text-emerald-900 font-bold">
                                  <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded text-[10px]">
                                    Lần {rIdx + 1}
                                  </span>
                                  <span className="text-slate-500 font-normal">
                                    {resp.respondedAt ? new Date(resp.respondedAt).toLocaleString('vi-VN') : ''}
                                  </span>
                                </div>
                              )}
                              <p className="text-xs text-emerald-950 font-medium leading-relaxed whitespace-pre-line">
                                {resp.content}
                              </p>
                              {resp.respondedBy && (
                                <div className="text-[10px] text-emerald-800 font-bold text-right italic">
                                  — Phản hồi bởi: {resp.respondedBy}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div className="text-[11px] text-amber-700 italic bg-amber-50 p-2.5 rounded-xl border border-amber-200/60 flex items-center space-x-2">
                      <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Phản ánh này chưa có nội dung trả lời từ Ban Quản Trị. Bấm "Phản Hồi / Xử Lý" bên dưới để nhập phản hồi.</span>
                    </div>
                  );
                })()}
              </div>

              {/* Action Toolbar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-400 font-mono">
                  ID: {item.id}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleOpenResponseModal(item)}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{getFeedbackResponses(item).length > 0 ? 'Thêm Phản Hồi' : 'Phản Hồi / Xử Lý'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: RESPONSE TO FEEDBACK */}
      {/* ========================================================= */}
      {activeFeedbackForResponse && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveFeedbackForResponse(null);
          }}
        >
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 cursor-default">
            <div className="p-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center space-x-2">
                <MessageCircle className="w-4 h-4 text-amber-400" />
                <span>
                  {getFeedbackResponses(activeFeedbackForResponse).length > 0 ? 'Thêm Phản Hồi Cho Góp Ý' : 'Phản Hồi Phản Ánh Tới Quân Nhân'}
                </span>
              </h3>
              <button
                onClick={() => setActiveFeedbackForResponse(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitResponse} className="p-5 space-y-4 text-xs">
              {/* Original Feedback Summary */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{activeFeedbackForResponse.userName} ({activeFeedbackForResponse.unitName})</span>
                  <span className="text-[10px] text-slate-500">{new Date(activeFeedbackForResponse.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
                <div className="text-slate-900 font-bold">{activeFeedbackForResponse.title}</div>
                <p className="text-slate-600 italic bg-white p-2.5 rounded-xl border border-slate-200">
                  "{activeFeedbackForResponse.content}"
                </p>

                {/* Attached Images in Response Modal */}
                {(() => {
                  const modalImgs = getFeedbackImages(activeFeedbackForResponse);
                  if (modalImgs.length === 0) return null;
                  return (
                    <div className="pt-2 border-t border-slate-200/80">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-blue-900 flex items-center space-x-1">
                          <ImageIcon className="w-3.5 h-3.5 text-blue-600" />
                          <span>Hình ảnh đính kèm ({modalImgs.length}):</span>
                        </span>
                        <span className="text-[10px] text-blue-600 font-medium">Bấm để phóng to ảnh</span>
                      </div>
                      <div className="flex items-center space-x-2 overflow-x-auto pb-1">
                        {modalImgs.map((img, i) => (
                          <div
                            key={`resp-img-${i}`}
                            onClick={() => {
                              setSelectedImageModal({
                                images: modalImgs,
                                currentIndex: i,
                                feedbackTitle: activeFeedbackForResponse.title,
                                userName: activeFeedbackForResponse.userName,
                                unitName: activeFeedbackForResponse.unitName
                              });
                              setZoomLevel(1);
                              setRotation(0);
                            }}
                            className="w-14 h-14 rounded-lg overflow-hidden border border-slate-300 hover:border-blue-500 cursor-pointer shrink-0 group relative shadow-2xs"
                          >
                            <img
                              src={formatImageSrc(img)}
                              alt={`Ảnh ${i + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Previous Responses History (Read-only: Không được sửa phản hồi cũ) */}
              {(() => {
                const prevResponses = getFeedbackResponses(activeFeedbackForResponse);
                if (prevResponses.length === 0) return null;
                return (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-slate-700 font-bold flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Các Phản Hồi Đã Gửi Trước Đó ({prevResponses.length} lần):</span>
                      </label>
                      <span className="text-[10px] text-slate-500 italic">Không thể chỉnh sửa phản hồi cũ</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-2 p-1.5 bg-slate-50 rounded-2xl border border-slate-200">
                      {prevResponses.map((r, i) => (
                        <div key={r.id || i} className="bg-white p-2.5 rounded-xl border border-slate-200/80 text-xs space-y-1 shadow-sm">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px]">
                              Phản hồi lần {i + 1}
                            </span>
                            <span className="text-slate-500">
                              {r.respondedAt ? new Date(r.respondedAt).toLocaleString('vi-VN') : ''}
                            </span>
                          </div>
                          <p className="text-slate-900 leading-relaxed whitespace-pre-line font-medium">{r.content}</p>
                          {r.respondedBy && (
                            <div className="text-[10px] text-emerald-800 font-bold italic text-right">
                              — Người trả lời: {r.respondedBy}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Status Selector */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Cập Nhật Trạng Thái Xử Lý *</label>
                <select
                  value={responseStatus}
                  onChange={(e) => setResponseStatus(e.target.value as FeedbackStatus)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-bold focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="RECEIVED">🔵 Đã tiếp nhận (Chưa phản hồi)</option>
                  <option value="PROCESSING">🟣 Đang giải quyết / Đang kiểm tra</option>
                  <option value="RESOLVED">✅ Đã xử lý & Phản hồi thành công</option>
                  <option value="PENDING">⚠️ Chờ xử lý</option>
                </select>
              </div>

              {/* Response Textarea - Thêm phản hồi mới */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  {getFeedbackResponses(activeFeedbackForResponse).length > 0
                    ? 'Nhập Thêm Nội Dung Phản Hồi Mới *'
                    : 'Nội Dung Phản Hồi Từ Ban Quản Trị *'}
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder={getFeedbackResponses(activeFeedbackForResponse).length > 0
                    ? 'Nhập nội dung phản hồi bổ sung tiếp theo (nội dung mới sẽ được lưu thêm vào danh sách phản hồi, không ghi đè phản hồi cũ)...'
                    : 'Nhập nội dung giải đáp, đính chính câu hỏi hoặc chỉ đạo xử lý...'}
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:border-blue-500 focus:bg-white leading-relaxed"
                />
              </div>

              {/* Responded By Input (Cố định theo tài khoản Admin, không được sửa) */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 flex items-center justify-between">
                  <span>Danh Nghĩa Phản Hồi (Tên/Chức vụ người trả lời)</span>
                  <span className="text-[11px] font-normal text-slate-400 italic">
                    (Cố định theo tài khoản Admin đăng nhập, không được sửa)
                  </span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={respondedByText}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-slate-700 font-bold cursor-not-allowed select-none focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setActiveFeedbackForResponse(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResponse}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md flex items-center space-x-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSubmittingResponse
                      ? 'Đang lưu...'
                      : (getFeedbackResponses(activeFeedbackForResponse).length > 0 ? 'Gửi Thêm Phản Hồi' : 'Gửi Phản Hồi & Lưu')}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE TEST FEEDBACK (GIẢ LẬP GỬI PHẢN ÁNH) */}
      {/* ========================================================= */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCreateModalOpen(false);
          }}
        >
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 cursor-default">
            <div className="p-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center space-x-2">
                <Plus className="w-4 h-4 text-amber-400" />
                <span>Gửi Phản Ánh Mẫu (Giả Lập Dữ Liệu)</span>
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFeedbackSubmit} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Họ và Tên Quân Nhân *</label>
                  <input
                    type="text"
                    required
                    value={newFeedbackForm.userName}
                    onChange={(e) => setNewFeedbackForm({ ...newFeedbackForm, userName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Cấp Bậc & Chức Vụ</label>
                  <input
                    type="text"
                    value={newFeedbackForm.userRank}
                    onChange={(e) => setNewFeedbackForm({ ...newFeedbackForm, userRank: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Đơn Vị *</label>
                  <select
                    value={newFeedbackForm.unitName}
                    onChange={(e) => setNewFeedbackForm({ ...newFeedbackForm, unitName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 font-bold"
                  >
                    {allUnitOptions.map((unitName, idx) => (
                      <option key={`create-unit-${unitName}-${idx}`} value={unitName}>
                        {unitName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Loại Phản Ánh *</label>
                  <select
                    value={newFeedbackForm.type}
                    onChange={(e) => setNewFeedbackForm({ ...newFeedbackForm, type: e.target.value as FeedbackType })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 font-bold"
                  >
                    <option value="QUESTION_ERROR">🚨 Báo lỗi câu hỏi thi</option>
                    <option value="EXAM_ERROR">📌 Báo lỗi đợt kiểm tra</option>
                    <option value="APP_SUGGESTION">💡 Góp ý giao diện / App</option>
                    <option value="GDCT_CONTENT">📖 Thắc mắc nội dung GDCT</option>
                    <option value="OTHER">💬 Ý kiến khác</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Tiêu Đề Phản Ánh *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Báo lỗi câu hỏi số 5 trong đợt kiểm tra Quý 1/2026..."
                  value={newFeedbackForm.title}
                  onChange={(e) => setNewFeedbackForm({ ...newFeedbackForm, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Nội Dung Chi Tiết *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Mô tả chi tiết thắc mắc, phương án câu hỏi chưa chuẩn hoặc góp ý..."
                  value={newFeedbackForm.content}
                  onChange={(e) => setNewFeedbackForm({ ...newFeedbackForm, content: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Trích dẫn câu hỏi hoặc Đợt thi (Nếu có)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Đợt 1 Quý 1/2026 - Câu 10: 'Hải quân VN thành lập năm nào...'"
                  value={newFeedbackForm.relatedQuestionText}
                  onChange={(e) => setNewFeedbackForm({ ...newFeedbackForm, relatedQuestionText: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md"
                >
                  Tạo Phản Ánh
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================= */}
      {/* FULLSCREEN IMAGE LIGHTBOX MODAL */}
      {/* ========================================================= */}
      {selectedImageModal && selectedImageModal.images.length > 0 && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/92 backdrop-blur-md flex flex-col justify-between select-none animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedImageModal(null);
            }
          }}
        >
          {/* Top Bar */}
          <div className="p-3.5 sm:p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-white shrink-0 z-10">
            <div className="flex items-center space-x-3 truncate">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-500 text-blue-400 flex items-center justify-center shrink-0">
                <ImageIcon className="w-5 h-5" />
              </div>
              <div className="truncate">
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                    {selectedImageModal.feedbackTitle || 'Hình ảnh đính kèm góp ý'}
                  </h4>
                  <span className="text-[11px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-400/30 font-mono shrink-0">
                    Ảnh {selectedImageModal.currentIndex + 1} / {selectedImageModal.images.length}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate mt-0.5">
                  Quân nhân: <span className="text-slate-200 font-semibold">{selectedImageModal.userName || 'Chưa rõ'}</span>
                  {selectedImageModal.unitName && (
                    <span> • Đơn vị: <span className="text-slate-200 font-semibold">{selectedImageModal.unitName}</span></span>
                  )}
                </div>
              </div>
            </div>

            {/* Lightbox Controls */}
            <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0 ml-3">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(0.5, +(prev - 0.25).toFixed(2)))}
                title="Thu nhỏ (-)"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors border border-slate-700"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                title="Kích thước chuẩn (100%)"
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-mono transition-colors border border-slate-700 hidden sm:inline"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(3, +(prev + 0.25).toFixed(2)))}
                title="Phóng to (+)"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors border border-slate-700"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation(prev => (prev + 90) % 360)}
                title="Xoay 90°"
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors border border-slate-700"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const currentImg = selectedImageModal.images[selectedImageModal.currentIndex];
                  handleDownloadImage(
                    currentImg, 
                    `anh-dinh-kem-${selectedImageModal.userName || 'quan-nhan'}-${selectedImageModal.currentIndex + 1}.jpg`
                  );
                }}
                title="Tải ảnh về máy"
                className="p-2 sm:px-3 sm:py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-colors shadow-sm flex items-center space-x-1.5 text-xs"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Tải ảnh</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedImageModal(null)}
                title="Đóng (Phím Esc)"
                className="p-2 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white transition-colors ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Center Image Canvas Area */}
          <div 
            className="relative flex-1 flex items-center justify-center p-4 sm:p-6 overflow-hidden"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setSelectedImageModal(null);
              }
            }}
          >
            {/* Prev Image Button */}
            {selectedImageModal.images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageModal(prev => {
                    if (!prev) return prev;
                    const prevIdx = (prev.currentIndex - 1 + prev.images.length) % prev.images.length;
                    return { ...prev, currentIndex: prevIdx };
                  });
                  setZoomLevel(1);
                  setRotation(0);
                }}
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-slate-900/80 hover:bg-blue-600 text-white flex items-center justify-center border border-slate-700/80 shadow-2xl transition-all"
                title="Ảnh trước (Mũi tên trái ←)"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Displayed Image */}
            <div 
              className="max-w-4xl max-h-[75vh] flex items-center justify-center transition-transform duration-200 select-none"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`
              }}
            >
              <img
                src={formatImageSrc(selectedImageModal.images[selectedImageModal.currentIndex])}
                alt={`Ảnh phản ánh ${selectedImageModal.currentIndex + 1}`}
                className="max-w-full max-h-[75vh] object-contain rounded-2xl shadow-2xl border border-slate-800"
              />
            </div>

            {/* Next Image Button */}
            {selectedImageModal.images.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedImageModal(prev => {
                    if (!prev) return prev;
                    const nextIdx = (prev.currentIndex + 1) % prev.images.length;
                    return { ...prev, currentIndex: nextIdx };
                  });
                  setZoomLevel(1);
                  setRotation(0);
                }}
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 z-20 w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-slate-900/80 hover:bg-blue-600 text-white flex items-center justify-center border border-slate-700/80 shadow-2xl transition-all"
                title="Ảnh tiếp theo (Mũi tên phải →)"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Bottom Thumbnails Strip */}
          <div className="p-3 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between shrink-0 z-10 text-xs">
            <div className="flex items-center space-x-2 overflow-x-auto py-1 max-w-2xl scrollbar-thin">
              {selectedImageModal.images.map((thumb, tIdx) => (
                <button
                  type="button"
                  key={`lightbox-thumb-${tIdx}`}
                  onClick={() => {
                    setSelectedImageModal(prev => prev ? { ...prev, currentIndex: tIdx } : null);
                    setZoomLevel(1);
                    setRotation(0);
                  }}
                  className={`w-14 h-11 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                    selectedImageModal.currentIndex === tIdx 
                      ? 'border-blue-500 ring-2 ring-blue-500/50 scale-105' 
                      : 'border-slate-700 opacity-60 hover:opacity-100'
                  }`}
                >
                  <img
                    src={formatImageSrc(thumb)}
                    alt={`Thu nhỏ ${tIdx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            <div className="text-slate-400 text-[11px] hidden md:block">
              Phím <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono">←</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono">→</kbd> chuyển ảnh, <kbd className="px-1.5 py-0.5 bg-slate-800 rounded border border-slate-700 text-slate-300 font-mono">Esc</kbd> đóng
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
