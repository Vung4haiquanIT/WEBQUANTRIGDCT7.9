import React, { useState, useEffect } from 'react';
import { 
  X, 
  Smartphone, 
  Layers, 
  FileText, 
  Video, 
  Headphones, 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  Volume2, 
  Sparkles,
  BookOpen,
  Info,
  CheckCircle,
  Wifi,
  WifiOff,
  Database,
  CloudUpload,
  ShieldCheck,
  Award,
  Star,
  HelpCircle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Check,
  Download,
  Trash2,
  HardDrive,
  RefreshCw,
  AlertCircle,
  FolderDown,
  CheckSquare,
  Square,
  Sliders,
  Settings,
  ArrowRight
} from 'lucide-react';
import { 
  Lesson, 
  SlideItem, 
  ContentSection, 
  VideoItem, 
  AudioItem, 
  OfflineProgressItem,
  OfflinePackage,
  LessonSizeBreakdown,
  OfflineModuleSelection,
  AndroidOfflinePackageRecord,
  LessonSection,
  LessonItem,
  LessonQuestion,
  SourceDocument,
  UserItemProgress,
  UserSectionProgress
} from '../types';
import { DongSonDrum } from './DongSonMotif';
import { api } from '../services/api';

interface LessonPreviewModalProps {
  lesson: Lesson;
  slides?: SlideItem[];
  contents?: ContentSection[];
  videos?: VideoItem[];
  audios?: AudioItem[];
  onClose: () => void;
}

