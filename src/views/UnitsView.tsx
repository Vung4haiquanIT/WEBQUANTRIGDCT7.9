import React, { useState } from 'react';
import { Plus, Users, Edit3, CheckCircle2, Trash2, AlertTriangle, AlertCircle } from 'lucide-react';
import { Unit, User } from '../types';

interface UnitsViewProps {
  units: Unit[];
  users?: User[];
  onCreateUnit: (unit: Partial<Unit>) => Promise<any>;
  onUpdateUnit: (id: string, unit: Partial<Unit>) => Promise<void>;
  onDeleteUnit?: (id: string, unitName?: string) => Promise<void>;
}

export const UnitsView: React.FC<UnitsViewProps> = ({
  units,
  users = [],
  onCreateUnit,
  onUpdateUnit,
  onDeleteUnit,
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

  const [unitToDelete, setUnitToDelete] = useState<Unit | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

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
      name: u.name || '',
      description: u.description || '',
      commander: u.commander || '',
      politicalOfficer: u.politicalOfficer || '',
    });
    setIsModalOpen(true);
  };

  const handleRequestDelete = (u: Unit) => {
    setDeleteErrorMessage(null);
    setUnitToDelete(u);
  };

  const handleConfirmDelete = async () => {
    if (!unitToDelete) return;
    setIsDeleting(true);
    setDeleteErrorMessage(null);
    try {
      if (onDeleteUnit) {
        await onDeleteUnit(unitToDelete.id, unitToDelete.name);
      }
      setSuccessToast(`Đã xóa đơn vị "${unitToDelete.name}" thành công`);
      setUnitToDelete(null);
      setTimeout(() => {
        setSuccessToast(null);
      }, 3500);
    } catch (err: any) {
      console.error('Lỗi xóa đơn vị:', err);
      setDeleteErrorMessage(err.message || 'Không thể xóa đơn vị. Vui lòng thử lại.');
    } finally {
      setIsDeleting(false);
    }
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
          type: 'BRIGADE',
          status: 'ACTIVE',
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
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="text-base font-bold text-slate-800 line-clamp-1">{unit.name}</h3>
                  <div className="flex items-center space-x-1.5 text-xs text-slate-600 bg-slate-100/90 px-2.5 py-1 rounded-lg shrink-0">
                    <Users className="w-3.5 h-3.5 text-blue-600" />
                    <span className="font-bold text-slate-800">{userCount}</span>
                    <span className="text-slate-500 text-xs">tài khoản</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                  {unit.description || 'Đơn vị trực thuộc Bộ Tư lệnh Vùng 4 Hải Quân.'}
                </p>

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
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
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => handleOpenEdit(unit)}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 transition-colors border border-slate-200 cursor-pointer"
                    title="Chỉnh sửa đơn vị"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleRequestDelete(unit)}
                    className="p-1.5 rounded-lg bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors border border-slate-200 cursor-pointer"
                    title="Xóa đơn vị"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Create/Edit Unit */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
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

              <div className="flex items-center justify-between pt-2">
                {editingUnit ? (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      const target = editingUnit;
                      setIsModalOpen(false);
                      handleRequestDelete(target);
                    }}
                    className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-semibold transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa đơn vị này</span>
                  </button>
                ) : <div />}

                <div className="flex items-center space-x-2">
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
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirm Delete Unit */}
      {unitToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col p-6 animate-scale-up">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0 shadow-xs">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Xác nhận xóa đơn vị</h3>
                <p className="text-xs text-slate-500 font-medium">{unitToDelete.name}</p>
              </div>
            </div>

            {(() => {
              const uCount = getUserCountForUnit(unitToDelete);
              return uCount > 0 ? (
                <div className="my-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start space-x-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Cảnh báo liên kết tài khoản:</p>
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      Đơn vị này hiện có <strong>{uCount} tài khoản</strong> quân nhân đang trực thuộc. Nếu bạn xóa, các tài khoản này vẫn được lưu giữ nhưng sẽ không còn thuộc đơn vị nào.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="my-3 p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Bạn có chắc chắn muốn xóa đơn vị <strong>{unitToDelete.name}</strong> không? Hành động này sẽ loại bỏ đơn vị khỏi danh sách hệ thống.
                  </p>
                </div>
              );
            })()}

            {deleteErrorMessage && (
              <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
                {deleteErrorMessage}
              </div>
            )}

            <div className="flex items-center justify-end space-x-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setUnitToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xác nhận xóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center space-x-2 text-xs font-semibold animate-slide-up">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}
    </div>
  );
};
