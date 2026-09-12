import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Radio, 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  RotateCw, 
  Upload, 
  Plus, 
  Trash2, 
  Edit3, 
  Download, 
  Search, 
  Filter, 
  Clock, 
  Calendar, 
  Mic, 
  Users, 
  Headphones, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Smartphone, 
  RefreshCw,
  Sliders,
  ChevronRight,
  Sparkles,
  Layers,
  FileAudio,
  Repeat,
  RadioTower
} from 'lucide-react';
import { RadioBroadcast, RadioCategory, Unit, User } from '../types';
import { api } from '../services/api';
import { DongSonDrum } from '../components/DongSonMotif';

interface RadioBroadcastViewProps {
  units?: Unit[];
  currentUser?: User;
}

const CATEGORY_MAP: Record<RadioCategory, { label: string; badgeColor: string; icon: string }> = {
  BAN_TIN_THOI_SU: {
    label: 'Bản tin Thời sự Vùng',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: '📢'
  },
  LOI_BAC_DAY: {
    label: 'Lời Bác dạy ngày này năm xưa',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: '🌟'
  },
  PHAP_LUAT_KY_LUAT: {
    label: 'Pháp luật & Kỷ luật Quân đội',
    badgeColor: 'bg-rose-50 text-rose-700 border-rose-200',
    icon: '⚖️'
  },
  TIENG_NOI_CHIEN_SI: {
    label: 'Tiếng nói Chiến sĩ',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    icon: '⚓'
  },
  VAN_HOA_VAN_NGHE: {
    label: 'Văn hóa - Văn nghệ',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: '🎵'
  },
  CHUYEN_MUC: {
    label: 'Chuyên mục & Nghiệp vụ',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    icon: '📚'
  }
};

