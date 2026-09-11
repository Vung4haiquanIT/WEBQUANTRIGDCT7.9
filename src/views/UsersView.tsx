import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Trash2, 
  Edit3, 
  CheckCircle,
  XCircle,
  Search,
  Eye,
  Key,
  RefreshCw,
  Shield,
  Award,
  BookOpen,
  FileCheck,
  MessageSquare,
  Building2,
  Clock,
  UserCheck,
  Smartphone,
  Lock,
  Unlock,
  Users
} from 'lucide-react';
import { User, UserRole, Unit, UserProgress, ExamSubmission, UserFeedback } from '../types';
import { matchSearch } from '../utils/vietnamese';
import { api } from '../services/api';

interface UsersViewProps {
  users: User[];
  units: Unit[];
  onCreateUser: (user: Partial<User>) => Promise<void>;
  onUpdateUser: (id: string, user: Partial<User>) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
  onCreateUnit?: (unit: Partial<Unit>) => Promise<Unit>;
}

interface UserDetailData {
  progressList: UserProgress[];
  examSubmissions: ExamSubmission[];
  feedbacks: UserFeedback[];
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
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  
  // Create / Edit User Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isCreatingNewUnit, setIsCreatingNewUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Detail & Cloud Sync Modal State
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [userDetailTab, setUserDetailTab] = useState<'profile' | 'learning' | 'exams' | 'feedbacks'>('profile');
  const [userDetailData, setUserDetailData] = useState<UserDetailData | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Quick Reset Password Modal State
  const [resetPassUser, setResetPassUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('123@abc');
  const [isResettingPass, setIsResettingPass] = useState(false);

  // Custom Confirmation Modal State (Replaces blocked window.confirm in iframe)
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  // Success Notification Dialog State (Replaces blocked window.alert in iframe)
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // Normalize user roles for legacy values
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

    const matchSearchQuery = !searchTerm.trim() ||
      matchSearch(displayName, searchTerm) ||
      matchSearch(u.email, searchTerm) ||
      matchSearch(userRankPos, searchTerm) ||
      matchSearch(userUnit, searchTerm);

    const matchRole = roleFilter === 'ALL' || userRole === roleFilter;
    const matchUnit = unitFilter === 'ALL' || u.unitId === unitFilter || userUnit.toLowerCase().includes(unitFilter.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? u.status !== 'INACTIVE' : u.status === 'INACTIVE');

    return matchSearchQuery && matchRole && matchUnit && matchStatus;
  });

  // Role & Status Counts
  const countAdmin = users.filter(u => normalizeRole(u.role) === 'ADMIN').length;
  const countApprover = users.filter(u => normalizeRole(u.role) === 'APPROVER').length;
  const countUser = users.filter(u => normalizeRole(u.role) === 'USER').length;
  const countActive = users.filter(u => u.status !== 'INACTIVE').length;

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

  const handleOpenUserDetail = async (u: User) => {
    setViewingUser(u);
    setUserDetailTab('profile');
    setIsLoadingDetail(true);
    setUserDetailData(null);

    try {
      const res = await api.getUserPersonalCloudData(u.id);
      setUserDetailData(res);
    } catch (err) {
      console.error('Lỗi tải dữ liệu cá nhân đồng bộ:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleToggleUserStatus = (u: User) => {
    const nextStatus = u.status === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE';
    const actionText = nextStatus === 'ACTIVE' ? 'mở khóa' : 'khóa tạm thời';
    setConfirmDialog({
      isOpen: true,
      title: `${nextStatus === 'ACTIVE' ? 'Mở khóa' : 'Tạm khóa'} tài khoản`,
      message: `Bạn có chắc muốn ${actionText} tài khoản "${u.fullName || u.name}"?`,
      onConfirm: async () => {
        try {
          await onUpdateUser(u.id, { status: nextStatus });
        } catch (err) {
          console.error('Lỗi thay đổi trạng thái tài khoản:', err);
        }
        setConfirmDialog(null);
      }
    });
  };

  const handleOpenResetPassword = (u: User) => {
    setResetPassUser(u);
    setNewPassword(u.password || '123@abc');
  };

  const handleSaveResetPassword = async () => {
    if (!resetPassUser || !newPassword.trim()) return;
    try {
      setIsResettingPass(true);
      await onUpdateUser(resetPassUser.id, { password: newPassword.trim() });
      setSuccessMessage(`Đã cập nhật mật khẩu mới cho tài khoản "${resetPassUser.fullName || resetPassUser.name}"!`);
      setResetPassUser(null);
    } catch (err) {
      console.error('Lỗi cập nhật mật khẩu:', err);
      setSuccessMessage('Không thể cập nhật mật khẩu. Vui lòng thử lại.');
    } finally {
      setIsResettingPass(false);
    }
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
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            <Shield className="w-3 h-3 text-purple-600" />
            <span>Quản trị viên</span>
          </span>
        );
      case 'APPROVER':
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <UserCheck className="w-3 h-3 text-amber-600" />
            <span>Người phê duyệt</span>
          </span>
        );
      case 'USER':
      default:
        return (
          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Smartphone className="w-3 h-3 text-blue-600" />
            <span>Người dùng App</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-5 pb-12">
      {/* Header & Stats Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              QUẢN LÝ NGƯỜI DÙNG & ĐỒNG BỘ TÀI KHOẢN
            </h2>
            <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
              <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
              <span>Realtime Cloud Sync</span>
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Mỗi tài khoản được tạo có dữ liệu cá nhân riêng biệt, đồng bộ kết quả học tập và thi cử giữa Web Quản trị và App di động.
          </p>
        </div>

        <button
          id="btn-add-user"
          onClick={handleOpenNew}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-xs shadow-xs transition-colors self-start sm:self-auto cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Thêm người dùng mới</span>
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Tổng tài khoản</div>
            <div className="text-lg font-extrabold text-slate-800">{users.length}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Đang hoạt động</div>
            <div className="text-lg font-extrabold text-emerald-700">{countActive}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Cán bộ / Quản trị</div>
            <div className="text-lg font-extrabold text-purple-700">{countAdmin + countApprover}</div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Quân nhân dự thi</div>
            <div className="text-lg font-extrabold text-amber-700">{countUser}</div>
          </div>
        </div>
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
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-colors font-medium"
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
              <option value="USER">Người dùng App ({countUser})</option>
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

          <div className="flex items-center space-x-2">
            <span className="text-slate-600 font-medium">Trạng thái:</span>
            <select
              id="select-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động</option>
              <option value="INACTIVE">Tạm khóa</option>
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
                <th className="p-4">Họ và tên / Tài khoản App</th>
                <th className="p-4">Cấp bậc & Chức vụ</th>
                <th className="p-4">Đơn vị công tác</th>
                <th className="p-4">Vai trò</th>
                <th className="p-4">Đăng nhập App</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Hành động & Dữ liệu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                    Không tìm thấy tài khoản người dùng phù hợp với bộ lọc.
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
                          <div className="w-9 h-9 rounded-xl bg-blue-600 shrink-0 flex items-center justify-center font-bold text-white text-xs shadow-xs">
                            {displayName.substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{displayName}</div>
                            <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                              {u.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-semibold text-slate-800">{rankPos}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-700 font-medium truncate max-w-[200px] block" title={unitDisplayName}>
                          {unitDisplayName}
                        </span>
                      </td>
                      <td className="p-4">{renderRoleBadge(u.role)}</td>
                      <td className="p-4">
                        <div className="flex items-center space-x-1.5 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-mono text-slate-700">
                          <Key className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[100px]">{u.password || '123@abc'}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        {isActive ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-700 font-semibold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            <span>Hoạt động</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-slate-500 font-semibold text-[11px] bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            <span>Tạm khóa</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Xem dữ liệu cá nhân & Tiến độ đồng bộ Cloud */}
                          <button
                            onClick={() => handleOpenUserDetail(u)}
                            title="Xem chi tiết dữ liệu cá nhân & Tiến độ thi cử Cloud"
                            className="flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-semibold text-[11px] transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" />
                            <span>Dữ liệu Cloud</span>
                          </button>

                          {/* Reset mật khẩu */}
                          <button
                            onClick={() => handleOpenResetPassword(u)}
                            title="Đổi/Reset Mật khẩu App"
                            className="p-1.5 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          {/* Khóa / Mở khóa */}
                          <button
                            onClick={() => handleToggleUserStatus(u)}
                            title={isActive ? 'Tạm khóa tài khoản' : 'Mở khóa tài khoản'}
                            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                              isActive 
                                ? 'bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 border-slate-200' 
                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'
                            }`}
                          >
                            {isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>

                          {/* Sửa */}
                          <button
                            onClick={() => handleOpenEdit(u)}
                            title="Chỉnh sửa thông tin"
                            className="p-1.5 rounded-lg bg-slate-50 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Xóa */}
                          <button
                            onClick={() => {
                              setConfirmDialog({
                                isOpen: true,
                                title: 'Xóa tài khoản',
                                message: `Bạn có chắc muốn xóa tài khoản "${displayName}"? Toàn bộ thông tin tài khoản và dữ liệu liên quan sẽ bị xóa sạch khỏi Cloud.`,
                                onConfirm: async () => {
                                  try {
                                    await onDeleteUser(u.id);
                                  } catch (err) {
                                    console.error('Lỗi khi xóa người dùng:', err);
                                  }
                                  setConfirmDialog(null);
                                }
                              });
                            }}
                            title="Xóa tài khoản"
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

      {/* Modal: View User Personal Cloud Data */}
      {viewingUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                  {(viewingUser.fullName || viewingUser.name).substring(0, 1).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-base flex items-center space-x-2">
                    <span>{viewingUser.fullName || viewingUser.name}</span>
                    <span className="text-xs font-normal text-slate-500">({viewingUser.rankAndPosition || viewingUser.rank})</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Đơn vị: {viewingUser.unit || viewingUser.unitName} • Email: <span className="font-mono text-slate-700">{viewingUser.email}</span>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setViewingUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex items-center border-b border-slate-200 bg-white px-5 text-xs font-semibold text-slate-600">
              <button
                onClick={() => setUserDetailTab('profile')}
                className={`py-3 px-4 border-b-2 flex items-center space-x-2 cursor-pointer transition-colors ${
                  userDetailTab === 'profile'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>1. Hồ sơ cá nhân</span>
              </button>

              <button
                onClick={() => setUserDetailTab('learning')}
                className={`py-3 px-4 border-b-2 flex items-center space-x-2 cursor-pointer transition-colors ${
                  userDetailTab === 'learning'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>2. Tiến độ Học tập App ({userDetailData?.progressList.length || 0})</span>
              </button>

              <button
                onClick={() => setUserDetailTab('exams')}
                className={`py-3 px-4 border-b-2 flex items-center space-x-2 cursor-pointer transition-colors ${
                  userDetailTab === 'exams'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Award className="w-4 h-4" />
                <span>3. Kết quả Bài thi ({userDetailData?.examSubmissions.length || 0})</span>
              </button>

              <button
                onClick={() => setUserDetailTab('feedbacks')}
                className={`py-3 px-4 border-b-2 flex items-center space-x-2 cursor-pointer transition-colors ${
                  userDetailTab === 'feedbacks'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>4. Phản ánh App ({userDetailData?.feedbacks.length || 0})</span>
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {isLoadingDetail ? (
                <div className="p-12 text-center text-slate-500 space-y-3">
                  <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs font-medium">Đang đồng bộ dữ liệu cá nhân từ Firebase Cloud...</p>
                </div>
              ) : userDetailTab === 'profile' ? (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div>
                      <span className="text-slate-400 block mb-0.5">Mã ID Tài khoản Cloud:</span>
                      <span className="font-mono font-bold text-slate-800">{viewingUser.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Email đăng nhập App:</span>
                      <span className="font-mono font-bold text-slate-800">{viewingUser.email}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Mật khẩu App hiện tại:</span>
                      <span className="font-mono font-bold text-slate-800">{viewingUser.password || '123@abc'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Cấp bậc & Chức vụ:</span>
                      <span className="font-bold text-slate-800">{viewingUser.rankAndPosition || `${viewingUser.rank} - ${viewingUser.position}`}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Đơn vị công tác:</span>
                      <span className="font-bold text-slate-800">{viewingUser.unit || viewingUser.unitName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Trạng thái hoạt động:</span>
                      <span className={`font-bold ${viewingUser.status !== 'INACTIVE' ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {viewingUser.status !== 'INACTIVE' ? 'Đang hoạt động' : 'Đã tạm khóa'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200 text-blue-800 space-y-2">
                    <div className="font-bold flex items-center space-x-1.5 text-blue-900">
                      <Smartphone className="w-4 h-4 text-blue-600" />
                      <span>Hướng dẫn đồng bộ trên App di động:</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      Quân nhân có thể sử dụng email <strong className="text-slate-800 font-mono">{viewingUser.email}</strong> và mật khẩu <strong className="text-slate-800 font-mono">{viewingUser.password || '123@abc'}</strong> để đăng nhập trên ứng dụng GDCT di động. Tất cả tiến độ đọc bài học, xem video, làm trắc nghiệm và kết quả các đợt thi sẽ tự động đồng bộ thời gian thực về hồ sơ cá nhân này.
                    </p>
                  </div>
                </div>
              ) : userDetailTab === 'learning' ? (
                <div>
                  {!userDetailData?.progressList || userDetailData.progressList.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Quân nhân này chưa học bài học nào trên App di động hoặc Web.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="p-3">Bài học / Chuyên đề</th>
                            <th className="p-3 text-center">Slide %</th>
                            <th className="p-3 text-center">Nội dung %</th>
                            <th className="p-3 text-center">Video %</th>
                            <th className="p-3 text-center">Audio %</th>
                            <th className="p-3 text-center">Tổng quan %</th>
                            <th className="p-3 text-right">Lần cuối học</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {userDetailData.progressList.map(prog => (
                            <tr key={prog.id} className="hover:bg-slate-50">
                              <td className="p-3 font-semibold text-slate-800 max-w-[200px] truncate">
                                {prog.lessonTitle || prog.lessonId}
                              </td>
                              <td className="p-3 text-center font-mono">{prog.slideProgress || 0}%</td>
                              <td className="p-3 text-center font-mono">{prog.contentProgress || 0}%</td>
                              <td className="p-3 text-center font-mono">{prog.videoProgress || 0}%</td>
                              <td className="p-3 text-center font-mono">{prog.audioProgress || 0}%</td>
                              <td className="p-3 text-center">
                                <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${
                                  prog.overallProgress >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                                }`}>
                                  {prog.overallProgress || 0}%
                                </span>
                              </td>
                              <td className="p-3 text-right text-slate-500 text-[11px]">
                                {(() => {
                                  if (!prog.lastAccessedAt) return '—';
                                  const d = new Date(prog.lastAccessedAt);
                                  if (!isNaN(d.getTime())) return d.toLocaleString('vi-VN');
                                  const num = Number(prog.lastAccessedAt);
                                  if (!isNaN(num) && num > 0) return new Date(num).toLocaleString('vi-VN');
                                  return '—';
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : userDetailTab === 'exams' ? (
                <div>
                  {!userDetailData?.examSubmissions || userDetailData.examSubmissions.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Quân nhân này chưa làm bài kiểm tra đợt thi nào trên ứng dụng di động.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-[11px] font-semibold text-slate-500 border-b border-slate-200">
                          <tr>
                            <th className="p-3">Đợt kiểm tra</th>
                            <th className="p-3 text-center">Điểm số</th>
                            <th className="p-3 text-center">Số câu đúng</th>
                            <th className="p-3 text-center">Kết quả</th>
                            <th className="p-3 text-right">Thời gian nộp</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {userDetailData.examSubmissions.map(sub => (
                            <tr key={sub.id} className="hover:bg-slate-50">
                              <td className="p-3 font-semibold text-slate-800">{sub.sessionTitle || 'Bài kiểm tra'}</td>
                              <td className="p-3 text-center font-bold text-blue-600 text-sm">{sub.score} / 10</td>
                              <td className="p-3 text-center font-mono">{sub.correctCount} / {sub.totalQuestions}</td>
                              <td className="p-3 text-center">
                                {sub.passed ? (
                                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                    ĐẠT
                                  </span>
                                ) : (
                                  <span className="bg-rose-50 text-rose-700 border border-rose-200 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                    CHƯA ĐẠT
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right text-slate-500 text-[11px]">
                                {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString('vi-VN') : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {!userDetailData?.feedbacks || userDetailData.feedbacks.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      Quân nhân này chưa gửi phản ánh hay báo lỗi nào từ App.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {userDetailData.feedbacks.map(fb => (
                        <div key={fb.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                          <div className="flex items-center justify-between font-bold text-slate-800">
                            <span>{fb.title || 'Phản ánh nội dung'}</span>
                            <span className="text-[10px] text-slate-400">
                              {fb.createdAt ? new Date(fb.createdAt).toLocaleString('vi-VN') : ''}
                            </span>
                          </div>
                          <p className="text-slate-600">{fb.content}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setViewingUser(null)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium text-xs rounded-xl transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Quick Reset Password */}
      {resetPassUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <Key className="w-4 h-4 text-amber-600" />
                <span>Đặt lại mật khẩu App</span>
              </h3>
              <button
                onClick={() => setResetPassUser(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                Tài khoản: <strong className="text-slate-800">{resetPassUser.fullName || resetPassUser.name}</strong> ({resetPassUser.email})
              </p>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mật khẩu mới đăng nhập App:
                </label>
                <input
                  type="text"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono text-sm focus:outline-hidden focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setResetPassUser(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs rounded-xl cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isResettingPass}
                onClick={handleSaveResetPassword}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-xl shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isResettingPass ? 'Đang lưu...' : 'Lưu mật khẩu mới'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-800">
                {editingUser ? 'Chỉnh sửa người dùng' : 'Thêm người dùng mới'}
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Email đăng nhập App / Web <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-user-email"
                  type="email"
                  required
                  placeholder="email@vung4.vn"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Mật khẩu đăng nhập App <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-user-password"
                  type="text"
                  required
                  placeholder="Mật khẩu (Mặc định: 123@abc)"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white font-mono"
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
                    <option value="USER">Người dùng App</option>
                    <option value="APPROVER">Người phê duyệt</option>
                    <option value="ADMIN">Quản trị viên</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Trạng thái hoạt động</label>
                <div className="flex items-center space-x-4 pt-1">
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="userStatus"
                      checked={formData.status === 'ACTIVE'}
                      onChange={() => setFormData({ ...formData, status: 'ACTIVE' })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-emerald-700">Hoạt động</span>
                  </label>
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="userStatus"
                      checked={formData.status === 'INACTIVE'}
                      onChange={() => setFormData({ ...formData, status: 'INACTIVE' })}
                      className="text-slate-600 focus:ring-slate-500"
                    />
                    <span className="font-semibold text-slate-600">Tạm khóa</span>
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

      {/* Custom Confirmation Modal */}
      {confirmDialog && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col p-6 animate-scale-up">
            <h3 className="text-lg font-bold text-slate-900 mb-2">{confirmDialog.title}</h3>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-sm transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                }}
                className={`px-4 py-2 rounded-xl text-white font-semibold text-sm transition-colors cursor-pointer ${
                  confirmDialog.title.includes('Xóa') ? 'bg-rose-600 hover:bg-rose-700 shadow-xs' : 'bg-blue-600 hover:bg-blue-700 shadow-xs'
                }`}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Success Alert Modal */}
      {successMessage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col p-6 animate-scale-up">
            <div className="flex items-center space-x-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Thông báo</h3>
            </div>
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">{successMessage}</p>
            <div className="flex items-center justify-end">
              <button
                onClick={() => setSuccessMessage(null)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors cursor-pointer shadow-xs"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
