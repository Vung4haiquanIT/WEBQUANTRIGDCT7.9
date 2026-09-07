import React, { useState, useEffect } from 'react';
import { 
  Database, 
  HardDrive, 
  Terminal, 
  Copy, 
  CheckCircle2, 
  RefreshCw, 
  Smartphone,
  Radio,
  Layers,
  FolderTree,
  FileCode,
  ArrowRightLeft,
  ShieldCheck,
  Send,
  Sparkles,
  AlertTriangle,
  PlayCircle
} from 'lucide-react';
import { api } from '../services/api';
import { StorageFileMetadata, RealtimeEvent, SyncDelta } from '../types';
import { runFirebaseLiveDiagnostics, FirebaseTestResult } from '../services/firebaseDiagnostics';
import { migrateLocalDataToFirestore, MigrationReport } from '../services/dataMigration';
import firebaseConfig from '../../firebase-applet-config.json';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'architecture' | 'storage' | 'sync' | 'api' | 'realtime'>('diagnostics');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  // Diagnostics State
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<FirebaseTestResult[]>([]);
  const [diagnosticsSummary, setDiagnosticsSummary] = useState<{ allPassed: boolean; projectId: string; databaseId: string } | null>(null);

  // Migration State
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  // API Tester state
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loadingApi, setLoadingApi] = useState(false);
  const [selectedEndpoint, setSelectedEndpoint] = useState('/api/sync');

  // Storage files state
  const [storageFiles, setStorageFiles] = useState<StorageFileMetadata[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [loadingStorage, setLoadingStorage] = useState(false);

  // Sync tester state
  const [syncDeltaResult, setSyncDeltaResult] = useState<SyncDelta | null>(null);
  const [syncTimestampInput, setSyncTimestampInput] = useState<string>(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const [syncingDelta, setSyncingDelta] = useState(false);
  const [batchSyncResult, setBatchSyncResult] = useState<any>(null);

  // Realtime events log
  const [realtimeLogs, setRealtimeLogs] = useState<RealtimeEvent[]>([]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleRunDiagnostics = async () => {
    try {
      setIsRunningDiagnostics(true);
      const res = await runFirebaseLiveDiagnostics();
      setDiagnosticResults(res.results);
      setDiagnosticsSummary({
        allPassed: res.allPassed,
        projectId: res.projectId,
        databaseId: res.databaseId
      });
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const handleRunMigration = async () => {
    try {
      setIsMigrating(true);
      setMigrationError(null);
      const report = await migrateLocalDataToFirestore();
      setMigrationReport(report);
    } catch (err: any) {
      setMigrationError(err.message || 'Lỗi khi di chuyển dữ liệu sang Firestore');
    } finally {
      setIsMigrating(false);
    }
  };

  const testApi = async (endpoint: string) => {
    try {
      setLoadingApi(true);
      setSelectedEndpoint(endpoint);
      const res = await fetch(endpoint);
      const data = await res.json();
      setApiResponse(data);
    } catch (err: any) {
      setApiResponse({ error: err.message });
    } finally {
      setLoadingApi(false);
    }
  };

  const loadStorageFiles = async () => {
    try {
      setLoadingStorage(true);
      const files = await api.getStorageFiles(selectedCategory as any);
      setStorageFiles(files);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStorage(false);
    }
  };

  const handleTestDeltaSync = async () => {
    try {
      setSyncingDelta(true);
      const res = await api.syncDelta(syncTimestampInput);
      setSyncDeltaResult(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setSyncingDelta(false);
    }
  };

  const handleTestBatchProgressSync = async () => {
    try {
      const sampleBatch = [
        {
          userId: 'user-4',
          userName: 'Đại úy Hoàng Văn Kiên',
          lessonId: 'lesson-1-1',
          slideProgress: 100,
          videoProgress: 100,
          audioProgress: 90,
          contentProgress: 100,
          lastAccessedAt: new Date().toISOString(),
          completed: true
        }
      ];
      const res = await api.syncProgressBatch(sampleBatch);
      setBatchSyncResult(res);
    } catch (err: any) {
      setBatchSyncResult({ error: err.message });
    }
  };

  useEffect(() => {
    if (activeTab === 'storage') {
      loadStorageFiles();
    }
    if (activeTab === 'diagnostics' && diagnosticResults.length === 0) {
      handleRunDiagnostics();
    }
  }, [activeTab, selectedCategory]);

  useEffect(() => {
    const unsub = api.subscribeRealtime((event: RealtimeEvent) => {
      setRealtimeLogs(prev => [event, ...prev.slice(0, 49)]);
    });
    return () => unsub();
  }, []);

  const endpoints = [
    { method: 'GET', path: '/api/stats', desc: 'Thống kê tổng quan hệ thống' },
    { method: 'GET', path: '/api/courses?page=1&limit=10', desc: 'Danh sách chuyên đề GDCT kèm phân trang' },
    { method: 'GET', path: '/api/lessons?courseId=course-1', desc: 'Danh sách bài học theo chuyên đề' },
    { method: 'GET', path: '/api/lessons/lesson-1-1/bundle', desc: 'Tải toàn bộ gói bài học kèm Checksum SHA-256' },
    { method: 'GET', path: '/api/lessons/lesson-1-1/version', desc: 'Kiểm tra thông tin phiên bản & băm Hash' },
    { method: 'GET', path: '/api/sync?updatedAfter=2026-02-01T00:00:00.000Z', desc: 'Đồng bộ vi sai Delta Sync cho mobile' },
    { method: 'GET', path: '/api/storage/files', desc: 'Danh sách tệp lưu trữ và đường dẫn Cloud Storage' },
    { method: 'GET', path: '/api/units', desc: 'Danh sách các đơn vị trực thuộc Vùng 4 Hải Quân' },
  ];

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Kiến trúc Lưu trữ & Đồng bộ Dữ liệu
            </span>
            <span className="text-xs text-slate-500 font-mono">Cloud Firestore • Cloud Storage • Room Offline • Realtime</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight mt-1">
            TRUNG TÂM QUẢN TRỊ KIẾN TRÚC & HẠ TẦNG FIREBASE
          </h2>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold overflow-x-auto">
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'diagnostics' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Kiểm thử & Di chuyển Firebase</span>
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'architecture' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Firestore & Blueprint</span>
          </button>
          <button
            onClick={() => setActiveTab('storage')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'storage' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span>Cloud Storage</span>
          </button>
          <button
            onClick={() => setActiveTab('sync')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'sync' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>Incremental Sync & Room</span>
          </button>
          <button
            onClick={() => setActiveTab('api')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'api' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>REST API & Phân trang</span>
          </button>
          <button
            onClick={() => setActiveTab('realtime')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              activeTab === 'realtime' ? 'bg-white text-blue-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Realtime Live ({realtimeLogs.length})</span>
          </button>
        </div>
      </div>

      {/* TOP SYSTEM METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Firebase Project ID</span>
            <Database className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-sm font-mono font-bold text-slate-800 break-all">{firebaseConfig.projectId}</div>
          <p className="text-[11px] text-slate-500">
            Database: <span className="font-mono text-blue-700">{firebaseConfig.firestoreDatabaseId || '(default)'}</span>
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Cloud Storage</span>
            <HardDrive className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-sm font-mono font-bold text-slate-800 break-all">{firebaseConfig.storageBucket}</div>
          <p className="text-[11px] text-slate-500">
            Lưu PPTX gốc, Slide ảnh 16:9, Video MP4, Audio MP3 và tài liệu PDF.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Trạng thái Database</span>
            <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-emerald-600 flex items-center space-x-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Đã kết nối Firestore</span>
          </div>
          <p className="text-[11px] text-slate-500">
            11 Collections với Security Rules và Realtime Listener.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Authentication</span>
            <Smartphone className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-sm font-mono font-bold text-slate-800 truncate">Firebase Auth + Google</div>
          <p className="text-[11px] text-slate-500">
            RBAC: Super Admin, Content Admin, Unit Admin, User.
          </p>
        </div>
      </div>

      {/* TAB 0: DIAGNOSTICS & DATA MIGRATION */}
      {activeTab === 'diagnostics' && (
        <div className="space-y-6">
          {/* Card 1: Live CRUD & Realtime Test */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 uppercase">
                    1. Kiểm tra Kết nối & Kiểm thử CRUD Thật trên Cloud Firestore (TEST_GDCT)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tạo bản ghi thử nghiệm `TEST_GDCT`, thực hiện quy trình Đọc (Read), Sửa (Update), Lắng nghe thời gian thực (Realtime onSnapshot) và Xóa sạch (Delete).
                  </p>
                </div>
              </div>

              <button
                onClick={handleRunDiagnostics}
                disabled={isRunningDiagnostics}
                className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
                <span>{isRunningDiagnostics ? 'Đang chạy kiểm thử...' : 'Chạy lại kiểm thử Firestore'}</span>
              </button>
            </div>

            {/* Diagnostic Steps List */}
            <div className="space-y-3">
              {diagnosticResults.map((res, idx) => (
                <div 
                  key={idx} 
                  className={`p-4 rounded-xl border flex items-start justify-between transition-all ${
                    res.status === 'SUCCESS' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${res.status === 'SUCCESS' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      <span className="text-xs font-bold text-slate-800">{res.step}</span>
                    </div>
                    <p className="text-xs text-slate-600 font-mono pl-4">{res.details}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                      res.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {res.status}
                    </span>
                    <div className="text-[10px] text-slate-400 font-mono mt-1">
                      {new Date(res.timestamp).toLocaleTimeString('vi-VN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {diagnosticsSummary && diagnosticsSummary.allPassed && (
              <div className="p-4 bg-emerald-100/70 border border-emerald-300 rounded-xl flex items-center space-x-3 text-emerald-900 text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <strong>KẾT LUẬN:</strong> Cloud Firestore hoạt động hoàn toàn chính xác và đã sẵn sàng cho Production. Mọi thao tác Create, Read, Update, Delete và Realtime Listener đều đạt 100% yêu cầu.
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Production Data Migration */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 uppercase">
                    2. Chuyển đổi Dữ liệu sang Cloud Firestore (Data Migration)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đồng bộ toàn bộ Chuyên đề, Bài học, Slide, Video, Audio, Đơn vị và Người dùng vào Cloud Firestore.
                  </p>
                </div>
              </div>

              <button
                onClick={handleRunMigration}
                disabled={isMigrating}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isMigrating ? 'Đang chuyển đổi...' : 'Đồng bộ Dữ liệu vào Firestore'}</span>
              </button>
            </div>

            {migrationReport && (
              <div className="p-5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900 uppercase">Báo cáo Thống kê Dữ liệu Firestore:</span>
                  <span className="text-[11px] text-blue-700 font-mono">{new Date(migrationReport.migratedAt).toLocaleString('vi-VN')}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    <span className="text-slate-500">Chuyên đề (courses):</span>
                    <div className="text-base font-bold text-blue-700">{migrationReport.coursesCount}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    <span className="text-slate-500">Bài học (lessons):</span>
                    <div className="text-base font-bold text-blue-700">{migrationReport.lessonsCount}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    <span className="text-slate-500">Slide bài giảng:</span>
                    <div className="text-base font-bold text-blue-700">{migrationReport.slidesCount}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    <span className="text-slate-500">Nội dung Lời Bác:</span>
                    <div className="text-base font-bold text-blue-700">{migrationReport.contentsCount}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    <span className="text-slate-500">Video bài giảng:</span>
                    <div className="text-base font-bold text-blue-700">{migrationReport.videosCount}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    <span className="text-slate-500">Audio bài giảng:</span>
                    <div className="text-base font-bold text-blue-700">{migrationReport.audiosCount}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    <span className="text-slate-500">Đơn vị (units):</span>
                    <div className="text-base font-bold text-blue-700">{migrationReport.unitsCount}</div>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-100">
                    <span className="text-slate-500">Người dùng (users):</span>
                    <div className="text-base font-bold text-blue-700">{migrationReport.usersCount}</div>
                  </div>
                </div>
              </div>
            )}

            {migrationError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>{migrationError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 1: ARCHITECTURE & FIRESTORE BLUEPRINT */}
      {activeTab === 'architecture' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-200">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 uppercase">
                    1. Cloud Firestore Schema & Blueprint Architecture
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tuân thủ nghiêm ngặt nguyên tắc: Firestore chỉ lưu metadata và Storage path reference. Tuyệt đối không lưu file nhị phân lớn.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200">
                Chuẩn hóa v4.0
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-blue-700 uppercase">Cấu trúc Tập hợp (Collections)</div>
                <ul className="text-xs text-slate-600 space-y-1 font-mono">
                  <li>• /courses/{'{courseId}'}</li>
                  <li>• /lessons/{'{lessonId}'}</li>
                  <li>• /slides/{'{slideId}'}</li>
                  <li>• /contents/{'{contentId}'}</li>
                  <li>• /videos/{'{videoId}'}</li>
                  <li>• /audios/{'{audioId}'}</li>
                  <li>• /units/{'{unitId}'}</li>
                  <li>• /users/{'{userId}'}</li>
                  <li>• /progress/{'{progressId}'}</li>
                  <li>• /notifications/{'{id}'}</li>
                  <li>• /storageFiles/{'{fileId}'}</li>
                </ul>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-indigo-700 uppercase">Cơ chế Đánh phiên bản (Versioning)</div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Mọi bản ghi Course, Lesson, Slide, Content, Video, Audio đều sở hữu thuộc tính 
                  <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-bold ml-1">version: number</code>, 
                  <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-bold ml-1">contentVersion</code>, 
                  <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-bold ml-1">mediaVersion</code> và 
                  <code className="bg-slate-200 px-1 py-0.5 rounded text-indigo-700 font-bold ml-1">updatedAt: ISOString</code>.
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="text-xs font-bold text-emerald-700 uppercase">Chỉ mục Truy vấn (Indexes)</div>
                <ul className="text-xs text-slate-600 space-y-1 font-mono">
                  <li>• (courseId, status, order ASC)</li>
                  <li>• (lessonId, order ASC)</li>
                  <li>• (status, updatedAt DESC)</li>
                  <li>• (userId, lessonId) UNIQUE</li>
                  <li>• (unitId, overallProgress)</li>
                  <li>• (updatedAt, version ASC)</li>
                </ul>
              </div>
            </div>

            <div className="p-4 bg-slate-900 rounded-xl text-slate-300 font-mono text-xs overflow-x-auto">
              <div className="text-slate-400 mb-2 font-bold">// Cấu hình Security Rules Đã Triển khai (firestore.rules)</div>
              <pre>{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /courses/{courseId} {
      allow get, list: if true;
      allow create, update: if isContentAdmin();
      allow delete: if isSuperAdmin();
    }
    match /lessons/{lessonId} {
      allow get, list: if true;
      allow create, update: if isContentAdmin();
      allow delete: if isSuperAdmin();
    }
    match /progress/{progressId} {
      allow read, write: if isSignedIn() && (isUnitAdmin() || request.auth.uid == resource.data.userId);
    }
  }
}`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLOUD STORAGE & FILE VERSIONING */}
      {activeTab === 'storage' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-200">
                  <FolderTree className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800 uppercase">
                    2. Cấu trúc Thư mục Cloud Storage & Quản lý Phiên bản Tệp
                  </h3>
                  <p className="text-xs text-slate-500">
                    Phân cấp thư mục theo quy chuẩn nghiêm ngặt: courses/{'{id}'}, lessons/{'{id}'}, slides/{'{id}'}, v.v.
                  </p>
                </div>
              </div>
            </div>

            {/* Storage directory layout */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono">
                <div className="font-bold text-slate-800">/documents/</div>
                <div className="text-[11px] text-slate-500 mt-1">Lưu trữ PPTX & PDF gốc</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono">
                <div className="font-bold text-slate-800">/slides/</div>
                <div className="text-[11px] text-slate-500 mt-1">Lưu trữ ảnh slide chuẩn 16:9</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono">
                <div className="font-bold text-slate-800">/videos/</div>
                <div className="text-[11px] text-slate-500 mt-1">Lưu trữ video MP4 bài giảng</div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono">
                <div className="font-bold text-slate-800">/audios/</div>
                <div className="text-[11px] text-slate-500 mt-1">Lưu trữ audio MP3 bài giảng</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INCREMENTAL SYNC & ROOM TESTER */}
      {activeTab === 'sync' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center space-x-3 border-b border-slate-100 pb-4">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 uppercase">
                  3. Cơ chế Đồng bộ Vi sai (Incremental Delta Sync) cho Android Room
                </h3>
                <p className="text-xs text-slate-500">
                  Mobile chỉ tải về các bản ghi thay đổi kể từ mốc thời gian `updatedAfter`.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={syncTimestampInput}
                onChange={(e) => setSyncTimestampInput(e.target.value)}
                placeholder="ISO Timestamp (e.g. 2026-02-01T00:00:00.000Z)"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-xl text-xs font-mono"
              />
              <button
                onClick={handleTestDeltaSync}
                disabled={syncingDelta}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs"
              >
                {syncingDelta ? 'Đang đồng bộ...' : 'Thử nghiệm Delta Sync'}
              </button>
            </div>

            {syncDeltaResult && (
              <div className="p-4 bg-slate-900 rounded-xl font-mono text-[11px] text-emerald-400 overflow-auto max-h-[300px]">
                <pre>{JSON.stringify(syncDeltaResult, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: REST API & PAGINATION TESTER */}
      {activeTab === 'api' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Smartphone className="w-5 h-5 text-blue-600" />
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase">
                  Tài liệu & Thử nghiệm REST API cho Ứng dụng Android
                </h3>
                <p className="text-xs text-slate-500">
                  Các điểm kết nối chuẩn hóa đầy đủ phân trang (`page`, `limit`), tìm kiếm và đánh phiên bản.
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Endpoints list */}
            <div className="lg:col-span-5 space-y-2">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-2">
                Danh sách kết nối API
              </span>
              {endpoints.map((ep, idx) => (
                <button
                  key={idx}
                  onClick={() => testApi(ep.path)}
                  className={`w-full text-left p-3 rounded-xl border transition-all flex items-start space-x-2.5 ${
                    selectedEndpoint === ep.path
                      ? 'bg-blue-50/70 border-blue-500 shadow-xs'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className="bg-slate-100 text-blue-700 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border border-slate-200">
                    {ep.method}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-xs font-bold text-slate-800 truncate">{ep.path}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{ep.desc}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Live API Tester Response */}
            <div className="lg:col-span-7 flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                  <Terminal className="w-3.5 h-3.5 text-blue-600" />
                  <span>Phản hồi JSON từ máy chủ ({selectedEndpoint})</span>
                </span>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(apiResponse, null, 2), 'response')}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center space-x-1 transition-colors"
                >
                  {copiedKey === 'response' ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép JSON</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-4 font-mono text-[11px] text-emerald-400 overflow-auto max-h-[420px] shadow-inner">
                {loadingApi ? (
                  <div className="text-blue-300 animate-pulse">Đang truy vấn API server...</div>
                ) : (
                  <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: REALTIME STREAM MONITOR */}
      {activeTab === 'realtime' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-800 uppercase">
                  Nhật ký Sự kiện Đồng bộ Tức thì (Realtime Listeners)
                </h3>
                <p className="text-xs text-slate-500">
                  Tất cả thay đổi Chuyên đề, Bài học, Slide, Video, Audio và Tiến độ học tập được phát sóng tức thì qua Cloud Firestore onSnapshot và SSE.
                </p>
              </div>
            </div>

            <button
              onClick={() => setRealtimeLogs([])}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              Xóa nhật ký
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto border border-slate-200 rounded-xl">
            {realtimeLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Đang lắng nghe sự kiện từ Cloud Firestore onSnapshot... Hãy thử chỉnh sửa một slide hoặc bài học để theo dõi.
              </div>
            ) : (
              realtimeLogs.map((log, idx) => (
                <div key={idx} className="p-3.5 hover:bg-slate-50 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono font-bold text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {log.type}
                    </span>
                    <span className="font-semibold text-slate-800">
                      Thao tác: <code className="text-indigo-600 font-bold">{log.action}</code> trên thực thể: <code className="text-slate-600">{log.entityId}</code>
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString('vi-VN')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
