import React, { useState } from 'react';
import { Plus, Users, Edit3, CheckCircle2 } from 'lucide-react';
import { Unit, User } from '../types';

interface UnitsViewProps {
  units: Unit[];
  users?: User[];
  onCreateUnit: (unit: Partial<Unit>) => Promise<any>;
  onUpdateUnit: (id: string, unit: Partial<Unit>) => Promise<void>;
}

export const UnitsView: React.FC<UnitsViewProps> = ({
  units,
  users = [],
  onCreateUnit,
  onUpdateUnit,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    commander: '',
    politicalOfficer: '',
  });

  const handleOpenNew = () => {
    setEditingUnit(null);
    setFormData({
      name: '',
      description: '',
      commander: '',
      politicalOfficer: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: Unit) => {
    setEditingUnit(u);
    setFormData({
      name: u.name,
      description: u.description || '',
      commander: u.commander || '',
      politicalOfficer: u.politicalOfficer || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      if (editingUnit) {
        await onUpdateUnit(editingUnit.id, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          commander: formData.commander.trim(),
          politicalOfficer: formData.politicalOfficer.trim(),
        });
      } else {
        await onCreateUnit({
          name: formData.name.trim(),
          code: `DV-${Date.now().toString().slice(-4)}`,
          type: 'BRIGADE',
          status: 'ACTIVE',
          memberCount: 0,
          description: formData.description.trim(),
          commander: formData.commander.trim(),
          politicalOfficer: formData.politicalOfficer.trim(),
        });
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Lỗi lưu đơn vị:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getUserCountForUnit = (unit: Unit) => {
    const unitNameLower = unit.name.trim().toLowerCase();
    return users.filter((u) => {
      const uUnitId = u.unitId || '';
      const uUnitName = (u.unitName || u.unit || '').trim().toLowerCase();
      return uUnitId === unit.id || (uUnitName && uUnitName === unitNameLower);
    }).length;
  };

  const sortedUnits = React.useMemo(() => {
    return [...units].sort((a, b) =>
      (a.name || '').localeCompare(b.name || '', 'vi', { numeric: true, sensitivity: 'base' })
    );
  }, [units]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight">
            QUẢN LÝ ĐƠN VỊ & LỰC LƯỢNG
          </h2>
        </div>

        <button
          onClick={handleOpenNew}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Thêm Đơn vị mới</span>
        </button>
      </div>

      {/* Units Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {sortedUnits.map((unit) => {
          const userCount = getUserCountForUnit(unit);

          return (
            <div
              key={unit.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-base font-bold text-slate-800 line-clamp-1">{unit.name}</h3>
                  <div className="flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-100/90 px-2.5 py-1 rounded-lg shrink-0 ml-2">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-bold text-slate-800">{userCount}</span>
                    <span className="text-slate-500 text-xs">tài khoản</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
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
                  className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors border border-slate-200 cursor-pointer"
                  title="Chỉnh sửa đơn vị"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create/Edit Unit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-800 uppercase">
              {editingUnit ? 'Chỉnh sửa Đơn vị' : 'Thêm Đơn vị mới'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tên đơn vị *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="Ví dụ: Lữ đoàn 162 (Lữ đoàn Tàu mặt nước)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-medium focus:outline-hidden focus:border-blue-500 focus:bg-white"
                />
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
                  placeholder="Mô tả tóm tắt chức năng, nhiệm vụ..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !formData.name.trim()}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSubmitting && (
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{editingUnit ? 'Lưu thay đổi' : 'Tạo đơn vị'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