export const LessonPreviewModal: React.FC<LessonPreviewModalProps> = ({
  lesson,
  slides: initialSlides,
  contents: initialContents,
  videos: initialVideos,
  audios: initialAudios,
  onClose,
}) => {
  const [slides, setSlides] = useState<SlideItem[]>(initialSlides || []);
  const [contents, setContents] = useState<ContentSection[]>(initialContents || []);
  const [videos, setVideos] = useState<VideoItem[]>(initialVideos || []);
  const [audios, setAudios] = useState<AudioItem[]>(initialAudios || []);
  const [loadingData, setLoadingData] = useState(false);

  // Structured Word/PDF Document State
  const [sections, setSections] = useState<LessonSection[]>([]);
  const [items, setItems] = useState<LessonItem[]>([]);
  const [questions, setQuestions] = useState<LessonQuestion[]>([]);
  const [sourceDoc, setSourceDoc] = useState<SourceDocument | null>(null);
  const [itemProgressMap, setItemProgressMap] = useState<Record<string, UserItemProgress>>({});
  const [sectionProgressMap, setSectionProgressMap] = useState<Record<string, UserSectionProgress>>({});
  const [essayAnswers, setEssayAnswers] = useState<Record<string, string>>({});

  // Network Simulation State
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  // Interactive Quiz & Section Progress State
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState<Record<string, number>>({});
  const [completedSections, setCompletedSections] = useState<Record<string, boolean>>({});

  // Media Player State (Video & Audio in Simulator)
  const [videoErrorMap, setVideoErrorMap] = useState<Record<string, boolean>>({});
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);

  // Helper to format file sizes accurately
  const formatFileSize = (fileSize?: number, fileSizeMb?: number): string => {
    if (typeof fileSize === 'number' && fileSize > 0) {
      return (fileSize / (1024 * 1024)).toFixed(1) + ' MB';
    }
    if (typeof fileSizeMb === 'number' && fileSizeMb > 0) {
      return fileSizeMb.toFixed(1) + ' MB';
    }
    return '0.0 MB';
  };

  // -------------------------------------------------------------
  // ON-DEMAND OFFLINE STORAGE STATE
  // -------------------------------------------------------------
  const [offlineRecord, setOfflineRecord] = useState<AndroidOfflinePackageRecord | null>(null);
  const [sizeBreakdown, setSizeBreakdown] = useState<LessonSizeBreakdown | null>(null);
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [isOfflineManagerOpen, setIsOfflineManagerOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStep, setDownloadStep] = useState('');

  // Module selection for on-demand downloading
  const [selectedModules, setSelectedModules] = useState<OfflineModuleSelection>({
    content: true,
    slides: true,
    videos: false,
    audios: false
  });

  // Simulated Global Device Offline Storage (List of saved lessons)
  const [allOfflineLessons, setAllOfflineLessons] = useState<AndroidOfflinePackageRecord[]>([]);

  // Simulated Local Room DB Progress
  const [localProgress, setLocalProgress] = useState<OfflineProgressItem>({
    userId: 'user-chien-si-1',
    userName: 'Hạ sĩ Nguyễn Văn Hùng',
    unitId: 'unit-1',
    unitName: 'Lữ đoàn 162',
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    courseId: lesson.courseId,
    slideProgress: 0,
    videoProgress: 0,
    audioProgress: 0,
    contentProgress: 0,
    overallProgress: 0,
    completed: false,
    lastAccessedAt: new Date().toISOString(),
    isDirty: false
  });

  // Load lesson data and size breakdown
  useEffect(() => {
    if (lesson?.id) {
      setLoadingData(true);
      Promise.all([
        api.getSlides(lesson.id).catch(() => []),
        api.getContents(lesson.id).catch(() => []),
        api.getSections(lesson.id).catch(() => []),
        api.getItems(lesson.id).catch(() => []),
        api.getQuestions(lesson.id).catch(() => []),
        api.getVideos(lesson.id).catch(() => []),
        api.getAudios(lesson.id).catch(() => []),
        api.getSourceDocument(lesson.id).catch(() => null),
        api.getItemProgress('user-chien-si-1', lesson.id).catch(() => []),
        api.getSectionProgress('user-chien-si-1', lesson.id).catch(() => []),
        api.getLessonSizeBreakdown(lesson.id).catch(() => null)
      ])
        .then(([s, c, sec, it, q, v, a, sDoc, progList, secProgList, breakdown]) => {
          setSlides(s || []);
          setContents(c || []);
          setSections(sec || []);
          setItems(it || []);
          setQuestions(q || []);
          setVideos(v || []);
          setAudios(a || []);
          setSourceDoc(sDoc);
          if (breakdown) setSizeBreakdown(breakdown);

          const map: Record<string, UserItemProgress> = {};
          if (Array.isArray(progList)) {
            progList.forEach(p => {
              if (p.itemId) map[p.itemId] = p;
            });
          }
          setItemProgressMap(map);

          const secMap: Record<string, UserSectionProgress> = {};
          if (Array.isArray(secProgList)) {
            secProgList.forEach(p => {
              if (p.sectionId) secMap[p.sectionId] = p;
            });
          }
          setSectionProgressMap(secMap);
        })
        .finally(() => {
          setLoadingData(false);
        });
    }
  }, [lesson?.id]);

  // Compute live estimated size based on selected modules
  const computeSelectedSizeMb = (): number => {
    if (!sizeBreakdown) return 0.15;
    let total = 0;
    if (selectedModules.content) total += sizeBreakdown.contentSizeMb;
    if (selectedModules.slides) total += sizeBreakdown.slideSizeMb;
    if (selectedModules.videos) total += sizeBreakdown.videoSizeMb;
    if (selectedModules.audios) total += sizeBreakdown.audioSizeMb;
    return Math.round(total * 100) / 100;
  };

  // Trigger On-Demand Offline Download
  const handleStartOfflineDownload = async (isUpgrade = false) => {
    setIsDownloading(true);
    setDownloadProgress(10);
    setDownloadStep('Bắt đầu kết nối và tải Metadata bài học...');

    try {
      // 1. Fetch package from API with selected modules
      const pkg = await api.getOfflinePackage(lesson.id, selectedModules);
      
      setDownloadProgress(35);
      setDownloadStep('Đang lưu trữ cấu trúc Lời Bác dạy & Nội dung vào Room DB...');
      await new Promise(r => setTimeout(r, 450));

      setDownloadProgress(65);
      setDownloadStep('Đang tải tệp Slide và xác thực SHA-256 Checksum...');
      await new Promise(r => setTimeout(r, 550));

      if (selectedModules.videos || selectedModules.audios) {
        setDownloadProgress(85);
        setDownloadStep('Đang lưu trữ tệp Đa phương tiện vào File Storage...');
        await new Promise(r => setTimeout(r, 450));
      }

      setDownloadProgress(100);
      setDownloadStep('Hoàn tất xác minh tính toàn vẹn gói Offline!');
      await new Promise(r => setTimeout(r, 350));

      const newRecord: AndroidOfflinePackageRecord = {
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        courseId: lesson.courseId,
        courseTitle: lesson.courseTitle || 'Giáo dục chính trị',
        localVersion: lesson.version,
        serverVersion: lesson.version,
        contentVersion: lesson.contentVersion || lesson.version,
        mediaVersion: lesson.mediaVersion || lesson.version,
        status: 'OFFLINE_READY',
        downloadProgress: 100,
        downloadedAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        selectedModules: { ...selectedModules },
        sizeBreakdown: {
          contentSizeMb: selectedModules.content ? (sizeBreakdown?.contentSizeMb || 0.15) : 0,
          slideSizeMb: selectedModules.slides ? (sizeBreakdown?.slideSizeMb || 0) : 0,
          videoSizeMb: selectedModules.videos ? (sizeBreakdown?.videoSizeMb || 0) : 0,
          audioSizeMb: selectedModules.audios ? (sizeBreakdown?.audioSizeMb || 0) : 0,
          totalSizeMb: computeSelectedSizeMb()
        },
        packageChecksum: pkg.packageChecksum,
        offlinePackage: pkg
      };

      setOfflineRecord(newRecord);
      setAllOfflineLessons(prev => {
        const filtered = prev.filter(p => p.lessonId !== lesson.id);
        return [newRecord, ...filtered];
      });

      setIsDownloadModalOpen(false);
      setSyncSuccessMsg(
        isUpgrade
          ? `Đã cập nhật an toàn lên phiên bản v${lesson.version} thành công!`
          : `Đã lưu bài học về thiết bị (${computeSelectedSizeMb()} MB). Sẵn sàng học offline!`
      );
      setTimeout(() => setSyncSuccessMsg(null), 4000);
    } catch (err) {
      console.error('Error downloading offline package:', err);
      alert('Không thể lưu gói offline. Vui lòng kiểm tra lại kết nối!');
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
      setDownloadStep('');
    }
  };

  // Delete Offline Package (frees up device storage)
  const handleDeleteOfflinePackage = () => {
    setOfflineRecord(null);
    setAllOfflineLessons(prev => prev.filter(p => p.lessonId !== lesson.id));
    setShowDeleteConfirm(false);
    setSyncSuccessMsg('Đã xóa bản offline khỏi thiết bị. Dung lượng bộ nhớ đã được giải phóng!');
    setTimeout(() => setSyncSuccessMsg(null), 3000);
  };

  // Check if update is available (server version higher than local downloaded version)
  const isUpdateAvailable = offlineRecord && lesson.version > offlineRecord.localVersion;

  const moduleConfig = lesson?.moduleConfig || {
    showSlides: true,
    showContents: true,
    showVideos: true,
    showAudios: true,
  };

  // Available tabs based on moduleConfig
  const availableTabs: { id: 'slides' | 'contents' | 'videos' | 'audios'; label: string; icon: any; count: number }[] = [];
  
  if (moduleConfig.showSlides) {
    availableTabs.push({ id: 'slides', label: 'Slide Bài giảng', icon: Layers, count: (slides || []).length });
  }
  if (moduleConfig.showContents) {
    availableTabs.push({ id: 'contents', label: 'Nội dung GDCT', icon: FileText, count: (contents || []).length });
  }
  if (moduleConfig.showVideos) {
    availableTabs.push({ id: 'videos', label: 'Video tư liệu', icon: Video, count: (videos || []).length });
  }
  if (moduleConfig.showAudios) {
    availableTabs.push({ id: 'audios', label: 'Audio bài giảng', icon: Headphones, count: (audios || []).length });
  }

  const [activeTab, setActiveTab] = useState<'slides' | 'contents' | 'videos' | 'audios'>('slides');

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.find(t => t.id === activeTab)) {
      setActiveTab(availableTabs[0].id);
    }
  }, [availableTabs.length]);

  // Slide state
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Audio simulation state
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  // Record slide progress into local Room DB simulation (Per-Module: By Slide OR By Content, not 4-part average)
  const handleSlideChange = (newIndex: number) => {
    setCurrentSlideIndex(newIndex);
    const progressPercent = slides.length > 0 ? Math.round(((newIndex + 1) / slides.length) * 100) : 0;
    
    setLocalProgress(prev => {
      const maxSlide = Math.max(prev.slideProgress, progressPercent);
      // Overall progress is based on Slide OR Content (not 4-part sum/4)
      const overall = Math.max(maxSlide, prev.contentProgress);
      return {
        ...prev,
        slideProgress: maxSlide,
        overallProgress: overall,
        completed: overall >= 85 || maxSlide === 100 || prev.contentProgress === 100,
        lastAccessedAt: new Date().toISOString(),
        isDirty: true
      };
    });

    if (isOfflineMode) {
      setPendingSyncCount(prev => prev + 1);
    }
  };

  // Interactive Quiz Selection & Progress Calculation (Per-Module: Content Progress)
  const handleSelectQuizOption = (sectionId: string, optionIndex: number, correctOptionIndex: number) => {
    setSelectedQuizAnswers(prev => ({
      ...prev,
      [sectionId]: optionIndex
    }));

    const isCorrect = optionIndex === correctOptionIndex;
    if (isCorrect) {
      const nextCompleted = { ...completedSections, [sectionId]: true };
      setCompletedSections(nextCompleted);

      const totalCount = Math.max(1, contents.length);
      const completedCount = Object.keys(nextCompleted).length;
      const progressPercent = Math.min(100, Math.round((completedCount / totalCount) * 100));

      setLocalProgress(prev => {
        // Overall progress is based on Slide OR Content (not 4-part sum/4)
        const overall = Math.max(prev.slideProgress, progressPercent);
        return {
          ...prev,
          contentProgress: progressPercent,
          overallProgress: overall,
          completed: overall >= 85 || prev.slideProgress === 100 || progressPercent === 100,
          lastAccessedAt: new Date().toISOString(),
          isDirty: true
        };
      });

      if (isOfflineMode) {
        setPendingSyncCount(prev => prev + 1);
      }
    }
  };

  // Trigger online batch progress sync when reconnected
  const handleSyncPendingProgress = async () => {
    try {
      setIsSyncing(true);
      const res = await api.syncProgressBatch([localProgress]);
      setPendingSyncCount(0);
      setSyncSuccessMsg(res.message || 'Đã đồng bộ tiến độ lên máy chủ thành công!');
      setTimeout(() => setSyncSuccessMsg(null), 3000);
    } catch (err) {
      console.error('Error syncing progress:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Determine if the current lesson is viewable in the current network state
  // Under Online-First: if offline AND no offline package saved, we show the blocked screen
  const isLessonAccessible = !isOfflineMode || (isOfflineMode && offlineRecord?.status === 'OFFLINE_READY');

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-5xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* TOP HEADER BAR */}
        <div className="bg-slate-900 p-3.5 sm:p-4 border-b border-slate-800 flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">
                  Mô phỏng Giao diện Android GDCT Vùng 4
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Phiên bản máy chủ: v{lesson.version}</span>
              </div>
              <h2 className="text-sm font-bold text-white truncate max-w-md mt-0.5">
                {lesson.title}
              </h2>
            </div>
          </div>

          {/* Controls: Network Simulator & Offline Manager */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Storage Manager Hub button */}
            <button
              id="btn-open-offline-manager"
              onClick={() => setIsOfflineManagerOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
              title="Xem danh sách các bài học đã lưu offline trên thiết bị"
            >
              <HardDrive className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Quản lý Offline</span>
              <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {allOfflineLessons.length}
              </span>
            </button>

            {/* Toggle Online/Offline */}
            <button
              id="btn-toggle-offline-mode"
              onClick={() => {
                const nextMode = !isOfflineMode;
                setIsOfflineMode(nextMode);
                if (!nextMode && pendingSyncCount > 0) {
                  handleSyncPendingProgress();
                }
              }}
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                isOfflineMode
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                  : 'bg-emerald-950/70 text-emerald-300 border-emerald-700 hover:bg-emerald-900/80'
              }`}
              title="Chuyển đổi trạng thái mạng để kiểm tra mô hình Online-First và On-Demand Offline"
            >
              {isOfflineMode ? (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Mất mạng (Offline)</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Trực tuyến (Online)</span>
                </>
              )}
            </button>

            <button
              id="close-preview-modal-btn"
              onClick={onClose}
              className="p-2 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Toast/Notification Bar */}
        {syncSuccessMsg && (
          <div className="bg-emerald-600 text-white text-xs font-bold py-2 px-4 text-center flex items-center justify-center space-x-2 shadow-xs animate-in slide-in-from-top-2">
            <CheckCircle className="w-4 h-4" />
            <span>{syncSuccessMsg}</span>
          </div>
        )}

        {/* MAIN BODY: SIMULATOR & MONITOR */}
        <div className="flex-1 overflow-hidden p-3 sm:p-5 flex flex-col lg:flex-row items-center justify-center gap-5 bg-slate-100">
          
          {/* PHONE FRAME */}
          <div className="w-[380px] h-[640px] bg-slate-900 rounded-[44px] border-[6px] border-slate-800 shadow-2xl flex flex-col overflow-hidden relative shrink-0">
            
            {/* Phone Notch / Status Bar */}
            <div className="h-7 bg-slate-900 flex items-center justify-between px-6 shrink-0 relative z-20">
              <span className="text-[10px] font-mono text-slate-400 font-semibold">09:41</span>
              <div className="w-20 h-3.5 bg-black rounded-full border border-zinc-800"></div>
              <div className="flex items-center space-x-1.5 text-[10px] text-slate-300">
                {isOfflineMode ? (
                  <span className="flex items-center text-amber-400 text-[9px] font-bold gap-0.5">
                    <WifiOff className="w-2.5 h-2.5" /> NGOẠI TUYẾN
                  </span>
                ) : (
                  <span className="flex items-center text-emerald-400 text-[9px] font-bold gap-0.5">
                    <Wifi className="w-2.5 h-2.5" /> 5G ONLINE
                  </span>
                )}
                <span>100%</span>
              </div>
            </div>

            {/* Mobile App Header */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 px-4 py-2.5 text-white relative overflow-hidden shrink-0 border-b border-blue-800">
              <DongSonDrum className="absolute -right-6 -top-6 w-28 h-28 opacity-15" color="#93C5FD" />
              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-[9px] font-bold text-blue-300 tracking-wider uppercase">
                    <span>HẢI QUÂN VÙNG 4</span>
                    <span>•</span>
                    <span>GDCT</span>
                  </div>
                  
                  {/* Storage / Version Status Tag */}
                  {offlineRecord ? (
                    <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle className="w-2.5 h-2.5 text-emerald-400" />
                      OFFLINE v{offlineRecord.localVersion} ({offlineRecord.sizeBreakdown.totalSizeMb} MB)
                    </span>
                  ) : (
                    <span className="text-[9px] font-bold bg-blue-950/80 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-full">
                      ONLINE-FIRST
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-white line-clamp-1 mt-0.5">
                  {lesson.title}
                </div>
              </div>
            </div>

            {/* ON-DEMAND OFFLINE ACTION BANNER / CONTROLS (Inside Phone) */}
            <div className="bg-slate-800/90 border-b border-slate-700 px-3 py-2 shrink-0">
              {/* Case 1: New Server Version Available */}
              {isUpdateAvailable && !isOfflineMode && (
                <div className="p-2 bg-gradient-to-r from-amber-950 to-slate-900 border border-amber-500/50 rounded-xl flex items-center justify-between text-white animate-in fade-in">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-[10px] font-bold text-amber-300">CÓ PHIÊN BẢN MỚI (v{lesson.version})</div>
                      <div className="text-[9px] text-slate-400">Bản hiện tại: v{offlineRecord.localVersion}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => setIsDownloadModalOpen(true)}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
                    >
                      Cập nhật
                    </button>
                  </div>
                </div>
              )}

              {/* Case 2: Not Downloaded Yet (Online-First) */}
              {!offlineRecord && !isOfflineMode && (
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-300 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                    Học trực tuyến (Chưa lưu offline)
                  </span>
                  <button
                    id="btn-trigger-offline-download"
                    onClick={() => setIsDownloadModalOpen(true)}
                    className="flex items-center space-x-1.5 px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[10px] font-bold shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    <span>LƯU ĐỂ HỌC OFFLINE</span>
                  </button>
                </div>
              )}

              {/* Case 3: Offline Package Ready */}
              {offlineRecord && !isUpdateAvailable && (
                <div className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Đã lưu offline ({offlineRecord.sizeBreakdown.totalSizeMb} MB)</span>
                  </div>
                  <button
                    id="btn-delete-offline-package"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex items-center space-x-1 px-2 py-0.5 text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded transition-all font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Xóa bản offline</span>
                  </button>
                </div>
              )}
            </div>

            {/* If Lesson is accessible, show tabs and lesson content */}
            {isLessonAccessible ? (
              <>
                {/* Dynamic Mobile Tabs */}
                <div className="bg-slate-800 border-b border-slate-700 px-2 py-1 flex items-center justify-around shrink-0">
                  {availableTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex flex-col items-center py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5 mb-0.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Mobile Tab Content */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-3 text-slate-800">
                  
                  {/* SLIDES TAB (PowerPoint Presentation Mode) */}
                  {activeTab === 'slides' && (
                    <div className="h-full flex flex-col space-y-2.5">
                      {slides.length === 0 ? (
                        <div className="my-auto text-center py-8 text-slate-400 text-xs">
                          Chưa có slide nào được tải lên cho bài học này.
                        </div>
                      ) : (
                        <div className="flex-1 flex flex-col space-y-2">
                          {/* Slide Progress Banner */}
                          <div className="bg-white rounded-xl p-2 border border-slate-200 shadow-2xs flex items-center justify-between">
                            <div className="flex items-center space-x-1.5 text-[11px] font-bold text-slate-800">
                              <Layers className="w-3.5 h-3.5 text-blue-600" />
                              <span>Tiến độ Slide bài giảng:</span>
                            </div>
                            <span className="text-[11px] font-bold text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              Slide {currentSlideIndex + 1}/{slides.length} ({localProgress.slideProgress}%)
                            </span>
                          </div>

                          {/* 16:9 PowerPoint Slide Frame */}
                          <div className="relative aspect-[16/9] bg-slate-950 rounded-xl overflow-hidden border border-slate-300 shadow-md group">
                            <img
                              src={slides[currentSlideIndex]?.imageUrl}
                              alt={slides[currentSlideIndex]?.title}
                              className="w-full h-full object-contain bg-slate-950"
                            />
                            <div className="absolute top-2 left-2 bg-black/80 backdrop-blur-xs text-white text-[10px] font-bold px-2.5 py-0.5 rounded-md border border-white/20 shadow-xs">
                              Slide {currentSlideIndex + 1} / {slides.length}
                            </div>
                            {isOfflineMode && (
                              <div className="absolute top-2 right-2 bg-amber-500 text-slate-950 text-[9px] font-bold px-2 py-0.5 rounded-md shadow-xs">
                                Offline Mode
                              </div>
                            )}
                          </div>

                          {/* Slide Carousel Thumbnail Strip */}
                          {slides.length > 1 && (
                            <div className="flex items-center space-x-1.5 overflow-x-auto py-1 px-0.5 scrollbar-thin">
                              {slides.map((s, sIdx) => {
                                const isActive = sIdx === currentSlideIndex;
                                return (
                                  <button
                                    key={s.id || sIdx}
                                    onClick={() => handleSlideChange(sIdx)}
                                    className={`relative shrink-0 w-14 aspect-[16/9] rounded-md overflow-hidden border-2 transition-all cursor-pointer ${
                                      isActive
                                        ? 'border-blue-600 ring-2 ring-blue-300 shadow-xs scale-105'
                                        : 'border-slate-200 opacity-60 hover:opacity-100'
                                    }`}
                                    title={`Chuyển đến Slide ${sIdx + 1}`}
                                  >
                                    <img
                                      src={s.imageUrl}
                                      alt={s.title}
                                      className="w-full h-full object-cover"
                                    />
                                    <span className="absolute bottom-0 right-0 bg-slate-900/80 text-white text-[8px] font-mono px-1 rounded-tl">
                                      {sIdx + 1}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {/* Slide Info & Controls */}
                          <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col justify-between shadow-xs space-y-2">
                            <div>
                              <h4 className="text-xs font-bold text-slate-800">
                                {slides[currentSlideIndex]?.title || `Slide ${currentSlideIndex + 1}`}
                              </h4>
                              {slides[currentSlideIndex]?.notes && (
                                <p className="text-[11px] text-slate-600 mt-1 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-200">
                                  <span className="font-semibold text-blue-700">Ghi chú giảng dạy:</span>{' '}
                                  {slides[currentSlideIndex]?.notes}
                                </p>
                              )}
                            </div>

                            {/* Slide Navigation Buttons */}
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                              <button
                                disabled={currentSlideIndex === 0}
                                onClick={() => handleSlideChange(Math.max(0, currentSlideIndex - 1))}
                                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-30 text-xs font-bold border border-slate-200 cursor-pointer transition-colors"
                              >
                                <ChevronLeft className="w-3.5 h-3.5" />
                                <span>Trước</span>
                              </button>
                              <span className="text-[11px] font-mono text-slate-600 font-semibold">
                                {currentSlideIndex + 1} / {slides.length}
                              </span>
                              <button
                                disabled={currentSlideIndex === slides.length - 1}
                                onClick={() => handleSlideChange(Math.min(slides.length - 1, currentSlideIndex + 1))}
                                className="flex items-center space-x-1 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-30 text-xs font-bold shadow-xs cursor-pointer transition-colors"
                              >
                                <span>Tiếp</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* CONTENTS TAB */}
                  {activeTab === 'contents' && (
                    <div className="space-y-3 pb-4">
                      {/* Overall Progress Header */}
                      <div className="bg-white rounded-xl p-2.5 border border-slate-200 shadow-2xs flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Award className="w-4 h-4 text-amber-600" />
                          <span className="text-[11px] font-bold text-slate-800">📚 Tiến độ học tập bài giảng:</span>
                        </div>
                        <span className="text-[11px] font-bold text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          {(Object.values(itemProgressMap) as UserItemProgress[]).filter(p => p.completed).length} / {items.length || contents.length} hoàn thành ({
                            items.length > 0 
                              ? Math.round(((Object.values(itemProgressMap) as UserItemProgress[]).filter(p => p.completed).length / items.length) * 100)
                              : localProgress.contentProgress
                          }%)
                        </span>
                      </div>

                      {/* SOURCE DOCUMENT BANNER (IF AVAILABLE) */}
                      {sourceDoc && (
                        <div className="bg-slate-900 text-white p-3 rounded-xl border border-blue-800/80 shadow-xs flex items-center justify-between gap-2">
                          <div className="flex items-center space-x-2.5">
                            <div className="p-2 bg-blue-600/20 text-blue-400 rounded-lg border border-blue-500/30">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-[11px] font-bold text-white flex items-center space-x-1.5">
                                <span className="line-clamp-1">{sourceDoc.name || sourceDoc.fileName}</span>
                                <span className="text-[9px] uppercase font-mono px-1.5 py-0.2 bg-blue-900 text-blue-300 rounded font-bold">
                                  {(sourceDoc.type || 'DOCX').toUpperCase()}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Tài liệu nguồn bài giảng • {sourceDoc.size ? (sourceDoc.size > 1024 * 1024 ? `${(sourceDoc.size / (1024 * 1024)).toFixed(2)} MB` : `${Math.round(sourceDoc.size / 1024)} KB`) : ''}
                              </p>
                            </div>
                          </div>
                          {(sourceDoc.cloudinaryUrl || sourceDoc.url) && (
                            <button
                              onClick={() => {
                                const docUrl = sourceDoc.cloudinaryUrl || sourceDoc.url;
                                window.open(docUrl, '_blank', 'noopener,noreferrer');
                              }}
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-lg shadow-2xs flex items-center space-x-1 shrink-0 cursor-pointer"
                            >
                              <Download className="w-3 h-3" />
                              <span>MỞ TÀI LIỆU GỐC</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* STRUCTURED SECTIONS TREE */}
                      {sections.length > 0 ? (
                        sections.map((sec, secIdx) => {
                          const secItems = items.filter(i => i.sectionId === sec.id);

                          return (
                            <div key={sec.id} className="space-y-2">
                              {/* Section Header */}
                              <div className="bg-blue-900 text-white p-2.5 rounded-xl border border-blue-700 flex items-center space-x-2 shadow-xs">
                                <BookOpen className="w-4 h-4 text-amber-400 shrink-0" />
                                <h3 className="text-xs font-bold text-white uppercase tracking-wide">
                                  {sec.title || `PHẦN ${secIdx + 1}`}
                                </h3>
                              </div>

                              {/* Section Items */}
                              <div className="space-y-2.5 pl-1">
                                {secItems.map((item) => {
                                  const prog = itemProgressMap[item.id];
                                  const isCompleted = prog?.completed;
                                  const attempts = prog?.attempts || 0;
                                  const itemQs = questions.filter(q => q.itemId === item.id);

                                  return (
                                    <div
                                      key={item.id}
                                      className={`bg-white rounded-xl p-3.5 border transition-all shadow-2xs space-y-3 ${
                                        isCompleted
                                          ? 'border-emerald-400 ring-1 ring-emerald-200'
                                          : attempts > 0
                                          ? 'border-amber-300 ring-1 ring-amber-100'
                                          : 'border-slate-200'
                                      }`}
                                    >
                                      {/* Item Title & Status Badge */}
                                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                        <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 flex-1 pr-2">
                                          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                          <span>{item.title}</span>
                                        </h4>
                                        {isCompleted ? (
                                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                            <CheckCircle className="w-3 h-3 text-emerald-600" /> Đã hoàn thành
                                          </span>
                                        ) : attempts > 0 ? (
                                          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full shrink-0">
                                            Đang học
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full shrink-0">
                                            Chưa học
                                          </span>
                                        )}
                                      </div>

                                      {/* Body Content */}
                                      <div
                                        className="text-[11px] leading-relaxed text-slate-700 space-y-1.5 prose max-w-none font-sans"
                                        dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
                                      />

                                      {/* Item Questions */}
                                      {itemQs.length > 0 && (
                                        <div className="space-y-2.5 pt-2 border-t border-slate-100">
                                          <div className="text-[10px] font-bold text-blue-950 uppercase flex items-center gap-1">
                                            <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Kiểm tra nhận thức ({itemQs.length} câu):</span>
                                          </div>

                                          {itemQs.map((q) => {
                                            if (q.type === 'short_answer' || q.type === 'essay') {
                                              const userAns = essayAnswers[q.id] || '';
                                              const isSubmitted = selectedQuizAnswers[q.id] !== undefined;

                                              return (
                                                <div
                                                  key={q.id}
                                                  className="p-3 rounded-xl border space-y-2 bg-blue-50/60 border-blue-200 transition-all"
                                                >
                                                  <div className="flex items-center justify-between">
                                                    <p className="text-[11px] font-bold text-slate-800 flex-1">
                                                      {q.question}
                                                    </p>
                                                    <span className="text-[9px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0 ml-1">
                                                      {q.type === 'essay' ? 'Tự luận' : 'Trả lời ngắn'}
                                                    </span>
                                                  </div>

                                                  <textarea
                                                    rows={2}
                                                    value={userAns}
                                                    onChange={(e) => setEssayAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                                    placeholder="Nhập câu trả lời của đồng chí tại đây..."
                                                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-[11px] text-slate-900 focus:outline-none focus:border-blue-500"
                                                  />

                                                  <div className="flex items-center justify-between">
                                                    <button
                                                      type="button"
                                                      onClick={() => {
                                                        setSelectedQuizAnswers(prev => ({ ...prev, [q.id]: 1 }));
                                                      }}
                                                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition-all cursor-pointer"
                                                    >
                                                      {isSubmitted ? 'Xem lại đáp án' : 'Gửi câu trả lời'}
                                                    </button>
                                                  </div>

                                                  {isSubmitted && (q.explanation || q.correctAnswer) && (
                                                    <div className="p-2 bg-emerald-50 rounded-lg text-[10px] text-emerald-900 border border-emerald-200 space-y-1">
                                                      <div className="font-bold flex items-center gap-1">
                                                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                        <span>Đáp án gợi ý / Hướng dẫn:</span>
                                                      </div>
                                                      <p className="text-slate-700">{typeof q.correctAnswer === 'string' ? q.correctAnswer : q.explanation}</p>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            }

                                            const selectedOpt = selectedQuizAnswers[q.id];
                                            const isCorrect = selectedOpt !== undefined && selectedOpt === q.correctAnswer;
                                            const isWrong = selectedOpt !== undefined && selectedOpt !== q.correctAnswer;

                                            return (
                                              <div
                                                key={q.id}
                                                className={`p-3 rounded-xl border space-y-2 transition-all ${
                                                  isCorrect
                                                    ? 'bg-emerald-50/70 border-emerald-300'
                                                    : isWrong
                                                    ? 'bg-red-50/70 border-red-300'
                                                    : 'bg-blue-50/60 border-blue-200'
                                                }`}
                                              >
                                                <p className="text-[11px] font-bold text-slate-800">
                                                  {q.question}
                                                </p>

                                                <div className="space-y-1.5">
                                                  {q.options.map((opt, oIdx) => {
                                                    const isSelected = selectedOpt === oIdx;
                                                    const optLetter = String.fromCharCode(65 + oIdx);

                                                    let optStyle = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
                                                    if (isSelected) {
                                                      if (isCorrect) {
                                                        optStyle = 'bg-emerald-100/90 border-emerald-400 text-emerald-950 font-bold';
                                                      } else if (isWrong) {
                                                        optStyle = 'bg-red-100/90 border-red-400 text-red-950 font-bold';
                                                      }
                                                    }

                                                    return (
                                                      <button
                                                        key={oIdx}
                                                        onClick={async () => {
                                                          setSelectedQuizAnswers(prev => ({ ...prev, [q.id]: oIdx }));
                                                          let itemFullyCorrect = oIdx === q.correctAnswer;
                                                          for (const otherQ of itemQs) {
                                                            const checkOpt = otherQ.id === q.id ? oIdx : selectedQuizAnswers[otherQ.id];
                                                            if (checkOpt !== otherQ.correctAnswer) {
                                                              itemFullyCorrect = false;
                                                              break;
                                                            }
                                                          }

                                                          try {
                                                            const progRecord = await api.submitItemProgress({
                                                              userId: 'user-chien-si-1',
                                                              userName: 'Hạ sĩ Nguyễn Văn Hùng',
                                                              unitId: 'unit-1',
                                                              unitName: 'Lữ đoàn 162',
                                                              courseId: lesson.courseId,
                                                              lessonId: lesson.id,
                                                              sectionId: item.sectionId,
                                                              itemId: item.id,
                                                              completed: itemFullyCorrect,
                                                              score: itemFullyCorrect ? 10 : 0,
                                                              attempts: (itemProgressMap[item.id]?.attempts || 0) + 1,
                                                              lastAccessedAt: new Date().toISOString()
                                                            });
                                                            setItemProgressMap(prev => ({ ...prev, [item.id]: progRecord }));
                                                          } catch (err) {
                                                            console.warn('Error saving progress:', err);
                                                          }
                                                        }}
                                                        className={`w-full text-left p-2 rounded-lg border text-[11px] flex items-start space-x-2 transition-all cursor-pointer ${optStyle}`}
                                                      >
                                                        <span className="w-4 h-4 rounded bg-slate-200 text-slate-800 font-mono font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                                                          {optLetter}
                                                        </span>
                                                        <span className="flex-1 leading-snug">{opt}</span>
                                                      </button>
                                                    );
                                                  })}
                                                </div>

                                                {/* Explanation / Result banner */}
                                                {isCorrect && q.explanation && (
                                                  <div className="p-2 bg-emerald-100/60 rounded-lg text-[10px] text-emerald-900 border border-emerald-200 flex items-start space-x-1.5">
                                                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                                    <p>{q.explanation}</p>
                                                  </div>
                                                )}
                                                {isWrong && (
                                                  <div className="p-2 bg-red-100/60 rounded-lg text-[10px] text-red-900 border border-red-200 flex items-start space-x-1.5">
                                                    <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                                                    <p>Chưa chính xác! Đồng chí hãy đọc kỹ nội dung bài đọc và chọn lại.</p>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      ) : contents.length === 0 ? (
                        <div className="text-center py-8 text-slate-400 text-xs">
                          Chưa có nội dung văn bản cho bài học này.
                        </div>
                      ) : (
                        contents.map((item) => {
                          const isCompleted = !!completedSections[item.id];
                          const selectedOpt = selectedQuizAnswers[item.id];
                          const hasQuiz = item.quoteQuiz && item.quoteQuiz.enabled;
                          const isCorrect = hasQuiz && selectedOpt !== undefined && selectedOpt === item.quoteQuiz?.correctOptionIndex;
                          const isWrong = hasQuiz && selectedOpt !== undefined && selectedOpt !== item.quoteQuiz?.correctOptionIndex;

                          return (
                            <div
                              key={item.id}
                              className={`bg-white rounded-xl p-3.5 border transition-all shadow-xs space-y-3 ${
                                isCompleted ? 'border-emerald-400 ring-1 ring-emerald-200' : 'border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                <h3 className="text-xs font-bold text-slate-800 flex items-center space-x-1.5 flex-1 pr-2">
                                  <BookOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                  <span className="line-clamp-1">{item.title}</span>
                                </h3>
                                {isCompleted ? (
                                  <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                                    <CheckCircle className="w-3 h-3 text-emerald-600" /> Đã hoàn thành
                                  </span>
                                ) : (
                                  <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
                                    Chưa hoàn thành
                                  </span>
                                )}
                              </div>

                              {item.quote && (
                                <div className="p-3 bg-gradient-to-br from-red-950 via-slate-900 to-blue-950 text-white rounded-xl border border-red-800/80 shadow-xs relative overflow-hidden">
                                  <DongSonDrum className="absolute -right-4 -bottom-4 w-20 h-20 opacity-15" color="#FBBF24" />
                                  <div className="relative z-10 space-y-1.5">
                                    <div className="flex items-center space-x-1.5 text-amber-400 font-bold text-[9px] uppercase tracking-wider">
                                      <Star className="w-3 h-3 fill-amber-400" />
                                      <span>LỜI DẠY CỦA CHỦ TỊCH HỒ CHÍ MINH</span>
                                    </div>
                                    <blockquote className="text-[11px] font-serif italic text-amber-100 leading-relaxed border-l-2 border-amber-400 pl-2.5">
                                      "{item.quote}"
                                    </blockquote>
                                    <div className="text-[9px] text-slate-300 flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-slate-800/80">
                                      <span className="font-bold text-amber-300">
                                        {item.quoteAuthor || 'Chủ tịch Hồ Chí Minh'}
                                      </span>
                                      {item.quoteHistoricalContext && (
                                        <span className="text-slate-400 italic">
                                          {item.quoteHistoricalContext}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div
                                className="text-[11px] leading-relaxed text-slate-700 space-y-1.5 prose max-w-none font-sans"
                                dangerouslySetInnerHTML={{ __html: item.bodyHtml }}
                              />

                              {hasQuiz && item.quoteQuiz ? (
                                <div className={`p-3 rounded-xl border space-y-2.5 transition-all ${
                                  isCorrect
                                    ? 'bg-emerald-50/70 border-emerald-300'
                                    : isWrong
                                    ? 'bg-red-50/70 border-red-300'
                                    : 'bg-blue-50/60 border-blue-200'
                                }`}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-blue-950 uppercase flex items-center gap-1">
                                      <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Trắc nghiệm nhận thức & Tính tiến độ:</span>
                                    </span>
                                    {isCorrect && (
                                      <span className="text-[9px] font-bold text-emerald-800 bg-emerald-200 px-1.5 py-0.5 rounded">
                                        +100% Tiến độ
                                      </span>
                                    )}
                                  </div>

                                  <p className="text-[11px] font-bold text-slate-800">
                                    {item.quoteQuiz.question}
                                  </p>

                                  <div className="space-y-1.5">
                                    {item.quoteQuiz.options.map((opt, oIdx) => {
                                      const isSelected = selectedOpt === oIdx;
                                      const optLetter = String.fromCharCode(65 + oIdx);

                                      let optStyle = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
                                      if (isSelected) {
                                        if (isCorrect) {
                                          optStyle = 'bg-emerald-100/90 border-emerald-400 text-emerald-950 font-bold';
                                        } else if (isWrong) {
                                          optStyle = 'bg-red-100/90 border-red-400 text-red-950 font-bold';
                                        }
                                      }

                                      return (
                                        <button
                                          key={oIdx}
                                          disabled={isCorrect}
                                          onClick={() => handleSelectQuizOption(item.id, oIdx, item.quoteQuiz!.correctOptionIndex)}
                                          className={`w-full text-left p-2 rounded-lg border text-[11px] flex items-start space-x-2 transition-all cursor-pointer ${optStyle}`}
                                        >
                                          <span className="w-4 h-4 rounded bg-slate-200 text-slate-800 font-mono font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                                            {optLetter}
                                          </span>
                                          <span className="flex-1 leading-snug">{opt}</span>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {isCorrect && item.quoteQuiz.explanation && (
                                    <div className="p-2 bg-emerald-100/60 rounded-lg text-[10px] text-emerald-900 border border-emerald-200 flex items-start space-x-1.5">
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                      <p>{item.quoteQuiz.explanation}</p>
                                    </div>
                                  )}
                                  {isWrong && (
                                    <div className="p-2 bg-red-100/60 rounded-lg text-[10px] text-red-900 border border-red-200 flex items-start space-x-1.5">
                                      <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                                      <p>Chưa chính xác! Đồng chí hãy suy nghĩ kỹ và lựa chọn lại đáp án đúng.</p>
                                    </div>
                                  )}
                                </div>
                              ) : null}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* VIDEOS TAB */}
                  {activeTab === 'videos' && (
                    <div className="space-y-4">
                      {videos.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-xs bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
                          <Video className="w-8 h-8 mx-auto text-slate-300" />
                          <p className="font-semibold text-slate-600">Chưa có video tư liệu nào.</p>
                          <p className="text-[10px] text-slate-400">Vui lòng tải video lên từ tab "Video tư liệu" trong bài giảng.</p>
                        </div>
                      ) : (
                        videos.map((vid, idx) => {
                          const hasError = !!videoErrorMap[vid.id];
                          const isOfflineBlocked = isOfflineMode && offlineRecord && !offlineRecord.package.hasVideos;
                          const validVideoUrl = vid.videoUrl || vid.cloudinaryUrl;

                          return (
                            <div key={vid.id} className="bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xs space-y-0 hover:shadow-md transition-all">
                              {/* Native HTML5 Video Player */}
                              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                                {isOfflineBlocked ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-300 p-4 text-center space-y-2">
                                    <WifiOff className="w-8 h-8 text-amber-400" />
                                    <span className="text-xs font-bold text-amber-300">Không khả dụng khi Ngoại tuyến</span>
                                    <p className="text-[10px] text-slate-400 max-w-xs">
                                      Gói ngoại tuyến này không bao gồm video để tiết kiệm bộ nhớ thiết bị.
                                    </p>
                                  </div>
                                ) : hasError || !validVideoUrl ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 text-slate-300 p-4 text-center space-y-2">
                                    <AlertCircle className="w-8 h-8 text-red-400" />
                                    <span className="text-xs font-bold text-white">Không thể tải luồng video</span>
                                    <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">
                                      Không thể phát video từ Cloudinary CDN. Vui lòng kiểm tra định dạng hoặc thử lại.
                                    </p>
                                    <button
                                      onClick={() => setVideoErrorMap(prev => ({ ...prev, [vid.id]: false }))}
                                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-blue-400 text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                                    >
                                      Thử tải lại
                                    </button>
                                  </div>
                                ) : (
                                  <video
                                    key={validVideoUrl}
                                    controls
                                    playsInline
                                    preload="metadata"
                                    src={validVideoUrl}
                                    poster={vid.thumbnail && !vid.thumbnail.endsWith('.mp4') ? vid.thumbnail : undefined}
                                    onError={() => {
                                      console.error('Video player load error for:', vid.title, validVideoUrl);
                                      setVideoErrorMap(prev => ({ ...prev, [vid.id]: true }));
                                    }}
                                    className="w-full h-full object-contain bg-black"
                                  >
                                    <source src={validVideoUrl} type={vid.mimeType || 'video/mp4'} />
                                    Trình duyệt không hỗ trợ phát thẻ video HTML5.
                                  </video>
                                )}

                                {/* Top Floating badges on video */}
                                <div className="absolute top-2 left-2 pointer-events-none flex items-center space-x-1.5 z-10">
                                  <span className="bg-slate-900/90 backdrop-blur-xs text-amber-400 text-[9px] font-bold px-2 py-0.5 rounded font-mono border border-slate-700">
                                    #{idx + 1}
                                  </span>
                                  <span className="bg-blue-600/90 text-white text-[9px] font-bold px-2 py-0.5 rounded font-mono">
                                    {vid.mimeType ? vid.mimeType.replace('video/', '').toUpperCase() : 'MP4'}
                                  </span>
                                </div>
                              </div>

                              {/* Video Details & Meta */}
                              <div className="p-3.5 space-y-2">
                                <h4 className="text-xs font-bold text-slate-900 leading-snug">{vid.title}</h4>
                                {vid.description && (
                                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">{vid.description}</p>
                                )}
                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 text-[10px] font-mono text-slate-500">
                                  <div className="flex items-center space-x-2">
                                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">
                                      📦 {formatFileSize(vid.fileSize, vid.fileSizeMb)}
                                    </span>
                                    <span>
                                      ⏱ {Math.floor((vid.durationSeconds || 0) / 60)}:{String((vid.durationSeconds || 0) % 60).padStart(2, '0')}
                                    </span>
                                  </div>
                                  <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-sans font-medium text-[9px]">
                                    Cloudinary Stream ✓
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}

                  {/* AUDIOS TAB */}
                  {activeTab === 'audios' && (
                    <div className="space-y-3">
                      {audios.length === 0 ? (
                        <div className="text-center py-10 text-slate-400 text-xs bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
                          <Headphones className="w-8 h-8 mx-auto text-slate-300" />
                          <p className="font-semibold text-slate-600">Chưa có file audio bài giảng nào.</p>
                          <p className="text-[10px] text-slate-400">Vui lòng tải audio lên từ tab "Audio bài giảng" trong bài giảng.</p>
                        </div>
                      ) : (
                        audios.map((aud, idx) => {
                          const isOfflineBlocked = isOfflineMode && offlineRecord && !offlineRecord.package.hasAudios;
                          const validAudioUrl = aud.audioUrl || aud.cloudinaryUrl;

                          return (
                            <div key={aud.id} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3 hover:shadow-md transition-all">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center space-x-3 min-w-0">
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                    <Headphones className="w-5 h-5" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center space-x-1.5">
                                      <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                                        #{idx + 1}
                                      </span>
                                      <h4 className="text-xs font-bold text-slate-800 truncate">{aud.title}</h4>
                                    </div>
                                    <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono mt-0.5">
                                      <span>⏱ {Math.floor((aud.durationSeconds || 0) / 60)} phút</span>
                                      <span>•</span>
                                      <span>📦 {formatFileSize(aud.fileSize, aud.fileSizeMb)}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {aud.description && (
                                <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                                  {aud.description}
                                </p>
                              )}

                              {isOfflineBlocked ? (
                                <div className="p-3 bg-amber-50 rounded-xl text-amber-800 text-[10px] flex items-center space-x-2 border border-amber-200">
                                  <WifiOff className="w-4 h-4 shrink-0 text-amber-600" />
                                  <span>Audio này không được tải về gói Offline. Cần kết nối Internet để nghe trực tuyến.</span>
                                </div>
                              ) : (
                                <div className="pt-1">
                                  <audio
                                    controls
                                    preload="metadata"
                                    src={validAudioUrl}
                                    className="w-full h-10 rounded-lg outline-none"
                                  >
                                    Trình duyệt không hỗ trợ phát âm thanh HTML5.
                                  </audio>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* BLOCKED STATE: WHEN OFFLINE AND LESSON WAS NOT SAVED ON-DEMAND */
              <div className="flex-1 bg-slate-900 text-white p-6 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-16 h-16 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <WifiOff className="w-8 h-8" />
                </div>
                <div className="space-y-2 max-w-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/80 px-2 py-0.5 rounded border border-amber-800">
                    CHƯA LƯU BẢN OFFLINE
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    Bài học chưa được lưu để học ngoại tuyến
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Theo mô hình <strong>Online-First</strong>, hệ thống không tự động lưu toàn bộ dữ liệu về máy để tối ưu bộ nhớ. Chiến sĩ cần kết nối Internet để học hoặc chủ động chọn "LƯU ĐỂ HỌC OFFLINE" trước khi đi biển.
                  </p>
                </div>
                <button
                  onClick={() => setIsOfflineMode(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-xs flex items-center space-x-2 transition-all cursor-pointer"
                >
                  <Wifi className="w-3.5 h-3.5" />
                  <span>Bật kết nối Trực tuyến (Online)</span>
                </button>
              </div>
            )}

            {/* Mobile Navigation Indicator Bar */}
            <div className="h-5 bg-slate-900 flex items-center justify-center shrink-0">
              <div className="w-28 h-1 bg-zinc-600 rounded-full"></div>
            </div>
          </div>

          {/* SIDE INSPECTOR: ANDROID OFFLINE STORAGE & ROOM SYNC MONITOR */}
          <div className="w-full lg:w-80 bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 text-xs">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-200">
              <HardDrive className="w-4 h-4 text-blue-600" />
              <span className="font-bold text-slate-800">Kiến trúc Online-First & Offline</span>
            </div>

            {/* Mode & Storage Architecture Card */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-700">Mô hình hoạt động:</span>
                <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-100 text-blue-800">
                  ON-DEMAND OFFLINE
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Tách biệt <strong>TEMP CACHE</strong> (bộ nhớ tạm HTTP) và <strong>OFFLINE STORAGE</strong> (Room DB + Persistent Files).
              </p>
              <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-1.5 text-[10px]">
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-slate-500">Trạng thái bài học:</div>
                  <div className="font-bold text-slate-800">
                    {offlineRecord ? 'OFFLINE READY' : 'ONLINE ONLY'}
                  </div>
                </div>
                <div className="bg-white p-2 rounded border border-slate-200">
                  <div className="text-slate-500">Bản trên máy:</div>
                  <div className="font-bold text-slate-800">
                    {offlineRecord ? `v${offlineRecord.localVersion}` : 'Chưa tải'}
                  </div>
                </div>
              </div>
            </div>

            {/* Local Progress Monitor (Room DB - Per-Module independent tracking) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Tiến độ ghi nhận (Room DB):</span>
                <span className="font-bold text-blue-600 text-sm font-mono">{localProgress.overallProgress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                <div className="bg-blue-600 h-full rounded-full transition-all" style={{ width: `${localProgress.overallProgress}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 pt-1">
                <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200 flex flex-col">
                  <span className="text-slate-400 font-medium">Theo Slide:</span>
                  <strong className="text-blue-700 font-mono text-xs">{localProgress.slideProgress}%</strong>
                </div>
                <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200 flex flex-col">
                  <span className="text-slate-400 font-medium">Theo Nội dung:</span>
                  <strong className="text-indigo-700 font-mono text-xs">{localProgress.contentProgress}%</strong>
                </div>
              </div>
              <p className="text-[9px] text-slate-400 italic">
                * Tiến độ tính độc lập theo Slide hoặc theo Nội dung (không cộng chia 4 phần).
              </p>
            </div>

            {/* Offline Progress Sync Queue */}
            <div className="border border-slate-200 rounded-xl p-3 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700">Hàng đợi đồng bộ tiến độ:</span>
                <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                  {pendingSyncCount} bản ghi
                </span>
              </div>
              <p className="text-[10px] text-slate-500">
                Ghi nhận vào Room DB ngay cả khi mất mạng; tự động đồng bộ lên máy chủ khi có kết nối trở lại.
              </p>

              <button
                disabled={isOfflineMode || isSyncing || pendingSyncCount === 0}
                onClick={handleSyncPendingProgress}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-xs transition-all cursor-pointer"
              >
                <CloudUpload className="w-3.5 h-3.5" />
                <span>{isSyncing ? 'Đang đồng bộ...' : 'Đồng bộ tiến độ lên máy chủ'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER INFO */}
        <div className="bg-slate-50 p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600 px-6">
          <div className="flex items-center space-x-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Mô hình Online-First bảo vệ bộ nhớ điện thoại chiến sĩ, chỉ lưu trữ khi có lệnh chủ động.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition-colors shadow-xs cursor-pointer"
          >
            Đóng xem trước
          </button>
        </div>
      </div>

      {/* ============================================================= */}
      {/* 1. ON-DEMAND OFFLINE DOWNLOAD / SELECTION MODAL */}
      {/* ============================================================= */}
      {isDownloadModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-900 p-5 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Lưu bài học để học Offline</h3>
                  <p className="text-xs text-blue-200">{lesson.title}</p>
                </div>
              </div>
              <button
                disabled={isDownloading}
                onClick={() => setIsDownloadModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {!isDownloading ? (
                <>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Chọn các thành phần cần lưu trữ vào bộ nhớ thiết bị. Ứng dụng sẽ xác thực tính toàn vẹn gói dữ liệu bằng mã SHA-256 Checksum:
                  </p>

                  {/* Module Checkboxes */}
                  <div className="space-y-2.5">
                    {/* Content Section (Mandatory) */}
                    <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <CheckSquare className="w-4 h-4 text-blue-600" />
                        <div>
                          <div className="text-xs font-bold text-slate-800">Nội dung bài giảng & Lời Bác dạy</div>
                          <div className="text-[10px] text-slate-500">Bao gồm bộ câu hỏi trắc nghiệm nhận thức (Bắt buộc)</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-blue-700 font-mono">
                        ~{sizeBreakdown?.contentSizeMb || 0.15} MB
                      </span>
                    </div>

                    {/* Slides */}
                    <div 
                      onClick={() => setSelectedModules(prev => ({ ...prev, slides: !prev.slides }))}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        selectedModules.slides ? 'border-blue-400 bg-blue-50/40 ring-1 ring-blue-200' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {selectedModules.slides ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                        <div>
                          <div className="text-xs font-bold text-slate-800">Slide bài giảng ({slides.length} slide)</div>
                          <div className="text-[10px] text-slate-500">Hình ảnh slide chất lượng cao phục vụ giảng dạy</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-700 font-mono">
                        ~{sizeBreakdown?.slideSizeMb || 0} MB
                      </span>
                    </div>

                    {/* Videos */}
                    <div 
                      onClick={() => setSelectedModules(prev => ({ ...prev, videos: !prev.videos }))}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        selectedModules.videos ? 'border-blue-400 bg-blue-50/40 ring-1 ring-blue-200' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {selectedModules.videos ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                        <div>
                          <div className="text-xs font-bold text-slate-800">Video tư liệu ({videos.length} video)</div>
                          <div className="text-[10px] text-slate-500">Phim tài liệu lịch sử truyền thống Vùng 4</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-700 font-mono">
                        ~{sizeBreakdown?.videoSizeMb || 0} MB
                      </span>
                    </div>

                    {/* Audios */}
                    <div 
                      onClick={() => setSelectedModules(prev => ({ ...prev, audios: !prev.audios }))}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                        selectedModules.audios ? 'border-blue-400 bg-blue-50/40 ring-1 ring-blue-200' : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        {selectedModules.audios ? (
                          <CheckSquare className="w-4 h-4 text-blue-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                        <div>
                          <div className="text-xs font-bold text-slate-800">Audio bài giảng ({audios.length} audio)</div>
                          <div className="text-[10px] text-slate-500">Giọng đọc lời Bác và phát thanh nội bộ</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-slate-700 font-mono">
                        ~{sizeBreakdown?.audioSizeMb || 0} MB
                      </span>
                    </div>
                  </div>

                  {/* Summary & Storage Calculation */}
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        Tổng dung lượng cần lưu: <span className="text-blue-700 font-mono text-sm">{computeSelectedSizeMb()} MB</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Dung lượng khả dụng trên thiết bị: <strong>3.4 GB</strong>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold">
                      Đủ bộ nhớ
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end space-x-3 pt-2">
                    <button
                      onClick={() => setIsDownloadModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      id="btn-confirm-start-download"
                      onClick={() => handleStartOfflineDownload(isUpdateAvailable || false)}
                      className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md flex items-center space-x-2 transition-all cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>Bắt đầu lưu Offline ({computeSelectedSizeMb()} MB)</span>
                    </button>
                  </div>
                </>
              ) : (
                /* DOWNLOADING STATE */
                <div className="py-6 space-y-5 text-center">
                  <div className="w-14 h-14 mx-auto rounded-full bg-blue-100 flex items-center justify-center text-blue-600 animate-pulse">
                    <Download className="w-7 h-7" />
                  </div>
                  
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-800">Đang lưu bài học về thiết bị...</h4>
                    <p className="text-xs text-slate-500 font-mono">{downloadStep}</p>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200">
                      <div 
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full rounded-full transition-all duration-300"
                        style={{ width: `${downloadProgress}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 font-bold">
                      <span>Tiến độ tải</span>
                      <span className="text-blue-600">{downloadProgress}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 2. DELETE OFFLINE CONFIRMATION DIALOG */}
      {/* ============================================================= */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <div className="text-center space-y-1">
              <h3 className="text-sm font-bold text-slate-900">Xóa bản offline khỏi thiết bị?</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hành động này sẽ giải phóng <strong>{offlineRecord?.sizeBreakdown.totalSizeMb} MB</strong> bộ nhớ trên điện thoại. Dữ liệu trên máy chủ hoàn toàn không bị ảnh hưởng.
              </p>
            </div>

            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Giữ lại
              </button>
              <button
                id="btn-confirm-delete-offline"
                onClick={handleDeleteOfflinePackage}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition-colors shadow-xs cursor-pointer"
              >
                Xóa khỏi thiết bị
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* 3. ANDROID OFFLINE STORAGE MANAGER HUB MODAL */}
      {/* ============================================================= */}
      {isOfflineManagerOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95">
            {/* Header */}
            <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Quản lý Dữ liệu Offline trên Thiết bị</h3>
                  <p className="text-xs text-slate-400">Danh sách các bài học đã được chiến sĩ chủ động lưu về máy</p>
                </div>
              </div>
              <button
                onClick={() => setIsOfflineManagerOpen(false)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Storage Meter */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-3 text-center">
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500">Bài học đã lưu</div>
                <div className="text-base font-bold text-slate-800 font-mono mt-0.5">
                  {allOfflineLessons.length} bài
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500">Dung lượng Offline chiếm dụng</div>
                <div className="text-base font-bold text-blue-600 font-mono mt-0.5">
                  {Math.round(allOfflineLessons.reduce((acc, cur) => acc + cur.sizeBreakdown.totalSizeMb, 0) * 10) / 10} MB
                </div>
              </div>
              <div className="bg-white p-3 rounded-xl border border-slate-200">
                <div className="text-[10px] text-slate-500">Bộ nhớ khả dụng</div>
                <div className="text-base font-bold text-emerald-600 font-mono mt-0.5">
                  3.4 GB
                </div>
              </div>
            </div>

            {/* List of Offline Packages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {allOfflineLessons.length === 0 ? (
                <div className="text-center py-10 text-slate-400 space-y-2">
                  <HardDrive className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="text-xs">Chưa có bài học nào được lưu offline trên thiết bị này.</p>
                  <p className="text-[10px] text-slate-400">Chọn "LƯU ĐỂ HỌC OFFLINE" trên từng bài học khi có mạng.</p>
                </div>
              ) : (
                allOfflineLessons.map((item) => (
                  <div key={item.lessonId} className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
                    <div className="space-y-1 max-w-md">
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                          v{item.localVersion}
                        </span>
                        <h4 className="text-xs font-bold text-slate-800 truncate">{item.lessonTitle}</h4>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center space-x-2">
                        <span>Chuyên đề: {item.courseTitle}</span>
                        <span>•</span>
                        <span className="font-mono">{item.sizeBreakdown.totalSizeMb} MB</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          setAllOfflineLessons(prev => prev.filter(p => p.lessonId !== item.lessonId));
                          if (item.lessonId === lesson.id) setOfflineRecord(null);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="Xóa bản offline này"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {allOfflineLessons.length > 0 && (
                <button
                  onClick={() => {
                    setAllOfflineLessons([]);
                    setOfflineRecord(null);
                  }}
                  className="text-xs font-bold text-red-600 hover:text-red-700 cursor-pointer"
                >
                  Xóa tất cả bản offline
                </button>
              )}
              <button
                onClick={() => setIsOfflineManagerOpen(false)}
                className="ml-auto px-4 py-2 rounded-xl bg-slate-800 text-white text-xs font-bold cursor-pointer"
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
