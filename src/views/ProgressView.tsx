import React, { useState } from 'react';
import { CheckCircle, Clock, Search } from 'lucide-react';
import { UserProgress, Unit } from '../types';

interface ProgressViewProps {
  progressList: UserProgress[];
  units: Unit[];
}

export const ProgressView: React.FC<ProgressViewProps> = ({ progressList, units }) => {
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = progressList.filter((p) => {
    const matchUnit = selectedUnit === 'ALL' || p.unitId === selectedUnit;
    const matchSearch =
      p.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.lessonTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.unitName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchUnit && matchSearch;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Chỉ huy & Tuyên huấn
            </span>
            <span className="text-xs text-slate-500 font-mono">Theo dõi kết quả học tập</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight mt-1">
            TIẾN ĐỘ HỌC TẬP CHÍNH TRỊ TOÀN VÙNG
          </h2>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700">
            <span className="font-bold text-blue-600">{progressList.filter(p => p.completed).length}</span> / {progressList.length} Đã hoàn thành (100%)
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full max-w-md">
          <input
            type="text"
            placeholder="Tìm theo tên học viên, bài học, đơn vị..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <span className="text-slate-600 font-medium">Đơn vị:</span>
          <select
            value={selectedUnit}
            onChange={(e) => setSelectedUnit(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden focus:border-blue-500"
          >
            <option value="ALL">Tất cả đơn vị (Toàn Vùng)</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Progress Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="p-4">Học viên</th>
                <th className="p-4">Đơn vị</th>
                <th className="p-4">Bài học đang học</th>
                <th className="p-4">Tiến độ thành phần</th>
                <th className="p-4">Tổng tiến độ</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Lần cuối truy cập</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">
                    Chưa có dữ liệu tiến độ học tập nào.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-bold text-slate-800">{item.userName}</td>
                    <td className="p-4 text-slate-600">{item.unitName}</td>
                    <td className="p-4 max-w-xs truncate text-slate-800 font-medium">
                      {item.lessonTitle}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2 text-[10px]">
                        <span title="Slide" className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-200">
                          Slide: {item.slideProgress}%
                        </span>
                        <span title="Nội dung" className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200">
                          Đọc: {item.contentProgress}%
                        </span>
                        <span title="Video" className="bg-cyan-50 text-cyan-700 px-1.5 py-0.5 rounded border border-cyan-200">
                          Video: {item.videoProgress}%
                        </span>
                        <span title="Audio" className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200">
                          Audio: {item.audioProgress}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                          <div
                            className="bg-blue-600 h-full rounded-full"
                            style={{ width: `${item.overallProgress}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-700 font-mono text-[11px]">
                          {item.overallProgress}%
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      {item.completed ? (
                        <span className="inline-flex items-center space-x-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full text-[10px]">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          <span>Đã đạt chuẩn</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 text-amber-700 font-medium bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full text-[10px]">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>Đang học</span>
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right font-mono text-[10px] text-slate-500">
                      {new Date(item.lastAccessedAt).toLocaleTimeString('vi-VN')}{' '}
                      {new Date(item.lastAccessedAt).toLocaleDateString('vi-VN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
