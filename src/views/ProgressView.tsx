import React, { useState, useMemo, useEffect } from 'react';
import { 
  CheckCircle, 
  Clock, 
  Search, 
  TrendingUp, 
  Users, 
  Download, 
  Eye, 
  X, 
  BookOpen, 
  Video, 
  FileText,
  Building,
  ChevronDown,
  Calendar
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { UserProgress, Unit, User, Course, Lesson, ExamSubmission } from '../types';
import { removeVietnameseTones, matchSearch } from '../utils/vietnamese';
import { api } from '../services/api';

interface ProgressViewProps {
  progressList: UserProgress[];
  units: Unit[];
  users?: User[];
  courses?: Course[];
  lessons?: Lesson[];
}

interface AccountReportRow {
  user: User;
  unitName: string;
  unitId: string;
  rank: string;
  position: string;
  totalLessons: number;
  completedLessons: number;
  avgProgress: number;
  progressRecords: UserProgress[];
  examCount: number;
  highestScore: number;
  passedCount: number;
  submissions: ExamSubmission[];
}

interface LessonUnitBreakdown {
  unitId: string;
  unitName: string;
  totalUsers: number;
  completedUsers: number;
  avgProgress: number;
  learners: {
    userId: string;
    fullName: string;
    rank: string;
    position: string;
    unitName?: string;
    progress: number;
    isCompleted: boolean;
    lastAccessedAt?: string;
  }[];
}

interface LessonReportRow {
  id: string;
  title: string;
  year: number;
  courseTitle?: string;
  totalLearners: number;
  completedLearners: number;
  avgProgress: number;
  unitBreakdown: LessonUnitBreakdown[];
}

// Helper to determine exact unit name & ID for a user
const resolveUserUnit = (u: User, unitsList: Unit[]): { id: string; name: string } => {
  const rawId = (u.unitId || '').trim();
  const rawName = (u.unitName || u.unit || (u as any).donVi || '').trim();

  // 1. Try match by unit ID
  if (rawId) {
    const foundById = unitsList.find(unit => unit.id === rawId);
    if (foundById && foundById.name) {
      return { id: foundById.id, name: foundById.name.trim() };
    }
  }

  // 2. Try match by unit Name
  if (rawName) {
    const norm = removeVietnameseTones(rawName).toLowerCase();
    const foundByName = unitsList.find(unit => 
      removeVietnameseTones(unit.name || '').toLowerCase() === norm
    );
    if (foundByName && foundByName.name) {
      return { id: foundByName.id, name: foundByName.name.trim() };
    }
    return { id: rawId || rawName, name: rawName };
  }

  return { id: rawId || 'chua-xep', name: 'Chưa xếp đơn vị' };
};

// Helper to determine exact unit name & ID for a progress record
const resolveProgressUnit = (p: UserProgress, unitsList: Unit[]): { id: string; name: string } => {
  const rawId = (p.unitId || '').trim();
  const rawName = (p.unitName || (p as any).donVi || '').trim();

  if (rawId) {
    const foundById = unitsList.find(unit => unit.id === rawId);
    if (foundById && foundById.name) {
      return { id: foundById.id, name: foundById.name.trim() };
    }
  }

  if (rawName) {
    const norm = removeVietnameseTones(rawName).toLowerCase();
    const foundByName = unitsList.find(unit => 
      removeVietnameseTones(unit.name || '').toLowerCase() === norm
    );
    if (foundByName && foundByName.name) {
      return { id: foundByName.id, name: foundByName.name.trim() };
    }
    return { id: rawId || rawName, name: rawName };
  }

  return { id: rawId || 'vung4', name: 'Vùng 4 Hải Quân' };
};

export const ProgressView: React.FC<ProgressViewProps> = ({ 
  progressList, 
  units, 
  users = [],
  courses = [],
  lessons = []
}) => {
  const [activeTab, setActiveTab] = useState<'accountReport' | 'lessonProgress'>('accountReport');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [selectedLessonDetail, setSelectedLessonDetail] = useState<LessonReportRow | null>(null);
  const [selectedUnitForLearnersModal, setSelectedUnitForLearnersModal] = useState<LessonUnitBreakdown | null>(null);
  const [learnerSearchTerm, setLearnerSearchTerm] = useState('');
  const [selectedAccountDetail, setSelectedAccountDetail] = useState<{
    user: User;
    rank: string;
    position: string;
    unitName: string;
    totalLessons: number;
    completedLessons: number;
    avgProgress: number;
    progressRecords: UserProgress[];
    submissions: ExamSubmission[];
  } | null>(null);

  // Fetch real exam submissions on mount
  useEffect(() => {
    let isMounted = true;
    const loadSubmissions = async () => {
      try {
        const data = await api.getExamSubmissions();
        if (isMounted) {
          setSubmissions(data || []);
        }
      } catch (e) {
        console.warn('Failed to load exam submissions in ProgressView:', e);
      }
    };
    loadSubmissions();
    return () => {
      isMounted = false;
    };
  }, []);

  // Canonical total number of lessons in the study curriculum
  const totalCurriculumLessons = useMemo(() => {
    // 1. From lessons prop (non-deleted, not archived)
    const validLessons = (lessons || []).filter(l => !l.isDeleted && l.status !== 'ARCHIVED');
    if (validLessons.length > 0) return validLessons.length;

    // 2. From courses prop
    const courseLessons = (courses || []).flatMap(c => c.lessons || []).filter(l => !l.isDeleted && l.status !== 'ARCHIVED');
    if (courseLessons.length > 0) return courseLessons.length;

    // 3. From progressList unique lesson IDs or titles
    const uniqueFromProgress = new Set(
      progressList.map(p => p.lessonId || p.lessonTitle).filter(Boolean)
    );
    if (uniqueFromProgress.size > 0) return Math.max(uniqueFromProgress.size, 3);

    return 3; // Standard 3 core political lessons
  }, [lessons, courses, progressList]);

  // Dynamically collect accurate unique units from official units list, users, and progress records
  const unitOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();

    // 1. Official units
    units.forEach((u) => {
      if (u.name && u.name.trim()) {
        const trimmed = u.name.trim();
        const norm = removeVietnameseTones(trimmed).toLowerCase();
        if (!map.has(norm)) {
          map.set(norm, { id: u.id || trimmed, name: trimmed });
        }
      }
    });

    // 2. Units from users
    users.forEach((u) => {
      const resolved = resolveUserUnit(u, units);
      if (resolved.name && resolved.name !== 'Chưa xếp đơn vị') {
        const norm = removeVietnameseTones(resolved.name).toLowerCase();
        if (!map.has(norm)) {
          map.set(norm, { id: resolved.id, name: resolved.name });
        }
      }
    });

    // 3. Units from progress records
    progressList.forEach((p) => {
      const resolved = resolveProgressUnit(p, units);
      if (resolved.name && resolved.name !== 'Chưa xếp đơn vị') {
        const norm = removeVietnameseTones(resolved.name).toLowerCase();
        if (!map.has(norm)) {
          map.set(norm, { id: resolved.id, name: resolved.name });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => 
      a.name.localeCompare(b.name, 'vi', { numeric: true, sensitivity: 'base' })
    );
  }, [units, users, progressList]);

  // Aggregate Account-based Progress Report Data with precise Unit matching
  const accountReportData = useMemo<AccountReportRow[]>(() => {
    const list = users && users.length > 0 ? users : [];

    const filteredUsers = list.filter((u) => {
      // 1. Exact Unit match
      let matchUnit = false;
      if (selectedUnit === 'ALL') {
        matchUnit = true;
      } else {
        const resolved = resolveUserUnit(u, units);
        const selectedOpt = unitOptions.find(opt => opt.id === selectedUnit || opt.name === selectedUnit);
        const targetId = selectedOpt ? selectedOpt.id : selectedUnit;
        const targetName = selectedOpt ? selectedOpt.name : selectedUnit;

        const normUserUnit = removeVietnameseTones(resolved.name).toLowerCase();
        const normTarget = removeVietnameseTones(targetName).toLowerCase();

        matchUnit = 
          resolved.id === targetId ||
          resolved.name === targetName ||
          normUserUnit === normTarget;
      }

      if (!matchUnit) return false;

      // 2. Search match (accent-insensitive)
      if (!searchTerm.trim()) return true;
      const matchName = matchSearch(u.fullName || u.name || '', searchTerm);
      const matchEmail = matchSearch(u.email || '', searchTerm);
      const matchRank = matchSearch(u.rank || (u as any).userRank || '', searchTerm);
      const matchPosition = matchSearch(u.position || (u as any).userPosition || '', searchTerm);
      const resolvedUnit = resolveUserUnit(u, units);
      const matchUnitText = matchSearch(resolvedUnit.name, searchTerm);

      return matchName || matchEmail || matchRank || matchPosition || matchUnitText;
    });

    return filteredUsers.map((u) => {
      const rawUserProg = progressList.filter(
        (p) => p.userId === u.id || (p.userName && p.userName.trim().toLowerCase() === (u.fullName || u.name || '').trim().toLowerCase())
      );
      // Deduplicate by lessonId or title to prevent duplicate records if lessons were renamed
      const progByLesson = new Map<string, UserProgress>();
      rawUserProg.forEach(p => {
        const key = p.lessonId || removeVietnameseTones(p.lessonTitle || '').toLowerCase().trim();
        if (!key) return;
        const existing = progByLesson.get(key);
        if (!existing) {
          progByLesson.set(key, p);
        } else {
          const isPCompl = Boolean(p.completed || (p as any).isCompleted || (p as any).hoanThanh || (p as any).daDat);
          const isExCompl = Boolean(existing.completed || (existing as any).isCompleted || (existing as any).hoanThanh || (existing as any).daDat);
          if (isPCompl && !isExCompl) {
            progByLesson.set(key, p);
          } else if ((p.overallProgress || 0) > (existing.overallProgress || 0)) {
            progByLesson.set(key, p);
          }
        }
      });
      const userProg = Array.from(progByLesson.values());
      const totalLessons = totalCurriculumLessons > 0 ? totalCurriculumLessons : Math.max(userProg.length, 1);
      const completedLessons = userProg.filter(
        (p) => Boolean(p.completed || (p as any).isCompleted || (p as any).hoanThanh || (p as any).daDat)
      ).length;
      // Tiến độ TB = số bài đã học / tổng số bài
      const avgProgress = totalLessons > 0 
        ? Number(((completedLessons / totalLessons) * 100).toFixed(2))
        : 0;

      // Submissions matching this user
      const userSubs = submissions.filter(
        (s) => s.userId === u.id || (s.userName && s.userName.trim().toLowerCase() === (u.fullName || u.name || '').trim().toLowerCase())
      );

      const examCount = userSubs.length;
      const passedCount = userSubs.filter((s) => s.passed || Number(s.score) >= 5.0).length;
      const highestScore = userSubs.length > 0 ? Math.max(...userSubs.map((s) => Number(s.score) || 0)) : 0;

      const resolved = resolveUserUnit(u, units);

      return {
        user: u,
        unitName: resolved.name,
        unitId: resolved.id,
        rank: u.rank || (u as any).userRank || '—',
        position: u.position || (u as any).userPosition || '—',
        totalLessons,
        completedLessons,
        avgProgress,
        progressRecords: userProg,
        examCount,
        highestScore,
        passedCount,
        submissions: [...userSubs].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      };
    });
  }, [users, progressList, submissions, selectedUnit, searchTerm, unitOptions, units, totalCurriculumLessons]);

  // Overall statistics for account progress dynamically calculated based on current filter & unit
  const stats = useMemo(() => {
    const totalUsers = accountReportData.length;
    const usersFinishedAll = accountReportData.filter((d) => d.totalLessons > 0 && d.completedLessons >= d.totalLessons).length;
    const avgOverallProgress = totalUsers > 0
      ? (accountReportData.reduce((acc, d) => acc + d.avgProgress, 0) / totalUsers).toFixed(2)
      : '0.00';

    const selectedOption = unitOptions.find(opt => opt.id === selectedUnit || opt.name === selectedUnit);
    const unitLabel = selectedUnit === 'ALL' 
      ? 'Tài khoản toàn vùng' 
      : `Tài khoản thuộc ${selectedOption ? selectedOption.name : selectedUnit}`;

    return {
      totalUsers,
      usersFinishedAll,
      avgOverallProgress,
      unitLabel
    };
  }, [accountReportData, selectedUnit, unitOptions]);

  // Filtered raw lesson progress items with precise unit matching
  const filteredLessonProgress = useMemo(() => {
    return progressList.filter((p) => {
      // 1. Precise Unit match
      let matchUnit = false;
      if (selectedUnit === 'ALL') {
        matchUnit = true;
      } else {
        const resolved = resolveProgressUnit(p, units);
        const selectedOpt = unitOptions.find(opt => opt.id === selectedUnit || opt.name === selectedUnit);
        const targetId = selectedOpt ? selectedOpt.id : selectedUnit;
        const targetName = selectedOpt ? selectedOpt.name : selectedUnit;

        const normProgUnit = removeVietnameseTones(resolved.name).toLowerCase();
        const normTarget = removeVietnameseTones(targetName).toLowerCase();

        matchUnit = 
          resolved.id === targetId ||
          resolved.name === targetName ||
          normProgUnit === normTarget;
      }

      if (!matchUnit) return false;

      // 2. Search matching
      if (!searchTerm.trim()) return true;
      const matchName = matchSearch(p.userName, searchTerm);
      const matchLesson = matchSearch(p.lessonTitle, searchTerm);
      const resolved = resolveProgressUnit(p, units);
      const matchUnitText = matchSearch(resolved.name, searchTerm);

      return matchName || matchLesson || matchUnitText;
    });
  }, [progressList, selectedUnit, searchTerm, unitOptions, units]);

  // Extract unique available study years
  const availableYears = useMemo(() => {
    const set = new Set<number>();
    (lessons || []).forEach((l) => {
      if (l.year && !isNaN(Number(l.year))) set.add(Number(l.year));
      if (l.courseYear && !isNaN(Number(l.courseYear))) set.add(Number(l.courseYear));
    });
    (courses || []).forEach((c) => {
      if (c.year && !isNaN(Number(c.year))) set.add(Number(c.year));
    });
    (progressList || []).forEach((p) => {
      const dateStr = p.updatedAt || p.createdAt || p.lastAccessedAt;
      if (dateStr) {
        const yr = new Date(dateStr).getFullYear();
        if (!isNaN(yr) && yr >= 2020 && yr <= 2030) set.add(yr);
      }
    });
    set.add(2026);
    set.add(2025);
    return Array.from(set).sort((a, b) => b - a);
  }, [lessons, courses, progressList]);

  // Aggregate Lesson-based Progress Report Data with unit breakdown
  const lessonReportData = useMemo<LessonReportRow[]>(() => {
    // 1. Gather all unique lessons across active curriculum lessons and courses
    const lessonMap = new Map<string, { id: string; title: string; year: number; courseTitle?: string }>();

    // From lessons prop (official curriculum lessons)
    (lessons || []).forEach((l) => {
      if (!l.isDeleted && l.status !== 'ARCHIVED' && l.title && l.title.trim()) {
        const key = l.id || removeVietnameseTones(l.title).toLowerCase().trim();
        const yr = Number(l.year) || Number(l.courseYear) || 2026;
        lessonMap.set(key, {
          id: l.id || key,
          title: l.title.trim(),
          year: yr,
          courseTitle: l.courseTitle || ''
        });
      }
    });

    // From courses prop (ensure all active course lessons appear)
    (courses || []).forEach((c) => {
      const cYear = Number(c.year) || 2026;
      (c.lessons || []).forEach((l) => {
        if (!l.isDeleted && l.status !== 'ARCHIVED' && l.title && l.title.trim()) {
          const key = l.id || removeVietnameseTones(l.title).toLowerCase().trim();
          if (!lessonMap.has(key)) {
            lessonMap.set(key, {
              id: l.id || key,
              title: l.title.trim(),
              year: Number(l.year) || Number(l.courseYear) || cYear,
              courseTitle: l.courseTitle || c.title || ''
            });
          }
        }
      });
    });

    // Fallback ONLY IF curriculum is completely empty (no lessons or courses configured yet)
    if (lessonMap.size === 0) {
      (progressList || []).forEach((p) => {
        if (p.lessonTitle && p.lessonTitle.trim()) {
          const title = p.lessonTitle.trim();
          const key = p.lessonId || removeVietnameseTones(title).toLowerCase().trim();
          if (!lessonMap.has(key)) {
            let yr = 2026;
            const dateStr = p.updatedAt || p.createdAt || p.lastAccessedAt;
            if (dateStr) {
              const parsed = new Date(dateStr).getFullYear();
              if (!isNaN(parsed) && parsed >= 2020 && parsed <= 2030) yr = parsed;
            }
            lessonMap.set(key, {
              id: p.lessonId || key,
              title: title,
              year: yr,
              courseTitle: p.courseTitle || ''
            });
          }
        }
      });
    }

    // Standard fallback if still completely empty
    if (lessonMap.size === 0) {
      lessonMap.set('core-1', {
        id: 'core-1',
        title: 'Tăng cường công tác dân vận của Quân đội trên địa bàn trọng điểm về Quốc phòng an ninh',
        year: 2026,
        courseTitle: 'Giáo dục chính trị (GDCT)'
      });
      lessonMap.set('core-2', {
        id: 'core-2',
        title: 'Xây dựng Đảng bộ Quân chủng và Vùng 4 Hải quân trong sạch vững mạnh',
        year: 2026,
        courseTitle: 'Giáo dục chính trị (GDCT)'
      });
      lessonMap.set('core-3', {
        id: 'core-3',
        title: 'Phát huy truyền thống vẻ vang đánh thắng trận đầu của Hải quân nhân dân Việt Nam',
        year: 2026,
        courseTitle: 'Lịch sử truyền thống'
      });
    }

    const allLessons = Array.from(lessonMap.values());
    const result: LessonReportRow[] = [];

    for (const lItem of allLessons) {
      // 1. Year filter
      if (selectedYear !== 'ALL' && lItem.year.toString() !== selectedYear) {
        continue;
      }

      // 2. Search filter
      if (searchTerm.trim()) {
        const matchTitle = matchSearch(lItem.title, searchTerm);
        const matchCourse = matchSearch(lItem.courseTitle || '', searchTerm);
        if (!matchTitle && !matchCourse) {
          continue;
        }
      }

      // 3. Compute breakdown for every unit
      const unitBreakdown: LessonUnitBreakdown[] = [];

      unitOptions.forEach((opt) => {
        // Users belonging to this unit
        const uMatches = (u: User) => {
          const res = resolveUserUnit(u, units);
          return (
            res.id === opt.id ||
            res.name === opt.name ||
            removeVietnameseTones(res.name).toLowerCase() === removeVietnameseTones(opt.name).toLowerCase()
          );
        };
        const unitUsers = users.filter(uMatches);

        const learners: LessonUnitBreakdown['learners'] = [];
        let completedCount = 0;
        let sumProgress = 0;

        unitUsers.forEach((u) => {
          const uProg = progressList.find((p) => {
            const matchUser =
              (p.userId && p.userId === u.id) ||
              (p.userName && u.fullName && p.userName.trim().toLowerCase() === u.fullName.trim().toLowerCase()) ||
              (p.userName && u.name && p.userName.trim().toLowerCase() === u.name.trim().toLowerCase());
            if (!matchUser) return false;

            const matchLesson =
              (p.lessonId && p.lessonId === lItem.id) ||
              (p.lessonTitle &&
                removeVietnameseTones(p.lessonTitle).toLowerCase().trim() ===
                  removeVietnameseTones(lItem.title).toLowerCase().trim());
            return matchLesson;
          });

          const isCompleted = Boolean(
            uProg?.completed ||
            (uProg as any)?.isCompleted ||
            (uProg as any)?.hoanThanh ||
            (uProg as any)?.daDat ||
            Number(uProg?.overallProgress) >= 100
          );
          const progVal = isCompleted ? 100 : Math.min(100, Math.max(0, Number(uProg?.overallProgress) || 0));

          if (isCompleted) completedCount++;
          sumProgress += progVal;

          learners.push({
            userId: u.id,
            fullName: u.fullName || u.name,
            rank: u.rank || 'Quân nhân',
            position: u.position || 'Chiến sĩ',
            unitName: opt.name,
            progress: progVal,
            isCompleted,
            lastAccessedAt: uProg?.lastAccessedAt || uProg?.updatedAt
          });
        });

        // Collect any progress records for this unit without a corresponding user object
        const unmappedProgs = progressList.filter((p) => {
          const res = resolveProgressUnit(p, units);
          const matchUOpt =
            res.id === opt.id ||
            res.name === opt.name ||
            removeVietnameseTones(res.name).toLowerCase() === removeVietnameseTones(opt.name).toLowerCase();
          if (!matchUOpt) return false;

          const matchLesson =
            (p.lessonId && p.lessonId === lItem.id) ||
            (p.lessonTitle &&
              removeVietnameseTones(p.lessonTitle).toLowerCase().trim() ===
                removeVietnameseTones(lItem.title).toLowerCase().trim());
          if (!matchLesson) return false;

          const alreadyIn = learners.some((lrn) =>
            (p.userId && p.userId === lrn.userId) ||
            (p.userName && p.userName.trim().toLowerCase() === lrn.fullName.trim().toLowerCase())
          );
          return !alreadyIn;
        });

        unmappedProgs.forEach((p) => {
          const isCompleted = Boolean(
            p.completed ||
            (p as any)?.isCompleted ||
            (p as any)?.hoanThanh ||
            (p as any)?.daDat ||
            Number(p.overallProgress) >= 100
          );
          const progVal = isCompleted ? 100 : Math.min(100, Math.max(0, Number(p.overallProgress) || 0));

          if (isCompleted) completedCount++;
          sumProgress += progVal;

          learners.push({
            userId: p.userId || p.id,
            fullName: p.userName || 'Quân nhân',
            rank: (p as any).rank || 'Quân nhân',
            position: (p as any).position || 'Chiến sĩ',
            unitName: opt.name,
            progress: progVal,
            isCompleted,
            lastAccessedAt: p.lastAccessedAt || p.updatedAt
          });
        });

        const totalUsersInUnit = learners.length;
        const avgUnitProgress = totalUsersInUnit > 0 ? Number((sumProgress / totalUsersInUnit).toFixed(2)) : 0;

        unitBreakdown.push({
          unitId: opt.id,
          unitName: opt.name,
          totalUsers: totalUsersInUnit,
          completedUsers: completedCount,
          avgProgress: avgUnitProgress,
          learners
        });
      });

      // 4. Calculate total & average according to selectedUnit
      let totalLearners = 0;
      let completedLearners = 0;
      let avgProgress = 0;

      if (selectedUnit === 'ALL') {
        totalLearners = unitBreakdown.reduce((acc, ub) => acc + ub.totalUsers, 0);
        completedLearners = unitBreakdown.reduce((acc, ub) => acc + ub.completedUsers, 0);
        const sumProg = unitBreakdown.reduce((acc, ub) => acc + ub.learners.reduce((s, l) => s + l.progress, 0), 0);
        avgProgress = totalLearners > 0 ? Number((sumProg / totalLearners).toFixed(2)) : 0;
      } else {
        const foundUnit = unitBreakdown.find(
          (ub) =>
            ub.unitId === selectedUnit ||
            ub.unitName === selectedUnit ||
            removeVietnameseTones(ub.unitName).toLowerCase() === removeVietnameseTones(selectedUnit).toLowerCase()
        );
        if (foundUnit) {
          totalLearners = foundUnit.totalUsers;
          completedLearners = foundUnit.completedUsers;
          avgProgress = foundUnit.avgProgress;
        }
      }

      result.push({
        id: lItem.id,
        title: lItem.title,
        year: lItem.year,
        courseTitle: lItem.courseTitle,
        totalLearners,
        completedLearners,
        avgProgress,
        unitBreakdown
      });
    }

    return result;
  }, [lessons, courses, progressList, selectedYear, searchTerm, unitOptions, users, units, selectedUnit]);

  // Export Lesson Progress Report to Excel
  const handleExportLessonProgressToExcel = () => {
    if (lessonReportData.length === 0) {
      alert('Không có dữ liệu bài học để xuất file Excel');
      return;
    }

    const selectedOption = unitOptions.find(opt => opt.id === selectedUnit || opt.name === selectedUnit);
    const scopeLabel = selectedUnit === 'ALL' ? 'Toàn Vùng' : (selectedOption ? selectedOption.name : selectedUnit);

    // Sheet 1: Tổng hợp tiến độ theo bài học
    const summaryRows = lessonReportData.map((row, idx) => ({
      'STT': idx + 1,
      'Tên bài học': row.title,
      'Năm học': row.year,
      'Chuyên đề': row.courseTitle || 'GDCT Vùng 4',
      'Đơn vị thống kê': scopeLabel,
      'Tổng quân nhân': row.totalLearners,
      'Quân nhân hoàn thành': row.completedLearners,
      'Tiến độ trung bình (%)': `${Number(row.avgProgress).toFixed(2)}%`,
      'Trạng thái': row.totalLearners > 0 && row.completedLearners >= row.totalLearners ? 'Hoàn thành 100%' : row.completedLearners > 0 ? 'Đang học' : 'Chưa học'
    }));

    // Sheet 2: Chi tiết theo từng đơn vị
    const unitBreakdownRows: any[] = [];
    lessonReportData.forEach((row) => {
      row.unitBreakdown.forEach((ub) => {
        unitBreakdownRows.push({
          'Tên bài học': row.title,
          'Năm học': row.year,
          'Đơn vị': ub.unitName,
          'Tổng quân nhân đơn vị': ub.totalUsers,
          'Quân nhân hoàn thành': ub.completedUsers,
          'Tiến độ trung bình (%)': `${Number(ub.avgProgress).toFixed(2)}%`,
          'Trạng thái': ub.totalUsers > 0 && ub.completedUsers >= ub.totalUsers ? 'Hoàn thành 100%' : ub.completedUsers > 0 ? 'Đang học' : 'Chưa học'
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(summaryRows);
    ws1['!cols'] = [
      { wch: 6 }, { wch: 38 }, { wch: 10 }, { wch: 28 }, { wch: 24 },
      { wch: 16 }, { wch: 22 }, { wch: 22 }, { wch: 18 }
    ];
    XLSX.utils.book_append_sheet(wb, ws1, 'Tien_Do_Theo_Bai_Hoc');

    if (unitBreakdownRows.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(unitBreakdownRows);
      ws2['!cols'] = [
        { wch: 38 }, { wch: 10 }, { wch: 24 }, { wch: 22 },
        { wch: 22 }, { wch: 22 }, { wch: 18 }
      ];
      XLSX.utils.book_append_sheet(wb, ws2, 'Chi_Tiet_Cac_Don_Vi');
    }

    const yearSuffix = selectedYear !== 'ALL' ? `_${selectedYear}` : '';
    XLSX.writeFile(wb, `BAO_CAO_TIEN_DO_THEO_BAI_HOC${yearSuffix}.xlsx`);
  };

  // Export Account Report to Excel with updated column structure
  const handleExportAccountReportToExcel = () => {
    if (accountReportData.length === 0) {
      alert('Không có dữ liệu tài khoản để xuất file Excel');
      return;
    }

    const rows = accountReportData.map((d, idx) => ({
      'STT': idx + 1,
      'Họ và tên': d.user.fullName || d.user.name || '',
      'Cấp bậc': d.rank,
      'Chức vụ': d.position,
      'Đơn vị': d.unitName,
      'Email': d.user.email || '',
      'Bài đã học': `${d.completedLessons} / ${d.totalLessons} bài`,
      'Tiến độ học (%)': `${Number(d.avgProgress).toFixed(2)}%`,
      'Trạng thái': d.totalLessons > 0 && d.completedLessons >= d.totalLessons ? 'Hoàn thành 100%' : 'Đang học'
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 28 }, { wch: 16 }, { wch: 22 }, { wch: 22 },
      { wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 20 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Bao_Cao_Tung_Tai_Khoan');
    XLSX.writeFile(wb, `BAO_CAO_HOC_TAP_THEO_TUNG_TAI_KHOAN.xlsx`);
  };

  // Export list of soldiers in a specific unit learning a specific lesson
  const handleExportUnitLearnersToExcel = () => {
    if (!selectedUnitForLearnersModal || !selectedLessonDetail) return;
    const learners = selectedUnitForLearnersModal.learners;
    if (learners.length === 0) {
      alert('Không có dữ liệu quân nhân để xuất file Excel');
      return;
    }

    const rows = learners.map((lrn, idx) => ({
      'STT': idx + 1,
      'Họ và tên': lrn.fullName,
      'Cấp bậc': lrn.rank,
      'Chức vụ': lrn.position,
      'Đơn vị': lrn.unitName || selectedUnitForLearnersModal.unitName,
      'Tên bài học': selectedLessonDetail.title,
      'Năm học': selectedLessonDetail.year,
      'Tiến độ bài học (%)': `${lrn.progress.toFixed(1)}%`,
      'Trạng thái': lrn.isCompleted ? 'Đã hoàn thành' : lrn.progress > 0 ? 'Đang học' : 'Chưa học',
      'Lần cuối học': formatLastAccess(lrn.lastAccessedAt)
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 26 }, { wch: 16 }, { wch: 22 }, { wch: 24 },
      { wch: 38 }, { wch: 10 }, { wch: 20 }, { wch: 18 }, { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Danh_Sach_Quan_Nhan');
    const unitTag = removeVietnameseTones(selectedUnitForLearnersModal.unitName).toUpperCase().replace(/[^A-Z0-9]/g, '_');
    XLSX.writeFile(wb, `DANH_SACH_QUAN_NHAN_${unitTag}.xlsx`);
  };

  const formatLastAccess = (dateStr: string | number | undefined) => {
    if (!dateStr) return 'Mới cập nhật';
    const dateObj = new Date(dateStr);
    if (isNaN(dateObj.getTime())) {
      const num = Number(dateStr);
      if (!isNaN(num) && num > 0) {
        const numDate = new Date(num);
        if (!isNaN(numDate.getTime())) {
          return `${numDate.toLocaleTimeString('vi-VN')} ${numDate.toLocaleDateString('vi-VN')}`;
        }
      }
      return 'Mới cập nhật';
    }
    return `${dateObj.toLocaleTimeString('vi-VN')} ${dateObj.toLocaleDateString('vi-VN')}`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-blue-700" />
            <span>TIẾN ĐỘ HỌC TẬP CHÍNH TRỊ TOÀN VÙNG</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi tốc độ học tập chuyên đề và tổng hợp kết quả của từng tài khoản quân nhân
          </p>
        </div>
      </div>

      {/* Summary KPI Cards (3 Cards - Bỏ mục "Đã tham gia thi") */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tổng số quân nhân</span>
            <span className="text-2xl font-black text-slate-800">{stats.totalUsers}</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">{stats.unitLabel}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Hoàn thành toàn bộ</span>
            <span className="text-2xl font-black text-emerald-700">{stats.usersFinishedAll}</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">Quân nhân đạt 100% bài</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Tiến độ trung bình</span>
            <span className="text-2xl font-black text-amber-700">{stats.avgOverallProgress}%</span>
            <span className="text-[11px] text-slate-500 block mt-0.5">Tốc độ học tập chung</span>
          </div>
        </div>
      </div>

      {/* Filter & Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto flex-1 max-w-3xl">
          <div className="relative flex-1 min-w-[220px]">
            <input
              type="text"
              placeholder={activeTab === 'accountReport' ? "Tìm theo họ tên, email, cấp bậc, chức vụ, đơn vị..." : "Tìm theo tên bài học, chuyên đề..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>

          {/* Unit Filter */}
          <div className="flex items-center space-x-2 text-xs shrink-0">
            <span className="text-slate-600 font-bold uppercase text-[10px]">Đơn vị:</span>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 font-semibold cursor-pointer"
            >
              <option value="ALL">Tất cả đơn vị (Toàn Vùng)</option>
              {unitOptions.map((u) => (
                <option key={`opt-unit-${u.id}-${u.name}`} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Filter (Hiển thị khi chọn tab Chi tiết tiến độ theo bài học) */}
          {activeTab === 'lessonProgress' && (
            <div className="flex items-center space-x-2 text-xs shrink-0 animate-in fade-in duration-200">
              <span className="text-slate-600 font-bold uppercase text-[10px] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>Năm:</span>
              </span>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-blue-50/60 border border-blue-200 text-blue-900 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 font-bold cursor-pointer"
              >
                <option value="ALL">Tất cả các năm</option>
                {availableYears.map((yr) => (
                  <option key={`opt-yr-${yr}`} value={yr.toString()}>
                    Năm {yr}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Export Button (for Excel) */}
        <div>
          {activeTab === 'accountReport' ? (
            <button
              onClick={handleExportAccountReportToExcel}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
              title="Xuất báo cáo học tập từng tài khoản quân nhân ra Excel"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Báo Cáo Excel (.xlsx)</span>
            </button>
          ) : (
            <button
              onClick={handleExportLessonProgressToExcel}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-sm transition-all cursor-pointer"
              title="Xuất báo cáo tiến độ theo từng bài học ra Excel"
            >
              <Download className="w-4 h-4" />
              <span>Xuất Báo Cáo Excel (.xlsx)</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs (Nằm phía dưới bộ lọc, ngay trên bảng) */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('accountReport')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'accountReport'
              ? 'bg-white text-blue-800 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4 text-emerald-600" />
          <span>Báo cáo học tập theo từng tài khoản ({accountReportData.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('lessonProgress')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'lessonProgress'
              ? 'bg-white text-blue-800 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-4 h-4 text-blue-600" />
          <span>Chi Tiết Tiến Độ Theo Từng Bài Học ({lessonReportData.length})</span>
        </button>
      </div>

      {/* TAB 1: BÁO CÁO THEO TÀI KHOẢN (CÁC CỘT: STT, Họ và tên, Cấp bậc, Chức vụ, Đơn vị, Bài đã học, Tiến độ học, Chi tiết) */}
      {activeTab === 'accountReport' && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>Báo Cáo Học Tập Theo Từng Tài Khoản ({accountReportData.length} tài khoản)</span>
            </h3>
            <span className="text-[11px] text-slate-400">
              Dữ liệu đồng bộ trực tiếp từ ứng dụng di động
            </span>
          </div>

          {accountReportData.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-700 text-sm">Không tìm thấy tài khoản quân nhân nào</p>
                <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
                  Hãy thử thay đổi bộ lọc đơn vị hoặc kiểm tra lại từ khóa tìm kiếm.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <th className="p-3.5 w-12 text-center">STT</th>
                    <th className="p-3.5">Họ và tên</th>
                    <th className="p-3.5">Cấp bậc</th>
                    <th className="p-3.5">Chức vụ</th>
                    <th className="p-3.5">Đơn vị</th>
                    <th className="p-3.5 text-center">Bài đã học</th>
                    <th className="p-3.5">Tiến độ học</th>
                    <th className="p-3.5 text-center">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {accountReportData.map((d, idx) => (
                    <tr key={d.user.id || `acc-rep-${idx}`} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-3.5 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-3.5">
                        <div>
                          <span className="font-bold text-slate-900 block text-sm">{d.user.fullName || d.user.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono block mt-0.5">{d.user.email}</span>
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-700 font-semibold">
                        {d.rank}
                      </td>
                      <td className="p-3.5 text-slate-600">
                        {d.position}
                      </td>
                      <td className="p-3.5">
                        <span className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-slate-200">
                          {d.unitName}
                        </span>
                      </td>
                      <td className="p-3.5 text-center font-mono font-bold text-slate-700 text-sm">
                        {d.completedLessons} / {d.totalLessons} bài
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center space-x-2">
                          <div className="w-24 bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className={`h-full ${d.avgProgress >= 80 ? 'bg-emerald-500' : d.avgProgress >= 50 ? 'bg-blue-500' : 'bg-slate-400'}`}
                              style={{ width: `${d.avgProgress}%` }}
                            />
                          </div>
                          <span className="font-mono font-black text-slate-700 text-[11px]">
                            {Number(d.avgProgress).toFixed(2)}%
                          </span>
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAccountDetail({
                              user: d.user,
                              rank: d.rank,
                              position: d.position,
                              unitName: d.unitName,
                              totalLessons: d.totalLessons,
                              completedLessons: d.completedLessons,
                              avgProgress: d.avgProgress,
                              progressRecords: d.progressRecords,
                              submissions: d.submissions
                            });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors border border-blue-200/80 shadow-xs cursor-pointer"
                          title="Bấm vào để xem chi tiết tiến độ học tập và kiểm tra của quân nhân"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CHI TIẾT TIẾN ĐỘ THEO TỪNG BÀI HỌC (GỒM CÁC CỘT: STT, Tên bài học, Tiến độ trung bình, Chi tiết) */}
      {activeTab === 'lessonProgress' && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-400" />
              <span>Danh Sách Tiến Độ Từng Bài Học ({lessonReportData.length} bài học)</span>
            </h3>
            <div className="text-xs text-slate-300 flex items-center gap-3">
              <span>
                Năm học:{' '}
                <strong className="text-blue-300">
                  {selectedYear === 'ALL' ? 'Tất cả' : selectedYear}
                </strong>
              </span>
              <span className="text-slate-500">•</span>
              <span>
                Đơn vị:{' '}
                <strong className="text-amber-300">
                  {selectedUnit === 'ALL'
                    ? 'Toàn Vùng'
                    : (unitOptions.find(u => u.id === selectedUnit)?.name || selectedUnit)}
                </strong>
              </span>
            </div>
          </div>

          {lessonReportData.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <p className="font-bold text-slate-700 text-sm">Không tìm thấy bài học nào phù hợp</p>
              <p className="text-slate-400 max-w-sm mx-auto">
                Vui lòng thử chọn lại năm học, đơn vị hoặc thay đổi từ khóa tìm kiếm.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                    <th className="p-3.5 w-14 text-center">STT</th>
                    <th className="p-3.5">Tên bài học</th>
                    <th className="p-3.5">Tiến độ trung bình</th>
                    <th className="p-3.5 w-28 text-center">Chi tiết</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {lessonReportData.map((row, idx) => (
                    <tr key={row.id || `lesson-row-${idx}`} className="hover:bg-blue-50/30 transition-colors">
                      <td className="p-3.5 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="p-3.5">
                        <div className="font-bold text-slate-900 text-sm leading-snug">
                          {row.title}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            Năm {row.year}
                          </span>
                          {row.courseTitle && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              Chuyên đề: {row.courseTitle}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center space-x-3 max-w-xs">
                          <div className="w-32 bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200 shrink-0">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                row.avgProgress >= 80
                                  ? 'bg-emerald-500'
                                  : row.avgProgress >= 50
                                  ? 'bg-blue-600'
                                  : row.avgProgress > 0
                                  ? 'bg-amber-500'
                                  : 'bg-slate-300'
                              }`}
                              style={{ width: `${row.avgProgress}%` }}
                            />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-mono font-black text-slate-800 text-xs">
                              {row.avgProgress.toFixed(2)}%
                            </span>
                            <span className="text-[10px] text-slate-500 whitespace-nowrap">
                              {row.completedLearners} / {row.totalLearners} quân nhân đạt
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedLessonDetail(row);
                            setSelectedUnitForLearnersModal(null);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs transition-colors border border-blue-200/80 shadow-xs cursor-pointer"
                          title="Bấm để xem chi tiết tiến độ bài học này của các đơn vị"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>Chi tiết</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CHI TIẾT TIẾN ĐỘ BÀI HỌC CỦA CÁC ĐƠN VỊ */}
      {/* ========================================================= */}
      {selectedLessonDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-blue-900/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    CHI TIẾT TIẾN ĐỘ BÀI HỌC THEO CÁC ĐƠN VỊ
                  </h3>
                  <p className="text-xs text-blue-200 mt-0.5 line-clamp-1 max-w-xl">
                    Bài học: <span className="font-bold text-white">{selectedLessonDetail.title}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedLessonDetail(null);
                  setSelectedUnitForLearnersModal(null);
                }}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Strip */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <span className="text-slate-600">
                  Năm học: <strong className="text-blue-700 font-bold">Năm {selectedLessonDetail.year}</strong>
                </span>
                <span className="text-slate-600">
                  Tiến độ TB: <strong className="text-emerald-700 font-mono text-sm">{Number(selectedLessonDetail.avgProgress).toFixed(2)}%</strong>
                </span>
                <span className="text-slate-600">
                  Đã hoàn thành: <strong className="text-purple-700 font-mono font-bold">{selectedLessonDetail.completedLearners} / {selectedLessonDetail.totalLearners} quân nhân</strong>
                </span>
              </div>
              {selectedLessonDetail.courseTitle && (
                <span className="text-slate-500 font-semibold bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                  {selectedLessonDetail.courseTitle}
                </span>
              )}
            </div>

            {/* Content Body: Table of Units */}
            <div className="overflow-y-auto p-4 flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>Tiến độ bài học phân bổ theo từng đơn vị ({selectedLessonDetail.unitBreakdown.length} đơn vị)</span>
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const allLearners = selectedLessonDetail.unitBreakdown.flatMap(ub =>
                      ub.learners.map(l => ({
                        ...l,
                        unitName: l.unitName || ub.unitName
                      }))
                    );
                    const totalUsers = allLearners.length;
                    const completedUsers = allLearners.filter(l => l.isCompleted).length;
                    const sumProg = allLearners.reduce((s, l) => s + l.progress, 0);
                    const avgProgress = totalUsers > 0 ? Number((sumProg / totalUsers).toFixed(2)) : 0;

                    setSelectedUnitForLearnersModal({
                      unitId: 'ALL',
                      unitName: 'Tất cả các đơn vị',
                      totalUsers,
                      completedUsers,
                      avgProgress,
                      learners: allLearners
                    });
                    setLearnerSearchTerm('');
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                  title="Mở cửa sổ xem tất cả quân nhân của toàn bộ các đơn vị học bài này"
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Xem tất cả quân nhân</span>
                </button>
              </div>

              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <th className="p-3 text-center w-12">STT</th>
                      <th className="p-3">Đơn vị</th>
                      <th className="p-3 text-center">Tổng quân nhân</th>
                      <th className="p-3 text-center">Đã hoàn thành</th>
                      <th className="p-3">Tiến độ trung bình</th>
                      <th className="p-3 text-center">Trạng thái</th>
                      <th className="p-3 text-center w-36">Xem quân nhân</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {selectedLessonDetail.unitBreakdown.map((ub, uIdx) => {
                      const isDone = ub.totalUsers > 0 && ub.completedUsers >= ub.totalUsers;
                      const isLearning = ub.completedUsers > 0 || ub.avgProgress > 0;

                      return (
                        <tr key={ub.unitId || `ub-row-${uIdx}`} className="hover:bg-blue-50/20 transition-colors">
                          <td className="p-3 text-center font-mono text-slate-500">{uIdx + 1}</td>
                          <td className="p-3 font-bold text-slate-900 text-xs">
                            {ub.unitName}
                          </td>
                          <td className="p-3 text-center font-semibold text-slate-700">
                            {ub.totalUsers} quân nhân
                          </td>
                          <td className="p-3 text-center font-bold text-emerald-700 font-mono">
                            {ub.completedUsers} / {ub.totalUsers}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200 shrink-0">
                                <div
                                  className={`h-full ${
                                    ub.avgProgress >= 80
                                      ? 'bg-emerald-500'
                                      : ub.avgProgress >= 50
                                      ? 'bg-blue-600'
                                      : ub.avgProgress > 0
                                      ? 'bg-amber-500'
                                      : 'bg-slate-300'
                                  }`}
                                  style={{ width: `${ub.avgProgress}%` }}
                                />
                              </div>
                              <span className="font-mono font-bold text-[11px]">{ub.avgProgress.toFixed(2)}%</span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            {isDone ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Hoàn thành 100%
                              </span>
                            ) : isLearning ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                Đang học
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                Chưa học
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            {ub.learners.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedUnitForLearnersModal({
                                    ...ub,
                                    learners: ub.learners.map(l => ({
                                      ...l,
                                      unitName: l.unitName || ub.unitName
                                    }))
                                  });
                                  setLearnerSearchTerm('');
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 transition-colors border border-blue-200/80 shadow-2xs cursor-pointer"
                                title={`Mở cửa sổ danh sách ${ub.learners.length} quân nhân đơn vị ${ub.unitName}`}
                              >
                                <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                <span>Xem quân nhân</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">0 quân nhân</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => {
                  setSelectedLessonDetail(null);
                  setSelectedUnitForLearnersModal(null);
                }}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL MỚI: DANH SÁCH QUÂN NHÂN CỦA ĐƠN VỊ HỌC BÀI NÀY */}
      {/* ========================================================= */}
      {selectedUnitForLearnersModal && selectedLessonDetail && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-60 flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[88vh] flex flex-col">
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-blue-800/40">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white">
                      DANH SÁCH QUÂN NHÂN - {selectedUnitForLearnersModal.unitName.toUpperCase()}
                    </h3>
                    <span className="bg-blue-600/60 text-blue-200 border border-blue-400/40 px-2 py-0.5 rounded-full text-[10px] font-bold">
                      {selectedUnitForLearnersModal.totalUsers} đồng chí
                    </span>
                  </div>
                  <p className="text-xs text-blue-200 mt-0.5 line-clamp-1">
                    Bài học: <span className="font-semibold text-white">{selectedLessonDetail.title}</span> (Năm {selectedLessonDetail.year})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedUnitForLearnersModal(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
                title="Đóng cửa sổ quân nhân"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Bar: Stats (Left), Search (Center), Export Button (Right) */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
              {/* Left: Summary Stats */}
              <div className="flex flex-wrap items-center gap-3.5 shrink-0 text-slate-700">
                <span>
                  Đã hoàn thành: <strong className="text-emerald-700 font-mono font-bold">{selectedUnitForLearnersModal.completedUsers} / {selectedUnitForLearnersModal.totalUsers}</strong>
                </span>
                <span className="hidden sm:inline text-slate-300">|</span>
                <span>
                  Tiến độ TB đơn vị: <strong className="text-blue-700 font-mono font-bold">{selectedUnitForLearnersModal.avgProgress.toFixed(2)}%</strong>
                </span>
              </div>

              {/* Center: Search input */}
              <div className="relative w-full md:w-80 max-w-md mx-auto md:mx-0">
                <input
                  type="text"
                  placeholder="Tìm theo họ tên, cấp bậc, chức vụ..."
                  value={learnerSearchTerm}
                  onChange={(e) => setLearnerSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-8 pr-3 py-1.5 focus:outline-hidden focus:border-blue-500 transition-all shadow-2xs"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              {/* Right: Xuất danh sách */}
              <div className="flex items-center justify-end shrink-0">
                <button
                  type="button"
                  onClick={handleExportUnitLearnersToExcel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors shadow-2xs cursor-pointer"
                  title="Xuất danh sách quân nhân của đơn vị học bài này ra file Excel (.xlsx)"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>Xuất danh sách</span>
                </button>
              </div>
            </div>

            {/* Body: Scrollable Table */}
            <div className="overflow-y-auto p-4 flex-1">
              {(() => {
                const isAllUnitsView = selectedUnitForLearnersModal.unitId === 'ALL';
                const filteredLearners = selectedUnitForLearnersModal.learners.filter(l => {
                  if (!learnerSearchTerm.trim()) return true;
                  return matchSearch(l.fullName, learnerSearchTerm) ||
                    matchSearch(l.rank, learnerSearchTerm) ||
                    matchSearch(l.position, learnerSearchTerm) ||
                    (l.unitName ? matchSearch(l.unitName, learnerSearchTerm) : false);
                });

                if (filteredLearners.length === 0) {
                  return (
                    <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                      <Users className="w-8 h-8 text-slate-300 mx-auto" />
                      <p className="font-semibold text-slate-600">Không tìm thấy quân nhân nào phù hợp</p>
                      {learnerSearchTerm && (
                        <p className="text-[11px] text-slate-400">Thử kiểm tra lại từ khóa tìm kiếm</p>
                      )}
                    </div>
                  );
                }

                return (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                          <th className="p-3 text-center w-12">STT</th>
                          <th className="p-3">Họ và tên</th>
                          <th className="p-3">Cấp bậc</th>
                          <th className="p-3">Chức vụ</th>
                          {isAllUnitsView && (
                            <th className="p-3">Đơn vị</th>
                          )}
                          <th className="p-3">Tiến độ bài học</th>
                          <th className="p-3 text-center">Trạng thái</th>
                          <th className="p-3 text-right">Lần cuối học</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {filteredLearners.map((lrn, lIdx) => (
                          <tr key={lrn.userId || `lrn-${lIdx}`} className="hover:bg-blue-50/20 transition-colors">
                            <td className="p-3 text-center font-mono text-slate-400">{lIdx + 1}</td>
                            <td className="p-3 font-bold text-slate-900 text-xs">{lrn.fullName}</td>
                            <td className="p-3 text-slate-700">{lrn.rank}</td>
                            <td className="p-3 text-slate-600">{lrn.position}</td>
                            {isAllUnitsView && (
                              <td className="p-3 font-semibold text-blue-900 text-xs">
                                {lrn.unitName || '—'}
                              </td>
                            )}
                            <td className="p-3">
                              <div className="flex items-center space-x-2.5">
                                <div className="w-24 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200 shrink-0">
                                  <div
                                    className={`h-full ${
                                      lrn.progress >= 80
                                        ? 'bg-emerald-500'
                                        : lrn.progress >= 50
                                        ? 'bg-blue-600'
                                        : lrn.progress > 0
                                        ? 'bg-amber-500'
                                        : 'bg-slate-300'
                                    }`}
                                    style={{ width: `${lrn.progress}%` }}
                                  />
                                </div>
                                <span className="font-mono font-bold text-xs">{lrn.progress.toFixed(1)}%</span>
                              </div>
                            </td>
                            <td className="p-3 text-center">
                              {lrn.isCompleted ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Đã hoàn thành
                                </span>
                              ) : lrn.progress > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                  Đang học
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  Chưa học
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono text-[11px] text-slate-500">
                              {formatLastAccess(lrn.lastAccessedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                Hiển thị danh sách cán bộ, chiến sĩ học bài học theo đơn vị
              </span>
              <button
                onClick={() => setSelectedUnitForLearnersModal(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
              >
                Đóng cửa sổ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CHI TIẾT TIẾN ĐỘ HỌC TẬP TỪNG TÀI KHOẢN */}
      {/* ========================================================= */}
      {selectedAccountDetail && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between shrink-0 border-b border-blue-900/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    CHI TIẾT TIẾN ĐỘ HỌC TẬP QUÂN NHÂN
                  </h3>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Quân nhân: <span className="font-bold text-white">{selectedAccountDetail.user.fullName || selectedAccountDetail.user.name}</span>
                    {' • '}Cấp bậc: <span className="text-white font-medium">{selectedAccountDetail.rank}</span>
                    {' • '}Chức vụ: <span className="text-white font-medium">{selectedAccountDetail.position}</span>
                    {' • '}<span className="text-amber-300 font-semibold">{selectedAccountDetail.unitName}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAccountDetail(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary Strip */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-4">
                <span className="text-slate-600">
                  Bài đã học: <strong className="text-blue-700 font-mono text-sm">{selectedAccountDetail.completedLessons} / {selectedAccountDetail.totalLessons}</strong> bài
                </span>
                <span className="text-slate-600">
                  Tiến độ TB: <strong className="text-emerald-700 font-mono text-sm">{Number(selectedAccountDetail.avgProgress).toFixed(2)}%</strong>
                </span>
              </div>
              <div className="text-slate-500 font-mono text-[11px]">
                Email: {selectedAccountDetail.user.email}
              </div>
            </div>

            {/* Content Body */}
            <div className="overflow-y-auto p-4 flex-1 space-y-6">
              {/* CÁC BÀI HỌC / CHUYÊN ĐỀ ĐÃ VÀ ĐANG HỌC */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Danh sách chuyên đề đã học ({selectedAccountDetail.progressRecords.length})</span>
                </h4>

                {selectedAccountDetail.progressRecords.length === 0 ? (
                  <div className="py-8 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-400 text-xs">
                    Quân nhân chưa tham gia học bài học nào trên ứng dụng.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                          <th className="p-3 text-center w-12">STT</th>
                          <th className="p-3">Tên bài học</th>
                          <th className="p-3 text-center">Trạng thái</th>
                          <th className="p-3 text-right">Lần cuối học</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                        {selectedAccountDetail.progressRecords.map((prog, pIdx) => {
                          const isDone = Boolean(prog.completed || (prog as any).isCompleted || (prog as any).hoanThanh || (prog as any).daDat);
                          return (
                            <tr key={prog.id || `pr-${pIdx}`} className="hover:bg-slate-50 transition-colors">
                              <td className="p-3 text-center font-mono text-slate-500">{pIdx + 1}</td>
                              <td className="p-3 font-semibold text-slate-900">{prog.lessonTitle || 'Bài học'}</td>
                              <td className="p-3 text-center">
                                {isDone ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Đã hoàn thành
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                    Đang học
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right font-mono text-slate-500 text-[11px]">
                                {formatLastAccess(prog.lastAccessedAt)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setSelectedAccountDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
