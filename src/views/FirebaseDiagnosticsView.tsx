import React, { useState } from 'react';
import { 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Database, 
  Server,
  ChevronDown,
  ChevronUp,
  Cloud,
  FileCode,
  HardDrive
} from 'lucide-react';
import { runFirebaseLiveDiagnostics, runCloudinaryDiagnostics, FirebaseTestResult, CloudinaryTestResult } from '../services/firebaseDiagnostics';
import { CloudinaryUnsignedUploadTest } from '../components/CloudinaryUnsignedUploadTest';
import { DongSonDrum, DongSonBorder } from '../components/DongSonMotif';
import { firestoreService } from '../services/firestoreService';

export const FirebaseDiagnosticsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'firebase' | 'cloudinary' | 'orphans'>('cloudinary');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [hasRun, setHasRun] = useState<boolean>(false);
  const [currentStepInfo, setCurrentStepInfo] = useState<string>('');
  const [testResult, setTestResult] = useState<{
    allPassed: boolean;
    projectId: string;
    databaseId: string;
    results: FirebaseTestResult[];
  } | null>(null);
  const [cloudinaryResult, setCloudinaryResult] = useState<{
    allPassed: boolean;
    cloudName: string;
    status: string;
    results: CloudinaryTestResult[];
  } | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | string | null>(null);

  // Orphan scan state
  const [orphanData, setOrphanData] = useState<{ totalOrphans: number; details: any } | null>(null);
  const [isScanningOrphans, setIsScanningOrphans] = useState(false);
  const [orphanMessage, setOrphanMessage] = useState('');

  const handleScanOrphans = async () => {
    setIsScanningOrphans(true);
    setOrphanMessage('Đang quét toàn bộ Firestore tìm dữ liệu mồ côi...');
    try {
      const res = await firestoreService.scanOrphanRecords();
      setOrphanData(res);
      setOrphanMessage(`Quét hoàn tất. Tìm thấy ${res.totalOrphans} bản ghi mồ côi.`);
    } catch (err: any) {
      setOrphanMessage(`Lỗi quét mồ côi: ${err.message}`);
    } finally {
      setIsScanningOrphans(false);
    }
  };

  const handleRunAllTests = async () => {
    try {
      setIsRunning(true);
      setHasRun(true);
      setCurrentStepInfo('Đang chạy kiểm tra Firebase & Cloudinary...');
      
      const cRes = await runCloudinaryDiagnostics();
      setCloudinaryResult(cRes);

      const fRes = await runFirebaseLiveDiagnostics((stepIndex, totalSteps, currentName, resultsSoFar) => {
        setCurrentStepInfo(`Kiểm tra Firebase bước ${stepIndex}/${totalSteps}: ${currentName}`);
        setTestResult({
          allPassed: false,
          projectId: 'gdctv4-4e1f3',
          databaseId: '(default)',
          results: resultsSoFar
        });
      });

      setTestResult(fRes);
      setCurrentStepInfo('');
    } catch (err: any) {
      console.error('Diagnostics execution error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const stepsList = [
    { id: 1, title: '① Firebase Project & Config', keyword: 'Project' },
    { id: 2, title: '② Firestore WRITE', keyword: 'WRITE' },
    { id: 3, title: '③ Firestore READ', keyword: 'READ' },
    { id: 4, title: '④ Firestore UPDATE', keyword: 'UPDATE' },
    { id: 5, title: '⑤ Realtime Listener', keyword: 'Realtime' },
    { id: 6, title: '⑥ Firebase Storage', keyword: 'Storage' },
    { id: 7, title: '⑦ Firebase Authentication SDK', keyword: 'Authentication' },
    { id: 8, title: '⑧ Firestore DELETE / Cleanup', keyword: 'Cleanup' },
  ];

  const cloudinaryStepsList = [
    { id: 'c1', title: '① Cloudinary Connection', keyword: 'Connection' },
    { id: 'c2', title: '② Upload Test', keyword: 'Upload' },
    { id: 'c3', title: '③ CDN URL', keyword: 'CDN URL' },
    { id: 'c4', title: '④ Delete Test', keyword: 'Delete' }
  ];

  const handleRunCloudinaryOnly = async () => {
    try {
      setIsRunning(true);
      setCurrentStepInfo('Đang kiểm tra Cloudinary CDN...');
      const cRes = await runCloudinaryDiagnostics((stepIndex, totalSteps, currentName, resultsSoFar) => {
        setCurrentStepInfo(`Kiểm tra Cloudinary bước ${stepIndex}/${totalSteps}: ${currentName}`);
        setCloudinaryResult({
          allPassed: false,
          cloudName: 'ieplkoep',
          status: 'RUNNING',
          results: resultsSoFar
        });
      });
      setCloudinaryResult(cRes);
      setCurrentStepInfo('');
    } catch (err: any) {
      console.error('Cloudinary diagnostic error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const getStepResult = (keyword: string): FirebaseTestResult | undefined => {
    if (!testResult || !testResult.results) return undefined;
    return testResult.results.find(r => r.step.toLowerCase().includes(keyword.toLowerCase()));
  };

  const getCloudinaryStepResult = (keyword: string): CloudinaryTestResult | undefined => {
    if (!cloudinaryResult || !cloudinaryResult.results) return undefined;
    return cloudinaryResult.results.find(r => r.step.toLowerCase().includes(keyword.toLowerCase()));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16 relative">
      {/* Background watermark */}
      <div className="absolute top-10 right-10 pointer-events-none opacity-5">
        <DongSonDrum className="w-96 h-96" color="#DC2626" />
      </div>

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0B1E3B] via-[#152e52] to-[#0B1E3B] text-white p-6 md:p-8 rounded-2xl shadow-xl border border-amber-500/30 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase border border-amber-500/30">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Hệ Thống Quản Trị Vùng 4 • Storage & Cloud Diagnostics</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase font-sans">
              CHẨN ĐOÁN FIREBASE & CLOUDINARY MEDIA
            </h1>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl font-medium">
              Kiểm tra toàn diện cơ sở dữ liệu Cloud Firestore, kết nối Cloudinary Media Storage CDN, PPTX Slides Engine và Offline Cache.
            </p>
          </div>

          <button
            onClick={handleRunAllTests}
            disabled={isRunning}
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black px-6 py-4 rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center justify-center space-x-3 text-sm tracking-wider uppercase border border-amber-300 disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={`w-5 h-5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'ĐANG CHẠY KIỂM TRA...' : 'CHẠY TẤT CẢ KIỂM TRA'}</span>
          </button>
        </div>
      </div>

      <DongSonBorder color="#F59E0B" className="h-2 opacity-40" />

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          onClick={() => setActiveTab('cloudinary')}
          className={`flex items-center space-x-2 px-5 py-3 font-bold text-xs uppercase tracking-wider rounded-t-xl transition-all border-t border-x ${
            activeTab === 'cloudinary'
              ? 'bg-white border-slate-300 text-blue-700 shadow-xs'
              : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Cloud className="w-4 h-4 text-blue-600" />
          <span>Cloudinary Media Storage CDN</span>
          {cloudinaryResult && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${cloudinaryResult.allPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {cloudinaryResult.allPassed ? 'CONNECTED' : 'CHECK'}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('firebase')}
          className={`flex items-center space-x-2 px-5 py-3 font-bold text-xs uppercase tracking-wider rounded-t-xl transition-all border-t border-x ${
            activeTab === 'firebase'
              ? 'bg-white border-slate-300 text-red-700 shadow-xs'
              : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Database className="w-4 h-4 text-red-600" />
          <span>Firebase Firestore & Auth</span>
          {testResult && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${testResult.allPassed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {testResult.allPassed ? 'PASSED' : 'CHECK'}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('orphans')}
          className={`flex items-center space-x-2 px-5 py-3 font-bold text-xs uppercase tracking-wider rounded-t-xl transition-all border-t border-x ${
            activeTab === 'orphans'
              ? 'bg-white border-slate-300 text-amber-700 shadow-xs'
              : 'bg-slate-100 border-transparent text-slate-500 hover:bg-slate-200'
          }`}
        >
          <ShieldCheck className="w-4 h-4 text-amber-600" />
          <span>Quét Dữ Liệu Mồ Côi</span>
          {orphanData && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${orphanData.totalOrphans === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {orphanData.totalOrphans} MỒ CÔI
            </span>
          )}
        </button>
      </div>

      {/* Project Configuration Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3.5 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-2 bg-blue-600"></div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 flex-shrink-0">
            <Cloud className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Media Storage Provider</div>
            <div className="text-base font-mono font-extrabold text-slate-900 mt-0.5">Cloudinary CDN</div>
            <div className="text-[11px] text-blue-600 font-medium mt-0.5">
              Cloud: <span className="font-bold">{import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'gdctv4'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3.5 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-2 bg-red-600"></div>
          <div className="p-3 bg-red-50 text-red-600 rounded-xl border border-red-100 flex-shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Firebase Project ID</div>
            <div className="text-base font-mono font-extrabold text-slate-900 mt-0.5">gdctv4-4e1f3</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-0.5 flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              <span>Firestore Active</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3.5 relative overflow-hidden">
          <div className="absolute top-0 left-0 bottom-0 w-2 bg-emerald-600"></div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 flex-shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Offline Cache Storage</div>
            <div className="text-base font-mono font-extrabold text-slate-900 mt-0.5">IndexedDB PWA</div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5">
              Sẵn sàng lưu Offline video/audio
            </div>
          </div>
        </div>
      </div>

      {/* Running Progress Status Banner */}
      {isRunning && (
        <div className="bg-amber-50 border border-amber-300 text-amber-900 p-4 rounded-2xl shadow-sm flex items-center space-x-3 animate-pulse">
          <Clock className="w-6 h-6 text-amber-600 animate-spin flex-shrink-0" />
          <div className="flex-1">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700">Trạng thái thực thi</div>
            <div className="text-sm font-extrabold mt-0.5">⏳ {currentStepInfo || 'Đang kiểm tra...'}</div>
          </div>
        </div>
      )}

      {/* TAB 1: CLOUDINARY MEDIA STORAGE DIAGNOSTICS */}
      {activeTab === 'cloudinary' && (
        <div className="space-y-6">
          <CloudinaryUnsignedUploadTest />

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-blue-50/50">
            <div>
              <div className="flex items-center space-x-2">
                <Cloud className="w-5 h-5 text-blue-600" />
                <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                  ☁️ CLOUDINARY MEDIA STORAGE
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Cloud Name: <span className="font-bold text-slate-800">ieplkoep</span> | API Key: <span className="font-bold text-slate-800">683212723352821</span>
              </p>
            </div>

            <button
              onClick={handleRunCloudinaryOnly}
              disabled={isRunning}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl shadow-xs transition-all text-xs tracking-wider uppercase flex items-center justify-center space-x-2 flex-shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
              <span>KIỂM TRA CLOUDINARY</span>
            </button>
          </div>

          {cloudinaryResult?.allPassed && (
            <div className="bg-emerald-500 text-white p-4 text-center font-bold text-sm tracking-wide uppercase flex items-center justify-center space-x-2">
              <CheckCircle2 className="w-5 h-5 text-white" />
              <span>☁️ CLOUDINARY MEDIA STORAGE HOẠT ĐỘNG BÌNH THƯỜNG</span>
            </div>
          )}

          <div className="divide-y divide-slate-100">
            {cloudinaryStepsList.map((stepItem) => {
              const res = getCloudinaryStepResult(stepItem.keyword);
              const status = res ? res.status : 'PENDING';
              const isExpanded = expandedStep === stepItem.id;

              return (
                <div key={stepItem.id} className="p-4 md:p-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3.5">
                      <div className="flex-shrink-0">
                        {status === 'RUNNING' || (isRunning && !res) ? (
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center animate-spin">
                            <Clock className="w-4 h-4" />
                          </div>
                        ) : status === 'SUCCESS' ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        ) : status === 'NOT_CONFIGURED' ? (
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs">
                            !
                          </div>
                        ) : status === 'FAILED' ? (
                          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                            <XCircle className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs">
                            {stepItem.id}
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{stepItem.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {res ? res.details : (isRunning ? 'Đang chờ thực thi...' : 'Đang chờ chạy kiểm tra...')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-end sm:self-center">
                      {status === 'SUCCESS' ? (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Thành công</span>
                        </span>
                      ) : status === 'NOT_CONFIGURED' ? (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300">
                          <span>Chưa cấu hình .env</span>
                        </span>
                      ) : status === 'FAILED' ? (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Lỗi</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span>Sẵn sàng</span>
                        </span>
                      )}

                      {res?.details && (
                        <button
                          onClick={() => setExpandedStep(isExpanded ? null : stepItem.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                          title="Xem chi tiết"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && res && (
                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs font-mono bg-slate-900 text-blue-300 p-3.5 rounded-xl shadow-inner space-y-1">
                      <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Thông tin phản hồi API:</div>
                      <div className="break-all">{res.details}</div>
                      <div className="text-slate-500 text-[10px] pt-1">Thời gian: {new Date(res.timestamp).toLocaleString('vi-VN')}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </div>
      )}

      {/* TAB 2: FIREBASE FIRESTORE DIAGNOSTICS */}
      {activeTab === 'firebase' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-red-50/50">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-red-600" />
              <h2 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                Danh sách 8 bước kiểm tra hệ thống Firebase Production
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">
              {hasRun ? (testResult ? `${testResult.results.filter(r => r.status === 'SUCCESS').length}/8 Thành công` : '') : 'Chưa chạy kiểm tra'}
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {stepsList.map((stepItem) => {
              const res = getStepResult(stepItem.keyword);
              const status = res ? res.status : 'PENDING';
              const isExpanded = expandedStep === stepItem.id;

              return (
                <div key={stepItem.id} className="p-4 md:p-5 hover:bg-slate-50/50 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center space-x-3.5">
                      <div className="flex-shrink-0">
                        {status === 'RUNNING' || (isRunning && !res) ? (
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center animate-spin">
                            <Clock className="w-4 h-4" />
                          </div>
                        ) : status === 'SUCCESS' ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        ) : status === 'FAILED' ? (
                          <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                            <XCircle className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-bold text-xs">
                            {stepItem.id}
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{stepItem.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {res ? res.details : (isRunning ? 'Đang chờ thực thi...' : 'Đang chờ chạy kiểm tra...')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 self-end sm:self-center">
                      {status === 'SUCCESS' ? (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>✅ Thành công</span>
                        </span>
                      ) : status === 'FAILED' ? (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>❌ Thất bại</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span>Chờ chạy</span>
                        </span>
                      )}

                      {res?.details && (
                        <button
                          onClick={() => setExpandedStep(isExpanded ? null : stepItem.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                          title="Xem chi tiết"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && res && (
                    <div className="mt-3 pt-3 border-t border-slate-100 text-xs font-mono bg-slate-900 text-emerald-400 p-3.5 rounded-xl shadow-inner space-y-1">
                      <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Chi tiết thực thi:</div>
                      <div className="break-all">{res.details}</div>
                      <div className="text-slate-500 text-[10px] pt-1">Thời gian: {new Date(res.timestamp).toLocaleString('vi-VN')}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ORPHAN SCAN & CLEANUP */}
      {activeTab === 'orphans' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="inline-flex items-center space-x-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-amber-200 mb-2">
                <Database className="w-3.5 h-3.5" />
                <span>Kiểm Tra Chuyên Sâu • Data Integrity & Cascade Audit</span>
              </div>
              <h2 className="text-xl font-black text-slate-900">CHẨN ĐOÁN DỮ LIỆU MỒ CÔI & THAM CHIẾU HỎNG</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                Quét toàn bộ các collection (lessons, contents, sections, slides, videos, audios, documents) để phát hiện và làm sạch các bản ghi mồ côi (không còn gắn với Course hoặc Lesson tồn tại).
              </p>
            </div>

            <button
              onClick={handleScanOrphans}
              disabled={isScanningOrphans}
              className="bg-amber-600 hover:bg-amber-700 text-slate-950 font-black px-6 py-3 rounded-xl shadow-md transition-all text-xs tracking-wider uppercase flex items-center justify-center space-x-2 disabled:opacity-50 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${isScanningOrphans ? 'animate-spin' : ''}`} />
              <span>{isScanningOrphans ? 'ĐANG QUÉT MỒ CÔI...' : 'QUÉT DỮ LIỆU MỒ CÔI'}</span>
            </button>
          </div>

          {orphanMessage && (
            <div className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl text-xs font-semibold text-blue-900">
              {orphanMessage}
            </div>
          )}

          {orphanData && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                  <div className="text-2xl font-black text-slate-900">{orphanData.totalOrphans}</div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase mt-1">Tổng Mồ Côi</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                  <div className="text-2xl font-black text-rose-600">{orphanData.details.lessons.length}</div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase mt-1">Bài học mồ côi</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                  <div className="text-2xl font-black text-amber-600">{orphanData.details.slides.length}</div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase mt-1">Slide mồ côi</div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                  <div className="text-2xl font-black text-blue-600">{orphanData.details.documents.length}</div>
                  <div className="text-[11px] font-bold text-slate-500 uppercase mt-1">Tài liệu mồ côi</div>
                </div>
              </div>

              {orphanData.totalOrphans === 0 ? (
                <div className="p-8 text-center bg-emerald-50/50 border border-emerald-200 rounded-2xl">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-emerald-900 uppercase">Hệ thống toàn vẹn tuyệt đối!</h3>
                  <p className="text-xs text-emerald-700 mt-1">Không phát hiện bản ghi mồ côi hay dữ liệu rác nào trong Firestore.</p>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
                  <div className="text-xs font-bold text-rose-800 uppercase flex items-center space-x-2">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Phát hiện {orphanData.totalOrphans} mục dữ liệu không có liên kết hợp lệ!</span>
                  </div>
                  <p className="text-xs text-rose-700">
                    Bạn có thể sử dụng chức năng Cascade Delete từng bài học để làm sạch triệt để.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-xs gap-4">
        <div className="text-xs text-slate-500">
          💡 Hệ thống lưu trữ Media hiện được định cấu hình tự động qua <strong>storageFactory</strong>: hỗ trợ Cloudinary CDN & Firebase Storage.
        </div>
        <button
          onClick={handleRunAllTests}
          disabled={isRunning}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl shadow-md transition-all text-xs tracking-wider uppercase flex items-center justify-center space-x-2 flex-shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
          <span>{isRunning ? 'Đang chạy kiểm tra...' : 'CHẠY LẠI TẤT CẢ KIỂM TRA'}</span>
        </button>
      </div>
    </div>
  );
};
