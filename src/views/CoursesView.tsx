import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Eye, 
  Copy, 
  RotateCcw, 
  Layers, 
  BookOpen, 
  ChevronDown, 
  ChevronRight,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertCircle,
  FileText,
  Video,
  Headphones,
  Sliders,
  MoreVertical,
  ArrowUpDown,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import { Course, Lesson, PublishStatus } from '../types';
import { DongSonDrum } from '../components/DongSonMotif';
import { api } from '../services/api';

interface CoursesViewProps {
  courses: Course[];
  lessons: Lesson[];
  onSelectLesson: (lesson: Lesson) => void;
  onPreviewLesson: (lesson: Lesson) => void;
  onCreateCourse: (course: Partial<Course>) => Promise<void>;
  onUpdateCourse: (id: string, course: Partial<Course>) => Promise<void>;
  onDeleteCourse: (id: string, permanent?: boolean) => Promise<void>;
  onCreateLesson: (lesson: Partial<Lesson>) => Promise<void>;
  onUpdateLesson: (id: string, lesson: Partial<Lesson>) => Promise<void>;
  onDuplicateLesson: (id: string) => Promise<void>;
  onDeleteLesson: (id: string, permanent?: boolean) => Promise<void>;
}

export const CoursesView: React.FC<CoursesViewProps> = ({
  courses,
  lessons,
  onSelectLesson,
  onPreviewLesson,
  onCreateCourse,
  onUpdateCourse,
  onDeleteCourse,
  onCreateLesson,
  onUpdateLesson,
  onDuplicateLesson,
  onDeleteLesson,
}) => {
  const [expandedCourseIds, setExpandedCourseIds] = useState<Record<string, boolean>>({
    [courses[0]?.id || 'course-1']: true,
  });
  const [searchFilter, setSearchFilter] = useState('');
  const [yearFilter, setYearFilter] = useState<number | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<PublishStatus | 'ALL'>('ALL');

  // Modal state for Course
  const [isCourseModalOpen, setIsCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [courseFormData, setCourseFormData] = useState({
    title: '',
    year: 2026,
    thumbnail: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    status: 'REVIEW' as PublishStatus,
    createdBy: 'Phòng Chính trị Vùng 4',
  });

  // Modal state for Lesson
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [selectedCourseForNewLesson, setSelectedCourseForNewLesson] = useState<string>('');
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonFormData, setLessonFormData] = useState({
    courseId: '',
    title: '',
    thumbnail: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
    status: 'REVIEW' as PublishStatus,
    showSlides: true,
    showContents: true,
    showVideos: true,
    showAudios: true,
    createdBy: 'Ban Tuyên huấn Vùng 4',
  });

  const toggleCourseExpand = (courseId: string) => {
    setExpandedCourseIds((prev) => ({ ...prev, [courseId]: !prev[courseId] }));
  };

  const handleThumbnailFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingThumbnail(true);
    try {
      const res = await api.uploadSlideImage(file, editingCourse?.id || 'new-course', 'general');
      if (res && res.secureUrl) {
        setCourseFormData(prev => ({ ...prev, thumbnail: res.secureUrl }));
      }
    } catch (err: any) {
      alert(`Lỗi tải ảnh lên: ${err.message}`);
    } finally {
      setIsUploadingThumbnail(false);
    }
  };

  const handleOpenNewCourse = () => {
    setEditingCourse(null);
    setCourseFormData({
      title: '',
      year: 2026,
      thumbnail: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
      status: 'REVIEW',
      createdBy: 'Phòng Chính trị Vùng 4',
    });
    setIsCourseModalOpen(true);
  };

  const handleOpenEditCourse = (course: Course) => {
    setEditingCourse(course);
    setCourseFormData({
      title: course.title,
      year: course.year,
      thumbnail: course.thumbnail,
      status: course.status || 'REVIEW',
      createdBy: course.createdBy,
    });
    setIsCourseModalOpen(true);
  };

  const handleSubmitCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseFormData.title.trim()) return;
    if (editingCourse) {
      await onUpdateCourse(editingCourse.id, courseFormData);
    } else {
      await onCreateCourse(courseFormData);
    }
    setIsCourseModalOpen(false);
  };

  const [courseToDelete, setCourseToDelete] = useState<Course | null>(null);
  const [lessonToDelete, setLessonToDelete] = useState<Lesson | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const handleConfirmDeleteCourse = (course: Course) => {
    setCourseToDelete(course);
  };

  const handleExecuteDeleteCourse = async () => {
    if (!courseToDelete) return;
    setIsDeletingItem(true);
    try {
      await onDeleteCourse(courseToDelete.id, true);
      setCourseToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleConfirmDeleteLesson = (lesson: Lesson) => {
    setLessonToDelete(lesson);
  };

  const handleExecuteDeleteLesson = async () => {
    if (!lessonToDelete) return;
    setIsDeletingItem(true);
    try {
      await onDeleteLesson(lessonToDelete.id, true);
      setLessonToDelete(null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeletingItem(false);
    }
  };

  const handleOpenNewLesson = (courseId: string) => {
    setEditingLesson(null);
    setSelectedCourseForNewLesson(courseId);
    setLessonFormData({
      courseId,
      title: '',
      thumbnail: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
      status: 'REVIEW',
      showSlides: true,
      showContents: true,
      showVideos: true,
      showAudios: true,
      createdBy: 'Ban Tuyên huấn Vùng 4',
    });
    setIsLessonModalOpen(true);
  };

  const handleSubmitLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonFormData.title.trim() || !lessonFormData.courseId) return;
    const payload = {
      courseId: lessonFormData.courseId,
      title: lessonFormData.title,
      thumbnail: lessonFormData.thumbnail,
      status: lessonFormData.status,
      moduleConfig: {
        showSlides: lessonFormData.showSlides,
        showContents: lessonFormData.showContents,
        showVideos: lessonFormData.showVideos,
        showAudios: lessonFormData.showAudios,
      },
      createdBy: lessonFormData.createdBy,
    };
    if (editingLesson) {
      await onUpdateLesson(editingLesson.id, payload);
    } else {
      await onCreateLesson(payload);
    }
    setIsLessonModalOpen(false);
  };

  // Filtered courses
  const filteredCourses = courses.filter((c) => {
    const matchSearch =
      c.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
      c.description.toLowerCase().includes(searchFilter.toLowerCase());
    const matchYear = yearFilter === 'ALL' || c.year === yearFilter;
    const matchStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchSearch && matchYear && matchStatus;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Kiến trúc phân cấp
            </span>
            <span className="text-xs text-slate-500">Chuyên đề &rarr; Bài học &rarr; Đa phương tiện</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-1">
            QUẢN LÝ CHUYÊN ĐỀ & BÀI HỌC GIÁO DỤC CHÍNH TRỊ
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          <button
            id="create-new-course-header-btn"
            onClick={handleOpenNewCourse}
            className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Chuyên đề</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center space-x-3 flex-1 min-w-[280px]">
          <div className="relative w-full max-w-md">
            <input
              type="text"
              placeholder="Tìm kiếm chuyên đề, bài học..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-none focus:border-blue-500 focus:bg-white"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-600 font-medium">Năm:</span>
            <select
              value={yearFilter}
              onChange={(e) => setYearFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả các năm</option>
              <option value={2026}>Năm 2026</option>
              <option value={2025}>Năm 2025</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5">
            <span className="text-slate-600 font-medium">Trạng thái:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="PUBLISHED">Công khai</option>
              <option value="INTERNAL">Nội bộ</option>
              <option value="REVIEW">Chờ thẩm định</option>
            </select>
          </div>
        </div>
      </div>

      {/* Courses & Lessons List */}
      <div className="space-y-4">
          {filteredCourses.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-3xl border border-slate-200 text-slate-500 shadow-sm">
              <BookOpen className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <p className="text-base font-bold text-slate-800">Không tìm thấy chuyên đề phù hợp</p>
              <p className="text-xs text-slate-500 mt-1">Vui lòng thay đổi bộ lọc hoặc thêm chuyên đề mới.</p>
            </div>
          ) : (
            filteredCourses.map((course) => {
              const isExpanded = !!expandedCourseIds[course.id];
              const courseLessons = lessons.filter((l) => l.courseId === course.id && !l.isDeleted);

              return (
                <div
                  key={course.id}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden transition-all"
                >
                  {/* Course Header Bar */}
                  <div className="p-4 lg:p-5 bg-slate-50/80 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleCourseExpand(course.id)}
                        className="p-1.5 rounded-lg bg-white text-slate-700 hover:bg-slate-100 mt-1 border border-slate-200 shrink-0 shadow-sm"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <div className="w-14 h-14 rounded-2xl bg-slate-200 overflow-hidden shrink-0 border border-slate-200 shadow-sm">
                        <img src={course.thumbnail} alt={course.title} className="w-full h-full object-cover" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase bg-amber-500 text-slate-950 px-2 py-0.5 rounded shadow-sm">
                            CHUYÊN ĐỀ {course.year}
                          </span>
                          {course.code && (
                            <span className="text-[10px] font-mono font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                              Mã khóa: {course.code}
                            </span>
                          )}
                          <span className="text-[10px] font-mono text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded border border-slate-300">
                            v{course.version}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              course.status === 'PUBLISHED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : course.status === 'INTERNAL'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {course.status === 'PUBLISHED'
                              ? 'Công khai'
                              : course.status === 'INTERNAL'
                              ? 'Nội bộ'
                              : 'Chờ thẩm định'}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 mt-1 truncate">
                          {course.title}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {course.description || 'Chương trình giáo dục chính trị Vùng 4 Hải Quân.'}
                        </p>
                      </div>
                    </div>

                    {/* Course Actions */}
                    <div className="flex items-center space-x-2 shrink-0 self-end md:self-center">
                      <button
                        onClick={() => handleOpenNewLesson(course.id)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Thêm bài học</span>
                      </button>

                      <button
                        onClick={() => handleOpenEditCourse(course)}
                        title="Chỉnh sửa chuyên đề"
                        className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 transition-colors shadow-sm"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleConfirmDeleteCourse(course)}
                        title="Xóa vĩnh viễn chuyên đề"
                        className="p-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 transition-colors shadow-sm"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Course Lessons Accordion Body */}
                  {isExpanded && (
                    <div className="p-4 lg:p-6 bg-slate-50/40 divide-y divide-slate-100">
                      {courseLessons.length === 0 ? (
                        <div className="py-8 text-center text-slate-500 text-xs">
                          <p>Chưa có bài học nào trong chuyên đề này.</p>
                          <button
                            onClick={() => handleOpenNewLesson(course.id)}
                            className="mt-2 text-blue-600 hover:underline font-bold text-xs inline-flex items-center space-x-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tạo bài học đầu tiên ngay</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between pb-1">
                            <span>Danh sách bài học ({courseLessons.length})</span>
                            <span className="text-[10px] text-slate-400 font-normal">
                              Nhấn vào bài học để biên soạn nội dung đa phương tiện
                            </span>
                          </div>

                          {courseLessons.map((lesson) => (
                            <div
                              key={lesson.id}
                              className="bg-white hover:bg-blue-50/30 rounded-2xl p-4 border border-slate-200 hover:border-blue-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 group shadow-sm"
                            >
                              <div
                                onClick={() => onSelectLesson(lesson)}
                                className="flex items-start space-x-3.5 flex-1 min-w-0 cursor-pointer"
                              >
                                <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden shrink-0 border border-slate-200 shadow-sm mt-0.5">
                                  <img src={lesson.thumbnail} alt={lesson.title} className="w-full h-full object-cover" />
                                </div>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                      Bài #{lesson.order}
                                    </span>
                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                      v{lesson.version}
                                    </span>
                                     <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        lesson.status === 'PUBLISHED'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : lesson.status === 'INTERNAL'
                                          ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                                      }`}
                                    >
                                      {lesson.status === 'PUBLISHED'
                                        ? 'Công khai'
                                        : lesson.status === 'INTERNAL'
                                        ? 'Nội bộ'
                                        : 'Chờ thẩm định'}
                                    </span>
                                  </div>

                                  <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 mt-1 truncate">
                                    {lesson.title}
                                  </h4>
                                  
                                  {/* Module Indicators */}
                                  <div className="flex items-center space-x-3 mt-2 text-[10px] text-slate-500">
                                    <span className={`flex items-center space-x-1 ${lesson.moduleConfig?.showSlides ? 'text-blue-700 font-medium' : 'text-slate-400 line-through'}`}>
                                      <Layers className="w-3 h-3" />
                                      <span>Slide bài giảng ({lesson.slideCount || 0})</span>
                                    </span>
                                    <span>•</span>
                                    <span className={`flex items-center space-x-1 ${lesson.moduleConfig?.showContents ? 'text-blue-700 font-medium' : 'text-slate-400 line-through'}`}>
                                      <FileText className="w-3 h-3" />
                                      <span>Nội dung bài học ({lesson.contentCount || 0})</span>
                                    </span>
                                    <span>•</span>
                                    <span className={`flex items-center space-x-1 ${lesson.moduleConfig?.showVideos ? 'text-blue-700 font-medium' : 'text-slate-400 line-through'}`}>
                                      <Video className="w-3 h-3" />
                                      <span>Video tư liệu ({lesson.videoCount || 0})</span>
                                    </span>
                                    <span>•</span>
                                    <span className={`flex items-center space-x-1 ${lesson.moduleConfig?.showAudios ? 'text-blue-700 font-medium' : 'text-slate-400 line-through'}`}>
                                      <Headphones className="w-3 h-3" />
                                      <span>Audio bài giảng ({lesson.audioCount || 0})</span>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Lesson Controls */}
                              <div className="flex items-center space-x-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                                <button
                                  onClick={() => onPreviewLesson(lesson)}
                                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Xem trước</span>
                                </button>

                                <button
                                  onClick={() => onSelectLesson(lesson)}
                                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>Soạn thảo</span>
                                </button>

                                <button
                                  onClick={() => onDuplicateLesson(lesson.id)}
                                  title="Nhân bản bài học"
                                  className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleConfirmDeleteLesson(lesson)}
                                  title="Xóa vĩnh viễn bài học"
                                  className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-rose-600 border border-slate-200 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

      {/* Modal: Create / Edit Course */}
      {isCourseModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider">
                {editingCourse ? 'Chỉnh sửa Chuyên đề' : 'Thêm Chuyên đề GDCT mới'}
              </h3>
              <button
                onClick={() => setIsCourseModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitCourse} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Tiêu đề chuyên đề *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Giáo dục chính trị năm 2026..."
                  value={courseFormData.title}
                  onChange={(e) => setCourseFormData({ ...courseFormData, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Năm học tập</label>
                  <input
                    type="number"
                    value={courseFormData.year}
                    onChange={(e) => setCourseFormData({ ...courseFormData, year: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Trạng thái</label>
                  <select
                    value={courseFormData.status}
                    onChange={(e) => setCourseFormData({ ...courseFormData, status: e.target.value as PublishStatus })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-bold"
                  >
                    <option value="REVIEW">Chờ thẩm định</option>
                    <option value="INTERNAL">Nội bộ</option>
                    <option value="PUBLISHED">Công khai</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Ảnh bìa chuyên đề</label>
                <div className="flex items-center space-x-3">
                  <div className="w-16 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                    <img 
                      src={courseFormData.thumbnail || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80'} 
                      alt="Thumbnail preview" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <label className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg cursor-pointer text-xs transition-all border border-slate-200">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploadingThumbnail ? 'Đang tải lên...' : 'Chọn ảnh từ máy'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleThumbnailFileChange} 
                        disabled={isUploadingThumbnail}
                        className="hidden" 
                      />
                    </label>
                    <input
                      type="text"
                      placeholder="Hoặc nhập URL ảnh bìa..."
                      value={courseFormData.thumbnail}
                      onChange={(e) => setCourseFormData({ ...courseFormData, thumbnail: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-mono text-[10px]"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCourseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md"
                >
                  {editingCourse ? 'Lưu thay đổi' : 'Tạo chuyên đề'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Lesson */}
      {isLessonModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider">
                {editingLesson ? 'Chỉnh sửa thông tin bài học' : 'Thêm Bài học mới'}
              </h3>
              <button
                onClick={() => setIsLessonModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitLesson} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Thuộc chuyên đề *</label>
                <select
                  value={lessonFormData.courseId}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, courseId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-bold"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} ({c.year})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Tên bài học *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Những nội dung trọng tâm 6 tháng cuối năm 2026..."
                  value={lessonFormData.title}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Trạng thái phát hành</label>
                <select
                  value={lessonFormData.status}
                  onChange={(e) => setLessonFormData({ ...lessonFormData, status: e.target.value as PublishStatus })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                >
                  <option value="REVIEW">Chờ thẩm định</option>
                  <option value="INTERNAL">Nội bộ</option>
                  <option value="PUBLISHED">Công khai</option>
                </select>
              </div>

              {/* Module Visibility Switches */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <label className="block text-slate-700 font-bold mb-2 uppercase text-[10px] tracking-wider">
                  Cấu hình hiển thị 4 thành phần nội dung
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lessonFormData.showSlides}
                      onChange={(e) => setLessonFormData({ ...lessonFormData, showSlides: e.target.checked })}
                      className="accent-blue-600 rounded"
                    />
                    <span>📊 Slide bài giảng</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lessonFormData.showContents}
                      onChange={(e) => setLessonFormData({ ...lessonFormData, showContents: e.target.checked })}
                      className="accent-blue-600 rounded"
                    />
                    <span>📖 Nội dung bài học</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lessonFormData.showVideos}
                      onChange={(e) => setLessonFormData({ ...lessonFormData, showVideos: e.target.checked })}
                      className="accent-blue-600 rounded"
                    />
                    <span>🎬 Video tư liệu</span>
                  </label>

                  <label className="flex items-center space-x-2 text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lessonFormData.showAudios}
                      onChange={(e) => setLessonFormData({ ...lessonFormData, showAudios: e.target.checked })}
                      className="accent-blue-600 rounded"
                    />
                    <span>🎧 Audio bài giảng</span>
                  </label>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsLessonModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md"
                >
                  {editingLesson ? 'Lưu thay đổi' : 'Tạo bài học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Course */}
      {courseToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Xác nhận xóa Chuyên đề</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Đồng chí có chắc chắn muốn xóa chuyên đề <strong className="text-slate-900">"{courseToDelete.title}"</strong> không?
            </p>
            <div className="bg-rose-50/60 border border-rose-200 p-3 rounded-xl text-[11px] text-rose-800 space-y-1">
              <p>• Xóa vĩnh viễn chuyên đề trên Firebase Firestore.</p>
              <p>• Xóa toàn bộ bài học, nội dung, slide, video, audio liên quan.</p>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={() => setCourseToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={handleExecuteDeleteCourse}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {isDeletingItem ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm Delete Lesson */}
      {lessonToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 p-6 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Xác nhận xóa Bài học</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Đồng chí có chắc chắn muốn xóa bài học <strong className="text-slate-900">"{lessonToDelete.title}"</strong> không?
            </p>
            <div className="bg-rose-50/60 border border-rose-200 p-3 rounded-xl text-[11px] text-rose-800 space-y-1">
              <p>• Xóa vĩnh viễn bài học trên Firebase Firestore.</p>
              <p>• Xóa toàn bộ slide, video, audio và tài liệu đính kèm trên Cloudinary & Firebase.</p>
            </div>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={() => setLessonToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isDeletingItem}
                onClick={handleExecuteDeleteLesson}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-50 flex items-center gap-2"
              >
                {isDeletingItem ? 'Đang xóa...' : 'Xóa vĩnh viễn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
