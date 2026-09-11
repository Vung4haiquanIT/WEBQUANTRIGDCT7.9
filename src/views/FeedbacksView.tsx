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
  Edit3
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { UserFeedback, FeedbackType, FeedbackStatus, Unit } from '../types';
import { api } from '../services/api';
import { matchSearch } from '../utils/vietnamese';

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

  // Filter logic
  const filteredFeedbacks = feedbacks.filter((fb) => {
    if (selectedStatus !== 'ALL' && fb.status !== selectedStatus) return false;
    if (selectedType !== 'ALL' && fb.type !== selectedType) return false;
    if (selectedUnit !== 'ALL' && fb.unitName !== selectedUnit) return false;

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

  // Open Response Modal
  const handleOpenResponseModal = (fb: UserFeedback) => {
    setActiveFeedbackForResponse(fb);
    setResponseStatus(fb.status === 'PENDING' ? 'RESOLVED' : fb.status);
    setResponseText(fb.adminResponse || '');
    setRespondedByText(fb.respondedBy || currentUser?.name || 'Phòng Chính trị Vùng 4');
  };

  // Submit Response
  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFeedbackForResponse) return;

    setIsSubmittingResponse(true);
    try {
      await api.updateFeedbackStatus(
        activeFeedbackForResponse.id,
        responseStatus,
        responseText.trim(),
        respondedByText.trim()
      );
      alert('Đã cập nhật phản hồi và tự động gửi thông báo tới App của quân nhân thành công!');
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

    const excelRows = filteredFeedbacks.map((item, index) => ({
      'STT': index + 1,
      'Mã Phản Ánh': item.id,
      'Họ và Tên Quân Nhân': item.userName,
      'Cấp Bậc / Chức Vụ': `${item.userRank || ''} ${item.userPosition ? '- ' + item.userPosition : ''}`.trim(),
      'Đơn Vị': item.unitName,
      'Loại Phản Ánh': getTypeLabel(item.type),
      'Tiêu Đề': item.title,
      'Nội Dung Chi Tiết': item.content,
      'Đợt Thi / Bài Học Liên Quan': item.relatedExamTitle || 'N/A',
      'Câu Hỏi Báo Lỗi': item.relatedQuestionText || 'N/A',
      'Trạng Thái Xử Lý': getStatusLabel(item.status),
      'Nội Dung Ban Quản Trị Phản Hồi': item.adminResponse || 'Chưa phản hồi',
      'Người Phản Hồi': item.respondedBy || 'N/A',
      'Thời Gian Gửi': new Date(item.createdAt).toLocaleString('vi-VN'),
      'Thời Gian Cập Nhật': item.updatedAt ? new Date(item.updatedAt).toLocaleString('vi-VN') : ''
    }));

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
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Gửi Phản Ánh Mẫu</span>
            </button>

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">TỔNG SỐ PHẢN ÁNH</span>
            <span className="text-2xl font-black text-slate-900 mt-0.5 block">{totalCount}</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">Tất cả bài gửi từ tài khoản</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shrink-0">
            <MessageCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-amber-700 uppercase tracking-wider">CHỜ XỬ LÝ</span>
            <span className="text-2xl font-black text-amber-600 mt-0.5 block">{pendingCount}</span>
            <span className="text-[11px] text-amber-600/80 mt-0.5 block">Cần tiếp nhận & giải quyết</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shrink-0">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-rose-700 uppercase tracking-wider">BÁO LỖI CÂU HỎI/ĐỀ</span>
            <span className="text-2xl font-black text-rose-600 mt-0.5 block">{questionErrorCount}</span>
            <span className="text-[11px] text-rose-600/80 mt-0.5 block">Cần kiểm tra lại ngân hàng đề</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200 shrink-0">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="block text-[11px] font-bold text-emerald-700 uppercase tracking-wider">ĐÃ XỬ LÝ & PHẢN HỒI</span>
            <span className="text-2xl font-black text-emerald-600 mt-0.5 block">{resolvedCount}</span>
            <span className="text-[11px] text-emerald-600/80 mt-0.5 block">Hoàn thành giải đáp</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
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

                {/* Admin Official Response Box */}
                {item.adminResponse ? (
                  <div className="mt-3 p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-900 flex items-center space-x-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>Phản Hồi Chính Thức Từ Ban Quản Trị:</span>
                      </span>
                      <span className="text-[11px] text-emerald-700 font-medium">
                        {item.respondedAt ? new Date(item.respondedAt).toLocaleString('vi-VN') : ''}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-950 font-medium leading-relaxed bg-white p-2.5 rounded-xl border border-emerald-100">
                      {item.adminResponse}
                    </p>
                    {item.respondedBy && (
                      <div className="text-[10px] text-emerald-800 font-bold text-right italic">
                        — Phản hồi bởi: {item.respondedBy}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-amber-700 italic bg-amber-50 p-2.5 rounded-xl border border-amber-200/60 flex items-center space-x-2">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Phản ánh này chưa có nội dung trả lời từ Ban Quản Trị. Bấm "Phản Hồi / Xử Lý" bên dưới để nhập phản hồi.</span>
                  </div>
                )}
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
                    <span>{item.adminResponse ? 'Sửa Phản Hồi' : 'Phản Hồi / Xử Lý'}</span>
                  </button>

                  <button
                    onClick={() => handleDeleteFeedback(item.id, item.title)}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-rose-600 border border-slate-200 transition-colors"
                    title="Xóa phản ánh này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center space-x-2">
                <MessageCircle className="w-4 h-4 text-amber-400" />
                <span>Phản Hồi Phản Ánh Tới Quân Nhân</span>
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
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between font-bold text-slate-800">
                  <span>{activeFeedbackForResponse.userName} ({activeFeedbackForResponse.unitName})</span>
                  <span className="text-[10px] text-slate-500">{new Date(activeFeedbackForResponse.createdAt).toLocaleDateString('vi-VN')}</span>
                </div>
                <div className="text-slate-900 font-bold">{activeFeedbackForResponse.title}</div>
                <p className="text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200">
                  "{activeFeedbackForResponse.content}"
                </p>
              </div>

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

              {/* Response Textarea */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nội Dung Phản Hồi Từ Ban Quản Trị *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Nhập nội dung giải đáp, đính chính câu hỏi hoặc chỉ đạo xử lý..."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-medium focus:outline-none focus:border-blue-500 focus:bg-white leading-relaxed"
                />
              </div>

              {/* Responded By Input */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Danh Nghĩa Phản Hồi (Tên/Chức vụ người trả lời)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Thượng tá Trần Văn Nam - Trưởng ban Tuyên huấn Vùng 4"
                  value={respondedByText}
                  onChange={(e) => setRespondedByText(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-medium"
                />
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
                  <span>{isSubmittingResponse ? 'Đang lưu...' : 'Gửi Phản Hồi & Lưu'}</span>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95">
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
    </div>
  );
};
