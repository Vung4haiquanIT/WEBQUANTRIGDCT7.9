import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, Plus, Upload, Play, CheckCircle2, XCircle, Clock, Calendar,
  Award, ShieldCheck, Download, Trash2, Eye, RefreshCw, Search, Filter,
  Users, Layers, ArrowRight, AlertCircle, FileText, Check, X, Smartphone, BarChart3,
  Edit3, TrendingUp, Medal, ChevronRight, Printer, HelpCircle, CheckCircle,
  UserCheck
} from 'lucide-react';
import { ExamBank, ExamQuestion, ExamSession, ExamSubmission, Unit, User, UserProgress } from '../types';
import { api } from '../services/api';
import { db, doc, getDoc } from '../services/firebase';
import { parseExamQuestionsFromExcel, downloadSampleExamExcelTemplate, ParsedExamExcelResult } from '../utils/excelExamParser';
import { matchSearch } from '../utils/vietnamese';
import { getCreatorUsername, getActiveAdminUsername, getActiveAdminFullName } from '../utils/creatorHelper';
import * as XLSX from 'xlsx';

interface ExamsViewProps {
  currentUser?: any;
  units?: Unit[];
  users?: User[];
  progressList?: UserProgress[];
}

export const ExamsView: React.FC<ExamsViewProps> = ({ currentUser, units = [], users = [], progressList = [] }) => {
  const [activeTab, setActiveTab] = useState<'sessions' | 'banks' | 'reports'>('sessions');

  // Core Data States
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [banks, setBanks] = useState<ExamBank[]>([]);
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Filter States for Reports
  const [selectedSessionFilter, setSelectedSessionFilter] = useState<string>('ALL');
  const [selectedUnitFilter, setSelectedUnitFilter] = useState<string>('ALL');
  const [searchCandidateQuery, setSearchCandidateQuery] = useState<string>('');

  // Modals States
  const [isNewBankModalOpen, setIsNewBankModalOpen] = useState(false);
  const [isNewSessionModalOpen, setIsNewSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<ExamSession | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<ExamSession | null>(null);
  const [bankToDelete, setBankToDelete] = useState<ExamBank | null>(null);
  const [reportViewMode, setReportViewMode] = useState<'unit' | 'candidate'>('unit');
  const [selectedBankForDetail, setSelectedBankForDetail] = useState<ExamBank | null>(null);
  const [selectedSessionForReport, setSelectedSessionForReport] = useState<ExamSession | null>(null);
  const [selectedSubmissionForDetail, setSelectedSubmissionForDetail] = useState<ExamSubmission | null>(null);
  const [detailQuestions, setDetailQuestions] = useState<ExamQuestion[]>([]);
  const [detailQuestionsSource, setDetailQuestionsSource] = useState<string>('');
  const [isLoadingDetailQuestions, setIsLoadingDetailQuestions] = useState<boolean>(false);
  const [selectedAccountForExamDetail, setSelectedAccountForExamDetail] = useState<{
    user: User;
    rank: string;
    position: string;
    unitName: string;
    examCount: number;
    highestScore: number;
    submissions: ExamSubmission[];
    sessionFilterTitle?: string;
  } | null>(null);

  // Test Simulator Modal (Mobile App Exam Simulator)
  const [activeSimulatorSession, setActiveSimulatorSession] = useState<ExamSession | null>(null);
  const [simulatorQuestions, setSimulatorQuestions] = useState<ExamQuestion[]>([]);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number>(1200); // 20 mins
  const [isSubmittingTest, setIsSubmittingTest] = useState<boolean>(false);
  const [testResultSummary, setTestResultSummary] = useState<ExamSubmission | null>(null);

  // Excel Import State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [parsedExcelResult, setParsedExcelResult] = useState<ParsedExamExcelResult | null>(null);
  const [newBankTitle, setNewBankTitle] = useState<string>('');
  const [newBankDescription, setNewBankDescription] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [isSyncingSessionId, setIsSyncingSessionId] = useState<string | null>(null);

  // Question Edit State inside a Question Bank
  const [editingQuestion, setEditingQuestion] = useState<ExamQuestion | null>(null);
  const [editingQuestionForm, setEditingQuestionForm] = useState<{
    question: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
  }>({
    question: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
    explanation: ''
  });
  const [isSavingQuestion, setIsSavingQuestion] = useState<boolean>(false);

  // Open Edit Question Modal
  const handleOpenEditQuestion = (q: ExamQuestion) => {
    setEditingQuestion(q);
    setEditingQuestionForm({
      question: q.question || '',
      options: q.options && q.options.length >= 4 ? [...q.options] : [(q.options?.[0] || ''), (q.options?.[1] || ''), (q.options?.[2] || ''), (q.options?.[3] || '')],
      correctOptionIndex: typeof q.correctOptionIndex === 'number' ? q.correctOptionIndex : 0,
      explanation: q.explanation || ''
    });
  };

  // Save Edited Question & Auto Sync Live to App
  const handleSaveEditedQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuestion || !selectedBankForDetail) return;
    if (!editingQuestionForm.question.trim()) {
      alert('Vui lòng nhập nội dung câu hỏi');
      return;
    }
    setIsSavingQuestion(true);
    try {
      const updatedQuestions = await api.updateExamQuestionInBank(
        selectedBankForDetail.id,
        editingQuestion.id,
        {
          question: editingQuestionForm.question.trim(),
          options: editingQuestionForm.options.map(o => o.trim()),
          correctOptionIndex: Number(editingQuestionForm.correctOptionIndex) || 0,
          explanation: editingQuestionForm.explanation.trim()
        }
      );

      // Update local state
      const updatedBank = {
        ...selectedBankForDetail,
        questions: updatedQuestions,
        totalQuestions: updatedQuestions.length
      };
      setSelectedBankForDetail(updatedBank);
      setEditingQuestion(null);
      await loadAllData();
    } catch (err: any) {
      console.error(`Lỗi cập nhật câu hỏi: ${err.message}`);
    } finally {
      setIsSavingQuestion(false);
    }
  };

  // Delete Question From Bank
  const handleDeleteQuestionFromBank = async (qId: string) => {
    if (!selectedBankForDetail) return;
    if (!confirm('Bạn có chắc chắn muốn xóa câu hỏi này khỏi bộ đề? Sau khi xóa, dữ liệu trên App di động sẽ cập nhật lập tức.')) return;
    try {
      const updatedQuestions = await api.deleteExamQuestionFromBank(selectedBankForDetail.id, qId);
      setSelectedBankForDetail({
        ...selectedBankForDetail,
        questions: updatedQuestions,
        totalQuestions: updatedQuestions.length
      });
      await loadAllData();
    } catch (err: any) {
      console.error(`Lỗi xóa câu hỏi: ${err.message}`);
    }
  };

  // Push Exam Session & Question Bank live to Mobile App accounts
  const handlePushBankToApp = async (session: ExamSession) => {
    setIsSyncingSessionId(session.id);
    try {
      const result = await api.syncSessionBankQuestions(session.id);
      await loadAllData();
      alert(
        `Đã đẩy thành công ${result.syncedQuestionCount} câu hỏi từ Ngân hàng đề lên Cloud App cho đợt kiểm tra "${session.title}"!\n\nTất cả các tài khoản người dùng/quân nhân trên App di động đã có thể truy cập làm bài.`
      );
    } catch (err: any) {
      alert(`Lỗi khi đẩy bộ đề lên App: ${err?.message || 'Không thể kết nối'}`);
    } finally {
      setIsSyncingSessionId(null);
    }
  };

  // Helper: format ISO / timestamp to YYYY-MM-DD for date input
  const formatForDateInput = (dateInput?: string | Date | number): string => {
    if (!dateInput) return '';
    if (typeof dateInput === 'string') {
      if (dateInput.endsWith('Z')) {
        const d = new Date(dateInput);
        if (!isNaN(d.getTime())) {
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        }
      } else if (dateInput.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
        return dateInput.substring(0, 10);
      }
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const getTzOffsetString = (): string => {
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const absMin = Math.abs(offsetMin);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${sign}${pad(Math.floor(absMin / 60))}:${pad(absMin % 60)}`;
  };

  // Helper: convert YYYY-MM-DD to ISO at start of day (00:00:00) with local offset (+07:00)
  const convertDateToStartOfDayIso = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleanStr = dateStr.includes('T') ? dateStr.substring(0, 10) : dateStr;
    const [y, m, d] = cleanStr.split('-').map(Number);
    if (y && m && d) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${y}-${pad(m)}-${pad(d)}T00:00:00${getTzOffsetString()}`;
    }
    return '';
  };

  // Helper: convert YYYY-MM-DD to ISO at end of day (23:59:59) with local offset (+07:00)
  const convertDateToEndOfDayIso = (dateStr: string): string => {
    if (!dateStr) return '';
    const cleanStr = dateStr.includes('T') ? dateStr.substring(0, 10) : dateStr;
    const [y, m, d] = cleanStr.split('-').map(Number);
    if (y && m && d) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${y}-${pad(m)}-${pad(d)}T23:59:59${getTzOffsetString()}`;
    }
    return '';
  };

  // Helper to format targetGroup string for display
  const formatTargetGroupDisplay = (targetGroup?: string): string => {
    if (!targetGroup || targetGroup === 'ALL') return 'Tất cả';
    const parts = targetGroup.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0 || parts.includes('ALL')) return 'Tất cả';
    
    const uniqueParts = Array.from(new Set(parts));
    if (uniqueParts.length >= 3) return 'Tất cả';

    const labels = uniqueParts.map(p => {
      if (p === 'SQ') return 'Sĩ quan (SQ)';
      if (p === 'QNCN') return 'QNCN';
      if (p === 'HSQ-BS') return 'HSQ-BS';
      return p;
    });
    return labels.join(', ');
  };

  // Helper to parse targetGroup string into array of selected group keys
  const parseTargetGroups = (targetGroupStr?: string): string[] => {
    if (!targetGroupStr || targetGroupStr === 'ALL') return ['SQ', 'QNCN', 'HSQ-BS'];
    const parts = targetGroupStr.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.includes('ALL')) return ['SQ', 'QNCN', 'HSQ-BS'];
    return Array.from(new Set(parts));
  };

  // Helper to build targetGroup string from array of selected group keys
  const buildTargetGroupString = (selectedList: string[]): string => {
    const allGroups = ['SQ', 'QNCN', 'HSQ-BS'];
    const hasAll = allGroups.every(g => selectedList.includes(g));
    if (hasAll || selectedList.length === 0) return 'ALL';
    return selectedList.join(', ');
  };

  // Helper: format for display (ngày DD/MM/YYYY)
  const formatDateDisplay = (dateInput?: string | Date | number): string => {
    if (!dateInput) return '';
    if (typeof dateInput === 'string') {
      if (dateInput.endsWith('Z')) {
        const d = new Date(dateInput);
        if (!isNaN(d.getTime())) {
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
        }
      } else if (dateInput.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(dateInput)) {
        const parts = dateInput.substring(0, 10).split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  // Helper: compute auto status based on startTime & endTime vs currentTime
  const getExamSessionStatus = (
    startTime?: string,
    endTime?: string,
    explicitStatus?: string
  ): {
    status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED';
    label: string;
    badgeClass: string;
    dotClass: string;
  } => {
    if (explicitStatus === 'COMPLETED') {
      return {
        status: 'COMPLETED',
        label: 'Đã kết thúc',
        badgeClass: 'text-slate-600 bg-slate-100 border-slate-200',
        dotClass: 'bg-slate-400'
      };
    }

    const now = Date.now();
    const sTime = startTime ? new Date(startTime).getTime() : null;
    const eTime = endTime ? new Date(endTime).getTime() : null;

    if (sTime && !isNaN(sTime) && now < sTime) {
      return {
        status: 'UPCOMING',
        label: 'Sắp diễn ra',
        badgeClass: 'text-amber-800 bg-amber-50 border-amber-300',
        dotClass: 'bg-amber-500'
      };
    }

    if (eTime && !isNaN(eTime) && now > eTime) {
      return {
        status: 'COMPLETED',
        label: 'Đã kết thúc',
        badgeClass: 'text-slate-600 bg-slate-100 border-slate-200',
        dotClass: 'bg-slate-400'
      };
    }

    return {
      status: 'ACTIVE',
      label: 'Đang diễn ra',
      badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      dotClass: 'bg-emerald-600 animate-pulse'
    };
  };

  // Helper to open session modal pre-selected from a Question Bank
  const handleCreateSessionFromBank = (bank: ExamBank) => {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startIso = convertDateToStartOfDayIso(formatForDateInput(today));
    const endIso = convertDateToEndOfDayIso(formatForDateInput(nextWeek));

    setEditingSession(null);
    setSessionFormData({
      title: `Đợt kiểm tra: ${bank.title}`,
      description: `Kiểm tra đánh giá chất lượng từ bộ đề ${bank.title} (${bank.totalQuestions} câu hỏi)`,
      targetGroup: 'ALL',
      bankId: bank.id,
      durationMinutes: 20,
      passScore: 5.0,
      totalQuestions: 20,
      maxAttempts: 3,
      targetUnit: 'ALL',
      startTime: startIso,
      endTime: endIso,
      status: 'ACTIVE'
    });
    setIsNewSessionModalOpen(true);
  };

  // New Exam Session Form State
  const [sessionFormData, setSessionFormData] = useState({
    title: '',
    description: '',
    targetGroup: 'ALL' as 'ALL' | 'SQ' | 'QNCN' | string,
    bankId: '',
    durationMinutes: 20,
    passScore: 5.0,
    totalQuestions: 20,
    maxAttempts: 3,
    targetUnit: 'ALL',
    startTime: '',
    endTime: '',
    status: 'ACTIVE' as 'ACTIVE' | 'COMPLETED' | 'DRAFT' | 'UPCOMING' | string
  });

  // Fetch initial data & setup realtime sync listeners
  useEffect(() => {
    loadAllData();

    // Realtime listener for exam sessions
    const unsubSessions = api.listenExamSessions((updatedSessions) => {
      setSessions(updatedSessions);
    });

    // Realtime listener for exam question banks
    const unsubBanks = api.listenExamBanks((updatedBanks) => {
      setBanks(updatedBanks);
    });

    // Realtime listener for all candidate exam submissions (instant sync across accounts)
    const unsubSubmissions = api.listenExamSubmissions(undefined, (updatedSubmissions) => {
      setSubmissions(updatedSubmissions);
    });

    return () => {
      if (unsubSessions) unsubSessions();
      if (unsubBanks) unsubBanks();
      if (unsubSubmissions) unsubSubmissions();
    };
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await api.cleanSampleSubmissionsIfNeeded().catch(() => {});
      const [banksData, sessionsData, subsData] = await Promise.all([
        api.getExamBanks(),
        api.getExamSessions(),
        api.getExamSubmissions()
      ]);
      setBanks(banksData);
      setSessions(sessionsData);
      setSubmissions(subsData);
    } catch (err) {
      console.error('Error loading exam data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper to format duration in minutes & seconds
  const formatDuration = (seconds?: number) => {
    if (!seconds || seconds <= 0) return '< 1 phút';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs} giây`;
    return `${mins} phút ${secs > 0 ? `${secs} giây` : ''}`;
  };

  // Resolve questions for selected submission detail modal
  useEffect(() => {
    if (!selectedSubmissionForDetail) {
      setDetailQuestions([]);
      setDetailQuestionsSource('');
      return;
    }

    // If submission already has full answer records with questions
    if (selectedSubmissionForDetail.answers && selectedSubmissionForDetail.answers.length > 0) {
      setDetailQuestions([]);
      setDetailQuestionsSource('recorded_answers');
      return;
    }

    let isMounted = true;
    setIsLoadingDetailQuestions(true);

    const fetchDetailQuestions = async () => {
      try {
        const sub = selectedSubmissionForDetail;
        
        // 1. Try matching session by id or title in state
        let matchedSession = sessions.find(s => s.id === sub.sessionId || s.title?.trim().toLowerCase() === sub.sessionTitle?.trim().toLowerCase());
        
        if (matchedSession?.questions && matchedSession.questions.length > 0) {
          if (isMounted) {
            const count = (matchedSession.totalQuestions && matchedSession.totalQuestions <= matchedSession.questions.length)
              ? matchedSession.totalQuestions
              : (sub.totalQuestions && sub.totalQuestions <= matchedSession.questions.length ? sub.totalQuestions : matchedSession.questions.length);
            setDetailQuestions(matchedSession.questions.slice(0, count));
            setDetailQuestionsSource(matchedSession.title);
            setIsLoadingDetailQuestions(false);
          }
          return;
        }

        // 2. Try session's bankId
        if (matchedSession?.bankId) {
          let matchedBank = banks.find(b => b.id === matchedSession?.bankId);
          if (!matchedBank?.questions || matchedBank.questions.length === 0) {
            try {
              matchedBank = await api.getExamBank(matchedSession.bankId);
            } catch {}
          }
          if (matchedBank?.questions && matchedBank.questions.length > 0) {
            if (isMounted) {
              const count = sub.totalQuestions && sub.totalQuestions <= matchedBank.questions.length
                ? sub.totalQuestions
                : (matchedSession.totalQuestions || matchedBank.questions.length);
              setDetailQuestions(matchedBank.questions.slice(0, count));
              setDetailQuestionsSource(matchedBank.title || matchedSession.title);
              setIsLoadingDetailQuestions(false);
            }
            return;
          }
        }

        // 3. Try matching bank in state by sessionTitle
        const bankMatch = banks.find(b => 
          b.title?.trim().toLowerCase().includes(sub.sessionTitle?.trim().toLowerCase()) ||
          sub.sessionTitle?.trim().toLowerCase().includes(b.title?.trim().toLowerCase())
        );
        if (bankMatch?.questions && bankMatch.questions.length > 0) {
          if (isMounted) {
            setDetailQuestions(bankMatch.questions.slice(0, sub.totalQuestions || 20));
            setDetailQuestionsSource(bankMatch.title);
            setIsLoadingDetailQuestions(false);
          }
          return;
        }

        // 4. Try fetching session doc directly from Firestore
        if (sub.sessionId) {
          try {
            const sSnap = await getDoc(doc(db, 'exam_sessions', sub.sessionId));
            if (sSnap.exists()) {
              const sData = sSnap.data() as ExamSession;
              if (sData.questions && sData.questions.length > 0) {
                if (isMounted) {
                  const count = sub.totalQuestions && sub.totalQuestions <= sData.questions.length ? sub.totalQuestions : (sData.totalQuestions || sData.questions.length);
                  setDetailQuestions(sData.questions.slice(0, count));
                  setDetailQuestionsSource(sData.title);
                  setIsLoadingDetailQuestions(false);
                }
                return;
              }
              if (sData.bankId) {
                const bSnap = await getDoc(doc(db, 'exam_banks', sData.bankId));
                if (bSnap.exists() && bSnap.data()?.questions?.length > 0) {
                  if (isMounted) {
                    const qArr = bSnap.data().questions;
                    const count = sub.totalQuestions && sub.totalQuestions <= qArr.length ? sub.totalQuestions : (sData.totalQuestions || qArr.length);
                    setDetailQuestions(qArr.slice(0, count));
                    setDetailQuestionsSource(bSnap.data().title || sData.title);
                    setIsLoadingDetailQuestions(false);
                  }
                  return;
                }
              }
            }
          } catch (fetchErr) {
            console.warn('Direct Firestore fetch error:', fetchErr);
          }
        }

        // Fallback: check any bank with questions
        if (banks.length > 0 && banks[0].questions && banks[0].questions.length > 0) {
          if (isMounted) {
            setDetailQuestions(banks[0].questions.slice(0, sub.totalQuestions || 20));
            setDetailQuestionsSource(banks[0].title);
          }
        } else {
          if (isMounted) {
            setDetailQuestions([]);
            setDetailQuestionsSource('');
          }
        }
      } catch (err) {
        console.error('Error resolving submission questions:', err);
      } finally {
        if (isMounted) {
          setIsLoadingDetailQuestions(false);
        }
      }
    };

    fetchDetailQuestions();

    return () => {
      isMounted = false;
    };
  }, [selectedSubmissionForDetail, sessions, banks]);

  // Open account exam detail modal (Chi tiết các lượt thi theo đợt kiểm tra) for a submission
  const handleOpenAccountDetailForSubmission = (sub: ExamSubmission) => {
    const userSubmissions = submissions.filter(s => {
      const isUserMatch = (sub.userId && s.userId === sub.userId) || 
        (s.userName && sub.userName && s.userName.trim().toLowerCase() === sub.userName.trim().toLowerCase());
      if (!isUserMatch) return false;

      // Filter strictly by the current exam session
      if (sub.sessionId && s.sessionId) {
        return s.sessionId === sub.sessionId;
      }
      if (sub.sessionTitle && s.sessionTitle) {
        return s.sessionTitle.trim().toLowerCase() === sub.sessionTitle.trim().toLowerCase();
      }
      return true;
    });

    // Lọc bỏ trùng lặp lượt thi (loại trừ các bản ghi bị ghi đúp qua nhiều collection)
    const uniqueUserSubmissions = api.deduplicateSubmissions(userSubmissions);
    uniqueUserSubmissions.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    const matchedUser = users.find(u => 
      (sub.userId && u.id === sub.userId) || 
      (u.fullName && sub.userName && u.fullName.trim().toLowerCase() === sub.userName.trim().toLowerCase()) ||
      (u.name && sub.userName && u.name.trim().toLowerCase() === sub.userName.trim().toLowerCase())
    );
    const list = uniqueUserSubmissions.length > 0 ? uniqueUserSubmissions : [sub];
    const highest = Math.max(...list.map(s => s.score || 0));

    setSelectedAccountForExamDetail({
      user: matchedUser || {
        id: sub.userId || `user-${sub.userName}`,
        fullName: sub.userName,
        name: sub.userName,
        email: matchedUser?.email || `${sub.userName.toLowerCase().replace(/\s+/g, '')}@v4.hq`,
        role: matchedUser?.role || 'user',
        rank: sub.userRank || 'Quân nhân',
        position: sub.userPosition,
        unitId: matchedUser?.unitId || '',
        unitName: sub.unitName || ''
      },
      rank: sub.userRank || matchedUser?.rank || 'Quân nhân',
      position: sub.userPosition || matchedUser?.position,
      unitName: sub.unitName || matchedUser?.unitName || '',
      examCount: list.length,
      highestScore: highest,
      submissions: list,
      sessionFilterTitle: sub.sessionTitle || ''
    });
  };

  // Handle Excel File Selected
  const handleExcelFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelFile(file);
    if (!newBankTitle) {
      setNewBankTitle(file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' '));
    }
    const result = await parseExamQuestionsFromExcel(file);
    setParsedExcelResult(result);
  };

  // Handle Save New Question Bank
  const handleSaveBankFromExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankTitle.trim()) {
      alert('Vui lòng nhập tên Bộ đề thi');
      return;
    }
    if (!parsedExcelResult || parsedExcelResult.questions.length === 0) {
      alert('Chưa có câu hỏi hợp lệ nào được đọc từ file Excel');
      return;
    }

    setIsImporting(true);
    try {
      const adminUsername = getActiveAdminUsername(currentUser);
      const adminFullName = getActiveAdminFullName(currentUser);
      const created = await api.createExamBank(
        {
          title: newBankTitle.trim(),
          description: newBankDescription.trim(),
          createdBy: adminFullName,
          createdByUsername: adminUsername,
          createdByName: adminFullName
        },
        parsedExcelResult.questions
      );

      setIsNewBankModalOpen(false);
      setExcelFile(null);
      setParsedExcelResult(null);
      setNewBankTitle('');
      setNewBankDescription('');
      loadAllData();
    } catch (err: any) {
      alert(`Lỗi lưu bộ đề: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Handle Delete Bank
  const handleRequestDeleteBank = (bank: ExamBank) => {
    setBankToDelete(bank);
  };

  const confirmDeleteBank = async (bank: ExamBank) => {
    const bankId = bank.id;
    setBankToDelete(null);
    try {
      await api.deleteExamBank(bankId);
      loadAllData();
    } catch (err: any) {
      alert(`Lỗi xóa bộ đề: ${err.message}`);
    }
  };

  // Handle Open Bank Detail
  const handleViewBankDetail = async (bank: ExamBank) => {
    const fullBank = await api.getExamBank(bank.id);
    setSelectedBankForDetail(fullBank || bank);
  };

  // Open Session Modal for Creation
  const handleOpenCreateSession = () => {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startIso = convertDateToStartOfDayIso(formatForDateInput(today));
    const endIso = convertDateToEndOfDayIso(formatForDateInput(nextWeek));

    setEditingSession(null);
    setSessionFormData({
      title: '',
      description: '',
      targetGroup: 'ALL',
      bankId: banks.length > 0 ? banks[0].id : '',
      durationMinutes: 20,
      passScore: 5.0,
      totalQuestions: 20,
      maxAttempts: 3,
      targetUnit: 'ALL',
      startTime: startIso,
      endTime: endIso,
      status: 'ACTIVE'
    });
    setIsNewSessionModalOpen(true);
  };

  // Open Session Modal for Editing
  const handleOpenEditSession = (session: ExamSession) => {
    setEditingSession(session);
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const defaultStartIso = convertDateToStartOfDayIso(formatForDateInput(today));
    const defaultEndIso = convertDateToEndOfDayIso(formatForDateInput(nextWeek));

    const sTime = session.startTime || session.createdAt || defaultStartIso;
    let eTime = session.endTime || defaultEndIso;
    const sDateStr = formatForDateInput(sTime);
    const eDateStr = formatForDateInput(eTime);
    if (sDateStr && eDateStr && eDateStr < sDateStr) {
      eTime = convertDateToEndOfDayIso(sDateStr);
    }

    setSessionFormData({
      title: session.title || '',
      description: session.description || '',
      targetGroup: session.targetGroup || 'ALL',
      bankId: session.bankId || '',
      durationMinutes: session.durationMinutes || 20,
      passScore: session.passScore || 5.0,
      totalQuestions: session.totalQuestions || 20,
      maxAttempts: session.maxAttempts !== undefined ? session.maxAttempts : 3,
      targetUnit: session.targetUnit || 'ALL',
      startTime: sTime,
      endTime: eTime,
      status: session.status || 'ACTIVE'
    });
    setIsNewSessionModalOpen(true);
  };

  // Handle Save (Create or Edit) Exam Session
  const handleSaveSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionFormData.title.trim()) {
      alert('Vui lòng nhập tên Đợt kiểm tra');
      return;
    }
    if (!sessionFormData.bankId) {
      alert('Vui lòng chọn Bộ đề thi cho đợt kiểm tra này');
      return;
    }

    const selectedBank = banks.find(b => b.id === sessionFormData.bankId);

    try {
      const requestedCount = Number(sessionFormData.totalQuestions) || 10;
      
      const startDatePart = formatForDateInput(sessionFormData.startTime) || formatForDateInput(new Date());
      const endDatePart = formatForDateInput(sessionFormData.endTime) || formatForDateInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));

      const startIso = convertDateToStartOfDayIso(startDatePart);
      const endIso = convertDateToEndOfDayIso(endDatePart);

      if (startIso && endIso && new Date(endIso).getTime() < new Date(startIso).getTime()) {
        alert('Lỗi: Ngày kết thúc không thể trước ngày bắt đầu. Vui lòng chọn lại ngày kết thúc!');
        return;
      }

      const computedAuto = getExamSessionStatus(startIso, endIso);

      if (editingSession) {
        const updated = await api.updateExamSession(editingSession.id, {
          title: sessionFormData.title.trim(),
          description: sessionFormData.description.trim(),
          targetGroup: sessionFormData.targetGroup || 'ALL',
          bankId: sessionFormData.bankId,
          bankTitle: selectedBank?.title || editingSession.bankTitle || 'Bộ đề kiểm tra',
          durationMinutes: Number(sessionFormData.durationMinutes) || 20,
          passScore: Number(sessionFormData.passScore) || 5.0,
          totalQuestions: requestedCount,
          maxAttempts: Number(sessionFormData.maxAttempts) !== undefined ? Number(sessionFormData.maxAttempts) : 3,
          questions: [], // Không lưu đề thi vào exam_sessions
          targetUnit: 'ALL',
          startTime: startIso,
          endTime: endIso,
          status: computedAuto.status,
        });

        setSessions(prev => prev.map(s => s.id === editingSession.id ? updated : s));
      } else {
        const adminUsername = getActiveAdminUsername(currentUser);
        const adminFullName = getActiveAdminFullName(currentUser);
        const created = await api.createExamSession({
          title: sessionFormData.title.trim(),
          description: sessionFormData.description.trim(),
          targetGroup: sessionFormData.targetGroup || 'ALL',
          bankId: sessionFormData.bankId,
          bankTitle: selectedBank?.title || 'Bộ đề kiểm tra',
          durationMinutes: Number(sessionFormData.durationMinutes) || 20,
          passScore: Number(sessionFormData.passScore) || 5.0,
          totalQuestions: requestedCount,
          maxAttempts: Number(sessionFormData.maxAttempts) !== undefined ? Number(sessionFormData.maxAttempts) : 3,
          questions: [], // Không lưu đề thi vào exam_sessions
          targetUnit: 'ALL',
          startTime: startIso,
          endTime: endIso,
          status: computedAuto.status,
          createdBy: adminFullName,
          createdByUsername: adminUsername,
          createdByName: adminFullName
        });

        setSessions(prev => [created, ...prev.filter(s => s.id !== created.id)]);
      }

      setIsNewSessionModalOpen(false);
      setEditingSession(null);
      setSessionFormData({
        title: '',
        description: '',
        targetGroup: 'ALL',
        bankId: '',
        durationMinutes: 20,
        passScore: 5.0,
        totalQuestions: 20,
        maxAttempts: 3,
        targetUnit: 'ALL',
        startTime: '',
        endTime: '',
        status: 'ACTIVE'
      });
      await loadAllData();
    } catch (err: any) {
      console.error('Lỗi lưu đợt kiểm tra:', err);
      alert(`Lỗi lưu đợt kiểm tra: ${err.message || 'Không thể lưu thay đổi'}`);
    }
  };

  // Handle Toggle Session Status
  const handleToggleSessionStatus = async (session: ExamSession) => {
    const currentStatusInfo = getExamSessionStatus(session.startTime, session.endTime);
    const now = new Date();
    try {
      if (currentStatusInfo.status === 'ACTIVE') {
        await api.updateExamSession(session.id, { 
          endTime: now.toISOString(),
          status: 'COMPLETED' 
        });
      } else {
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        const startIso = convertDateToStartOfDayIso(formatForDateInput(today));
        const endIso = convertDateToEndOfDayIso(formatForDateInput(nextWeek));
        await api.updateExamSession(session.id, { 
          startTime: startIso,
          endTime: endIso,
          status: 'ACTIVE' 
        });
      }
      loadAllData();
    } catch (err: any) {
      alert(`Lỗi cập nhật trạng thái đợt kiểm tra: ${err.message}`);
    }
  };

  // Handle Delete Session
  const handleRequestDeleteSession = (session: ExamSession) => {
    setSessionToDelete(session);
  };

  const confirmDeleteSession = async (session: ExamSession) => {
    const sessionId = session.id;
    const sessionTitle = session.title;
    setSessionToDelete(null);

    // Optimistic UI updates
    if (activeSimulatorSession?.id === sessionId) setActiveSimulatorSession(null);
    if (selectedSessionForReport?.id === sessionId) setSelectedSessionForReport(null);
    if (editingSession?.id === sessionId) {
      setEditingSession(null);
      setIsNewSessionModalOpen(false);
    }

    setSessions(prev => prev.filter(s => s.id !== sessionId && s.title !== sessionTitle));
    setSubmissions(prev => prev.filter(sub => sub.sessionId !== sessionId));

    try {
      await api.deleteExamSession(sessionId);
      await loadAllData();
    } catch (err: any) {
      console.error('Lỗi khi xóa đợt kiểm tra:', err);
      alert(`Lỗi khi xóa đợt kiểm tra: ${err?.message || 'Không thể kết nối'}`);
      loadAllData();
    }
  };

  // Helper to count attempts for currently logged-in user in a session
  const getUserAttemptsForSession = (session: ExamSession) => {
    if (!currentUser) return 0;
    const uId = currentUser.id;
    const uName = currentUser.name || currentUser.fullName;
    
    // Real submissions count
    const realSubsCount = submissions.filter(s => 
      s.sessionId === session.id && 
      (s.userId === uId || (s.userName && s.userName === uName))
    ).length;

    // Legacy/profile count if their last exam was for this session and there's no real submission
    let legacyCount = 0;
    if (realSubsCount === 0) {
      const uDoc = users.find(u => u.id === uId);
      if (uDoc) {
        let sessionTimestamp = 0;
        const match = session.id.match(/\d+/);
        if (match) {
          sessionTimestamp = parseInt(match[0]);
        }
        const isLastExamForThisSession = 
          (uDoc as any).lastExamTime && 
          sessionTimestamp > 0 && 
          ((uDoc as any).lastExamTime >= sessionTimestamp - 60000);

        if (isLastExamForThisSession) {
          legacyCount = Number((uDoc as any).totalExamsCount || 1);
        }
      }
    }

    return Math.max(realSubsCount, legacyCount);
  };

  const isAttemptsExhausted = (session: ExamSession) => {
    if (!session.maxAttempts || session.maxAttempts <= 0) return false;
    const attempts = getUserAttemptsForSession(session);
    return attempts >= session.maxAttempts;
  };

  // Start Mobile App Test Simulator
  const handleStartTestSimulator = async (session: ExamSession) => {
    // Luôn lấy ngẫu nhiên câu hỏi từ exam_banks thông qua bankId
    const bank = await api.getExamBank(session.bankId);
    const questionsForTest = bank?.questions || [];

    if (!questionsForTest || questionsForTest.length === 0) {
      alert('Bộ đề của đợt kiểm tra này hiện chưa có câu hỏi trong Ngân hàng đề! Vui lòng kiểm tra lại Ngân hàng đề thi.');
      return;
    }

    const targetCount = session.totalQuestions || 10;
    const finalQuestions = api.pickRandomQuestions(questionsForTest, targetCount);

    setActiveSimulatorSession(session);
    setSimulatorQuestions(finalQuestions);
    setUserAnswers({});
    setTimeLeftSeconds((session.durationMinutes || 20) * 60);
    setTestResultSummary(null);
  };

  // Timer countdown hook for active simulator
  useEffect(() => {
    if (!activeSimulatorSession || testResultSummary) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleExecuteSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeSimulatorSession, testResultSummary]);

  // Execute Submit Test in Simulator (Thử sức trên App - Không lưu CSDL chính thức, không tính vào báo cáo)
  const handleExecuteSubmitTest = async () => {
    if (!activeSimulatorSession || simulatorQuestions.length === 0) return;

    setIsSubmittingTest(true);

    let correctCount = 0;
    const answerRecords = simulatorQuestions.map((q, idx) => {
      const selected = userAnswers[idx];
      const isCorrect = selected === q.correctOptionIndex;
      if (isCorrect) correctCount++;
      return {
        questionId: q.id,
        questionText: q.question,
        selectedOption: selected !== undefined ? selected : -1,
        correctOption: q.correctOptionIndex,
        isCorrect
      };
    });

    const totalQ = simulatorQuestions.length;
    const rawScore = (correctCount / totalQ) * 10;
    const score = Math.round(rawScore * 10) / 10;
    const passed = score >= (activeSimulatorSession.passScore || 5.0);
    const timeSpent = (activeSimulatorSession.durationMinutes * 60) - timeLeftSeconds;

    const simulatedResult: ExamSubmission = {
      id: `sim-temp-${Date.now()}`,
      sessionId: activeSimulatorSession.id,
      sessionTitle: activeSimulatorSession.title,
      userId: currentUser?.id || `user-sim-${Date.now()}`,
      userName: currentUser?.name || currentUser?.fullName || 'Trần Văn Mạnh',
      userRank: currentUser?.rank || 'Đại úy',
      userPosition: currentUser?.position || 'Chính trị viên Tàu 012',
      unitName: currentUser?.unitName || currentUser?.unit || 'Lữ đoàn 162',
      score,
      correctCount,
      totalQuestions: totalQ,
      passed,
      timeSpentSeconds: timeSpent > 0 ? timeSpent : 1,
      answers: answerRecords,
      submittedAt: new Date().toISOString()
    };

    // Chế độ "Thử sức trên App" là trải nghiệm thử giao diện cho quản trị viên/cán bộ.
    // Hoàn toàn KHÔNG ghi nhận vào CSDL đợt thi chính thức và KHÔNG tính vào báo cáo kết quả tổng hợp.
    setTestResultSummary(simulatedResult);
    setIsSubmittingTest(false);
  };

  // Extract only the highest-score submission per soldier per exam session for reporting
  const bestSubmissions = useMemo(() => {
    const bestMap = new Map<string, ExamSubmission>();

    submissions.forEach((s) => {
      // Must be real exam submission from an exam session, not from lesson assessment questions
      if (
        s.id?.startsWith('sub-sync-') ||
        s.id?.startsWith('sub-sample-') ||
        s.id?.startsWith('sub-seed-') ||
        s.sessionId === 'session-default' ||
        (s as any).isSimulator
      ) {
        return;
      }

      // Key combination: unique soldier identifier + exam session identifier
      const uKey = (s.userId && s.userId.trim()) ? s.userId.trim() : (s.userName || '').trim().toLowerCase();
      const sessKey = (s.sessionId && s.sessionId.trim()) ? s.sessionId.trim() : (s.sessionTitle || '').trim().toLowerCase();
      const key = `${uKey}___${sessKey}`;

      if (!bestMap.has(key)) {
        bestMap.set(key, s);
      } else {
        const existing = bestMap.get(key)!;
        const currentScore = Number(s.score) || 0;
        const existingScore = Number(existing.score) || 0;

        if (currentScore > existingScore) {
          bestMap.set(key, s);
        } else if (currentScore === existingScore) {
          // If scores are equal, keep the most recent submission
          const currentTime = new Date(s.submittedAt || 0).getTime();
          const existingTime = new Date(existing.submittedAt || 0).getTime();
          if (currentTime > existingTime) {
            bestMap.set(key, s);
          }
        }
      }
    });

    return Array.from(bestMap.values());
  }, [submissions]);

  // All official exam sessions available across created sessions and submitted competition results
  const availableSessions = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    sessions.forEach(s => {
      map.set(s.id, { id: s.id, title: s.title });
    });
    submissions.forEach(s => {
      if (s.sessionId && !map.has(s.sessionId)) {
        map.set(s.sessionId, { id: s.sessionId, title: s.sessionTitle || s.sessionId });
      }
    });
    return Array.from(map.values());
  }, [sessions, submissions]);

  // Filtered best submissions for Report view (highest score per exam per soldier)
  const filteredReportSubmissions = useMemo(() => {
    return bestSubmissions.filter(s => {
      const matchSession = selectedSessionFilter === 'ALL' || !selectedSessionFilter || s.sessionId === selectedSessionFilter || s.sessionTitle === selectedSessionFilter;
      const matchUnit = selectedUnitFilter === 'ALL' || !selectedUnitFilter || s.unitName === selectedUnitFilter || (s.unitName && selectedUnitFilter && matchSearch(s.unitName, selectedUnitFilter));
      const matchSearchQuery = !searchCandidateQuery.trim() || 
        matchSearch(s.userName, searchCandidateQuery) ||
        matchSearch(s.unitName, searchCandidateQuery) ||
        matchSearch(s.userRank, searchCandidateQuery) ||
        matchSearch(s.sessionTitle, searchCandidateQuery);
      return matchSession && matchUnit && matchSearchQuery;
    });
  }, [bestSubmissions, selectedSessionFilter, selectedUnitFilter, searchCandidateQuery]);

  const filteredUsersForReport = useMemo(() => {
    return users.filter(u => {
      const uUnit = u.unitName || u.unit || '';
      const matchUnit = selectedUnitFilter === 'ALL' || uUnit === selectedUnitFilter;
      
      const displayName = u.fullName || u.name || '';
      const email = u.email || '';
      const matchSearchQuery = !searchCandidateQuery.trim() || 
        matchSearch(displayName, searchCandidateQuery) ||
        matchSearch(email, searchCandidateQuery) ||
        matchSearch(uUnit, searchCandidateQuery);

      return matchUnit && matchSearchQuery;
    });
  }, [users, selectedUnitFilter, searchCandidateQuery]);

  // Aggregate stats per Unit for detailed score report (Strictly from real exam submissions)
  const unitStatsList = useMemo(() => {
    const map: Record<string, {
      unitName: string;
      total: number;
      passed: number;
      failed: number;
      sumScore: number;
      maxScore: number;
      minScore: number;
      excellentCount: number; // 8.0 - 10.0
      goodCount: number;      // 6.5 - 7.9
      averageCount: number;   // 5.0 - 6.4
      poorCount: number;      // < 5.0
    }> = {};

    // Pre-populate units from unit list if available
    if (units && units.length > 0) {
      units.forEach(u => {
        if (u.name) {
          map[u.name] = {
            unitName: u.name,
            total: 0,
            passed: 0,
            failed: 0,
            sumScore: 0,
            maxScore: 0,
            minScore: 10,
            excellentCount: 0,
            goodCount: 0,
            averageCount: 0,
            poorCount: 0
          };
        }
      });
    }

    // Aggregate directly from real exam submissions matching selected session & unit filters
    const submissionsForUnitStats = bestSubmissions.filter(s => {
      const matchSession = selectedSessionFilter === 'ALL' || !selectedSessionFilter || s.sessionId === selectedSessionFilter || s.sessionTitle === selectedSessionFilter;
      const matchUnit = selectedUnitFilter === 'ALL' || !selectedUnitFilter || s.unitName === selectedUnitFilter || (s.unitName && selectedUnitFilter && matchSearch(s.unitName, selectedUnitFilter));
      return matchSession && matchUnit;
    });

    submissionsForUnitStats.forEach(s => {
      const uName = s.unitName || 'Chưa xếp đơn vị';
      if (!map[uName]) {
        map[uName] = {
          unitName: uName,
          total: 0,
          passed: 0,
          failed: 0,
          sumScore: 0,
          maxScore: 0,
          minScore: 10,
          excellentCount: 0,
          goodCount: 0,
          averageCount: 0,
          poorCount: 0
        };
      }
      
      const stat = map[uName];
      const score = Number(s.score) || 0;
      const isPassed = s.passed ?? (score >= 5.0);

      stat.total += 1;
      if (isPassed) {
        stat.passed += 1;
      } else {
        stat.failed += 1;
      }

      stat.sumScore += score;
      if (stat.total === 1) {
        stat.maxScore = score;
        stat.minScore = score;
      } else {
        if (score > stat.maxScore) stat.maxScore = score;
        if (score < stat.minScore) stat.minScore = score;
      }

      if (score >= 8.0) stat.excellentCount += 1;
      else if (score >= 6.5) stat.goodCount += 1;
      else if (score >= 5.0) stat.averageCount += 1;
      else stat.poorCount += 1;
    });

    return Object.values(map)
      .filter(u => u.total > 0 || (selectedUnitFilter !== 'ALL' && u.unitName === selectedUnitFilter))
      .map(u => {
        const avgScoreNum = u.total > 0 ? u.sumScore / u.total : 0;
        const avgScore = avgScoreNum.toFixed(1);
        const passRate = u.total > 0 ? Number(((u.passed / u.total) * 100).toFixed(2)) : 0;
        let rankLabel = 'CẦN ÔN LUYỆN';
        let rankColor = 'bg-rose-50 text-rose-700 border-rose-200';
        if (u.total === 0) {
          rankLabel = 'CHƯA CÓ BÀI THI';
          rankColor = 'bg-slate-50 text-slate-500 border-slate-200';
        } else if (passRate >= 90 && avgScoreNum >= 8.0) {
          rankLabel = 'ĐƠN VỊ XUẤT SẮC';
          rankColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        } else if (passRate >= 80 && avgScoreNum >= 6.5) {
          rankLabel = 'ĐƠN VỊ ĐẠT KHÁ';
          rankColor = 'bg-blue-50 text-blue-700 border-blue-200';
        } else if (passRate >= 50 && avgScoreNum >= 5.0) {
          rankLabel = 'ĐƠN VỊ ĐẠT';
          rankColor = 'bg-indigo-50 text-indigo-700 border-indigo-200';
        }

        return {
          ...u,
          avgScoreNum,
          avgScore,
          passRate,
          minScoreDisplay: u.total > 0 ? u.minScore : 0,
          rankLabel,
          rankColor
        };
      })
      .sort((a, b) => b.passRate - a.passRate || b.avgScoreNum - a.avgScoreNum);
  }, [bestSubmissions, units, selectedSessionFilter, selectedUnitFilter]);

  // Export Results Report to Excel with 2 detailed Worksheets (Unit Summary & Candidate Detail)
  const handleExportSubmissionsToExcel = (sessionTitle?: string) => {
    const filteredSubs = filteredReportSubmissions;

    if (filteredSubs.length === 0) {
      alert('Không có dữ liệu bài làm để xuất file Excel');
      return;
    }

    // 1. Sheet Tổng Hợp Đơn Vị
    const unitRows = unitStatsList.map((u, idx) => ({
      'STT': idx + 1,
      'Đơn vị': u.unitName,
      'Tổng quân nhân dự thi': u.total,
      'Số quân nhân ĐẠT': u.passed,
      'Số quân nhân CHƯA ĐẠT': u.failed,
      'Tỷ lệ ĐẠT (%)': `${Number(u.passRate).toFixed(2)}%`,
      'Điểm trung bình': u.avgScore,
      'Điểm cao nhất': u.maxScore,
      'Điểm thấp nhất': u.minScoreDisplay,
      'Giỏi/Xuất sắc (8-10đ)': `${u.excellentCount} (${u.total > 0 ? ((u.excellentCount / u.total) * 100).toFixed(2) : '0.00'}%)`,
      'Khá (6.5-7.9đ)': `${u.goodCount} (${u.total > 0 ? ((u.goodCount / u.total) * 100).toFixed(2) : '0.00'}%)`,
      'Trung bình (5-6.4đ)': `${u.averageCount} (${u.total > 0 ? ((u.averageCount / u.total) * 100).toFixed(2) : '0.00'}%)`,
      'Yếu (<5đ)': `${u.poorCount} (${u.total > 0 ? ((u.poorCount / u.total) * 100).toFixed(2) : '0.00'}%)`,
      'Xếp loại Thi đua Đơn vị': u.rankLabel
    }));

    // 2. Sheet Chi Tiết Bài Làm Quân Nhân
    const detailRows = filteredSubs.map((s, idx) => ({
      'STT': idx + 1,
      'Đợt kiểm tra': s.sessionTitle,
      'Họ và tên': s.userName,
      'Cấp bậc / Chức vụ': `${s.userRank || ''} ${s.userPosition ? `• ${s.userPosition}` : ''}`,
      'Đơn vị': s.unitName,
      'Số câu đúng': `${s.correctCount}/${s.totalQuestions}`,
      'Điểm số': s.score,
      'Kết quả': s.passed ? 'ĐẠT' : 'CHƯA ĐẠT',
      'Thời gian làm bài': `${Math.floor(s.timeSpentSeconds / 60)} phút ${s.timeSpentSeconds % 60} giây`,
      'Thời gian nộp bài': new Date(s.submittedAt).toLocaleString('vi-VN')
    }));

    const wb = XLSX.utils.book_new();

    const wsUnit = XLSX.utils.json_to_sheet(unitRows);
    wsUnit['!cols'] = [
      { wch: 6 }, { wch: 25 }, { wch: 20 }, { wch: 18 }, { wch: 20 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 22 },
      { wch: 18 }, { wch: 20 }, { wch: 15 }, { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, wsUnit, 'Tong_Hop_Theo_Don_Vi');

    const wsDetail = XLSX.utils.json_to_sheet(detailRows);
    wsDetail['!cols'] = [
      { wch: 6 }, { wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 20 },
      { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi_Tiet_Quan_Nhan');

    const filename = `BAO_CAO_KIEM_TRA_GDCT_${(sessionTitle || 'TOAN_VUNG').replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Calculate stats for filtered submissions
  const totalSubmissionsCount = useMemo(() => unitStatsList.reduce((acc, curr) => acc + curr.total, 0), [unitStatsList]);
  const passedCount = useMemo(() => unitStatsList.reduce((acc, curr) => acc + curr.passed, 0), [unitStatsList]);
  const passRatePercent = useMemo(() => totalSubmissionsCount > 0 ? Number(((passedCount / totalSubmissionsCount) * 100).toFixed(2)) : 0, [totalSubmissionsCount, passedCount]);
  const avgScore = useMemo(() => {
    const totalSum = unitStatsList.reduce((acc, curr) => acc + curr.sumScore, 0);
    return totalSubmissionsCount > 0 ? (totalSum / totalSubmissionsCount).toFixed(1) : '0.0';
  }, [unitStatsList, totalSubmissionsCount]);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Banner */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Tự động Nhập Bộ Đề Excel
            </span>
            <span className="text-xs text-slate-500 font-medium">Đồng bộ Bài thi lên App Di Động</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight mt-1">
            QUẢN LÝ ĐỢT KIỂM TRA & BỘ ĐỀ TRẮC NGHIỆM
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Khởi tạo đợt thi, tự động nhập câu hỏi từ Excel 7 cột, đồng bộ về thiết bị di động và tổng hợp bảng điểm kết quả.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsNewBankModalOpen(true)}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Upload className="w-4 h-4" />
            <span>+ Nhập Bộ Đề từ Excel</span>
          </button>

          <button
            onClick={handleOpenCreateSession}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Đợt Kiểm Tra Mới</span>
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex border-b border-slate-200 bg-white px-3 pt-2 rounded-2xl shadow-sm">
        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center space-x-2 px-5 py-3 border-b-2 font-bold text-xs transition-all ${
            activeTab === 'sessions'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Danh Sách Đợt Kiểm Tra ({sessions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('banks')}
          className={`flex items-center space-x-2 px-5 py-3 border-b-2 font-bold text-xs transition-all ${
            activeTab === 'banks'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Ngân Hàng Bộ Đề Excel ({banks.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={`flex items-center space-x-2 px-5 py-3 border-b-2 font-bold text-xs transition-all ${
            activeTab === 'reports'
              ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Tổng Hợp Báo Cáo Kết Quả ({bestSubmissions.length})</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: EXAM SESSIONS (ĐỢT KIỂM TRA) */}
      {/* ========================================================= */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 mx-auto mb-4">
                <Layers className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Chưa có đợt kiểm tra nào được khởi tạo</h3>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Vui lòng nhập bộ đề từ Excel trước hoặc bấm tạo đợt kiểm tra mới để giao bài thi cho quân nhân trên App di động.
              </p>
              <button
                onClick={handleOpenCreateSession}
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Khởi tạo đợt kiểm tra đầu tiên</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((session) => {
                const sessionSubs = submissions.filter(s => s.sessionId === session.id);
                const passSubsCount = sessionSubs.filter(s => s.passed).length;
                const rate = sessionSubs.length > 0 ? Number(((passSubsCount / sessionSubs.length) * 100).toFixed(2)) : 0;
                const linkedBank = banks.find(b => b.id === session.bankId);
                const displayTotalQuestions = session.totalQuestions || linkedBank?.totalQuestions || linkedBank?.questions?.length || 20;
                const sessionStatusInfo = getExamSessionStatus(session.startTime, session.endTime);

                return (
                  <div
                    key={session.id}
                    className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${sessionStatusInfo.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${sessionStatusInfo.dotClass}`} />
                            <span className="uppercase tracking-wider">
                              {sessionStatusInfo.label}
                            </span>
                          </span>

                          <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                            Đối tượng: {formatTargetGroupDisplay(session.targetGroup)}
                          </span>
                        </div>

                        <span className="text-[11px] text-slate-400 font-normal">
                          tạo bởi: <span className="text-slate-500 font-medium">{getCreatorUsername(session)}</span>
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors">
                        {session.title}
                      </h3>

                      {/* Thời gian diễn ra đợt thi */}
                      {(session.startTime || session.endTime) && (
                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/90 mt-2.5">
                          <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>
                            Thời gian:{' '}
                            <strong className="text-slate-900 font-bold">
                              {session.startTime ? `Từ ${formatDateDisplay(session.startTime)}` : 'Bắt đầu ngay'}
                            </strong>
                            {' '}đến{' '}
                            <strong className="text-slate-900 font-bold">
                              {session.endTime ? formatDateDisplay(session.endTime) : 'Không giới hạn'}
                            </strong>
                          </span>
                        </div>
                      )}

                      {/* Thời gian tạo đợt thi */}
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50/90 px-3 py-1.5 rounded-xl border border-emerald-200/80 mt-2">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          Thời gian tạo:{' '}
                          <strong className="text-emerald-900 font-bold">
                            {(() => {
                              const timeVal = session.createdAt || session.startTime || session.pushedToAppAt || session.updatedAt;
                              if (!timeVal) return 'Đang cập nhật';
                              const d = new Date(timeVal);
                              if (isNaN(d.getTime())) return timeVal;
                              return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ngày ${d.toLocaleDateString('vi-VN')}`;
                            })()}
                          </strong>
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5 mt-3 pt-3 border-t border-slate-100 text-center text-xs">
                        <div className="bg-slate-50 rounded-xl p-1.5 border border-slate-200/60">
                          <span className="block text-[9px] font-bold text-slate-500">Số câu hỏi</span>
                          <span className="font-bold text-slate-900 mt-0.5 block truncate" title={`${session.bankTitle || 'Bộ đề'}: ${displayTotalQuestions} câu`}>
                            {displayTotalQuestions} câu
                          </span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-1.5 border border-slate-200/60">
                          <span className="block text-[9px] font-bold text-slate-500">Thời gian</span>
                          <span className="font-bold text-blue-700 mt-0.5 block">
                            {session.durationMinutes} phút
                          </span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-1.5 border border-slate-200/60">
                          <span className="block text-[9px] font-bold text-slate-500">Số lượt thi</span>
                          <span className="font-bold text-amber-700 mt-0.5 block" title="Số lượt thi tối đa">
                            {session.maxAttempts && session.maxAttempts > 0 ? `${session.maxAttempts} lượt` : 'K.Giới hạn'}
                          </span>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-1.5 border border-slate-200/60">
                          <span className="block text-[9px] font-bold text-slate-500">Lượt nộp</span>
                          <span className="font-bold text-emerald-700 mt-0.5 block">
                            {sessionSubs.length} bài
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Controls Footer */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => handleStartTestSimulator(session)}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                          title="Trải nghiệm làm bài thi thử nghiệm trên App (Không tính vào báo cáo tổng hợp)"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Thử sức trên App</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedSessionFilter(session.id);
                            setSelectedSessionForReport(session);
                            setActiveTab('reports');
                          }}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-all"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>Bảng điểm ({Number(rate).toFixed(2)}% Đạt)</span>
                        </button>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleOpenEditSession(session)}
                          title="Chỉnh sửa đợt kiểm tra (đổi bộ đề, thời gian, số câu...)"
                          className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-bold border border-amber-200 transition-colors flex items-center space-x-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Sửa</span>
                        </button>

                        <button
                          onClick={() => handleToggleSessionStatus(session)}
                          title={sessionStatusInfo.status === 'ACTIVE' ? 'Kết thúc đợt kiểm tra ngay' : 'Mở lại đợt kiểm tra'}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors"
                        >
                          {sessionStatusInfo.status === 'ACTIVE' ? 'Khóa đợt' : 'Mở đợt'}
                        </button>

                        <button
                          onClick={() => handleRequestDeleteSession(session)}
                          title="Xóa đợt kiểm tra này"
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-colors flex items-center space-x-1"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Xóa đợt</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: EXAM BANKS (NGÂN HÀNG BỘ ĐỀ EXCEL) */}
      {/* ========================================================= */}
      {activeTab === 'banks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-emerald-900 text-white p-4 rounded-2xl shadow-sm">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet className="w-6 h-6 text-emerald-300" />
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide">Cấu trúc File Excel Nhập Bộ Đề 7 Cột</h3>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Cột 1: STT | Cột 2: Câu hỏi | Cột 3-6: Đáp án A, B, C, D (3 hoặc 4 phương án) | Cột 7: Đáp án đúng (Điền A, B, C hoặc D)
                </p>
              </div>
            </div>
            <button
              onClick={downloadSampleExamExcelTemplate}
              className="flex items-center space-x-2 bg-amber-500 hover:bg-amber-400 text-slate-950 px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-sm transition-all shrink-0"
            >
              <Download className="w-4 h-4" />
              <span>Tải Mẫu Excel chuẩn (.xlsx)</span>
            </button>
          </div>

          {banks.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center max-w-xl mx-auto shadow-sm">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mx-auto mb-4">
                <FileSpreadsheet className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Chưa có Bộ đề trắc nghiệm nào trong hệ thống</h3>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Nhấn chọn file Excel theo mẫu 7 cột để hệ thống tự động bóc tách và lưu vào Ngân hàng câu hỏi.
              </p>
              <button
                onClick={() => setIsNewBankModalOpen(true)}
                className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all"
              >
                <Upload className="w-4 h-4" />
                <span>+ Nhập file Excel ngay</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {banks.map((bank) => (
                <div
                  key={bank.id}
                  className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>Bộ đề Excel</span>
                        </span>
                        <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200 font-mono">
                          {bank.totalQuestions} câu hỏi
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-400 font-normal">
                        tạo bởi: <span className="text-slate-500 font-medium">{getCreatorUsername(bank)}</span>
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{bank.title}</h3>
                    {bank.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{bank.description}</p>
                    )}

                    <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between flex-wrap gap-2">
                      <span>Tạo bởi: <strong className="font-semibold text-slate-800">{bank.createdByName || bank.createdBy || 'Phòng Chính trị Vùng 4'}</strong></span>
                      <span className="font-mono text-slate-400">{new Date(bank.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => handleCreateSessionFromBank(bank)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                        title="Khởi tạo đợt kiểm tra mới dựa trên bộ đề này"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tạo Đợt Kiểm Tra</span>
                      </button>

                      <button
                        onClick={() => handleViewBankDetail(bank)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem câu hỏi ({bank.totalQuestions})</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleRequestDeleteBank(bank)}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 text-rose-600 border border-slate-200 transition-colors"
                      title="Xóa bộ đề"
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

      {/* ========================================================= */}
      {/* TAB 3: REPORTS & SUBMISSIONS (TỔNG HỢP KẾT QUẢ THI) */}
      {/* ========================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {/* Report Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-900 text-white p-4 rounded-2xl shadow-sm border border-slate-800">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-sm flex items-center gap-2 text-emerald-400">
                  <BarChart3 className="w-4 h-4" />
                  <span>Tổng Hợp Báo Cáo Kết Quả Thi Trực Tuyến</span>
                </h3>
                <span className="text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                  ✓ Lấy kết quả cao nhất từng bài thi của mỗi quân nhân
                </span>
              </div>
            </div>
          </div>

          {/* Summary KPI Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase">Tổng số quân nhân dự thi</span>
                <span className="text-xl font-black text-slate-900">{totalSubmissionsCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase">Số quân nhân ĐẠT</span>
                <span className="text-xl font-black text-emerald-700">{passedCount} / {totalSubmissionsCount}</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase">Tỷ lệ Đạt yêu cầu</span>
                <span className="text-xl font-black text-indigo-700">{Number(passRatePercent).toFixed(2)}%</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase">Điểm trung bình</span>
                <span className="text-xl font-black text-amber-700">{avgScore}</span>
              </div>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Lọc Đợt kiểm tra</label>
                <select
                  value={selectedSessionFilter}
                  onChange={(e) => setSelectedSessionFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">-- Tất cả các đợt thi --</option>
                  {availableSessions.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Lọc Đơn vị</label>
                <select
                  value={selectedUnitFilter}
                  onChange={(e) => setSelectedUnitFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-bold text-slate-800 focus:outline-none focus:border-blue-500"
                >
                  <option value="ALL">-- Tất cả đơn vị --</option>
                  {units.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </div>

              {reportViewMode === 'candidate' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-0.5">Tìm kiếm quân nhân</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Họ tên, đơn vị..."
                      value={searchCandidateQuery}
                      onChange={(e) => setSearchCandidateQuery(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500 w-48"
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                handleExportSubmissionsToExcel(selectedSessionForReport?.title);
              }}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl font-bold shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Xuất Báo cáo Excel (.xlsx)</span>
            </button>
          </div>

          {/* Report Sub-Tabs Navigation */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl w-full sm:w-fit text-xs font-bold border border-slate-200">
            <button
              onClick={() => setReportViewMode('unit')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${
                reportViewMode === 'unit'
                  ? 'bg-white text-blue-800 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Medal className="w-4 h-4 text-amber-500" />
              <span>Báo Cáo Thang Điểm & Thi Đua Đơn Vị ({unitStatsList.length})</span>
            </button>

            <button
              onClick={() => setReportViewMode('candidate')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${
                reportViewMode === 'candidate'
                  ? 'bg-white text-blue-800 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-blue-600" />
              <span>Bảng Điểm Chi Tiết Quân Nhân ({filteredReportSubmissions.length})</span>
            </button>
          </div>

          {/* VIEW MODE 1: UNIT PERFORMANCE & SCORE MATRIX */}
          {reportViewMode === 'unit' && (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <Medal className="w-4 h-4 text-amber-400" />
                  <span>Tổng Hợp Báo Cáo Thang Điểm & Xếp Loại Đơn Vị ({unitStatsList.length} đơn vị)</span>
                </h3>
              </div>

              {unitStatsList.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Chưa có lượt dự thi thực tế nào từ ứng dụng</p>
                    <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
                      Hệ thống đã chuyển sang chế độ tổng hợp 100% kết quả thật từ App. Khi quân nhân đăng nhập và nộp bài kiểm tra trên ứng dụng di động, kết quả thi đua đơn vị sẽ tự động cập nhật ngay lập tức tại đây.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                        <th className="p-3.5 w-12 text-center">STT</th>
                        <th className="p-3.5">Tên Đơn Vị</th>
                        <th className="p-3.5 text-center">Sĩ số dự thi</th>
                        <th className="p-3.5 text-center">Kết quả ĐẠT</th>
                        <th className="p-3.5 text-center">Tỷ lệ ĐẠT</th>
                        <th className="p-3.5 text-center">Điểm trung bình</th>
                        <th className="p-3.5 text-center">Biên độ điểm (Min - Max)</th>
                        <th className="p-3.5">Phân bổ Thang Điểm (Giỏi - Khá - TB - Yếu)</th>
                        <th className="p-3.5 text-center">Xếp Loại Thi Đua</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {unitStatsList.map((unitStat, idx) => (
                        <tr key={unitStat.unitName} className="hover:bg-blue-50/30 transition-colors">
                          <td className="p-3.5 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-3.5 font-bold text-slate-900 text-sm">
                            {unitStat.unitName}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-slate-700">
                            {unitStat.total} quân nhân
                          </td>
                          <td className="p-3.5 text-center font-mono">
                            <span className="text-emerald-700 font-bold">{unitStat.passed} Đạt</span>
                            {unitStat.failed > 0 && (
                              <span className="text-rose-600 font-medium ml-1">({unitStat.failed} hỏng)</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center space-x-1.5">
                              <span className="font-mono font-black text-blue-800">{Number(unitStat.passRate).toFixed(2)}%</span>
                              <div className="w-12 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                                <div
                                  className={`h-full ${unitStat.passRate >= 80 ? 'bg-emerald-500' : unitStat.passRate >= 50 ? 'bg-blue-500' : 'bg-rose-500'}`}
                                  style={{ width: `${unitStat.passRate}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-center font-mono font-black text-amber-800 text-sm">
                            {unitStat.avgScore}
                          </td>
                          <td className="p-3.5 text-center font-mono text-slate-600 text-[11px]">
                            Thấp nhất: <span className="font-bold text-rose-600">{unitStat.minScoreDisplay}</span> | Cao nhất: <span className="font-bold text-emerald-700">{unitStat.maxScore}</span>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono">
                              <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200" title="Giỏi/Xuất sắc: 8.0 - 10.0">
                                Giỏi: <b>{unitStat.excellentCount}</b>
                              </span>
                              <span className="bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200" title="Khá: 6.5 - 7.9">
                                Khá: <b>{unitStat.goodCount}</b>
                              </span>
                              <span className="bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200" title="Trung bình: 5.0 - 6.4">
                                TB: <b>{unitStat.averageCount}</b>
                              </span>
                              {unitStat.poorCount > 0 && (
                                <span className="bg-rose-50 text-rose-800 px-2 py-0.5 rounded border border-rose-200" title="Yếu: < 5.0">
                                  Yếu: <b>{unitStat.poorCount}</b>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${unitStat.rankColor}`}>
                              {unitStat.rankLabel}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: DETAILED CANDIDATE SUBMISSIONS TABLE */}
          {reportViewMode === 'candidate' && (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  <span>Bảng Tổng hợp Kết quả Bài làm Chi Tiết Quân Nhân ({filteredReportSubmissions.length})</span>
                </h3>
              </div>

              {filteredReportSubmissions.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Chưa có kết quả bài làm chi tiết nào</p>
                    <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
                      Dữ liệu tổng hợp hiện tại dựa trên các lượt làm bài của quân nhân.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                        <th className="p-3.5 w-12 text-center">STT</th>
                        <th className="p-3.5">Họ và tên quân nhân</th>
                        <th className="p-3.5">Cấp bậc / Chức vụ</th>
                        <th className="p-3.5">Đơn vị</th>
                        <th className="p-3.5">Đợt kiểm tra</th>
                        <th className="p-3.5 text-center">Số câu đúng</th>
                        <th className="p-3.5 text-center">Điểm số</th>
                        <th className="p-3.5 text-center">Kết quả</th>
                        <th className="p-3.5 text-right">Thời gian nộp</th>
                        <th className="p-3.5 text-center">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {filteredReportSubmissions.map((sub, idx) => (
                        <tr key={sub.id} className="hover:bg-blue-50/30 transition-colors">
                          <td className="p-3.5 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-3.5 font-bold text-slate-900">{sub.userName}</td>
                          <td className="p-3.5 text-slate-600">{sub.userRank || '—'} {sub.userPosition ? `• ${sub.userPosition}` : ''}</td>
                          <td className="p-3.5">
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-200">
                              {sub.unitName}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-700 max-w-xs truncate">{sub.sessionTitle}</td>
                          <td className="p-3.5 text-center font-mono font-bold text-blue-700">
                            {sub.correctCount} / {sub.totalQuestions}
                          </td>
                          <td className="p-3.5 text-center font-mono font-black text-sm">
                            <span className={sub.score >= 5.0 ? 'text-emerald-700' : 'text-rose-600'}>
                              {sub.score}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                sub.passed
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {sub.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                            </span>
                          </td>
                          <td className="p-3.5 text-right text-slate-500 text-[11px]">
                            {new Date(sub.submittedAt).toLocaleTimeString('vi-VN')} {new Date(sub.submittedAt).toLocaleDateString('vi-VN')}
                          </td>
                          <td className="p-3.5 text-center">
                            <button
                              onClick={() => handleOpenAccountDetailForSubmission(sub)}
                              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 border border-blue-200/80 transition-all font-bold text-xs inline-flex items-center space-x-1.5 shadow-2xs hover:shadow-xs cursor-pointer"
                              title="Xem chi tiết các lượt thi theo đợt kiểm tra này"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-600" />
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
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: EXCEL IMPORT QUESTION BANK */}
      {/* ========================================================= */}
      {isNewBankModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsNewBankModalOpen(false);
          }}
        >
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col cursor-default">
            <div className="p-4 bg-emerald-900 text-white border-b border-emerald-800 flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                <span>Tự Động Nhập Bộ Đề Kiểm Tra Từ File Excel</span>
              </h3>
              <button
                onClick={() => setIsNewBankModalOpen(false)}
                className="text-emerald-300 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBankFromExcel} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Creator info */}
              <div className="text-slate-500 text-xs flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <span className="text-slate-400">Tạo bởi:</span>
                <span className="text-slate-700 font-medium">{getActiveAdminFullName(currentUser)}</span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Tên Bộ Đề Thi *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Bộ đề trắc nghiệm Nhận thức Chính trị Quý 1/2026..."
                  value={newBankTitle}
                  onChange={(e) => setNewBankTitle(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Mô tả bộ đề (không bắt buộc)</label>
                <input
                  type="text"
                  placeholder="Ghi chú về nguồn câu hỏi hoặc đối tượng kiểm tra..."
                  value={newBankDescription}
                  onChange={(e) => setNewBankDescription(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                />
              </div>

              {/* Upload Box */}
              <div className="border-2 border-dashed border-emerald-300/80 bg-emerald-50/40 rounded-2xl p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div>
                  <label className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl cursor-pointer text-xs shadow-sm transition-all">
                    <Upload className="w-4 h-4" />
                    <span>{excelFile ? `File: ${excelFile.name}` : 'Chọn File Excel (.xlsx, .xls)'}</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleExcelFileChange}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-slate-500 mt-2">
                    Cấu trúc 7 cột chuẩn: STT | Câu hỏi | Đáp án A | Đáp án B | Đáp án C | Đáp án D | Đáp án đúng (A, B, C, D)
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={downloadSampleExamExcelTemplate}
                    className="inline-flex items-center space-x-1.5 text-emerald-800 font-bold text-xs hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải File Excel Mẫu Chuẩn (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Parsed Preview Table */}
              {parsedExcelResult && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Xem trước dữ liệu bóc tách được ({parsedExcelResult.questions.length} câu hỏi)</span>
                    </h4>
                  </div>

                  <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-2xl">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="sticky top-0 bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                        <tr>
                          <th className="p-2 w-10 text-center">STT</th>
                          <th className="p-2">Nội dung câu hỏi</th>
                          <th className="p-2">Các đáp án</th>
                          <th className="p-2 w-28 text-center">Đáp án đúng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {parsedExcelResult.questions.map((q, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2 text-center font-mono font-bold">{q.stt}</td>
                            <td className="p-2 font-medium text-slate-900">{q.question}</td>
                            <td className="p-2 text-slate-600">
                              {q.options.map((opt, oIdx) => (
                                <span
                                  key={oIdx}
                                  className={`mr-2 px-1.5 py-0.5 rounded text-[10px] ${
                                    oIdx === q.correctOptionIndex
                                      ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                                      : 'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {String.fromCharCode(65 + oIdx)}. {opt}
                                </span>
                              ))}
                            </td>
                            <td className="p-2 text-center">
                              <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded text-[10px]">
                                {String.fromCharCode(65 + q.correctOptionIndex)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewBankModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isImporting || !parsedExcelResult || parsedExcelResult.questions.length === 0}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md disabled:opacity-50"
                >
                  {isImporting ? 'Đang lưu bộ đề...' : `Lưu bộ đề (${parsedExcelResult?.questions.length || 0} câu)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CREATE / EDIT EXAM SESSION */}
      {/* ========================================================= */}
      {isNewSessionModalOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsNewSessionModalOpen(false);
              setEditingSession(null);
            }
          }}
        >
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 cursor-default">
            <div className="p-4 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>{editingSession ? 'Chỉnh Sửa Đợt Kiểm Tra' : 'Khởi Tạo Đợt Kiểm Tra Mới'}</span>
              </h3>
              <button
                onClick={() => {
                  setIsNewSessionModalOpen(false);
                  setEditingSession(null);
                }}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSessionSubmit} className="p-5 space-y-4 text-xs">
              {/* Creator info */}
              <div className="text-slate-500 text-xs flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
                <span className="text-slate-400">Tạo bởi:</span>
                <span className="text-slate-700 font-medium">{editingSession?.createdByName || editingSession?.createdBy || getActiveAdminFullName(currentUser)}</span>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Tên Đợt Kiểm Tra *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Đợt 1: Kiểm tra Nhận thức Chính trị Quý 1/2026..."
                  value={sessionFormData.title}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-2">
                  Chọn đối tượng tham gia <span className="text-red-500">*</span>
                </label>

                {(() => {
                  const currentSelected = parseTargetGroups(sessionFormData.targetGroup);
                  const isAllSelected = sessionFormData.targetGroup === 'ALL' || (currentSelected.length === 3);

                  const toggleGroup = (groupKey: string) => {
                    if (groupKey === 'ALL') {
                      setSessionFormData({ ...sessionFormData, targetGroup: 'ALL' });
                      return;
                    }
                    let nextSelected: string[];
                    if (isAllSelected) {
                      nextSelected = [groupKey];
                    } else if (currentSelected.includes(groupKey)) {
                      nextSelected = currentSelected.filter(g => g !== groupKey);
                    } else {
                      nextSelected = [...currentSelected, groupKey];
                    }
                    setSessionFormData({
                      ...sessionFormData,
                      targetGroup: buildTargetGroupString(nextSelected)
                    });
                  };

                  return (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2">
                      <button
                        type="button"
                        onClick={() => toggleGroup('ALL')}
                        className={`w-full text-left px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                          isAllSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] ${
                            isAllSelected ? 'bg-white text-blue-600 border-white font-extrabold' : 'border-slate-300 bg-slate-50'
                          }`}>
                            {isAllSelected ? '✓' : ''}
                          </span>
                          <span>Tất cả (SQ, QNCN & HSQ-BS)</span>
                        </div>
                        <span className="text-[10px] opacity-80 font-mono">3/3 đối tượng</span>
                      </button>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                        {[
                          { key: 'SQ', label: 'Sĩ quan (SQ)' },
                          { key: 'QNCN', label: 'QNCN' },
                          { key: 'HSQ-BS', label: 'HSQ-BS' }
                        ].map((item) => {
                          const isChecked = currentSelected.includes(item.key);
                          return (
                            <button
                              key={item.key}
                              type="button"
                              onClick={() => toggleGroup(item.key)}
                              className={`text-left px-3 py-2 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                                isChecked
                                  ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs font-bold'
                                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                              }`}
                            >
                              <span className={`w-4 h-4 rounded-md border flex items-center justify-center text-[10px] shrink-0 ${
                                isChecked ? 'bg-blue-600 text-white border-blue-600 font-bold' : 'border-slate-300 bg-slate-50'
                              }`}>
                                {isChecked ? '✓' : ''}
                              </span>
                              <span className="truncate">{item.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="text-[11px] text-slate-500 pt-1 px-1 flex items-center justify-between border-t border-slate-200/60 mt-1">
                        <span>Đã chọn: <strong className="text-blue-700 font-bold">{formatTargetGroupDisplay(sessionFormData.targetGroup)}</strong></span>
                        <span className="text-[10px] text-slate-400">Có thể chọn 1, nhiều hoặc tất cả</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Chọn Bộ Đề Thi (từ File Excel đã nhập) *</label>
                <select
                  required
                  value={sessionFormData.bankId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setSessionFormData({
                      ...sessionFormData,
                      bankId: selectedId
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-bold"
                >
                  <option value="">-- Chọn Bộ Đề Thi --</option>
                  {banks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title} ({b.totalQuestions} câu hỏi)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Số câu hỏi *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={sessionFormData.totalQuestions}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSessionFormData({
                        ...sessionFormData,
                        totalQuestions: val === '' ? ('' as any) : Number(val)
                      });
                    }}
                    placeholder="20"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-mono font-bold text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Phút thi</label>
                  <input
                    type="number"
                    min="1"
                    value={sessionFormData.durationMinutes}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, durationMinutes: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Điểm đạt</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="10"
                    value={sessionFormData.passScore}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, passScore: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-mono text-center"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1" title="Số lượt thi tối đa cho mỗi tài khoản">Số lượt thi</label>
                  <input
                    type="number"
                    min="0"
                    value={sessionFormData.maxAttempts}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, maxAttempts: Number(e.target.value) })}
                    placeholder="Ví dụ: 3"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-mono text-center font-bold text-blue-700"
                  />
                </div>
              </div>

              {/* Khung chọn Ngày bắt đầu & Ngày kết thúc (Chỉ chọn ngày, mặc định 00h00 đến 23h59) */}
              {(() => {
                const startDateStr = formatForDateInput(sessionFormData.startTime);
                const endDateStr = formatForDateInput(sessionFormData.endTime);
                const isDateOrderInvalid = Boolean(startDateStr && endDateStr && endDateStr < startDateStr);

                return (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-slate-700 font-bold mb-1">
                          Ngày bắt đầu <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={startDateStr}
                          onChange={(e) => {
                            const newDateStr = e.target.value;
                            const startVal = newDateStr ? convertDateToStartOfDayIso(newDateStr) : '';
                            setSessionFormData({ 
                              ...sessionFormData, 
                              startTime: startVal
                            });
                          }}
                          className={`w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900 focus:outline-none focus:bg-white font-semibold text-sm ${
                            isDateOrderInvalid ? 'border-red-400 focus:border-red-500' : 'border-slate-200 focus:border-blue-500'
                          }`}
                        />
                        <span className="text-[11px] text-slate-400 mt-1 block">Mặc định tính từ 00h00</span>
                      </div>

                      <div>
                        <label className="block text-slate-700 font-bold mb-1">
                          Ngày kết thúc <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={endDateStr}
                          onChange={(e) => {
                            const newEndDateStr = e.target.value;
                            const endVal = newEndDateStr ? convertDateToEndOfDayIso(newEndDateStr) : '';
                            setSessionFormData({ 
                              ...sessionFormData, 
                              endTime: endVal 
                            });
                          }}
                          className={`w-full bg-slate-50 border rounded-xl p-2.5 text-slate-900 focus:outline-none focus:bg-white font-semibold text-sm ${
                            isDateOrderInvalid ? 'border-red-400 focus:border-red-500 bg-red-50/20' : 'border-slate-200 focus:border-blue-500'
                          }`}
                        />
                        <span className="text-[11px] text-slate-400 mt-1 block">Mặc định kết thúc lúc 23h59</span>
                      </div>
                    </div>

                    {/* Cảnh báo nếu ngày kết thúc trước ngày bắt đầu */}
                    {isDateOrderInvalid && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                        <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                        <span>
                          Lỗi: Ngày kết thúc ({formatDateDisplay(endDateStr)}) không được trước ngày bắt đầu ({formatDateDisplay(startDateStr)}). Vui lòng điều chỉnh lại để lưu!
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Dòng trạng thái hiển thị riêng biệt bên dưới, không có chữ tự động */}
              {(() => {
                const startDateStr = formatForDateInput(sessionFormData.startTime);
                const endDateStr = formatForDateInput(sessionFormData.endTime);
                const isDateOrderInvalid = Boolean(startDateStr && endDateStr && endDateStr < startDateStr);
                const modalStatus = getExamSessionStatus(sessionFormData.startTime, sessionFormData.endTime);

                return (
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-xs font-bold text-slate-700">Trạng thái</span>
                    {isDateOrderInvalid ? (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border text-red-700 bg-red-50 border-red-200">
                        <span className="w-2 h-2 rounded-full bg-red-500" />
                        <span>Thời gian không hợp lệ</span>
                      </span>
                    ) : (
                      <span className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold border ${modalStatus.badgeClass}`}>
                        <span className={`w-2 h-2 rounded-full ${modalStatus.dotClass}`} />
                        <span>{modalStatus.label}</span>
                      </span>
                    )}
                  </div>
                );
              })()}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                {editingSession ? (
                  <button
                    type="button"
                    onClick={() => {
                      const sessionToDel = editingSession;
                      setIsNewSessionModalOpen(false);
                      setEditingSession(null);
                      if (sessionToDel) handleRequestDeleteSession(sessionToDel);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 text-xs flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa Đợt Kiểm Tra Này</span>
                  </button>
                ) : <div />}

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsNewSessionModalOpen(false);
                      setEditingSession(null);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold"
                  >
                    Hủy
                  </button>
                  {(() => {
                    const s = formatForDateInput(sessionFormData.startTime);
                    const e = formatForDateInput(sessionFormData.endTime);
                    const isInvalid = Boolean(s && e && e < s);
                    return (
                      <button
                        type="submit"
                        disabled={isInvalid}
                        className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none text-white font-bold shadow-md transition-colors"
                      >
                        {editingSession ? 'Lưu Thay Đổi' : 'Tạo Đợt Thi'}
                      </button>
                    );
                  })()}
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: VIEW BANK QUESTIONS DETAIL */}
      {/* ========================================================= */}
      {selectedBankForDetail && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedBankForDetail(null);
          }}
        >
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[85vh] flex flex-col cursor-default">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Chi tiết Bộ đề: {selectedBankForDetail.title}</span>
              </h3>
              <button
                onClick={() => setSelectedBankForDetail(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 text-xs flex-1">
              {(!selectedBankForDetail.questions || selectedBankForDetail.questions.length === 0) ? (
                <p className="text-slate-500">Chưa có thông tin câu hỏi chi tiết.</p>
              ) : (
                selectedBankForDetail.questions.map((q, idx) => (
                  <div key={q.id || idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-slate-900 flex-1">
                        <span className="text-blue-700 font-mono mr-1.5">Câu #{q.stt || idx + 1}:</span>
                        <span>{q.question}</span>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          onClick={() => handleOpenEditQuestion(q)}
                          className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center space-x-1"
                          title="Chỉnh sửa nội dung câu hỏi và đồng bộ tức thì lên App"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Sửa câu hỏi</span>
                        </button>
                        <button
                          onClick={() => handleDeleteQuestionFromBank(q.id)}
                          className="p-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                          title="Xóa câu hỏi khỏi bộ đề"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-4">
                      {q.options.map((opt, oIdx) => (
                        <div
                          key={oIdx}
                          className={`p-1.5 rounded-lg border text-[11px] ${
                            oIdx === q.correctOptionIndex
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-900 font-bold'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <span className="font-mono mr-1">{String.fromCharCode(65 + oIdx)}.</span> {opt}
                        </div>
                      ))}
                    </div>

                    {q.explanation && (
                      <div className="pl-4 text-[11px] text-slate-500 italic">
                        <span className="font-bold">Giải thích:</span> {q.explanation}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button
                onClick={() => {
                  const bankObj = selectedBankForDetail;
                  setSelectedBankForDetail(null);
                  handleRequestDeleteBank(bankObj);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold border border-rose-200 text-xs flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa Bộ Đề Thi Này</span>
              </button>

              <button
                onClick={() => setSelectedBankForDetail(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: CHỈNH SỬA CÂU HỎI TRONG BỘ ĐỀ */}
      {/* ========================================================= */}
      {editingQuestion && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingQuestion(null);
          }}
        >
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col cursor-default">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-400" />
                <span>Chỉnh Sửa Câu Hỏi #{editingQuestion.stt}</span>
              </h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditedQuestionSubmit} className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Nội dung câu hỏi *</label>
                <textarea
                  rows={3}
                  value={editingQuestionForm.question}
                  onChange={(e) => setEditingQuestionForm({ ...editingQuestionForm, question: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-medium"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-slate-700 font-bold">Các phương án trả lời *</label>
                {editingQuestionForm.options.map((opt, idx) => (
                  <div key={idx} className="flex items-center space-x-2">
                    <span className="font-mono font-bold w-6 text-slate-500">{String.fromCharCode(65 + idx)}.</span>
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => {
                        const newOpts = [...editingQuestionForm.options];
                        newOpts[idx] = e.target.value;
                        setEditingQuestionForm({ ...editingQuestionForm, options: newOpts });
                      }}
                      className="flex-1 px-3 py-1.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <label className="flex items-center space-x-1 cursor-pointer shrink-0">
                      <input
                        type="radio"
                        name="correctAnswerOption"
                        checked={editingQuestionForm.correctOptionIndex === idx}
                        onChange={() => setEditingQuestionForm({ ...editingQuestionForm, correctOptionIndex: idx })}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      <span className={`text-[11px] font-bold ${editingQuestionForm.correctOptionIndex === idx ? 'text-emerald-700' : 'text-slate-500'}`}>
                        Đúng
                      </span>
                    </label>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Giải thích đáp án (không bắt buộc)</label>
                <input
                  type="text"
                  value={editingQuestionForm.explanation}
                  onChange={(e) => setEditingQuestionForm({ ...editingQuestionForm, explanation: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập giải thích cho đáp án..."
                />
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200/80 rounded-2xl text-[11px] text-amber-900 font-medium flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Nội dung sau khi sửa sẽ được lưu lên Cloud Firestore và tự động cập nhật ngay lập tức cho các thiết bị di động.</span>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuestion}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 disabled:opacity-50 flex items-center space-x-1.5"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isSavingQuestion ? 'Đang lưu & đẩy lên App...' : 'Lưu & Đẩy Lập Tức Lên App'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: MOBILE APP TEST SIMULATOR */}
      {/* ========================================================= */}
      {activeSimulatorSession && (
        <div 
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setActiveSimulatorSession(null);
              setSimulatorQuestions([]);
              setTestResultSummary(null);
            }
          }}
        >
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-white cursor-default">
            {/* Header */}
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  CHẾ ĐỘ THỬ SỨC TRÊN APP (DÀNH CHO CÁN BỘ / QUẢN TRỊ)
                </span>
                <h3 className="text-sm font-bold text-white mt-1">{activeSimulatorSession.title}</h3>
              </div>

              {!testResultSummary && (
                <div className="flex items-center space-x-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-3 py-1.5 rounded-xl font-mono text-sm font-bold">
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>
                    {Math.floor(timeLeftSeconds / 60).toString().padStart(2, '0')}:
                    {(timeLeftSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>
              )}
            </div>

            {/* Test Content OR Summary */}
            {testResultSummary ? (
              <div className="p-8 text-center space-y-6 overflow-y-auto flex-1">
                <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center border-2 ${
                  testResultSummary.passed ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-rose-950 border-rose-500 text-rose-400'
                }`}>
                  {testResultSummary.passed ? <CheckCircle2 className="w-10 h-10" /> : <XCircle className="w-10 h-10" />}
                </div>

                <div>
                  <h2 className="text-2xl font-black">{testResultSummary.passed ? 'XIN CHÚC MỪNG! BẠN ĐÃ ĐẠT' : 'KẾT QUẢ: CHƯA ĐẠT'}</h2>
                  <p className="text-xs text-amber-400 font-medium mt-1">
                    * Kết quả làm bài trong chế độ Thử sức trên App không lưu vào CSDL và không tính vào Báo cáo kết quả tổng hợp của đơn vị.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-center bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-xs">
                  <div>
                    <span className="block text-slate-400">Số câu đúng</span>
                    <span className="text-lg font-bold text-emerald-400">{testResultSummary.correctCount} / {testResultSummary.totalQuestions}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Điểm số</span>
                    <span className="text-lg font-bold text-amber-400">{testResultSummary.score}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Thời gian làm thử</span>
                    <span className="text-lg font-bold text-blue-400">{Math.floor(testResultSummary.timeSpentSeconds / 60)} phút</span>
                  </div>
                </div>

                <button
                  onClick={() => setActiveSimulatorSession(null)}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs shadow-lg transition-all"
                >
                  Hoàn thành & Thoát
                </button>
              </div>
            ) : (
              <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
                {simulatorQuestions.map((q, idx) => (
                  <div key={q.id || idx} className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-3">
                    <div className="font-bold text-sm text-slate-100 flex items-start gap-2">
                      <span className="text-amber-400 font-mono shrink-0">Câu {idx + 1}:</span>
                      <span>{q.question}</span>
                    </div>

                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => (
                        <label
                          key={oIdx}
                          className={`flex items-center space-x-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            userAnswers[idx] === oIdx
                              ? 'bg-blue-600/30 border-blue-500 text-white font-bold'
                              : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700/50'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`q-${idx}`}
                            checked={userAnswers[idx] === oIdx}
                            onChange={() => setUserAnswers({ ...userAnswers, [idx]: oIdx })}
                            className="w-4 h-4 text-blue-500"
                          />
                          <span><strong className="font-mono">{String.fromCharCode(65 + oIdx)}.</strong> {opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Footer Submit Button */}
            {!testResultSummary && !isAttemptsExhausted(activeSimulatorSession) && (
              <div className="p-4 bg-slate-800 border-t border-slate-700 flex items-center justify-between shrink-0">
                <span className="text-slate-400 text-xs">
                  Đã trả lời: <strong className="text-amber-400 font-mono">{Object.keys(userAnswers).length} / {simulatorQuestions.length}</strong> câu
                </span>

                <button
                  onClick={handleExecuteSubmitTest}
                  disabled={isSubmittingTest}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-lg transition-all"
                >
                  {isSubmittingTest ? 'Đang chấm điểm...' : 'Nộp bài thi ngay'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: SUBMISSION CANDIDATE DETAIL */}
      {/* ========================================================= */}
      {selectedSubmissionForDetail && (
        <div 
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[70] flex items-center justify-center p-3 sm:p-4 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSubmissionForDetail(null);
          }}
        >
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col cursor-default">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-400 shadow-inner shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wider text-white">
                    Kết Quả Bài Làm Chi Tiết Của Quân Nhân
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-300 mt-0.5">
                    <span>Quân nhân: <strong className="text-white font-bold">{selectedSubmissionForDetail.userName}</strong></span>
                    <span>•</span>
                    <span>{selectedSubmissionForDetail.userRank || 'Quân nhân'} {selectedSubmissionForDetail.userPosition ? `• ${selectedSubmissionForDetail.userPosition}` : ''}</span>
                    <span>•</span>
                    <span className="text-blue-300 font-semibold">{selectedSubmissionForDetail.unitName}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {selectedAccountForExamDetail && (
                  <button
                    onClick={() => setSelectedSubmissionForDetail(null)}
                    className="px-3 py-1.5 rounded-xl bg-blue-600/80 hover:bg-blue-600 text-white border border-blue-400/40 flex items-center space-x-1.5 text-xs font-bold transition-colors cursor-pointer shadow-xs"
                    title="Quay lại bảng danh sách các đợt thi của quân nhân"
                  >
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    <span className="hidden sm:inline">Trở lại danh sách đợt thi</span>
                  </button>
                )}
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 flex items-center space-x-1.5 text-xs font-bold transition-colors cursor-pointer"
                  title="In phiếu kết quả"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">In kết quả</span>
                </button>
                <button
                  onClick={() => setSelectedSubmissionForDetail(null)}
                  className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors font-bold text-xs cursor-pointer"
                  title="Đóng"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Scorecard KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-4 bg-slate-50/80 border-b border-slate-200 shrink-0">
              {/* Box 1: Điểm số & Xếp loại */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Điểm số bài thi
                </span>
                <div className="flex items-baseline space-x-2">
                  <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${
                    selectedSubmissionForDetail.score >= 5.0 ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {selectedSubmissionForDetail.score}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                    selectedSubmissionForDetail.passed
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {selectedSubmissionForDetail.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  Thang điểm 10 chuẩn
                </span>
              </div>

              {/* Box 2: Số câu đúng */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Số câu đúng
                </span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-xl sm:text-2xl font-black font-mono text-blue-700">
                    {selectedSubmissionForDetail.correctCount}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    / {selectedSubmissionForDetail.totalQuestions} câu
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.round((selectedSubmissionForDetail.correctCount / (selectedSubmissionForDetail.totalQuestions || 20)) * 100))}%`
                    }}
                  />
                </div>
                <span className="text-[10px] text-blue-600 font-bold block mt-1">
                  {Math.round((selectedSubmissionForDetail.correctCount / (selectedSubmissionForDetail.totalQuestions || 20)) * 100)}% chính xác
                </span>
              </div>

              {/* Box 3: Số câu chưa đúng */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Số câu chưa đúng
                </span>
                <div className="flex items-baseline space-x-1">
                  <span className="text-xl sm:text-2xl font-black font-mono text-amber-700">
                    {Math.max(0, (selectedSubmissionForDetail.totalQuestions || 20) - selectedSubmissionForDetail.correctCount)}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    / {selectedSubmissionForDetail.totalQuestions} câu
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, 100 - Math.round((selectedSubmissionForDetail.correctCount / (selectedSubmissionForDetail.totalQuestions || 20)) * 100))}%`
                    }}
                  />
                </div>
                <span className="text-[10px] text-amber-600 font-medium block mt-1">
                  {100 - Math.round((selectedSubmissionForDetail.correctCount / (selectedSubmissionForDetail.totalQuestions || 20)) * 100)}% sai / chưa chọn
                </span>
              </div>

              {/* Box 4: Thời gian làm bài */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                  Thời gian làm bài
                </span>
                <span className="text-lg sm:text-xl font-black font-mono text-slate-800 block">
                  {formatDuration(selectedSubmissionForDetail.timeSpentSeconds)}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1.5">
                  Tốc độ: ~{((selectedSubmissionForDetail.timeSpentSeconds || 0) / (selectedSubmissionForDetail.totalQuestions || 20)).toFixed(1)}s / câu
                </span>
              </div>
            </div>

            {/* Exam Meta Strip */}
            <div className="bg-white px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
              <div className="flex items-center space-x-2 text-slate-700">
                <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="text-slate-500">Đợt kiểm tra:</span>
                <strong className="text-slate-900 font-bold">{selectedSubmissionForDetail.sessionTitle}</strong>
              </div>
              <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                <span>
                  Thời điểm nộp: <strong className="text-slate-700 font-mono">{new Date(selectedSubmissionForDetail.submittedAt).toLocaleTimeString('vi-VN')} {new Date(selectedSubmissionForDetail.submittedAt).toLocaleDateString('vi-VN')}</strong>
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold">
                  <Smartphone className="w-3 h-3" />
                  <span>Android App Vùng 4</span>
                </span>
              </div>
            </div>

            {/* Scrollable Questions & Answers Body */}
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs flex-1 bg-slate-50/40">
              {/* CASE 1: Has recorded per-question answers */}
              {selectedSubmissionForDetail.answers && selectedSubmissionForDetail.answers.length > 0 && (
                <div className="space-y-3">
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-2xl flex items-start space-x-2.5 text-blue-900">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Chi tiết đáp án từng câu bài làm của thí sinh:</span>
                      <span className="text-[11px] text-blue-700">
                        Hệ thống đối chiếu giữa lựa chọn của quân nhân và đáp án chuẩn chính xác của bộ đề thi.
                      </span>
                    </div>
                  </div>

                  {selectedSubmissionForDetail.answers.map((ans, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border space-y-2.5 transition-colors bg-white ${
                        ans.isCorrect ? 'border-emerald-200 shadow-2xs' : 'border-rose-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-slate-900 flex items-start gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-blue-800 font-mono font-bold text-xs shrink-0 border border-slate-200">
                            Câu #{idx + 1}
                          </span>
                          <span className="text-sm font-semibold text-slate-900 leading-relaxed">
                            {ans.questionText}
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-black shrink-0 border ${
                            ans.isCorrect
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          {ans.isCorrect ? '✓ ĐÚNG' : '✕ CHƯA ĐÚNG'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                        <div className={`p-2.5 rounded-xl border flex items-center space-x-2 ${
                          ans.isCorrect ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950 font-bold' : 'bg-rose-50/60 border-rose-200 text-rose-950 font-semibold'
                        }`}>
                          <span className="text-slate-500 font-normal text-[11px]">Thí sinh chọn:</span>
                          <span className="px-2 py-0.5 rounded bg-white font-mono font-black border text-xs">
                            Đáp án {String.fromCharCode(65 + ans.selectedOption)}
                          </span>
                        </div>

                        {!ans.isCorrect && (
                          <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-200 text-emerald-950 flex items-center space-x-2 font-bold">
                            <span className="text-slate-500 font-normal text-[11px]">Đáp án đúng:</span>
                            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-mono font-black text-xs">
                              Đáp án {String.fromCharCode(65 + ans.correctOption)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* CASE 2: No recorded answers in sub, but detail questions resolved from Session/Bank */}
              {(!selectedSubmissionForDetail.answers || selectedSubmissionForDetail.answers.length === 0) && detailQuestions.length > 0 && (
                <div className="space-y-3">
                  <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl flex items-start space-x-3 text-slate-800 shadow-2xs">
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs font-bold text-xs mt-0.5">
                      <Check className="w-4 h-4" />
                    </div>
                    <div className="text-xs space-y-1">
                      <div className="font-bold text-blue-950 text-sm flex items-center gap-2">
                        <span>Đề thi chính thức: {detailQuestionsSource || selectedSubmissionForDetail.sessionTitle}</span>
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200">
                          {detailQuestions.length} câu hỏi
                        </span>
                      </div>
                      <p className="text-slate-600 leading-relaxed text-[11px]">
                        Bài làm được nộp trực tiếp từ <strong>Ứng dụng di động (Android App)</strong>. Kết quả tổng hợp đạt: <strong className="text-blue-700 font-bold">{selectedSubmissionForDetail.correctCount}/{selectedSubmissionForDetail.totalQuestions} câu đúng</strong> ({selectedSubmissionForDetail.score} điểm • {selectedSubmissionForDetail.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}). Dưới đây là danh sách đầy đủ toàn bộ câu hỏi và <strong>đáp án chuẩn chính thức</strong> của đợt thi để chỉ huy và cán bộ phụ trách đối chiếu bài thi.
                      </p>
                    </div>
                  </div>

                  {detailQuestions.map((q, qIdx) => (
                    <div
                      key={q.id || qIdx}
                      className="p-4 rounded-2xl border border-slate-200/90 bg-white shadow-2xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 font-mono font-black text-xs shrink-0 border border-slate-200 shadow-2xs">
                            Câu #{q.stt || (qIdx + 1)}
                          </span>
                          <span className="text-sm font-bold text-slate-900 leading-snug">
                            {q.question}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold shrink-0 border border-slate-200">
                          Trắc nghiệm
                        </span>
                      </div>

                      {/* Options Grid */}
                      {Array.isArray(q.options) && q.options.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {q.options.map((opt, optIdx) => {
                            const isCorrect = (q.correctOptionIndex === optIdx) || (q.correctAnswerText && q.correctAnswerText.trim().toLowerCase() === opt.trim().toLowerCase());
                            return (
                              <div
                                key={optIdx}
                                className={`p-3 rounded-xl border transition-all flex items-start space-x-2.5 ${
                                  isCorrect
                                    ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 font-semibold ring-1 ring-emerald-400/40 shadow-2xs'
                                    : 'bg-slate-50/60 border-slate-200 text-slate-700'
                                }`}
                              >
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5 ${
                                  isCorrect
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {String.fromCharCode(65 + optIdx)}
                                </span>
                                <div className="flex-1 text-xs leading-relaxed">
                                  <span>{opt}</span>
                                  {isCorrect && (
                                    <span className="block mt-1 text-[10px] font-bold text-emerald-700">
                                      ✓ Đáp án chuẩn chính thức
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Explanation note if available */}
                      {q.explanation && (
                        <div className="p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-amber-900 text-[11px] flex items-start space-x-2">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <div>
                            <strong className="font-bold">Giải thích: </strong>
                            <span>{q.explanation}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* CASE 3: Loading questions */}
              {isLoadingDetailQuestions && (
                <div className="p-12 text-center text-slate-500 space-y-3">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto text-blue-600" />
                  <p className="text-xs font-semibold">Đang tải bộ câu hỏi và đáp án chi tiết từ hệ thống...</p>
                </div>
              )}

              {/* CASE 4: Fallback if no detailed questions could be loaded */}
              {!isLoadingDetailQuestions && (!selectedSubmissionForDetail.answers || selectedSubmissionForDetail.answers.length === 0) && detailQuestions.length === 0 && (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Kết quả tổng hợp đã ghi nhận an toàn</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                      Quân nhân <strong>{selectedSubmissionForDetail.userName}</strong> đã hoàn thành đợt thi với kết quả <strong>{selectedSubmissionForDetail.correctCount}/{selectedSubmissionForDetail.totalQuestions} câu đúng</strong> ({selectedSubmissionForDetail.score} điểm • {selectedSubmissionForDetail.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}). Bộ câu hỏi đang được đồng bộ tiếp từ ngân hàng đề thi.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs shrink-0">
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Hệ thống Quản lý Giáo dục Chính trị & Thi Trực tuyến — Vùng 4 Hải quân
              </span>
              <div className="flex items-center space-x-2 ml-auto">
                {selectedAccountForExamDetail && (
                  <button
                    onClick={() => setSelectedSubmissionForDetail(null)}
                    className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs border border-blue-300 shadow-2xs transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                    <span>Trở lại danh sách đợt thi</span>
                  </button>
                )}
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs border border-slate-300 shadow-2xs transition-colors cursor-pointer flex items-center space-x-1.5"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-600" />
                  <span>In phiếu kết quả</span>
                </button>
                <button
                  onClick={() => setSelectedSubmissionForDetail(null)}
                  className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-2xs transition-colors cursor-pointer"
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ACCOUNT EXAM SUBMISSIONS DETAIL */}
      {/* ========================================================= */}
      {selectedAccountForExamDetail && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedAccountForExamDetail(null);
          }}
        >
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] cursor-default">
            {/* Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/30 border border-blue-400/30 flex items-center justify-center text-blue-400 font-bold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">
                    {selectedAccountForExamDetail.sessionFilterTitle
                      ? 'Chi Tiết Các Lượt Thi Đợt Kiểm Tra'
                      : 'Chi Tiết Các Đợt Thi Đã Tham Gia'}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-slate-300 mt-0.5">
                    <span className="font-bold text-white text-xs">
                      {selectedAccountForExamDetail.user.fullName || selectedAccountForExamDetail.user.name}
                    </span>
                    <span>•</span>
                    <span>{selectedAccountForExamDetail.rank} {selectedAccountForExamDetail.position ? `• ${selectedAccountForExamDetail.position}` : ''}</span>
                    <span>•</span>
                    <span className="text-blue-300 font-semibold">{selectedAccountForExamDetail.unitName}</span>
                    {selectedAccountForExamDetail.sessionFilterTitle && (
                      <>
                        <span>•</span>
                        <span className="text-amber-300 font-bold">
                          {selectedAccountForExamDetail.sessionFilterTitle}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedAccountForExamDetail(null)}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors font-bold text-xs cursor-pointer"
                title="Đóng"
              >
                ✕
              </button>
            </div>

            {/* Quick summary strip */}
            <div className="bg-slate-50 px-5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-4">
                <span className="text-slate-500 font-medium">
                  Tổng số lượt thi: <strong className="text-blue-700 font-bold font-mono">{selectedAccountForExamDetail.submissions.length} lượt</strong>
                </span>
                <span className="text-slate-500 font-medium">
                  Điểm cao nhất: <strong className="text-emerald-700 font-bold font-mono">{selectedAccountForExamDetail.highestScore}</strong>
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Email tài khoản: <span className="font-mono text-slate-600 font-semibold">{selectedAccountForExamDetail.user.email}</span>
              </span>
            </div>

            {/* Submissions List */}
            <div className="p-5 overflow-y-auto flex-1 text-xs">
              {selectedAccountForExamDetail.submissions.length === 0 ? (
                <div className="p-8 text-center text-slate-400 italic">
                  Chưa có lịch sử làm bài thi nào của quân nhân này.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase text-[10px] tracking-wider">
                        <th className="p-3 w-10 text-center">STT</th>
                        <th className="p-3">Đợt kiểm tra</th>
                        <th className="p-3 text-center">Số câu đúng</th>
                        <th className="p-3 text-center">Điểm số</th>
                        <th className="p-3 text-center">Kết quả</th>
                        <th className="p-3 text-right">Thời gian nộp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                      {selectedAccountForExamDetail.submissions.map((s, idx) => (
                        <tr key={s.id || idx} className="hover:bg-blue-50/30 transition-colors">
                          <td className="p-3 text-center font-mono text-slate-500">{idx + 1}</td>
                          <td className="p-3">
                            <span className="font-bold text-slate-900 block">{s.sessionTitle || 'Đợt kiểm tra'}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{s.sessionId}</span>
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-blue-700">
                            {s.correctCount} / {s.totalQuestions}
                          </td>
                          <td className="p-3 text-center font-mono font-black text-sm">
                            <span className={s.score >= 5.0 ? 'text-emerald-700' : 'text-rose-600'}>
                              {s.score}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              s.passed 
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}>
                              {s.passed ? 'ĐẠT' : 'CHƯA ĐẠT'}
                            </span>
                          </td>
                          <td className="p-3 text-right text-slate-500 text-[11px]">
                            {new Date(s.submittedAt).toLocaleTimeString('vi-VN')} {new Date(s.submittedAt).toLocaleDateString('vi-VN')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right shrink-0">
              <button
                onClick={() => setSelectedAccountForExamDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Đợt Kiểm Tra */}
      {sessionToDelete && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSessionToDelete(null);
          }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 cursor-default">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Xác Nhận Xóa Đợt Kiểm Tra</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Đồng chí có chắc chắn muốn xóa hẳn đợt kiểm tra <strong className="text-slate-800">"{sessionToDelete.title}"</strong>? 
                Hành động này sẽ xóa vĩnh viễn đợt thi này cùng tất cả kết quả bài làm liên quan khỏi hệ thống Cloud.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center space-x-3">
              <button
                type="button"
                onClick={() => setSessionToDelete(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteSession(sessionToDelete)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa Vĩnh Viễn</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Bộ Đề Thi */}
      {bankToDelete && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150 cursor-pointer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBankToDelete(null);
          }}
        >
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4 cursor-default">
            <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">Xác Nhận Xóa Bộ Đề Thi</h3>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                Đồng chí có chắc chắn muốn xóa hẳn bộ đề <strong className="text-slate-800">"{bankToDelete.title}"</strong>? 
                Hành động này sẽ xóa vĩnh viễn bộ đề này cùng toàn bộ câu hỏi trắc nghiệm liên quan khỏi hệ thống và Firebase Cloud.
              </p>
            </div>
            <div className="pt-2 flex items-center justify-center space-x-3">
              <button
                type="button"
                onClick={() => setBankToDelete(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
              >
                Hủy Bỏ
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteBank(bankToDelete)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors flex items-center space-x-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa Vĩnh Viễn</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
