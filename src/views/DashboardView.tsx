import React, { useState, useMemo } from 'react';
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
  ShieldAlert,
  Calendar
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, LabelList } from 'recharts';
import { DashboardStats, Course, Lesson, Unit, User, UserProgress, SystemNotification } from '../types';
import { DongSonDrum, DongSonBorder } from '../components/DongSonMotif';
import { removeVietnameseTones } from '../utils/vietnamese';

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

  const isLessonMarkedCompleted = (p: UserProgress) => {
    return Boolean(
      p.completed === true || 
      (p as any).isCompleted === true || 
      (p as any).hoanThanh === true || 
      (p as any).daDat === true
    );
  };

  const renderCustomBarLabel = (props: any) => {
    const { x, y, width, height, value } = props;
    if (value === undefined || value === null) return null;
    const num = Number(value);
    const isInside = height >= 24;
    const textY = isInside ? y + 15 : y - 6;
    const textColor = isInside ? '#FFFFFF' : '#334155';

    return (
      <text
        x={x + width / 2}
        y={textY}
        fill={textColor}
        textAnchor="middle"
        fontSize={11}
        fontWeight="700"
      >
        {num.toFixed(2)}%
      </text>
    );
  };

  const completedRecords = safeProgress.filter(p => isLessonMarkedCompleted(p));
  const completedCount = completedRecords.length;
  const uniqueCompletedUsersCount = new Set(completedRecords.map(p => p.userId || p.userName)).size;

  const statusPieData = [
    { name: 'Đã phát hành', value: publishedLessons.length, color: '#10B981' },
    { name: 'Đang soạn thảo', value: draftLessons.length, color: '#F59E0B' },
    { name: 'Chờ thẩm định', value: reviewLessons.length, color: '#6366F1' },
  ];
  const totalLessonsInPie = publishedLessons.length + draftLessons.length + reviewLessons.length;

  // Collect dynamically available years from courses, progress, or current year
  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear()); // 2026

    safeCourses.forEach((c) => {
      if (c.year) {
        const y = Number(c.year);
        if (!isNaN(y) && y > 2000 && y < 2100) {
          yearsSet.add(y);
        }
      } else if (c.createdAt) {
        const y = new Date(c.createdAt).getFullYear();
        if (!isNaN(y) && y > 2000 && y < 2100) yearsSet.add(y);
      }
    });

    safeProgress.forEach((p) => {
      if (p.lastAccessedAt) {
        const y = new Date(p.lastAccessedAt).getFullYear();
        if (!isNaN(y) && y > 2000 && y < 2100) yearsSet.add(y);
      }
    });

    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [safeCourses, safeProgress]);

  const [selectedYear, setSelectedYear] = useState<number | 'ALL'>(new Date().getFullYear());

  // Thống kê tiến độ theo đơn vị:
  // - Nếu trên app bài học được đánh dấu hoàn thành thì mới thống kê lên
  // - Thống kê theo tỉ lệ: (số bài học hoàn thành) / (tổng số bài) của mỗi quân nhân
  // - Được tính trung bình trong đơn vị đó
  // - Hiển thị tỉ lệ % trực tiếp trong cột biểu đồ
  const unitChartData = useMemo(() => {
    if (safeUnits.length === 0) return [];

    const courseIdsInYear = selectedYear === 'ALL'
      ? null
      : new Set(
          safeCourses
            .filter(c => Number(c.year) === selectedYear || (!c.year && new Date(c.createdAt || '').getFullYear() === selectedYear))
            .map(c => c.id)
        );

    // Xác định các bài học hợp lệ trong phạm vi năm (hoặc tất cả bài học)
    const validLessons = selectedYear === 'ALL'
      ? safeLessons.filter(l => !l.isDeleted && l.status !== 'DRAFT')
      : safeLessons.filter(l => {
          if (l.isDeleted) return false;
          if (l.status === 'DRAFT') return false;
          if (l.year && Number(l.year) === selectedYear) return true;
          if (l.courseYear && Number(l.courseYear) === selectedYear) return true;
          if (l.courseId && courseIdsInYear && courseIdsInYear.has(l.courseId)) return true;
          if (l.createdAt && new Date(l.createdAt).getFullYear() === selectedYear) return true;
          return false;
        });

    const validLessonIds = new Set(validLessons.map(l => l.id));

    // Tổng số bài học
    const totalLessons = validLessons.length > 0
      ? validLessons.length
      : (publishedLessons.length || safeLessons.filter(l => !l.isDeleted).length || 1);

    const yearProgress = selectedYear === 'ALL'
      ? safeProgress
      : safeProgress.filter(p => {
          if (p.courseId && courseIdsInYear && courseIdsInYear.has(p.courseId)) return true;
          if (p.lessonId && validLessonIds.has(p.lessonId)) return true;
          if (p.lastAccessedAt && new Date(p.lastAccessedAt).getFullYear() === selectedYear) return true;
          return false;
        });

    return safeUnits.map(u => {
      const normUnitName = removeVietnameseTones(u.name || '');
      const normUnitCode = removeVietnameseTones(u.code || '');

      // 1. Tìm các quân nhân đã đăng ký thuộc đơn vị
      const unitUsers = safeUsers.filter(usr => {
        if (usr.unitId && (usr.unitId === u.id || usr.unitId === u.code)) return true;
        if (usr.unitName && (usr.unitName === u.name || usr.unitName === u.code)) return true;
        if (usr.unit && (usr.unit === u.name || usr.unit === u.id || usr.unit === u.code)) return true;
        const normUserUnit = removeVietnameseTones(usr.unitName || usr.unit || '');
        if (normUserUnit && normUnitName) {
          if (normUserUnit === normUnitName || normUserUnit.includes(normUnitName) || normUnitName.includes(normUserUnit)) return true;
        }
        if (normUserUnit && normUnitCode && normUserUnit === normUnitCode) return true;
        return false;
      });

      const unitUserIds = new Set(unitUsers.map(usr => usr.id));

      // 2. Tìm tất cả bản ghi tiến độ thuộc về đơn vị này
      const unitProgress = yearProgress.filter(p => {
        if (p.userId && unitUserIds.has(p.userId)) return true;
        if (p.unitId && (p.unitId === u.id || p.unitId === u.code)) return true;
        if (p.unitName && (p.unitName === u.name || p.unitName === u.code)) return true;
        const normPUnit = removeVietnameseTones(p.unitName || (p as any).donVi || '');
        if (normPUnit && normUnitName) {
          if (normPUnit === normUnitName || normPUnit.includes(normUnitName) || normUnitName.includes(normPUnit)) return true;
        }
        return false;
      });

      // 3. Danh sách các quân nhân trong đơn vị
      const soldiersMap = new Map<string, { id: string; name: string; completedLessons: Set<string> }>();

      unitUsers.forEach(usr => {
        const soldierId = usr.id || usr.email || usr.name;
        if (!soldiersMap.has(soldierId)) {
          soldiersMap.set(soldierId, {
            id: soldierId,
            name: usr.fullName || usr.name || 'Quân nhân',
            completedLessons: new Set<string>(),
          });
        }
      });

      unitProgress.forEach(p => {
        const soldierId = p.userId || p.userName;
        if (soldierId && !soldiersMap.has(soldierId)) {
          soldiersMap.set(soldierId, {
            id: soldierId,
            name: p.userName || 'Quân nhân',
            completedLessons: new Set<string>(),
          });
        }
      });

      // 4. Ghi nhận bài học hoàn thành: CHỈ KHI TRÊN APP ĐƯỢC ĐÁNH DẤU HOÀN THÀNH
      unitProgress.forEach(p => {
        if (isLessonMarkedCompleted(p)) {
          const soldierId = p.userId || p.userName;
          if (soldierId && soldiersMap.has(soldierId)) {
            const lessonKey = p.lessonId || p.lessonTitle || p.id;
            const belongsToYear = selectedYear === 'ALL' || !validLessonIds.size || validLessonIds.has(p.lessonId) || (courseIdsInYear && p.courseId && courseIdsInYear.has(p.courseId));
            if (belongsToYear && lessonKey) {
              soldiersMap.get(soldierId)!.completedLessons.add(lessonKey);
            }
          }
        }
      });

      // 5. Thống kê theo tỉ lệ = (số bài hoàn thành) / (tổng số bài) của mỗi quân nhân
      // và được tính trung bình trong đơn vị đó
      let rate = 0;
      let totalCompletedLessonsInUnit = 0;
      const soldierCount = soldiersMap.size;

      if (soldierCount > 0) {
        let totalSoldierRatios = 0;
        soldiersMap.forEach(soldier => {
          const count = soldier.completedLessons.size;
          totalCompletedLessonsInUnit += count;
          const ratio = Math.min(1, count / totalLessons);
          totalSoldierRatios += ratio;
        });
        rate = Number(((totalSoldierRatios / soldierCount) * 100).toFixed(2));
      }

      return {
        name: u.name.split('(')[0].trim(),
        fullName: u.name,
        rate,
        totalLessons,
        completedLessonsCount: totalCompletedLessonsInUnit,
        soldiers: soldierCount || unitUsers.length || u.memberCount || 0,
      };
    });
  }, [safeUnits, safeUsers, safeProgress, safeCourses, safeLessons, publishedLessons, selectedYear]);

  // Thống kê tỉ lệ hoàn thành toàn Vùng (Toàn Vùng 4):
  // - Chỉ tính các bài học được đánh dấu hoàn thành trên ứng dụng
  // - Tỷ lệ của mỗi quân nhân = (Số bài hoàn thành / Tổng số bài học)
  // - Tỷ lệ toàn Vùng = Trung bình cộng tỷ lệ hoàn thành của các quân nhân toàn Vùng (%)
  const regionProgressStats = useMemo(() => {
    const courseIdsInYear = selectedYear === 'ALL'
      ? null
      : new Set(
          safeCourses
            .filter(c => Number(c.year) === selectedYear || (!c.year && new Date(c.createdAt || '').getFullYear() === selectedYear))
            .map(c => c.id)
        );

    // Xác định các bài học hợp lệ trong phạm vi năm (hoặc tất cả bài học)
    const validLessons = selectedYear === 'ALL'
      ? safeLessons.filter(l => !l.isDeleted && l.status !== 'DRAFT')
      : safeLessons.filter(l => {
          if (l.isDeleted) return false;
          if (l.status === 'DRAFT') return false;
          if (l.year && Number(l.year) === selectedYear) return true;
          if (l.courseYear && Number(l.courseYear) === selectedYear) return true;
          if (l.courseId && courseIdsInYear && courseIdsInYear.has(l.courseId)) return true;
          if (l.createdAt && new Date(l.createdAt).getFullYear() === selectedYear) return true;
          return false;
        });

    const validLessonIds = new Set(validLessons.map(l => l.id));

    // Tổng số bài học cần hoàn thành
    const totalLessons = validLessons.length > 0
      ? validLessons.length
      : (publishedLessons.length || safeLessons.filter(l => !l.isDeleted).length || 1);

    const yearProgress = selectedYear === 'ALL'
      ? safeProgress
      : safeProgress.filter(p => {
          if (p.courseId && courseIdsInYear && courseIdsInYear.has(p.courseId)) return true;
          if (p.lessonId && validLessonIds.has(p.lessonId)) return true;
          if (p.lastAccessedAt && new Date(p.lastAccessedAt).getFullYear() === selectedYear) return true;
          return false;
        });

    // 1. Tập hợp danh sách quân nhân trong toàn Vùng 4
    const soldiersMap = new Map<string, { id: string; name: string; unit: string; completedLessons: Set<string> }>();

    safeUsers.forEach(usr => {
      const soldierId = usr.id || usr.email || usr.name;
      if (soldierId && !soldiersMap.has(soldierId)) {
        soldiersMap.set(soldierId, {
          id: soldierId,
          name: usr.fullName || usr.name || 'Quân nhân',
          unit: usr.unitName || usr.unit || '',
          completedLessons: new Set<string>(),
        });
      }
    });

    yearProgress.forEach(p => {
      const soldierId = p.userId || p.userName;
      if (soldierId && !soldiersMap.has(soldierId)) {
        soldiersMap.set(soldierId, {
          id: soldierId,
          name: p.userName || 'Quân nhân',
          unit: p.unitName || (p as any).donVi || '',
          completedLessons: new Set<string>(),
        });
      }
    });

    // 2. Ghi nhận bài học hoàn thành khi và chỉ khi trên app được đánh dấu hoàn thành
    yearProgress.forEach(p => {
      if (isLessonMarkedCompleted(p)) {
        const soldierId = p.userId || p.userName;
        if (soldierId && soldiersMap.has(soldierId)) {
          const lessonKey = p.lessonId || p.lessonTitle || p.id;
          const belongsToYear = selectedYear === 'ALL' || !validLessonIds.size || validLessonIds.has(p.lessonId) || (courseIdsInYear && p.courseId && courseIdsInYear.has(p.courseId));
          if (belongsToYear && lessonKey) {
            soldiersMap.get(soldierId)!.completedLessons.add(lessonKey);
          }
        }
      }
    });

    const totalSoldiers = soldiersMap.size || (safeUsers.length || 1);
    let totalCompletedLessonsCount = 0;
    let soldiersWithAnyCompletion = 0;
    let soldiersCompletedAll = 0;
    let totalSoldierRatios = 0;

    soldiersMap.forEach(soldier => {
      const count = soldier.completedLessons.size;
      totalCompletedLessonsCount += count;
      if (count > 0) soldiersWithAnyCompletion += 1;
      if (count >= totalLessons) soldiersCompletedAll += 1;
      totalSoldierRatios += Math.min(1, count / totalLessons);
    });

    // Tỉ lệ hoàn thành toàn Vùng (%): trung bình cộng tỉ lệ hoàn thành của các quân nhân
    const rate = totalSoldiers > 0
      ? Number(((totalSoldierRatios / totalSoldiers) * 100).toFixed(2))
      : 0;

    const totalExpectedCompletions = totalSoldiers * totalLessons;

    return {
      rate,
      totalSoldiers,
      totalLessons,
      totalCompletedLessonsCount,
      soldiersWithAnyCompletion,
      soldiersCompletedAll,
      totalExpectedCompletions,
    };
  }, [safeCourses, safeLessons, publishedLessons, safeUsers, safeProgress, selectedYear]);

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
        <div 
          className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-amber-400 transition-all"
          title="Tỷ lệ hoàn thành Toàn Vùng = Trung bình tỷ lệ hoàn thành (Số bài hoàn thành / Tổng số bài) của các quân nhân toàn Vùng 4"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tỷ lệ hoàn thành</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-amber-600">
              {Number(regionProgressStats.rate).toFixed(2)}%
            </span>
            <span className="text-xs text-slate-500 font-medium">Toàn Vùng 4</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {regionProgressStats.soldiersWithAnyCompletion} chiến sĩ đạt chuẩn ({regionProgressStats.totalCompletedLessonsCount}/{regionProgressStats.totalExpectedCompletions} lượt bài học)
          </div>
        </div>

        {/* Card 4: Cơ quan đơn vị */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm relative overflow-hidden group hover:border-indigo-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Cơ quan đơn vị</span>
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{safeUnits.length}</span>
            <span className="text-xs text-slate-500 font-medium">Đơn vị</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {safeUsers.length} tài khoản người dùng
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
              <p className="text-xs text-slate-500 mt-0.5">
                Tỷ lệ hoàn thành = (Số bài hoàn thành / Tổng số bài) của mỗi quân nhân, tính trung bình theo đơn vị (%)
              </p>
            </div>
            <div className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 transition-colors shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <select
                id="select-unit-progress-year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer pr-1"
                title="Lựa chọn năm thống kê"
              >
                <option value="ALL">Tất cả các năm</option>
                {availableYears.map((yr) => (
                  <option key={yr} value={yr}>
                    Năm {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {unitChartData.length > 0 ? (
            <div className="h-64 min-h-[256px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={unitChartData} margin={{ top: 20, right: 10, left: -20, bottom: 25 }}>
                  <XAxis dataKey="name" stroke="#64748b" fontSize={11} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="#64748b" fontSize={11} domain={[0, 105]} ticks={[0, 25, 50, 75, 100]} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }}
                    formatter={(val: any, _name: any, item: any) => [
                      `${Number(val).toFixed(2)}% (TB hoàn thành trên tổng ${item?.payload?.totalLessons || 0} bài học - ${item?.payload?.soldiers || 0} quân nhân)`,
                      'Tỷ lệ hoàn thành'
                    ]}
                  />
                  <Bar isAnimationActive={false} dataKey="rate" fill="#2563eb" radius={[6, 6, 0, 0]}>
                    <LabelList
                      dataKey="rate"
                      content={renderCustomBarLabel}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 min-h-[256px] w-full flex flex-col items-center justify-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <Building2 className="w-8 h-8 mb-2 text-slate-300" />
              <span className="text-xs font-semibold text-slate-500">Chưa có dữ liệu đơn vị</span>
              <span className="text-[11px] text-slate-400 mt-0.5">Tiến độ sẽ được tự động tổng hợp khi có dữ liệu đơn vị và học viên học tập</span>
            </div>
          )}
        </div>

        {/* Right 1 Col: Lesson Status Pie */}
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-1">
              Phân bổ Trạng thái Bài học
            </h3>
            <p className="text-xs text-slate-500">Tình trạng biên soạn và thẩm định</p>
          </div>

          <div className="h-44 min-h-[176px] w-full my-auto flex items-center justify-center">
            {totalLessonsInPie > 0 ? (
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
                    isAnimationActive={false}
                  >
                    {statusPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#FFF' }}
                    formatter={(val: any) => [`${val} bài`, 'Số lượng']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-6 flex flex-col items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-2 text-slate-400">
                  <Layers className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-slate-600">0 bài học</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Hệ thống chưa có bài học nào</p>
              </div>
            )}
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
            {safeLessons.length === 0 ? (
              <div className="text-center py-8 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">Chưa có bài học nào trong hệ thống</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Tạo chuyên đề và bài học mới để phát hành lên ứng dụng</p>
              </div>
            ) : (
              safeLessons.slice(0, 3).map((lesson) => (
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
              ))
            )}
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
            {(!stats?.recentActivities || stats.recentActivities.length === 0) ? (
              <div className="text-center py-8 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">Chưa có nhật ký hoạt động mới</p>
              </div>
            ) : (
              stats.recentActivities.map((act) => (
                <div key={act.id} className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-800">
                    <span>{act.action}</span>
                    <span className="text-slate-400 font-mono text-[10px]">{act.time}</span>
                  </div>
                  <div className="text-slate-600 mt-1 line-clamp-1">{act.target}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Thực hiện: {act.user}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
