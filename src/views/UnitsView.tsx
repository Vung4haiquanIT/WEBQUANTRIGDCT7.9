import React, { useState } from 'react';
import { Plus, Users, Edit3, CheckCircle2 } from 'lucide-react';
import { Unit } from '../types';

interface UnitsViewProps {
  units: Unit[];
  onCreateUnit: (unit: Partial<Unit>) => Promise<void>;
  onUpdateUnit: (id: string, unit: Partial<Unit>) => Promise<void>;
}

export const UnitsView: React.FC<UnitsViewProps> = ({
  units,
  onCreateUnit,
  onUpdateUnit,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'BRIGADE' as Unit['type'],
    description: '',
    memberCount: 500,
    commander: '',
    politicalOfficer: '',
  });

  const handleOpenNew = () => {
    setEditingUnit(null);
    setFormData({
      name: '',
      code: '',
      type: 'BRIGADE',
      description: '',
      memberCount: 500,
      commander: '',
      politicalOfficer: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: Unit) => {
    setEditingUnit(u);
    setFormData({
      name: u.name,
      code: u.code,
      type: u.type,
      description: u.description || '',
      memberCount: u.memberCount,
      commander: u.commander || '',
      politicalOfficer: u.politicalOfficer || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) return;

    if (editingUnit) {
      await onUpdateUnit(editingUnit.id, formData);
    } else {
      await onCreateUnit(formData);
    }
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Biên chế Vùng 4 Hải Quân
            </span>
            <span className="text-xs text-slate-500 font-mono">Lữ đoàn • Tàu chiến • Đảo Trường Sa</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight mt-1">
            QUẢN LÝ ĐƠN VỊ & LỰC LƯỢNG HẢI QUÂN
          </h2>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Đơn vị mới</span>
        </button>
      </div>

      {/* Units Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {units.map((unit) => (
          <div
            key={unit.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                  {unit.code}
                </span>
                <div className="flex items-center space-x-1.5 text-xs text-slate-600">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-bold text-slate-700">{unit.memberCount}</span>
                  <span className="text-slate-400 text-[10px]">chiến sĩ</span>
                </div>
              </div>

              <h3 className="text-sm font-bold text-slate-800 line-clamp-2">{unit.name}</h3>
              <p className="text-xs text-slate-500 mt-1.5 line-clamp-2 leading-relaxed">
                {unit.description || 'Đơn vị trực thuộc Bộ Tư lệnh Vùng 4 Hải Quân.'}
              </p>

              <div className="mt-4 pt-3 border-t border-slate-100 space-y-1 text-xs">
                <div className="text-[11px] text-slate-700 flex items-center justify-between">
                  <span className="text-slate-500">Chỉ huy trưởng:</span>
                  <span className="font-semibold">{unit.commander || 'Đang cập nhật'}</span>
                </div>
                <div className="text-[11px] text-slate-700 flex items-center justify-between">
                  <span className="text-slate-500">Chính ủy/Chính trị viên:</span>
                  <span className="font-semibold">{unit.politicalOfficer || 'Đang cập nhật'}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="flex items-center space-x-1 text-emerald-600 font-semibold text-[10px]">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span>Hoạt động</span>
              </span>
              <button
                onClick={() => handleOpenEdit(unit)}
                className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors border border-slate-200"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal: Create/Edit Unit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase">
              {editingUnit ? 'Chỉnh sửa Đơn vị' : 'Thêm Đơn vị mới'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tên đơn vị *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Lữ đoàn 162 (Lữ đoàn Tàu mặt nước)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Ký hiệu (Code) *</label>
                  <input
                    type="text"
                    required
                    placeholder="L162, L146..."
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Quân số (người)</label>
                  <input
                    type="number"
                    value={formData.memberCount}
                    onChange={(e) => setFormData({ ...formData, memberCount: Number(e.target.value) })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Chỉ huy trưởng</label>
                <input
                  type="text"
                  placeholder="Thượng tá Nguyễn Văn..."
                  value={formData.commander}
                  onChange={(e) => setFormData({ ...formData, commander: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Chính ủy / Chính trị viên</label>
                <input
                  type="text"
                  placeholder="Đại tá Trần Hữu..."
                  value={formData.politicalOfficer}
                  onChange={(e) => setFormData({ ...formData, politicalOfficer: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Mô tả nhiệm vụ</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors">
                  {editingUnit ? 'Lưu thay đổi' : 'Tạo đơn vị'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
