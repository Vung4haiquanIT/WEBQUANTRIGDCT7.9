import React, { useState } from 'react';
import { 
  UserPlus, 
  Trash2, 
  Edit3, 
  CheckCircle,
  XCircle,
  Search
} from 'lucide-react';
import { User, UserRole, Unit } from '../types';
import { api } from '../services/api';

interface UsersViewProps {
  users: User[];
  units: Unit[];
  onCreateUser: (user: Partial<User>) => Promise<void>;
  onUpdateUser: (id: string, user: Partial<User>) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onCreateUnit?: (unit: Partial<Unit>) => Promise<Unit>;
}

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  units,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
  onCreateUnit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreatingNewUnit, setIsCreatingNewUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '123@abc',
    role: 'USER' as UserRole,
    rank: 'Đại úy',
    position: 'Chính trị viên',
    rankAndPosition: 'Đại úy - Chính trị viên',
    unitId: units[0]?.id || 'unit-1',
    unit: units[0]?.name || 'Bộ Tư lệnh Vùng 4 Hải Quân',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
  });

  // Normalize user roles for legacy values if any
  const normalizeRole = (role: string): UserRole => {
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return 'ADMIN';
    if (role === 'APPROVER' || role === 'CONTENT_ADMIN' || role === 'UNIT_ADMIN') return 'APPROVER';
    return 'USER';
  };

  // Filtered users list
  const filteredUsers = users.filter((u) => {
    const userRole = normalizeRole(u.role);
    const displayName = u.fullName || u.name || '';
    const userRank = u.rank || '';
    const userPos = u.position || '';
    const userRankPos = u.rankAndPosition || `${userRank} - ${userPos}`;
    const userUnit = u.unit || u.unitName || '';

    const matchSearch =
      displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userRankPos.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userUnit.toLowerCase().includes(searchTerm.toLowerCase());

    const matchRole = roleFilter === 'ALL' || userRole === roleFilter;
    const matchUnit = unitFilter === 'ALL' || u.unitId === unitFilter || userUnit.toLowerCase().includes(unitFilter.toLowerCase());

    return matchSearch && matchRole && matchUnit;
  });

  // Role Counts
  const countAdmin = users.filter(u => normalizeRole(u.role) === 'ADMIN').length;
  const countApprover = users.filter(u => normalizeRole(u.role) === 'APPROVER').length;
  const countUser = users.filter(u => normalizeRole(u.role) === 'USER').length;

  const handleOpenNew = () => {
    setEditingUser(null);
    if (units.length === 0) {
      setIsCreatingNewUnit(true);
      setNewUnitName('');
      setFormData({
        fullName: '',
        email: '',
        password: '123@abc',
        role: 'USER',
        rank: 'Đại úy',
        position: 'Chính trị viên',
        rankAndPosition: 'Đại úy - Chính trị viên',
        unitId: '__NEW__',
        unit: '',
        status: 'ACTIVE',
      });
    } else {
      setIsCreatingNewUnit(false);
      setNewUnitName('');
      setFormData({
        fullName: '',
        email: '',
        password: '123@abc',
        role: 'USER',
        rank: 'Đại úy',
        position: 'Chính trị viên',
        rankAndPosition: 'Đại úy - Chính trị viên',
        unitId: units[0].id,
        unit: units[0].name,
        status: 'ACTIVE',
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    const normRole = normalizeRole(u.role);
    const r = u.rank || '';
    const p = u.position || '';
    const rankPos = u.rankAndPosition || (r && p ? `${r} - ${p}` : r || p);
    const matchedUnit = units.find(unitItem => unitItem.id === u.unitId || unitItem.name === (u.unit || u.unitName));

    if (matchedUnit) {
      setIsCreatingNewUnit(false);
      setNewUnitName('');
      setFormData({
        fullName: u.fullName || u.name,
        email: u.email,
        password: u.password || '123@abc',
        role: normRole,
        rank: r,
        position: p,
        rankAndPosition: rankPos,
        unitId: matchedUnit.id,
        unit: matchedUnit.name,
        status: u.status || 'ACTIVE',
      });
    } else {
      const customUnit = u.unit || u.unitName || '';
      setIsCreatingNewUnit(true);
      setNewUnitName(customUnit);
      setFormData({
        fullName: u.fullName || u.name,
        email: u.email,
        password: u.password || '123@abc',
        role: normRole,
        rank: r,
        position: p,
        rankAndPosition: rankPos,
        unitId: '__NEW__',
        unit: customUnit,
        status: u.status || 'ACTIVE',
      });
    }
    setIsModalOpen(true);
  };

  const handleRankOrPosChange = (newRank: string, newPos: string) => {
    setFormData(prev => ({
      ...prev,
      rank: newRank,
      position: newPos,
      rankAndPosition: `${newRank} - ${newPos}`.trim()
    }));
  };

  const handleUnitChange = (selectedUnitId: string) => {
    const selectedUnitObj = units.find(u => u.id === selectedUnitId);
    const unitName = selectedUnitObj ? selectedUnitObj.name : 'Bộ Tư lệnh Vùng 4 Hải Quân';
    setFormData(prev => ({
      ...prev,
      unitId: selectedUnitId,
      unit: unitName,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.email.trim()) return;

    let finalUnitId = formData.unitId;
    let finalUnitName = formData.unit;

    if (isCreatingNewUnit || units.length === 0 || finalUnitId === '__NEW__') {
      const unitNameTrimmed = (newUnitName || formData.unit || '').trim();
      if (!unitNameTrimmed) {
        alert('Vui lòng nhập tên đơn vị');
        return;
      }

      // Kiểm tra xem đơn vị này đã có sẵn trong danh mục đơn vị chưa
      const existing = units.find(u => u.name.trim().toLowerCase() === unitNameTrimmed.toLowerCase());
      if (existing) {
        finalUnitId = existing.id;
        finalUnitName = existing.name;
      } else {
        try {
          setIsSaving(true);
          const unitData: Partial<Unit> = {
            name: unitNameTrimmed,
            code: `DV-${Date.now().toString().slice(-4)}`,
            type: 'BRIGADE',
            status: 'ACTIVE',
            memberCount: 0
          };
          const createdUnit = onCreateUnit ? await onCreateUnit(unitData) : await api.createUnit(unitData);
          if (createdUnit) {
            finalUnitId = createdUnit.id;
            finalUnitName = createdUnit.name;
          } else {
            finalUnitId = `unit-${Date.now()}`;
            finalUnitName = unitNameTrimmed;
          }
        } catch (err) {
          console.error('Lỗi tạo đơn vị mới:', err);
          finalUnitId = `unit-${Date.now()}`;
          finalUnitName = unitNameTrimmed;
        }
      }
    } else {
      const matched = units.find(u => u.id === finalUnitId);
      if (matched) {
        finalUnitName = matched.name;
      }
    }

    const payload: Partial<User> = {
      name: formData.fullName.trim(),
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      password: formData.password.trim(),
      role: formData.role,
      rank: formData.rank.trim(),
      position: formData.position.trim(),
      rankAndPosition: formData.rankAndPosition.trim() || `${formData.rank} - ${formData.position}`.trim(),
      unitId: finalUnitId,
      unitName: finalUnitName,
      unit: finalUnitName,
      status: formData.status,
    };

    try {
      setIsSaving(true);
      if (editingUser) {
        await onUpdateUser(editingUser.id, payload);
      } else {
        await onCreateUser(payload);
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Lỗi lưu tài khoản người dùng:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const renderRoleBadge = (role: string) => {
    const norm = normalizeRole(role);
    switch (norm) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
            Quản trị viên
          </span>
        );
      case 'APPROVER':
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            Người phê duyệt
          </span>
        );
      case 'USER':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
            Người dùng
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            QUẢN LÝ NGƯỜI DÙNG
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Danh sách tài khoản hệ thống ({users.length})
          </p>
        </div>

        <button
          id="btn-add-user"
          onClick={handleOpenNew}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-xs shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Thêm người dùng</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full max-w-md">
          <input
            id="input-search-users"
            type="text"
            placeholder="Tìm theo họ tên, cấp bậc, đơn vị, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-colors"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-600 font-medium">Vai trò:</span>
            <select
              id="select-role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả ({users.length})</option>
              <option value="ADMIN">Quản trị viên ({countAdmin})</option>
              <option value="APPROVER">Người phê duyệt ({countApprover})</option>
              <option value="USER">Người dùng ({countUser})</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-slate-600 font-medium">Đơn vị:</span>
            <select
              id="select-unit-filter"
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 font-medium max-w-[200px] truncate cursor-pointer"
            >
              <option value="ALL">Tất cả đơn vị</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-semibold">
              <tr>
                <th className="p-4">Họ và tên</th>
                <th className="p-4">Cấp bậc & Chức vụ</th>
                <th className="p-4">Đơn vị</th>
                <th className="p-4">Vai trò</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Không tìm thấy người dùng phù hợp.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const displayName = u.fullName || u.name;
                  const rankPos = u.rankAndPosition || (u.rank && u.position ? `${u.rank} - ${u.position}` : u.rank || u.position || '—');
                  const unitDisplayName = u.unit || u.unitName || '—';
                  const isActive = u.status !== 'INACTIVE';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-600 shrink-0 flex items-center justify-center font-bold text-white text-xs">
                            {displayName.substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{displayName}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-medium text-slate-800">{rankPos}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-700 font-medium truncate max-w-[220px] block" title={unitDisplayName}>
                          {unitDisplayName}
                        </span>
                      </td>
                      <td className="p-4">{renderRoleBadge(u.role)}</td>
                      <td className="p-4">
                        {isActive ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-medium text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Hoạt động</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-slate-500 font-medium text-[11px] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>Tạm khóa</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            title="Chỉnh sửa"
                            className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Bạn có chắc muốn xóa tài khoản "${displayName}"?`)) {
                                onDeleteUser(u.id);
                              }
                            }}
                            title="Xóa"
                            className="p-1.5 rounded-lg bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {editingUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Họ và tên <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-user-fullname"
                  type="text"
                  required
                  placeholder="Nguyễn Văn A"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-user-email"
                  type="email"
                  required
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mật khẩu <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-user-password"
                  type="text"
                  required
                  placeholder="Mật khẩu đăng nhập"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Cấp bậc
                  </label>
                  <input
                    id="form-user-rank"
                    type="text"
                    placeholder="Đại úy"
                    value={formData.rank}
                    onChange={(e) => handleRankOrPosChange(e.target.value, formData.position)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Chức vụ
                  </label>
                  <input
                    id="form-user-position"
                    type="text"
                    placeholder="Chính trị viên"
                    value={formData.position}
                    onChange={(e) => handleRankOrPosChange(formData.rank, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Đơn vị: Hỗ trợ chọn có sẵn hoặc tự động tạo mới để đồng bộ */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold">
                      Đơn vị <span className="text-red-500">*</span>
                    </label>
                    {units.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = !isCreatingNewUnit;
                          setIsCreatingNewUnit(next);
                          if (next) {
                            setNewUnitName(formData.unit || '');
                          }
                        }}
                        className="text-[11px] text-blue-600 hover:text-blue-700 hover:underline font-medium cursor-pointer"
                      >
                        {isCreatingNewUnit ? '← Chọn có sẵn' : '+ Tạo mới'}
                      </button>
                    )}
                  </div>
                  {isCreatingNewUnit || units.length === 0 ? (
                    <input
                      id="form-user-new-unit"
                      type="text"
                      required
                      placeholder="Nhập tên đơn vị mới..."
                      value={newUnitName}
                      onChange={(e) => {
                        setNewUnitName(e.target.value);
                        setFormData(prev => ({ ...prev, unit: e.target.value }));
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white font-medium"
                    />
                  ) : (
                    <select
                      id="form-user-unit"
                      value={formData.unitId}
                      onChange={(e) => {
                        if (e.target.value === '__NEW__') {
                          setIsCreatingNewUnit(true);
                          setNewUnitName('');
                        } else {
                          handleUnitChange(e.target.value);
                        }
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden font-medium cursor-pointer"
                    >
                      {units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                      <option value="__NEW__">+ Tạo đơn vị mới...</option>
                    </select>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Vai trò <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="form-user-role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden font-medium cursor-pointer"
                  >
                    <option value="USER">Người dùng</option>
                    <option value="APPROVER">Người phê duyệt</option>
                    <option value="ADMIN">Quản trị viên</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Trạng thái</label>
                <div className="flex items-center space-x-4 pt-1">
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="userStatus"
                      checked={formData.status === 'ACTIVE'}
                      onChange={() => setFormData({ ...formData, status: 'ACTIVE' })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium text-emerald-700">Hoạt động</span>
                  </label>
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="userStatus"
                      checked={formData.status === 'INACTIVE'}
                      onChange={() => setFormData({ ...formData, status: 'INACTIVE' })}
                      className="text-slate-600 focus:ring-slate-500"
                    />
                    <span className="font-medium text-slate-600">Tạm khóa</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button 
                  id="btn-save-user"
                  type="submit" 
                  disabled={isSaving}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {isSaving && (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
