import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, Plus, Upload, Play, CheckCircle2, XCircle, Clock, 
  Award, ShieldCheck, Download, Trash2, Eye, RefreshCw, Search, Filter,
  Users, Layers, ArrowRight, AlertCircle, FileText, Check, X, Smartphone, BarChart3,
  Edit3, TrendingUp, Medal, ChevronRight
} from 'lucide-react';
import { ExamBank, ExamQuestion, ExamSession, ExamSubmission, Unit, User, UserProgress } from '../types';
import { api } from '../services/api';
import { parseExamQuestionsFromExcel, downloadSampleExamExcelTemplate, ParsedExamExcelResult } from '../utils/excelExamParser';
import { matchSearch } from '../utils/vietnamese';
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
  const [reportViewMode, setReportViewMode] = useState<'unit' | 'candidate' | 'account'>('unit');
  const [selectedBankForDetail, setSelectedBankForDetail] = useState<ExamBank | null>(null);
  const [selectedSessionForReport, setSelectedSessionForReport] = useState<ExamSession | null>(null);
  const [selectedSubmissionForDetail, setSelectedSubmissionForDetail] = useState<ExamSubmission | null>(null);

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
      alert('Đã cập nhật chỉnh sửa câu hỏi và tự động đồng bộ tức thì lên Cloud App cho tất cả tài khoản di động!');
    } catch (err: any) {
      alert(`Lỗi cập nhật câu hỏi: ${err.message}`);
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
      alert('Đã xóa câu hỏi và cập nhật dữ liệu bộ đề lên Cloud App di động!');
    } catch (err: any) {
      alert(`Lỗi xóa câu hỏi: ${err.message}`);
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

  // Helper to open session modal pre-selected from a Question Bank
  const handleCreateSessionFromBank = (bank: ExamBank) => {
    setEditingSession(null);
    setSessionFormData({
      title: `Đợt kiểm tra: ${bank.title}`,
      description: `Kiểm tra đánh giá chất lượng từ bộ đề ${bank.title} (${bank.totalQuestions} câu hỏi)`,
      bankId: bank.id,
      durationMinutes: 20,
      passScore: 5.0,
      totalQuestions: bank.totalQuestions || 20,
      targetUnit: 'ALL',
      status: 'ACTIVE'
    });
    setIsNewSessionModalOpen(true);
  };

  // New Exam Session Form State
  const [sessionFormData, setSessionFormData] = useState({
    title: '',
    description: '',
    bankId: '',
    durationMinutes: 20,
    passScore: 5.0,
    totalQuestions: 20,
    maxAttempts: 1,
    targetUnit: 'ALL',
    status: 'ACTIVE' as 'ACTIVE' | 'COMPLETED' | 'DRAFT'
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
      const created = await api.createExamBank(
        {
          title: newBankTitle.trim(),
          description: newBankDescription.trim(),
          createdBy: currentUser?.name || 'Phòng Chính trị Vùng 4'
        },
        parsedExcelResult.questions
      );

      alert(`Đã lưu thành công Bộ đề "${created.title}" với ${parsedExcelResult.questions.length} câu hỏi!`);
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
    setEditingSession(null);
    setSessionFormData({
      title: '',
      description: '',
      bankId: '',
      durationMinutes: 20,
      passScore: 5.0,
      totalQuestions: 20,
      maxAttempts: 1,
      targetUnit: 'ALL',
      status: 'ACTIVE'
    });
    setIsNewSessionModalOpen(true);
  };

  // Open Session Modal for Editing
  const handleOpenEditSession = (session: ExamSession) => {
    setEditingSession(session);
    setSessionFormData({
      title: session.title || '',
      description: session.description || '',
      bankId: session.bankId || '',
      durationMinutes: session.durationMinutes || 20,
      passScore: session.passScore || 5.0,
      totalQuestions: session.totalQuestions || 20,
      maxAttempts: session.maxAttempts !== undefined ? session.maxAttempts : 1,
      targetUnit: session.targetUnit || 'ALL',
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
      let bankQuestions: ExamQuestion[] = [];
      const fullBank = await api.getExamBank(sessionFormData.bankId);
      if (fullBank?.questions && fullBank.questions.length > 0) {
        bankQuestions = fullBank.questions;
      } else if (selectedBank?.questions && selectedBank.questions.length > 0) {
        bankQuestions = selectedBank.questions;
      }

      const requestedCount = Number(sessionFormData.totalQuestions) || 20;
      const pool = bankQuestions.length > 0 ? bankQuestions : (editingSession?.questions || []);
      const selectedQuestions = api.pickRandomQuestions(pool, requestedCount);

      if (editingSession) {
        const updated = await api.updateExamSession(editingSession.id, {
          title: sessionFormData.title.trim(),
          description: sessionFormData.description.trim(),
          bankId: sessionFormData.bankId,
          bankTitle: selectedBank?.title || editingSession.bankTitle || 'Bộ đề kiểm tra',
          durationMinutes: Number(sessionFormData.durationMinutes) || 20,
          passScore: Number(sessionFormData.passScore) || 5.0,
          totalQuestions: selectedQuestions.length,
          maxAttempts: Number(sessionFormData.maxAttempts) !== undefined ? Number(sessionFormData.maxAttempts) : 1,
          questions: selectedQuestions,
          targetUnit: sessionFormData.targetUnit,
          status: sessionFormData.status,
        });

        setSessions(prev => prev.map(s => s.id === editingSession.id ? updated : s));
        alert(`Đã lưu thay đổi đợt kiểm tra "${updated.title}"! Đã chọn ngẫu nhiên ${selectedQuestions.length} câu hỏi từ bộ đề (tổng ${pool.length} câu) và đẩy lên Cloud App di động.`);
      } else {
        const created = await api.createExamSession({
          title: sessionFormData.title.trim(),
          description: sessionFormData.description.trim(),
          bankId: sessionFormData.bankId,
          bankTitle: selectedBank?.title || 'Bộ đề kiểm tra',
          durationMinutes: Number(sessionFormData.durationMinutes) || 20,
          passScore: Number(sessionFormData.passScore) || 5.0,
          totalQuestions: selectedQuestions.length,
          maxAttempts: Number(sessionFormData.maxAttempts) !== undefined ? Number(sessionFormData.maxAttempts) : 1,
          questions: selectedQuestions,
          targetUnit: sessionFormData.targetUnit,
          status: sessionFormData.status,
          createdBy: currentUser?.name || 'Phòng Chính trị Vùng 4'
        });

        setSessions(prev => [created, ...prev.filter(s => s.id !== created.id)]);
        alert(`Đã khởi tạo đợt kiểm tra mới "${created.title}"! Đã chọn ngẫu nhiên ${selectedQuestions.length} câu hỏi từ bộ đề (tổng ${pool.length} câu) và đẩy lên Cloud App di động.`);
      }

      setIsNewSessionModalOpen(false);
      setEditingSession(null);
      setSessionFormData({
        title: '',
        description: '',
        bankId: '',
        durationMinutes: 20,
        passScore: 5.0,
        totalQuestions: 20,
        maxAttempts: 1,
        targetUnit: 'ALL',
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
    const newStatus = session.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
    try {
      await api.updateExamSession(session.id, { status: newStatus });
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
    let questionsForTest: ExamQuestion[] = session.questions || [];
    if (!questionsForTest || questionsForTest.length === 0) {
      const bank = await api.getExamBank(session.bankId);
      questionsForTest = bank?.questions || [];
    }

    if (!questionsForTest || questionsForTest.length === 0) {
      alert('Bộ đề của đợt kiểm tra này hiện chưa có câu hỏi! Vui lòng bấm nút "Đẩy Bộ Đề Lên App" để đồng bộ câu hỏi từ ngân hàng đề.');
      return;
    }

    const targetCount = session.totalQuestions || questionsForTest.length;
    const finalQuestions = questionsForTest.slice(0, targetCount);

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

  // Execute Submit Test in Simulator
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

    const submissionPayload: Partial<ExamSubmission> = {
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
      answers: answerRecords
    };

    try {
      const result = await api.submitExamResult(submissionPayload);
      setTestResultSummary(result);
      loadAllData();
    } catch (err: any) {
      alert(`Lỗi nộp bài thi: ${err.message}`);
    } finally {
      setIsSubmittingTest(false);
    }
  };

  // Filtered submissions for Report view
  const filteredReportSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const matchSession = selectedSessionFilter === 'ALL' || !selectedSessionFilter || s.sessionId === selectedSessionFilter || s.sessionTitle === selectedSessionFilter;
      const matchUnit = selectedUnitFilter === 'ALL' || !selectedUnitFilter || s.unitName === selectedUnitFilter || (s.unitName && selectedUnitFilter && matchSearch(s.unitName, selectedUnitFilter));
      const matchSearchQuery = !searchCandidateQuery.trim() || 
        matchSearch(s.userName, searchCandidateQuery) ||
        matchSearch(s.unitName, searchCandidateQuery) ||
        matchSearch(s.userRank, searchCandidateQuery) ||
        matchSearch(s.sessionTitle, searchCandidateQuery);
      return matchSession && matchUnit && matchSearchQuery;
    });
  }, [submissions, selectedSessionFilter, selectedUnitFilter, searchCandidateQuery]);

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

  const accountReportData = useMemo(() => {
    // Extract session timestamp of selectedSessionFilter if any
    let sessionTimestamp = 0;
    let selectedSessionTitle = '';
    if (selectedSessionFilter && selectedSessionFilter !== 'ALL') {
      const match = selectedSessionFilter.match(/\d+/);
      if (match) {
        sessionTimestamp = parseInt(match[0]);
      }
      const sess = sessions.find(s => s.id === selectedSessionFilter || s.title === selectedSessionFilter);
      if (sess) {
        selectedSessionTitle = sess.title;
      }
    }

    return filteredUsersForReport.map(u => {
      const userProgress = progressList.filter(p => p.userId === u.id);
      const totalLessons = userProgress.length;
      const completedLessons = userProgress.filter(p => p.completed).length;
      const avgProgress = totalLessons > 0 
        ? Math.round(userProgress.reduce((sum, p) => sum + (p.overallProgress || 0), 0) / totalLessons)
        : 0;

      // Real submissions matching selected filters
      const userSubs = submissions.filter(s => {
        const isUserMatch = s.userId === u.id || (s.userName && s.userName === (u.fullName || u.name));
        const matchSession = selectedSessionFilter === 'ALL' || !selectedSessionFilter || s.sessionId === selectedSessionFilter || s.sessionTitle === selectedSessionFilter;
        return isUserMatch && matchSession;
      });

      // Historical/Legacy values
      const totalExamsCount = Number((u as any).totalExamsCount || 0);
      const passedExamsCount = Number((u as any).passedExamsCount || 0);

      // Check if user's last exam was taken for this specific session
      const isLastExamForThisSession = 
        selectedSessionFilter !== 'ALL' && 
        selectedSessionFilter && 
        (u as any).lastExamTime && 
        sessionTimestamp > 0 && 
        ((u as any).lastExamTime >= sessionTimestamp - 60000);

      // We include legacy/profile stats for this user if we are showing ALL sessions, OR if their last exam corresponds to the selected session
      const includeLegacy = selectedSessionFilter === 'ALL' || !selectedSessionFilter || isLastExamForThisSession;
      
      const examCount = includeLegacy ? Math.max(userSubs.length, totalExamsCount) : userSubs.length;
      const passedCount = includeLegacy ? Math.max(userSubs.filter(s => s.passed).length, passedExamsCount) : userSubs.filter(s => s.passed).length;

      // Highest score calculation
      let highestScore = userSubs.length > 0 ? Math.max(...userSubs.map(s => s.score)) : 0;
      if (includeLegacy) {
        if ((u as any).lastExamScore !== undefined) {
          const lastExamTotal = (u as any).lastExamTotal || 10;
          const lastExamScore = Number((u as any).lastExamScore || 0);
          const scoreVal = lastExamTotal > 0 ? (lastExamScore / lastExamTotal) * 10 : lastExamScore;
          highestScore = Math.max(highestScore, scoreVal);
        }
        if ((u as any).lastScore !== undefined) {
          const percentage = (u as any).lastScorePercentage || 0;
          const scoreVal = percentage > 0 ? (percentage / 10) : Number((u as any).lastScore || 0);
          highestScore = Math.max(highestScore, scoreVal);
        }
      }

      // Generate text describing the exam history
      let examSummaryText = userSubs.map(s => {
        return `${s.sessionTitle || 'Đợt kiểm tra'}: ${s.score}đ (${s.passed ? 'Đạt' : 'Chưa đạt'})`;
      }).join('; ');

      if (examSummaryText === '' && includeLegacy && ((u as any).lastExamScore !== undefined || (u as any).lastScore !== undefined)) {
        let lastScoreStr = '';
        if ((u as any).lastExamScore !== undefined) {
          const lastExamTotal = (u as any).lastExamTotal || 10;
          lastScoreStr = `${(u as any).lastExamScore}/${lastExamTotal}`;
        } else if ((u as any).lastScore !== undefined) {
          lastScoreStr = `${(u as any).lastScore}/10`;
        }
        
        const passed = (u as any).lastExamPassed !== false;
        const sTitle = selectedSessionTitle || (u as any).lastLessonTitle || 'Đợt kiểm tra';
        examSummaryText = `${sTitle}: ${lastScoreStr}đ (${passed ? 'Đạt' : 'Chưa đạt'})`;
      }

      return {
        user: u,
        totalLessons,
        completedLessons,
        avgProgress,
        examCount,
        highestScore,
        passedCount,
        examSummaryText,
        unitName: u.unitName || u.unit || 'Chưa xếp đơn vị',
        rank: u.rank || u.userRank || '—',
        position: u.position || u.userPosition || '—'
      };
    });
  }, [filteredUsersForReport, progressList, submissions, selectedSessionFilter, sessions]);

  // Aggregate stats per Unit for detailed score report
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

    accountReportData.forEach(d => {
      const uName = d.unitName || 'Chưa xếp đơn vị';
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

      // If this user/soldier took an exam
      if (d.examCount > 0) {
        stat.total += 1; // 1 quân nhân dự thi
        if (d.passedCount > 0 || d.highestScore >= 5.0) {
          stat.passed += 1; // 1 quân nhân ĐẠT
        } else {
          stat.failed += 1; // 1 quân nhân CHƯA ĐẠT
        }

        // Aggregate scores based on soldier's performance
        const effectiveScore = d.highestScore;
        stat.sumScore += effectiveScore;
        if (effectiveScore > stat.maxScore) stat.maxScore = effectiveScore;
        if (effectiveScore < stat.minScore) stat.minScore = effectiveScore;

        if (effectiveScore >= 8.0) stat.excellentCount += 1;
        else if (effectiveScore >= 6.5) stat.goodCount += 1;
        else if (effectiveScore >= 5.0) stat.averageCount += 1;
        else stat.poorCount += 1;
      }
    });

    return Object.values(map)
      .filter(u => u.total > 0 || (selectedUnitFilter !== 'ALL' && u.unitName === selectedUnitFilter))
      .map(u => {
        const avgScoreNum = u.total > 0 ? u.sumScore / u.total : 0;
        const avgScore = avgScoreNum.toFixed(1);
        const passRate = u.total > 0 ? Math.round((u.passed / u.total) * 100) : 0;
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
          minScoreDisplay: u.total > 0 && u.minScore !== 10 ? u.minScore : 0,
          rankLabel,
          rankColor
        };
      })
      .sort((a, b) => b.passRate - a.passRate || b.avgScoreNum - a.avgScoreNum);
  }, [accountReportData, units, selectedUnitFilter, submissions, selectedSessionFilter]);

  const handleExportAccountReportToExcel = () => {
    if (accountReportData.length === 0) {
      alert('Không có dữ liệu tài khoản để xuất file Excel');
      return;
    }

    const rows = accountReportData.map((d, idx) => ({
      'STT': idx + 1,
      'Họ và tên': d.user.fullName || d.user.name || '',
      'Cấp bậc / Chức vụ': `${d.rank} • ${d.position}`,
      'Đơn vị': d.unitName,
      'Email': d.user.email || '',
      'Số bài đang học': d.totalLessons,
      'Số bài hoàn thành': d.completedLessons,
      'Tiến độ học tập TB (%)': `${d.avgProgress}%`,
      'Số lượt thi': d.examCount,
      'Điểm số cao nhất': d.highestScore,
      'Số lần ĐẠT': d.passedCount,
      'Chi tiết các đợt thi': d.examSummaryText
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 6 }, { wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 25 },
      { wch: 15 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 18 },
      { wch: 12 }, { wch: 45 }
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Bao_Cao_Tung_Tai_Khoan');
    XLSX.writeFile(wb, `BAO_CAO_TIEN_DO_HOC_VA_KIEM_TRA_TUNG_TAI_KHOAN.xlsx`);
  };

  // Export Results Report to Excel with 2 detailed Worksheets (Unit Summary & Candidate Detail)
  const handleExportSubmissionsToExcel = (sessionTitle?: string) => {
    const filteredSubs = submissions.filter(s => {
      const matchSession = selectedSessionFilter === 'ALL' || s.sessionId === selectedSessionFilter;
      const matchUnit = selectedUnitFilter === 'ALL' || s.unitName === selectedUnitFilter;
      return matchSession && matchUnit;
    });

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
      'Tỷ lệ ĐẠT (%)': `${u.passRate}%`,
      'Điểm trung bình': u.avgScore,
      'Điểm cao nhất': u.maxScore,
      'Điểm thấp nhất': u.minScoreDisplay,
      'Giỏi/Xuất sắc (8-10đ)': `${u.excellentCount} (${u.total > 0 ? Math.round((u.excellentCount/u.total)*100) : 0}%)`,
      'Khá (6.5-7.9đ)': `${u.goodCount} (${u.total > 0 ? Math.round((u.goodCount/u.total)*100) : 0}%)`,
      'Trung bình (5-6.4đ)': `${u.averageCount} (${u.total > 0 ? Math.round((u.averageCount/u.total)*100) : 0}%)`,
      'Yếu (<5đ)': `${u.poorCount} (${u.total > 0 ? Math.round((u.poorCount/u.total)*100) : 0}%)`,
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
      'Điểm số (/10)': s.score,
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
  const passRatePercent = useMemo(() => totalSubmissionsCount > 0 ? Math.round((passedCount / totalSubmissionsCount) * 100) : 0, [totalSubmissionsCount, passedCount]);
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
          <span>Tổng Hợp Báo Cáo Kết Quả ({submissions.length})</span>
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
                const rate = sessionSubs.length > 0 ? Math.round((passSubsCount / sessionSubs.length) * 100) : 0;
                const linkedBank = banks.find(b => b.id === session.bankId);
                const displayTotalQuestions = session.totalQuestions || linkedBank?.totalQuestions || linkedBank?.questions?.length || 20;

                return (
                  <div
                    key={session.id}
                    className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            session.status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 animate-pulse'
                              : session.status === 'COMPLETED'
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${session.status === 'ACTIVE' ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                          <span>
                            {session.status === 'ACTIVE'
                              ? 'ĐANG DIỄN RA (TRÊN APP)'
                              : session.status === 'COMPLETED'
                              ? 'ĐÃ KẾT THÚC'
                              : 'BẢN NHÁP'}
                          </span>
                        </span>

                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Đơn vị: {session.targetUnit === 'ALL' ? 'Toàn Vùng' : session.targetUnit}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 hover:text-blue-600 transition-colors">
                        {session.title}
                      </h3>
                      {session.description && (
                        <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                          {session.description}
                        </p>
                      )}

                      {/* App Push Status Indicator */}
                      {session.questions && session.questions.length > 0 ? (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/80 mt-2.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>Đã đồng bộ {session.questions.length} câu hỏi lên App ({new Date(session.pushedToAppAt || session.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200/80 mt-2.5">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Tự động đồng bộ câu hỏi từ Bộ đề lên App khi tạo/chỉnh sửa đợt</span>
                        </div>
                      )}

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
                        {isAttemptsExhausted(session) ? (
                          <button
                            onClick={() => handleStartTestSimulator(session)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-300 text-slate-500 text-xs font-bold shadow-sm transition-all"
                            title="Đồng chí đã hoàn thành số lượt thi cho đợt kiểm tra này"
                          >
                            <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                            <span>Đã thi xong (Hết lượt)</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartTestSimulator(session)}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                          >
                            <Smartphone className="w-3.5 h-3.5" />
                            <span>Thử sức trên App</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedSessionFilter(session.id);
                            setSelectedSessionForReport(session);
                            setActiveTab('reports');
                          }}
                          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-all"
                        >
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>Bảng điểm ({rate}% Đạt)</span>
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
                          title={session.status === 'ACTIVE' ? 'Kết thúc đợt kiểm tra' : 'Mở lại đợt kiểm tra'}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 transition-colors"
                        >
                          {session.status === 'ACTIVE' ? 'Khóa đợt' : 'Mở đợt'}
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
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Bộ đề Excel</span>
                      </span>
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200 font-mono">
                        {bank.totalQuestions} câu hỏi
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">{bank.title}</h3>
                    {bank.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{bank.description}</p>
                    )}

                    <div className="mt-3 text-[11px] text-slate-400">
                      Tạo bởi: <span className="font-semibold text-slate-700">{bank.createdBy}</span> • {new Date(bank.createdAt).toLocaleDateString('vi-VN')}
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
              <h3 className="font-extrabold text-sm flex items-center gap-2 text-emerald-400">
                <BarChart3 className="w-4 h-4" />
                <span>Tổng Hợp Báo Cáo Kết Quả Thi Trực Tuyến</span>
              </h3>
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
                <span className="text-xl font-black text-indigo-700">{passRatePercent}%</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <span className="block text-[11px] font-bold text-slate-500 uppercase">Điểm trung bình</span>
                <span className="text-xl font-black text-amber-700">{avgScore} / 10</span>
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
                  {sessions.map(s => (
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
            </div>

            <button
              onClick={() => {
                if (reportViewMode === 'account') {
                  handleExportAccountReportToExcel();
                } else {
                  handleExportSubmissionsToExcel(selectedSessionForReport?.title);
                }
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

            <button
              onClick={() => setReportViewMode('account')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl transition-all ${
                reportViewMode === 'account'
                  ? 'bg-white text-blue-800 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Báo Cáo Học Tập & Kiểm Tra Từng Tài Khoản ({users.length})</span>
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
                        <th className="p-3.5 text-center">Điểm TB (/10)</th>
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
                              <span className="font-mono font-black text-blue-800">{unitStat.passRate}%</span>
                              <div className="w-12 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                                <div
                                  className={`h-full ${unitStat.passRate >= 80 ? 'bg-emerald-500' : unitStat.passRate >= 50 ? 'bg-blue-500' : 'bg-rose-500'}`}
                                  style={{ width: `${unitStat.passRate}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-center font-mono font-black text-amber-800 text-sm">
                            {unitStat.avgScore} / 10
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
                        <th className="p-3.5 text-center">Điểm số (/10)</th>
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
                              onClick={() => setSelectedSubmissionForDetail(sub)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                              title="Xem chi tiết câu trả lời"
                            >
                              <Eye className="w-3.5 h-3.5" />
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

          {/* VIEW MODE 3: COMPREHENSIVE STUDY & EXAM REPORT PER ACCOUNT */}
          {reportViewMode === 'account' && (
            <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Báo Cáo Tổng Hợp Tốc Độ Học Tập & Kết Quả Kiểm Tra Theo Từng Tài Khoản ({accountReportData.length} tài khoản)</span>
                </h3>
              </div>

              {accountReportData.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-xs space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-700 text-sm">Không tìm thấy tài khoản người dùng nào</p>
                    <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
                      Hãy thay đổi bộ lọc đơn vị hoặc kiểm tra lại từ khóa tìm kiếm.
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
                        <th className="p-3.5 text-center">Bài đã học</th>
                        <th className="p-3.5">Tiến độ Học TB</th>
                        <th className="p-3.5 text-center">Số lượt thi</th>
                        <th className="p-3.5 text-center">Điểm cao nhất</th>
                        <th className="p-3.5">Chi tiết đợt thi đã tham gia</th>
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
                          <td className="p-3.5 text-slate-600">
                            {d.rank} {d.position ? `• ${d.position}` : ''}
                          </td>
                          <td className="p-3.5">
                            <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-slate-200">
                              {d.unitName}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-slate-700 text-sm">
                            {d.completedLessons} / {d.totalLessons} bài
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center space-x-2">
                              <div className="w-16 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200">
                                <div
                                  className={`h-full ${d.avgProgress >= 80 ? 'bg-emerald-500' : d.avgProgress >= 50 ? 'bg-blue-500' : 'bg-slate-400'}`}
                                  style={{ width: `${d.avgProgress}%` }}
                                />
                              </div>
                              <span className="font-mono font-black text-slate-700 text-[11px]">{d.avgProgress}%</span>
                            </div>
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-blue-700 text-sm">
                            {d.examCount} lượt
                          </td>
                          <td className="p-3.5 text-center font-mono font-black text-sm">
                            {d.examCount > 0 ? (
                              <span className={d.highestScore >= 5.0 ? 'text-emerald-700' : 'text-rose-600'}>
                                {d.highestScore} / 10
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium">Chưa thi</span>
                            )}
                          </td>
                          <td className="p-3.5 max-w-xs">
                            {d.examCount > 0 ? (
                              <div className="flex flex-col gap-1">
                                {submissions.filter(s => s.userId === d.user.id).map(s => (
                                  <div key={s.id} className="text-[10px] leading-tight flex items-center gap-1">
                                    <span className="text-slate-500 font-bold truncate max-w-[120px]" title={s.sessionTitle}>{s.sessionTitle}:</span>
                                    <span className={`px-1 rounded-sm font-mono font-bold ${s.passed ? 'bg-emerald-50 text-emerald-800 border border-emerald-100' : 'bg-rose-50 text-rose-800 border border-rose-100'}`}>
                                      {s.score}đ ({s.passed ? 'Đạt' : 'Chưa đạt'})
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">Chưa ghi nhận bài thi nào</span>
                            )}
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95">
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
                <label className="block text-slate-700 font-bold mb-1">Mô tả nội dung đợt thi (không bắt buộc)</label>
                <textarea
                  rows={2}
                  placeholder="Nhập ghi chú hướng dẫn hoặc nội dung trọng tâm đợt kiểm tra..."
                  value={sessionFormData.description}
                  onChange={(e) => setSessionFormData({ ...sessionFormData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Chọn Bộ Đề Thi (từ File Excel đã nhập) *</label>
                <select
                  required
                  value={sessionFormData.bankId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const b = banks.find(item => item.id === selectedId);
                    setSessionFormData({
                      ...sessionFormData,
                      bankId: selectedId,
                      totalQuestions: b ? b.totalQuestions : sessionFormData.totalQuestions
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
                    onChange={(e) => setSessionFormData({ ...sessionFormData, totalQuestions: Number(e.target.value) })}
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
                    placeholder="0: Không hạn chế"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-mono text-center"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Đơn vị tham gia</label>
                  <select
                    value={sessionFormData.targetUnit}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, targetUnit: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white"
                  >
                    <option value="ALL">Toàn Vùng 4</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Trạng thái khởi tạo</label>
                  <select
                    value={sessionFormData.status}
                    onChange={(e) => setSessionFormData({ ...sessionFormData, status: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white font-bold"
                  >
                    <option value="ACTIVE">Đang diễn ra (Hiển thị lên App)</option>
                    <option value="DRAFT">Bản nháp</option>
                    <option value="COMPLETED">Đã kết thúc</option>
                  </select>
                </div>
              </div>

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
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md"
                  >
                    {editingSession ? 'Lưu Thay Đổi' : 'Tạo Đợt Thi'}
                  </button>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[85vh] flex flex-col">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col">
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-white">
            {/* Header */}
            <div className="p-4 bg-slate-800 border-b border-slate-700 flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">
                  MOBILE APP TEST SIMULATOR
                </span>
                <h3 className="text-sm font-bold text-white mt-1">{activeSimulatorSession.title}</h3>
              </div>

              {!testResultSummary && !isAttemptsExhausted(activeSimulatorSession) && (
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
            {isAttemptsExhausted(activeSimulatorSession) ? (
              <div className="p-12 text-center space-y-6 overflow-y-auto flex-1 flex flex-col items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-slate-800 border-2 border-amber-500 text-amber-400 flex items-center justify-center shadow-lg animate-bounce">
                  <Smartphone className="w-10 h-10" />
                </div>
                
                <div className="max-w-md mx-auto space-y-3">
                  <h2 className="text-xl font-black text-amber-400 uppercase tracking-wide">ĐỒNG CHÍ ĐÃ HOÀN THÀNH ĐỢT THI</h2>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Hệ thống ghi nhận quân nhân <strong>{currentUser?.name || currentUser?.fullName || 'quân nhân'}</strong> đã thực hiện hết số lượt thi cho phép của đợt kiểm tra này.
                  </p>
                  
                  <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 space-y-2 mt-4 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Số lượt thi tối đa:</span>
                      <span className="font-bold text-amber-400 font-mono">{activeSimulatorSession.maxAttempts} lượt</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-400">Số lượt thi đã hoàn thành:</span>
                      <span className="font-bold text-slate-200 font-mono">{getUserAttemptsForSession(activeSimulatorSession)} / {activeSimulatorSession.maxAttempts} lượt</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-slate-700/60 pt-2 mt-1">
                      <span className="text-slate-400">Kết quả cao nhất:</span>
                      <span className="font-bold text-emerald-400 font-mono">
                        {(() => {
                          const uId = currentUser?.id;
                          const uDoc = users.find(u => u.id === uId);
                          if (uDoc && (uDoc as any).lastExamScore !== undefined) {
                            return `${(uDoc as any).lastExamScore}/${(uDoc as any).lastExamTotal || 10}đ (${(uDoc as any).lastExamPassed !== false ? 'Đạt' : 'Chưa đạt'})`;
                          }
                          return 'Đã ghi nhận';
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setActiveSimulatorSession(null)}
                  className="px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white shadow-md transition-all mt-4"
                >
                  Đóng Trình Giả Lập App
                </button>
              </div>
            ) : testResultSummary ? (
              <div className="p-8 text-center space-y-6 overflow-y-auto flex-1">
                <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center border-2 ${
                  testResultSummary.passed ? 'bg-emerald-950 border-emerald-500 text-emerald-400' : 'bg-rose-950 border-rose-500 text-rose-400'
                }`}>
                  {testResultSummary.passed ? <CheckCircle2 className="w-10 h-10" /> : <XCircle className="w-10 h-10" />}
                </div>

                <div>
                  <h2 className="text-2xl font-black">{testResultSummary.passed ? 'XIN CHÚC MỪNG! BẠN ĐÃ ĐẠT' : 'KẾT QUẢ: CHƯA ĐẠT'}</h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Kết quả đã được ghi nhận trực tiếp về Web Quản trị GDCT Vùng 4 Hải Quân
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 max-w-md mx-auto text-center bg-slate-800/80 p-4 rounded-2xl border border-slate-700 text-xs">
                  <div>
                    <span className="block text-slate-400">Số câu đúng</span>
                    <span className="text-lg font-bold text-emerald-400">{testResultSummary.correctCount} / {testResultSummary.totalQuestions}</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Điểm số</span>
                    <span className="text-lg font-bold text-amber-400">{testResultSummary.score} / 10</span>
                  </div>
                  <div>
                    <span className="block text-slate-400">Thời gian</span>
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 max-h-[85vh] flex flex-col">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider">
                  Chi Tiết Bài Làm: {selectedSubmissionForDetail.userName}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {selectedSubmissionForDetail.unitName} • Điểm: {selectedSubmissionForDetail.score}/10 ({selectedSubmissionForDetail.passed ? 'ĐẠT' : 'CHƯA ĐẠT'})
                </p>
              </div>
              <button
                onClick={() => setSelectedSubmissionForDetail(null)}
                className="text-slate-400 hover:text-white text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 text-xs flex-1">
              {(!selectedSubmissionForDetail.answers || selectedSubmissionForDetail.answers.length === 0) ? (
                <p className="text-slate-500">Không có dữ liệu câu trả lời chi tiết.</p>
              ) : (
                selectedSubmissionForDetail.answers.map((ans, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-2xl border space-y-1.5 ${
                      ans.isCorrect ? 'bg-emerald-50/50 border-emerald-200' : 'bg-rose-50/50 border-rose-200'
                    }`}
                  >
                    <div className="font-bold text-slate-900 flex items-start gap-1.5">
                      <span className="font-mono text-blue-700">Câu #{idx + 1}:</span>
                      <span>{ans.questionText}</span>
                    </div>

                    <div className="flex items-center space-x-3 text-[11px]">
                      <span className={ans.isCorrect ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                        Lựa chọn của thí sinh: Đáp án {String.fromCharCode(65 + ans.selectedOption)}
                      </span>
                      {!ans.isCorrect && (
                        <span className="text-emerald-800 font-bold">
                          (Đáp án đúng: {String.fromCharCode(65 + ans.correctOption)})
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 text-right shrink-0">
              <button
                onClick={() => setSelectedSubmissionForDetail(null)}
                className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Đợt Kiểm Tra */}
      {sessionToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-center space-y-4">
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