export const RadioBroadcastView: React.FC<RadioBroadcastViewProps> = ({ units = [], currentUser }) => {
  // Main Data States
  const [broadcasts, setBroadcasts] = useState<RadioBroadcast[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');

  // Audio Player State
  const [currentPlayingItem, setCurrentPlayingItem] = useState<RadioBroadcast | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<RadioBroadcast | null>(null);
  const [itemToDelete, setItemToDelete] = useState<RadioBroadcast | null>(null);
  const [isMobilePreviewOpen, setIsMobilePreviewOpen] = useState<boolean>(false);
  const [previewingItem, setPreviewingItem] = useState<RadioBroadcast | null>(null);

  // Form State
  const [formTitle, setFormTitle] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formCategory, setFormCategory] = useState<RadioCategory>('BAN_TIN_THOI_SU');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formBroadcaster, setFormBroadcaster] = useState<string>('Ban Tuyên huấn Vùng 4');
  const [formVoiceReader, setFormVoiceReader] = useState<string>('');
  const [formTargetUnit, setFormTargetUnit] = useState<string>('Toàn Vùng');
  const [formStatus, setFormStatus] = useState<'PUBLISHED' | 'DRAFT'>('PUBLISHED');
  const [formAudioUrl, setFormAudioUrl] = useState<string>('');
  const [formDurationSeconds, setFormDurationSeconds] = useState<number>(0);
  const [formDurationFormatted, setFormDurationFormatted] = useState<string>('00:00');
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isUploadingAudio, setIsUploadingAudio] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Load Data
  const loadData = async () => {
    try {
      setIsLoading(true);
      const data = await api.getRadioBroadcasts();
      setBroadcasts(data);
    } catch (err) {
      console.error('Error fetching radio broadcasts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen realtime updates
    const unsubscribe = api.listenRadioBroadcasts((updatedList) => {
      setBroadcasts(updatedList);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Handle Play/Pause
  const handleTogglePlay = (item: RadioBroadcast) => {
    if (currentPlayingItem?.id === item.id) {
      if (isPlaying) {
        audioRef.current?.pause();
        setIsPlaying(false);
      } else {
        audioRef.current?.play();
        setIsPlaying(true);
      }
    } else {
      setCurrentPlayingItem(item);
      setCurrentTime(0);
      setIsPlaying(true);
      // Increment play count
      api.incrementRadioPlayCount(item.id);
    }
  };

  // Audio element events
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => {
          console.warn('Audio play prevented:', e);
          setIsPlaying(false);
        });
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentPlayingItem]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.loop = isLooping;
    }
  }, [volume, isMuted, playbackSpeed, isLooping]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (!isNaN(audioRef.current.duration) && audioRef.current.duration > 0) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && !isNaN(audioRef.current.duration)) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (newTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const handleSkip = (seconds: number) => {
    if (audioRef.current) {
      const target = Math.max(0, Math.min(audioRef.current.currentTime + seconds, duration));
      audioRef.current.currentTime = target;
      setCurrentTime(target);
    }
  };

  // Modal Open Handlers
  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('BAN_TIN_THOI_SU');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormBroadcaster(currentUser?.unit || 'Ban Tuyên huấn Vùng 4');
    setFormVoiceReader(currentUser?.rankAndPosition || '');
    setFormTargetUnit('Toàn Vùng');
    setFormStatus('PUBLISHED');
    setFormAudioUrl('');
    setFormDurationSeconds(0);
    setFormDurationFormatted('00:00');
    setAudioFile(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: RadioBroadcast) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormDescription(item.description || '');
    setFormCategory(item.category);
    setFormDate(item.broadcastDate);
    setFormBroadcaster(item.broadcaster || 'Ban Tuyên huấn Vùng 4');
    setFormVoiceReader(item.voiceReader || '');
    setFormTargetUnit(item.targetUnit || 'Toàn Vùng');
    setFormStatus(item.status as any || 'PUBLISHED');
    setFormAudioUrl(item.audioUrl);
    setFormDurationSeconds(item.durationSeconds || 0);
    setFormDurationFormatted(item.durationFormatted || formatTime(item.durationSeconds || 0));
    setAudioFile(null);
    setFormError(null);
    setIsModalOpen(true);
  };

  // File Upload Handling
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check audio type
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|aac|ogg|wma)$/i)) {
      setFormError('Vui lòng chọn tệp âm thanh hợp lệ (.mp3, .wav, .m4a, .aac, .ogg)');
      return;
    }

    setAudioFile(file);
    setFormError(null);

    // Measure duration client-side
    try {
      const objectUrl = URL.createObjectURL(file);
      const tempAudio = new Audio(objectUrl);
      tempAudio.addEventListener('loadedmetadata', () => {
        const sec = Math.round(tempAudio.duration);
        setFormDurationSeconds(sec);
        setFormDurationFormatted(formatTime(sec));
        URL.revokeObjectURL(objectUrl);
      });
    } catch {}

    // Auto set title if empty
    if (!formTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_\\-]/g, ' ');
      setFormTitle(cleanName);
    }
  };

  // Submit Save
  const handleSaveBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError('Vui lòng nhập tên chương trình / bản tin truyền thanh');
      return;
    }

    if (!formAudioUrl && !audioFile) {
      setFormError('Vui lòng tải lên tệp âm thanh hoặc dán đường dẫn tệp audio');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);

      let finalAudioUrl = formAudioUrl;
      let finalPublicId = editingItem?.cloudinaryPublicId || '';
      let finalFileSizeMb = editingItem?.fileSizeMb || 0;

      // If new file is chosen, upload to storage
      if (audioFile) {
        setIsUploadingAudio(true);
        setUploadProgress(25);
        const uploadRes = await api.uploadRadioAudioFile(audioFile);
        setUploadProgress(100);
        finalAudioUrl = uploadRes.secureUrl;
        finalPublicId = uploadRes.publicId;
        finalFileSizeMb = Math.round((uploadRes.bytes / (1024 * 1024)) * 100) / 100;
      }

      const payload: Partial<RadioBroadcast> = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        category: formCategory,
        categoryLabel: CATEGORY_MAP[formCategory]?.label || 'Bản tin Truyền thanh',
        audioUrl: finalAudioUrl,
        cloudinaryPublicId: finalPublicId,
        fileSizeMb: finalFileSizeMb,
        durationSeconds: formDurationSeconds,
        durationFormatted: formDurationFormatted || formatTime(formDurationSeconds),
        broadcastDate: formDate,
        broadcaster: formBroadcaster.trim() || 'Ban Tuyên huấn Vùng 4',
        voiceReader: formVoiceReader.trim(),
        targetUnit: formTargetUnit,
        status: formStatus
      };

      if (editingItem) {
        await api.updateRadioBroadcast(editingItem.id, payload);
      } else {
        await api.createRadioBroadcast(payload);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      console.error('Error saving broadcast:', err);
      setFormError(err.message || 'Lỗi khi lưu bản tin truyền thanh. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
      setIsUploadingAudio(false);
      setUploadProgress(0);
    }
  };

  // Delete Handler
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    try {
      await api.deleteRadioBroadcast(itemToDelete.id);
      if (currentPlayingItem?.id === itemToDelete.id) {
        setIsPlaying(false);
        setCurrentPlayingItem(null);
      }
      setItemToDelete(null);
      await loadData();
    } catch (err) {
      console.error('Error deleting broadcast:', err);
    }
  };

  // Filtered List
  const filteredBroadcasts = useMemo(() => {
    return broadcasts.filter(b => {
      const matchQuery = !searchQuery.trim() || 
        b.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.description && b.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.broadcaster && b.broadcaster.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (b.voiceReader && b.voiceReader.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCat = selectedCategory === 'ALL' || b.category === selectedCategory;
      const matchStat = selectedStatus === 'ALL' || b.status === selectedStatus;
      const matchTarget = selectedUnit === 'ALL' || b.targetUnit === selectedUnit || b.targetUnit === 'Toàn Vùng';

      return matchQuery && matchCat && matchStat && matchTarget;
    });
  }, [broadcasts, searchQuery, selectedCategory, selectedStatus, selectedUnit]);

  return (
    <div className="min-h-full flex flex-col bg-slate-50 text-slate-800 pb-36">
      {/* Hidden Global Audio Element */}
      <audio
        ref={audioRef}
        src={currentPlayingItem?.audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      {/* Military Broadcast Hero Header */}
      <div className="bg-gradient-to-r from-[#0B1E3B] via-[#0E284F] to-[#08182F] text-white p-6 md:p-8 relative overflow-hidden shadow-md border-b border-slate-700/60">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 pointer-events-none opacity-10">
          <DongSonDrum className="w-96 h-96" color="#F59E0B" opacity={1} />
        </div>

        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                TRUYỀN THANH NỘI BỘ
              </h1>
              <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
                Kênh phát thanh chính trị, thông tin thời sự, gương sáng chiến sĩ, phổ biến pháp luật quân sự và giáo dục truyền thống cách mạng đến từng cán bộ, chiến sĩ, tàu chiến, đảo xa.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                id="btn-refresh-radio"
                onClick={async () => {
                  setIsRefreshing(true);
                  await loadData();
                  setTimeout(() => setIsRefreshing(false), 500);
                }}
                disabled={isRefreshing}
                className="px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 flex items-center space-x-2 transition-all"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Làm mới</span>
              </button>

              <button
                id="btn-create-radio-broadcast"
                onClick={handleOpenCreateModal}
                className="px-5 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center space-x-2 transition-all transform active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>ĐĂNG BẢN TIN MỚI</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Controls: Search, Category Filters, Status */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="input-search-broadcast"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm bản tin theo tiêu đề, ban biên tập, giọng đọc, nội dung..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Trạng thái:</span>
              <select
                id="select-status-filter"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Tất cả ({broadcasts.length})</option>
                <option value="PUBLISHED">Đã phát sóng</option>
                <option value="DRAFT">Bản nháp</option>
              </select>
            </div>

            {/* Target Unit Filter */}
            <div className="flex items-center space-x-2 shrink-0">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Đơn vị:</span>
              <select
                id="select-unit-filter"
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-[180px] truncate"
              >
                <option value="ALL">Toàn Vùng / Tất cả</option>
                {units.map(u => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category Pills Bar */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs select-none scrollbar-none">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'ALL'
                  ? 'bg-[#0B1E3B] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả chuyên mục ({broadcasts.length})
            </button>
            {(Object.keys(CATEGORY_MAP) as RadioCategory[]).map(catKey => {
              const meta = CATEGORY_MAP[catKey];
              const count = broadcasts.filter(b => b.category === catKey).length;
              return (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey)}
                  className={`px-3 py-1.5 rounded-xl font-medium transition-all whitespace-nowrap flex items-center space-x-1.5 ${
                    selectedCategory === catKey
                      ? 'bg-blue-600 text-white font-bold shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{meta.icon}</span>
                  <span>{meta.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${selectedCategory === catKey ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Broadcasts List */}
        {isLoading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-600">Đang tải danh sách bản tin truyền thanh...</p>
          </div>
        ) : filteredBroadcasts.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <Radio className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800">Không tìm thấy bản tin truyền thanh phù hợp</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Thử thay đổi bộ lọc tìm kiếm hoặc tạo thêm bản tin phát thanh mới cho Vùng 4 Hải quân.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Đăng bản tin mới</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredBroadcasts.map((item) => {
              const isCurrentPlaying = currentPlayingItem?.id === item.id && isPlaying;
              const catMeta = CATEGORY_MAP[item.category] || CATEGORY_MAP.BAN_TIN_THOI_SU;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl border transition-all duration-200 p-5 flex flex-col justify-between group relative overflow-hidden shadow-sm hover:shadow-md ${
                    isCurrentPlaying 
                      ? 'border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {/* Top: Category Badge, Date, Status */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${catMeta.badgeColor}`}>
                        <span className="mr-1">{catMeta.icon}</span>
                        <span>{catMeta.label}</span>
                      </span>

                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-slate-500 font-medium flex items-center space-x-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{item.broadcastDate}</span>
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            item.status === 'PUBLISHED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.status === 'PUBLISHED' ? 'Đã phát' : 'Nháp'}
                        </span>
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug mb-2">
                      {item.title}
                    </h3>

                    {/* Description */}
                    {item.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
                        {item.description}
                      </p>
                    )}

                    {/* Metadata chips */}
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-500 mb-4">
                      <span className="inline-flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-md font-medium text-slate-700">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{item.durationFormatted || formatTime(item.durationSeconds)}</span>
                      </span>

                      {item.broadcaster && (
                        <span className="inline-flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-md font-medium text-slate-700">
                          <Radio className="w-3 h-3 text-blue-600" />
                          <span className="truncate max-w-[180px]">{item.broadcaster}</span>
                        </span>
                      )}

                      {item.voiceReader && (
                        <span className="inline-flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-md font-medium text-slate-700">
                          <Mic className="w-3 h-3 text-amber-600" />
                          <span className="truncate max-w-[140px]">{item.voiceReader}</span>
                        </span>
                      )}

                      <span className="inline-flex items-center space-x-1 bg-slate-100 px-2 py-1 rounded-md font-medium text-slate-700">
                        <Headphones className="w-3 h-3 text-purple-600" />
                        <span>{item.playCount || 0} lượt nghe</span>
                      </span>
                    </div>
                  </div>

                  {/* Bottom: Play Button & Action Tools */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                    {/* Big Audio Play/Pause trigger */}
                    <button
                      id={`btn-play-radio-${item.id}`}
                      onClick={() => handleTogglePlay(item)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                        isCurrentPlaying
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
                          : 'bg-slate-900 hover:bg-blue-600 text-white'
                      }`}
                    >
                      {isCurrentPlaying ? (
                        <>
                          <Pause className="w-4 h-4 fill-white" />
                          <span>TẠM DỪNG</span>
                          {/* Animated Waveform Bars */}
                          <span className="flex items-end space-x-0.5 h-3 ml-1">
                            <span className="w-0.5 h-full bg-white animate-pulse"></span>
                            <span className="w-0.5 h-2/3 bg-white animate-bounce"></span>
                            <span className="w-0.5 h-full bg-white animate-pulse delay-75"></span>
                          </span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 fill-white" />
                          <span>NGHE PHÁT THANH</span>
                        </>
                      )}
                    </button>

                    {/* Action tools: Mobile App Simulator, Edit, Download, Delete */}
                    <div className="flex items-center space-x-1">
                      <button
                        title="Mô phỏng nghe trên App di động"
                        onClick={() => {
                          setPreviewingItem(item);
                          setIsMobilePreviewOpen(true);
                        }}
                        className="p-2 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Smartphone className="w-4 h-4" />
                      </button>

                      <a
                        href={item.audioUrl}
                        download={`${item.title}.mp3`}
                        target="_blank"
                        rel="noreferrer"
                        title="Tải tệp âm thanh MP3"
                        className="p-2 rounded-lg text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>

                      <button
                        title="Chỉnh sửa thông tin bản tin"
                        onClick={() => handleOpenEditModal(item)}
                        className="p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        title="Xóa bản tin truyền thanh"
                        onClick={() => setItemToDelete(item)}
                        className="p-2 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modern Sticky Audio Player (Fixed Bottom) */}
      {currentPlayingItem && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0B1E3B] text-white border-t border-slate-700/80 shadow-2xl backdrop-blur-md px-4 py-3 md:px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 md:gap-6">
            {/* Left: Info */}
            <div className="flex items-center space-x-3 w-full md:w-1/3 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center shrink-0 text-amber-400 relative overflow-hidden">
                <Radio className={`w-6 h-6 ${isPlaying ? 'animate-bounce' : ''}`} />
                {isPlaying && (
                  <span className="absolute inset-0 bg-blue-500/10 animate-ping rounded-xl pointer-events-none"></span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20">
                    {CATEGORY_MAP[currentPlayingItem.category]?.label || 'Truyền thanh'}
                  </span>
                  <span className="text-[11px] text-slate-400 truncate">{currentPlayingItem.broadcaster}</span>
                </div>
                <h4 className="text-xs font-bold text-white truncate mt-0.5">
                  {currentPlayingItem.title}
                </h4>
              </div>
            </div>

            {/* Middle: Controls & Scrubber */}
            <div className="flex-1 w-full max-w-xl flex flex-col items-center space-y-1.5">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleSkip(-10)}
                  title="Tua lùi 10 giây"
                  className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="w-10 h-10 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg transition-transform active:scale-95"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-slate-950" />
                  ) : (
                    <Play className="w-5 h-5 fill-slate-950 translate-x-0.5" />
                  )}
                </button>

                <button
                  onClick={() => handleSkip(10)}
                  title="Tua tới 10 giây"
                  className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => setIsLooping(!isLooping)}
                  title="Lặp lại bản tin"
                  className={`p-1.5 rounded-full transition-colors ${
                    isLooping ? 'text-amber-400 bg-white/10' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Repeat className="w-4 h-4" />
                </button>

                {/* Playback speed toggle */}
                <button
                  onClick={() => {
                    const speeds = [1, 1.25, 1.5, 2];
                    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                    setPlaybackSpeed(speeds[nextIdx]);
                  }}
                  className="text-[11px] font-bold text-slate-300 hover:text-white px-2 py-0.5 rounded bg-white/10 border border-white/10"
                >
                  {playbackSpeed}x
                </button>
              </div>

              {/* Progress Seekbar */}
              <div className="w-full flex items-center space-x-2 text-[11px] font-mono text-slate-400">
                <span>{formatTime(currentTime)}</span>
                <input
                  type="range"
                  min={0}
                  max={duration || currentPlayingItem.durationSeconds || 100}
                  value={currentTime}
                  onChange={(e) => handleSeek(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <span>{formatTime(duration || currentPlayingItem.durationSeconds || 0)}</span>
              </div>
            </div>

            {/* Right: Volume & Close */}
            <div className="hidden md:flex items-center space-x-3 w-1/4 justify-end">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-slate-400 hover:text-white"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }}
                className="w-20 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-400"
              />
              <button
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentPlayingItem(null);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 ml-2"
                title="Đóng trình phát"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT BROADCAST MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Radio className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingItem ? 'CHỈNH SỬA BẢN TIN TRUYỀN THANH' : 'ĐĂNG BẢN TIN TRUYỀN THANH NỘI BỘ MỚI'}
                  </h3>
                  <p className="text-xs text-slate-500">Phát sóng audio tuyên truyền, giáo dục chính trị Vùng 4 Hải quân</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBroadcast} className="space-y-4 mt-4">
              {formError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tên bản tin / Chương trình phát thanh *
                </label>
                <input
                  id="input-broadcast-title"
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Ví dụ: Bản tin Truyền thanh Vùng 4 - Số phát sóng 15 tháng 9"
                  className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                />
              </div>

              {/* Category & Broadcast Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Chuyên mục phát thanh *
                  </label>
                  <select
                    id="select-broadcast-category"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as RadioCategory)}
                    className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  >
                    {(Object.keys(CATEGORY_MAP) as RadioCategory[]).map(catKey => (
                      <option key={catKey} value={catKey}>
                        {CATEGORY_MAP[catKey].icon} {CATEGORY_MAP[catKey].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Ngày phát thanh *
                  </label>
                  <input
                    id="input-broadcast-date"
                    type="date"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* Broadcaster & Voice Reader */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Cơ quan / Ban biên tập
                  </label>
                  <input
                    type="text"
                    value={formBroadcaster}
                    onChange={(e) => setFormBroadcaster(e.target.value)}
                    placeholder="Ví dụ: Ban Tuyên huấn Vùng 4"
                    className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Phát thanh viên / Giọng đọc
                  </label>
                  <input
                    type="text"
                    value={formVoiceReader}
                    onChange={(e) => setFormVoiceReader(e.target.value)}
                    placeholder="Ví dụ: Đại úy Nguyễn Văn Hưng - BTV Thu Hà"
                    className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  />
                </div>
              </div>

              {/* Target Unit & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Đối tượng tiếp sóng
                  </label>
                  <select
                    value={formTargetUnit}
                    onChange={(e) => setFormTargetUnit(e.target.value)}
                    className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  >
                    <option value="Toàn Vùng">Toàn Vùng (Tất cả đơn vị)</option>
                    {units.map(u => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Trạng thái phát hành
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as any)}
                    className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
                  >
                    <option value="PUBLISHED">Đã phát sóng (Hiển thị ngay trên App)</option>
                    <option value="DRAFT">Lưu bản nháp (Chưa phát)</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tóm tắt nội dung chính của bản tin
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Ghi nhanh các tin chính, chuyên mục, gương sáng chiến sĩ xuất hiện trong số phát thanh này..."
                  className="w-full text-sm px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium resize-none"
                />
              </div>

              {/* Audio Upload Box */}
              <div className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-2xl p-4 bg-slate-50/60 transition-colors">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Tệp âm thanh phát thanh (.mp3, .wav, .m4a, .aac) *</span>
                  {formDurationSeconds > 0 && (
                    <span className="text-blue-600 font-mono">Thời lượng: {formDurationFormatted}</span>
                  )}
                </label>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <label className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 hover:border-blue-400 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center space-x-2 cursor-pointer shadow-xs transition-all hover:bg-blue-50">
                    <Upload className="w-4 h-4 text-blue-600" />
                    <span>Chọn tệp Audio từ máy tính</span>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  <span className="text-xs text-slate-400">hoặc</span>

                  <input
                    type="url"
                    value={formAudioUrl}
                    onChange={(e) => {
                      setFormAudioUrl(e.target.value);
                      setAudioFile(null);
                    }}
                    placeholder="Dán đường dẫn trực tiếp (URL MP3)"
                    className="flex-1 w-full text-xs px-3 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {audioFile && (
                  <div className="mt-3 flex items-center justify-between p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-xs">
                    <div className="flex items-center space-x-2 min-w-0">
                      <FileAudio className="w-4 h-4 text-blue-600 shrink-0" />
                      <span className="font-semibold text-slate-800 truncate">{audioFile.name}</span>
                      <span className="text-slate-500 font-mono">({Math.round(audioFile.size / 1024)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAudioFile(null);
                        setFormDurationSeconds(0);
                        setFormDurationFormatted('00:00');
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {isUploadingAudio && (
                  <div className="mt-3 space-y-1">
                    <div className="flex justify-between text-[11px] text-blue-700 font-bold">
                      <span>Đang tải lên máy chủ Cloudinary...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-blue-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 flex items-center space-x-2"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>ĐANG LƯU BẢN TIN...</span>
                    </>
                  ) : (
                    <span>{editingItem ? 'CẬP NHẬT BẢN TIN' : 'PHÁT SÓNG BẢN TIN'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {itemToDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">Xác nhận xóa bản tin truyền thanh?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Bạn có chắc chắn muốn xóa bản tin <span className="font-bold text-slate-700">"{itemToDelete.title}"</span>? Thao tác này sẽ gỡ bản tin khỏi ứng dụng của các đơn vị.
              </p>
            </div>

            <div className="flex items-center space-x-3 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20"
              >
                Xác nhận xóa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MOBILE APP SIMULATOR MODAL */}
      {isMobilePreviewOpen && previewingItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative bg-slate-900 rounded-[44px] p-4 border-4 border-slate-700 shadow-2xl max-w-sm w-full">
            {/* Mobile screen notch */}
            <div className="w-32 h-5 bg-black rounded-b-2xl mx-auto mb-3 flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-slate-800"></span>
            </div>

            {/* Mobile inner screen */}
            <div className="bg-[#0B1E3B] text-white rounded-[32px] p-5 flex flex-col justify-between h-[580px] overflow-hidden relative border border-slate-700/60">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-[11px] font-bold text-amber-400 flex items-center space-x-1">
                  <Radio className="w-3.5 h-3.5 animate-pulse" />
                  <span>TRUYỀN THANH VÙNG 4</span>
                </span>
                <button
                  onClick={() => setIsMobilePreviewOpen(false)}
                  className="text-slate-400 hover:text-white text-xs p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Center: Vinyl / Radio Visualizer */}
              <div className="flex-1 flex flex-col items-center justify-center py-4 space-y-4">
                <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-amber-600 to-blue-700 p-1.5 shadow-xl flex items-center justify-center relative">
                  <div className="w-full h-full rounded-full bg-[#0E284F] flex items-center justify-center border-2 border-white/20">
                    <DongSonDrum className="w-24 h-24 opacity-30" color="#F59E0B" />
                    <RadioTower className="w-10 h-10 text-amber-400 absolute" />
                  </div>
                </div>

                <div className="text-center px-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30">
                    {CATEGORY_MAP[previewingItem.category]?.label || 'Truyền thanh'}
                  </span>
                  <h4 className="text-sm font-bold text-white mt-2 line-clamp-2">
                    {previewingItem.title}
                  </h4>
                  <p className="text-[11px] text-slate-300 mt-1">
                    {previewingItem.broadcaster} • {previewingItem.broadcastDate}
                  </p>
                </div>
              </div>

              {/* Bottom: Mobile Controls */}
              <div className="bg-white/5 backdrop-blur-md rounded-2xl p-3 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>00:00</span>
                  <span>{previewingItem.durationFormatted || formatTime(previewingItem.durationSeconds)}</span>
                </div>
                <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 w-1/3"></div>
                </div>

                <div className="flex items-center justify-center space-x-6 pt-1">
                  <button 
                    onClick={() => handleTogglePlay(previewingItem)}
                    className="w-12 h-12 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-lg"
                  >
                    {currentPlayingItem?.id === previewingItem.id && isPlaying ? (
                      <Pause className="w-5 h-5 fill-slate-950" />
                    ) : (
                      <Play className="w-5 h-5 fill-slate-950 translate-x-0.5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
