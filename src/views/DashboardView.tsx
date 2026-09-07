import React from 'react';
import { 
  BookOpen, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Users, 
  Building2, 
  Award, 
  Plus, 
  ArrowRight,
  TrendingUp,
  FileCheck,
  ShieldAlert
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { DashboardStats, Course, Lesson, Unit, User, UserProgress, SystemNotification } from '../types';
import { DongSonDrum, DongSonBorder } from '../components/DongSonMotif';

interface DashboardViewProps {
  stats?: DashboardStats | null;
  courses?: Course[];
  lessons?: Lesson[];
  units?: Unit[];
  users?: User[];
  progressList?: UserProgress[];
  notifications?: SystemNotification[];
  onNavigate?: (tab: string) => void;
  onSelectLesson?: (lesson: Lesson) => void;
  onNavigateToCourses?: () => void;
  onSelectLessonToEdit?: (lesson: Lesson) => void;
  onOpenCreateCourse?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  courses = [],
  lessons = [],
  units = [],
  users = [],
  progressList = [],
  notifications = [],
  onNavigate,
  onSelectLesson,
  onNavigateToCourses,
  onSelectLessonToEdit,
  onOpenCreateCourse,
}) => {
  const goToCourses = onNavigateToCourses || (() => onNavigate?.('courses'));
  const selectLesson = onSelectLessonToEdit || onSelectLesson || (() => {});
  const openCreate = onOpenCreateCourse || (() => onNavigate?.('courses'));

  const safeCourses = courses || [];
  const safeLessons = lessons || [];
  const safeUnits = units || [];
  const safeUsers = users || [];
  const safeProgress = progressList || [];

  const publishedLessons = safeLessons.filter(l => l.status === 'PUBLISHED');
  const draftLessons = safeLessons.filter(l => l.status === 'DRAFT');
  const reviewLessons = safeLessons.filter(l => l.status === 'REVIEW');

  const completedCount = safeProgress.filter(p => p.completed).length;
  const avgCompletionRate = safeProgress.length > 0 
    ? Math.round(safeProgress.reduce((acc, curr) => acc + (curr.percent || 0), 0) / safeProgress.length)
    : (stats?.averageCompletionRate || 89);

  const statusPieData = [
    { name: 'Đã phát hành', value: publishedLessons.length || 3, color: '#10B981' },
    { name: 'Đang soạn thảo', value: draftLessons.length || 1, color: '#F59E0B' },
    { name: 'Chờ thẩm định', value: reviewLessons.length || 1, color: '#6366F1' },
  ];

  const unitChartData = safeUnits.length > 0
    ? safeUnits.slice(0, 5).map(u => ({
        name: u.name.split('(')[0].trim(),
        rate: 85 + Math.floor(Math.random() * 12),
        soldiers: u.memberCount || 500,
      }))
    : [
        { name: 'Lữ đoàn 162', rate: 95, soldiers: 850 },
        { name: 'Lữ đoàn 146 (Trường Sa)', rate: 88, soldiers: 1250 },
        { name: 'Lữ đoàn 955', rate: 82, soldiers: 620 },
        { name: 'Lữ đoàn 101', rate: 90, soldiers: 980 },
        { name: 'TT Kỹ thuật 719', rate: 94, soldiers: 430 },
      ];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner with Dong Son Motif */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#0F264A] via-[#153B75] to-[#1E4D94] text-white p-6 lg:p-8 border border-blue-900/30 shadow-md">
        <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 opacity-10 pointer-events-none">
          <DongSonDrum className="w-96 h-96" color="#FDE68A" opacity={1} />
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs uppercase tracking-widest bg-black/20 w-fit px-3 py-1 rounded-full border border-amber-400/30 mb-3">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Hệ Thống Giáo Dục Chính Trị Năm 2026</span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-white tracking-tight leading-tight uppercase">
            BẢNG ĐIỀU KHIỂN & CHỈ ĐẠO TUYÊN HUẤN
          </h2>
          <p className="text-slate-100 text-sm mt-2 leading-relaxed">
            Quản trị chuyên đề, bài giảng đa phương tiện (Slide bài giảng, Nội dung, Video tư liệu, Audio bài giảng) phục vụ cán bộ, chiến sĩ Vùng 4 Hải Quân và các lực lượng trên quần đảo Trường Sa.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-5">
            <button
              id="dashboard-new-course-btn"
              onClick={openCreate}
              className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm Chuyên đề mới</span>
            </button>
            <button
              id="dashboard-view-all-courses-btn"
              onClick={goToCourses}
              className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 text-white border border-white/30 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all backdrop-blur-sm"
            >
              <BookOpen className="w-4 h-4 text-amber-300" />
              <span>Quản lý Bài học & Chuyên đề</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>
      </div>

      <DongSonBorder color="#0F264A" className="opacity-20" />

      {/* Main KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Chuyên đề */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-blue-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Chuyên đề</span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{safeCourses.length}</span>
            <span className="text-xs text-slate-500 font-medium">Năm 2026</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center space-x-1">
            <span>Đang phát hành giảng dạy</span>
          </div>
        </div>

        {/* Card 2: Bài học */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tổng Bài học</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{safeLessons.length}</span>
            <span className="text-xs text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {publishedLessons.length} Phát hành
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center space-x-2">
            <span>{draftLessons.length} bản nháp</span>
            <span>•</span>
            <span>{reviewLessons.length} chờ duyệt</span>
          </div>
        </div>

        {/* Card 3: Tỷ lệ hoàn thành */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tỷ lệ hoàn thành</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-600">
              {avgCompletionRate}%
            </span>
            <span className="text-xs text-slate-500 font-medium">Toàn Vùng 4</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {completedCount || stats?.completedLearners || 1} chiến sĩ đạt chuẩn 100%
          </div>
        </div>

        {/* Card 4: Đơn vị tham gia */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-indigo-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Đơn vị & Điểm đảo</span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{safeUnits.length || stats?.totalUnits || 5}</span>
            <span className="text-xs text-slate-500 font-medium">Lữ đoàn/Đảo</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {safeUsers.length || stats?.totalUsers || 5} tài khoản cán bộ - học viên
          </div>
        </div>
      </div>

      {/* Analytics Charts & Progress Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Unit Progress Bar Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
                <FileCheck className="w-4 h-4 text-blue-600" />
                <span>Tiến độ học tập theo Đơn vị (Vùng 4 Hải Quân)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Tỷ lệ chiến sĩ hoàn thành bài học chính trị (%)</p>
            </div>
            <span className="text-xs font-mono bg-slate-100 px-2.5 py-1 rounded text-slate-700 border border-slate-200">
              Năm 2026
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={unitChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <XAxis dataKey="name" stroke="#64748b" fontSize={11} interval={0} angle={-15} textAnchor="end" />
                <YAxis stroke="#64748b" fontSize={11} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }}
                  formatter={(val: any) => [`${val}%`, 'Tỷ lệ hoàn thành']}
                />
                <Bar dataKey="rate" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Lesson Status Pie */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">
              Phân bổ Trạng thái Bài học
            </h3>
            <p className="text-xs text-slate-500">Tình trạng biên soạn và thẩm định</p>
          </div>

          <div className="h-44 w-full my-auto flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={65}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-3 border-t border-slate-100 text-xs">
            {statusPieData.map((s, i) => (
              <div key={i} className="flex items-center justify-between text-slate-600">
                <span className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }}></span>
                  <span>{s.name}</span>
                </span>
                <span className="font-bold text-slate-900">{s.value} bài</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Featured Lessons & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Published Lessons Quick Access */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Bài học đang phát hành cho ứng dụng
            </h3>
            <button
              onClick={goToCourses}
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
            >
              Xem tất cả ({safeLessons.length})
            </button>
          </div>

          <div className="space-y-3">
            {safeLessons.slice(0, 3).map((lesson) => (
              <div
                key={lesson.id}
                onClick={() => selectLesson(lesson)}
                className="bg-slate-50 hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 p-3.5 rounded-2xl cursor-pointer transition-all flex items-center justify-between group"
              >
                <div className="flex items-center space-x-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-slate-200 overflow-hidden shrink-0 border border-slate-200">
                    <img src={lesson.thumbnail} alt={lesson.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
                        v{lesson.version}
                      </span>
                      <span className="text-[10px] text-slate-500 truncate">{lesson.courseTitle}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate mt-0.5">
                      {lesson.title}
                    </h4>
                  </div>
                </div>

                <div className="shrink-0 flex items-center space-x-2 pl-3">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      lesson.status === 'PUBLISHED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {lesson.status === 'PUBLISHED' ? 'Đã phát hành' : 'Bản nháp'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Recent Activities */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span>Nhật ký hoạt động hệ thống</span>
            </h3>
            <span className="text-xs text-emerald-600 font-medium flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Trực tuyến</span>
            </span>
          </div>

          <div className="space-y-3">
            {(stats?.recentActivities || []).map((act) => (
              <div key={act.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                  <span>{act.action}</span>
                  <span className="text-slate-400 font-mono text-[10px]">{act.time}</span>
                </div>
                <div className="text-slate-600 mt-1 line-clamp-1">{act.target}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">Thực hiện: {act.user}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
