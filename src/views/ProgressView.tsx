import React, { useState, useMemo } from 'react';
import { CheckCircle, Clock, Search } from 'lucide-react';
import { UserProgress, Unit } from '../types';
import { removeVietnameseTones, matchSearch } from '../utils/vietnamese';

interface ProgressViewProps {
  progressList: UserProgress[];
  units: Unit[];
}

export const ProgressView: React.FC<ProgressViewProps> = ({ progressList, units }) => {
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Dynamically collect all available units from both units list and progress items
  const unitOptions = useMemo(() => {
    const map = new Map<string, string>();
    // Pre-seed from registered units
    units.forEach((u) => {
      if (u.id && u.name) {
        map.set(u.id, u.name);
      }
    });

    // Also include any units from progress records that might have distinct names or IDs
    progressList.forEach((p) => {
      const uId = p.unitId || (p as any).donVi || p.unitName;
      const uName = p.unitName || (p as any).donVi || 'Vùng 4 Hải Quân';
      if (uId && uName && !map.has(uId)) {
        // If there is already a unit with matching normalized name, don't duplicate
        const normName = removeVietnameseTones(uName);
        const existingId = Array.from(map.entries()).find(([_, name]) => removeVietnameseTones(name) === normName)?.[0];
        if (!existingId) {
          map.set(uId, uName);
        }
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [units, progressList]);

  const filtered = useMemo(() => {
    return progressList.filter((p) => {
      // 1. Unit matching
      let matchUnit = false;
      if (selectedUnit === 'ALL') {
        matchUnit = true;
      } else {
        const pUnitId = p.unitId || '';
        const pUnitName = p.unitName || (p as any).donVi || '';
        const selectedOption = unitOptions.find(u => u.id === selectedUnit);
        const selectedTargetName = selectedOption ? selectedOption.name : selectedUnit;

        const normPUnitName = removeVietnameseTones(pUnitName);
        const normSelectedName = removeVietnameseTones(selectedTargetName);
        const normSelectedId = removeVietnameseTones(selectedUnit);

        // Match by exact ID, or normalized ID, or normalized name containment
        matchUnit = 
          pUnitId === selectedUnit ||
          (p as any).donVi === selectedUnit ||
          normPUnitName.includes(normSelectedName) ||
          normSelectedName.includes(normPUnitName) ||
          normPUnitName.includes(normSelectedId);
      }

      if (!matchUnit) return false;

      // 2. Search matching without distinguishing accents/diacritics or uppercase/lowercase
      if (!searchTerm.trim()) return true;

      const matchName = matchSearch(p.userName, searchTerm);
      const matchLesson = matchSearch(p.lessonTitle, searchTerm);
      const matchUnitText = matchSearch(p.unitName || (p as any).donVi, searchTerm);

      return matchName || matchLesson || matchUnitText;
    });
  }, [progressList, selectedUnit, searchTerm, unitOptions]);

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">
            TIẾN ĐỘ HỌC TẬP CHÍNH TRỊ TOÀN VÙNG
          </h2>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700">
            <span className="font-bold text-blue-600">{progressList.filter(p => p.completed).length}</span> / {progressList.length} Đã hoàn thành ({progressList.length > 0 ? Math.round((progressList.filter(p => p.completed).length / progressList.length) * 100) : 0}%)
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full max-w-md">
          <input
            type="text"
            placeholder="Tìm theo tên học viên, bài học, đơn vị (gõ có dấu hoặc không dấu)..."
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
            className="bg-slate-50 border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs focus:outline-hidden focus:border-blue-500 font-medium"
          >
            <option value="ALL">Tất cả đơn vị (Toàn Vùng)</option>
            {unitOptions.map((u) => (
              <option key={`opt-unit-${u.id}`} value={u.id}>
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
                <th className="p-4">Tổng tiến độ</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Lần cuối truy cập</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Không tìm thấy dữ liệu tiến độ nào phù hợp với bộ lọc hoặc từ khóa tìm kiếm.
                  </td>
                </tr>
              ) : (
                filtered.map((item, idx) => {
                  const uniqueKey = item.id || `prog-${item.userId || 'u'}-${item.lessonId || 'l'}-${idx}`;
                  const overall = Math.min(100, Math.max(0, Math.round(Number(item.overallProgress) || 0)));
                  return (
                    <tr key={uniqueKey} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4 font-bold text-slate-800">{item.userName}</td>
                      <td className="p-4 text-slate-600">{item.unitName || (item as any).donVi || 'Vùng 4 Hải Quân'}</td>
                      <td className="p-4 max-w-xs truncate text-slate-800 font-medium">
                        {item.lessonTitle || 'Bài học'}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-28 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                            <div
                              className={`h-full rounded-full ${overall >= 85 ? 'bg-emerald-500' : 'bg-blue-600'}`}
                              style={{ width: `${overall}%` }}
                            />
                          </div>
                          <span className="font-bold text-slate-700 font-mono text-[11px]">
                            {overall}%
                          </span>
                        </div>
                      </td>
                      <td className="p-4">
                        {item.completed || overall >= 85 ? (
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
                        {formatLastAccess(item.lastAccessedAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
