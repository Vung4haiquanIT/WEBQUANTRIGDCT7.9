import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  UserPlus, 
  Search, 
  Key, 
  Lock, 
  Unlock, 
  Trash2, 
  Edit3, 
  CheckCircle, 
  AlertTriangle, 
  Users, 
  Building2, 
  Eye, 
  EyeOff, 
  Sparkles,
  RefreshCw,
  X,
  Check
} from 'lucide-react';
import { SystemAdmin, AdminUserSession, Unit } from '../types';

interface SystemAdminViewProps {
  admins: SystemAdmin[];
  units: Unit[];
  currentAdmin: AdminUserSession | null;
  onCreateAdmin: (admin: Partial<SystemAdmin>) => Promise<void>;
  onUpdateAdmin: (id: string, data: Partial<SystemAdmin>) => Promise<void>;
  onDeleteAdmin: (id: string) => Promise<void>;
  onRefresh?: () => void;
}

const MILITARY_RANKS = [
  'Chuẩn Đô đốc',
  'Đại tá',
  'Thượng tá',
  'Trung tá',
  'Thiếu tá',
  'Đại úy',
  'Thượng úy',
  'Trung úy',
  'Thiếu úy'
];

export const SystemAdminView: React.FC<SystemAdminViewProps> = ({
  admins,
  units,
  currentAdmin,
  onCreateAdmin,
  onUpdateAdmin,
  onDeleteAdmin,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  
  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<SystemAdmin | null>(null);
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState<SystemAdmin | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<SystemAdmin | null>(null);

  // Form states
  const [formData, setFormData] = useState<{
    username: string;
    email: string;
    fullName: string;
    rank: string;
    position: string;
    unitName: string;
    unitId: string;
    password: string;
    notes: string;
  }>({
    username: '',
    email: '',
    fullName: '',
    rank: 'Trung tá',
    position: 'Trợ lý Tuyên huấn',
    unitName: units[0]?.name || '',
    unitId: units[0]?.id || '',
    password: '123@abc',
    notes: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Filtered admins
  const filteredAdmins = admins.filter(admin => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch = 
      !term ||
      (admin.fullName && admin.fullName.toLowerCase().includes(term)) ||
      (admin.username && admin.username.toLowerCase().includes(term)) ||
      (admin.email && admin.email.toLowerCase().includes(term)) ||
      (admin.unitName && admin.unitName.toLowerCase().includes(term)) ||
      (admin.position && admin.position.toLowerCase().includes(term));

    const matchesStatus = 
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && admin.status === 'ACTIVE' && !admin.isLocked) ||
      (statusFilter === 'INACTIVE' && (admin.status === 'INACTIVE' || admin.isLocked));

    return matchesSearch && matchesStatus;
  });

  // Stats
  const totalAdmins = admins.length;
  const subAdminsCount = admins.filter(a => !a.isRoot).length;
  const activeCount = admins.filter(a => a.status === 'ACTIVE' && !a.isLocked).length;
  const lockedCount = admins.filter(a => a.status === 'INACTIVE' || a.isLocked).length;

  const handleOpenCreateModal = () => {
    setFormData({
      username: '',
      email: '',
      fullName: '',
      rank: 'Trung tá',
      position: 'Trợ lý Tuyên huấn',
      unitName: units[0]?.name || '',
      unitId: units[0]?.id || '',
      password: '123@abc',
      notes: ''
    });
    setShowPassword(false);
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedAccount = formData.username.trim().toLowerCase();
    const trimmedFullName = formData.fullName.trim();
    const trimmedPassword = formData.password.trim();

    if (!trimmedAccount || !trimmedFullName || !trimmedPassword) {
      showFeedback('error', 'Vui lòng điền đầy đủ tài khoản/email, họ tên và mật khẩu!');
      return;
    }

    if (trimmedAccount.length < 3) {
      showFeedback('error', 'Tài khoản đăng nhập phải có ít nhất 3 ký tự!');
      return;
    }

    // Check duplicate username or email
    if (admins.some(a => 
      (a.username && a.username.toLowerCase() === trimmedAccount) ||
      (a.email && a.email.toLowerCase() === trimmedAccount)
    )) {
      showFeedback('error', `Tài khoản "${trimmedAccount}" đã tồn tại! Vui lòng chọn tên khác.`);
      return;
    }

    try {
      setIsProcessing(true);
      await onCreateAdmin({
        username: trimmedAccount,
        email: trimmedAccount,
        fullName: trimmedFullName,
        rank: formData.rank,
        position: formData.position,
        rankAndPosition: `${formData.rank} - ${formData.position}`,
        unitName: formData.unitName,
        unitId: formData.unitId,
        password: trimmedPassword,
        role: 'ADMIN',
        isRoot: false,
        canManageAdmins: false, // Explicitly false so sub-admin will never see system-admin tab
        status: 'ACTIVE',
        isLocked: false,
        notes: formData.notes.trim(),
        createdBy: currentAdmin?.name || 'Quản trị viên tối cao'
      });
      setShowCreateModal(false);
      showFeedback('success', `Đã thêm tài khoản quản trị [${trimmedAccount}] thành công!`);
    } catch (err: any) {
      showFeedback('error', err.message || 'Lỗi khi tạo tài khoản quản trị.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;

    try {
      setIsProcessing(true);
      await onUpdateAdmin(editingAdmin.id, {
        fullName: editingAdmin.fullName.trim(),
        email: (editingAdmin.email || '').trim().toLowerCase(),
        rank: editingAdmin.rank,
        position: editingAdmin.position,
        rankAndPosition: `${editingAdmin.rank || ''} - ${editingAdmin.position || ''}`.trim(),
        unitName: editingAdmin.unitName,
        unitId: editingAdmin.unitId,
        notes: editingAdmin.notes || ''
      });
      setEditingAdmin(null);
      showFeedback('success', `Đã cập nhật thông tin tài khoản [${editingAdmin.username}]!`);
    } catch (err: any) {
      showFeedback('error', err.message || 'Lỗi khi cập nhật tài khoản.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleLock = async (admin: SystemAdmin) => {
    if (admin.isRoot) {
      showFeedback('error', 'Không thể khóa tài khoản Quản trị tối cao (Root Administrator)!');
      return;
    }

    const newLocked = !admin.isLocked;
    try {
      setIsProcessing(true);
      await onUpdateAdmin(admin.id, {
        isLocked: newLocked,
        status: newLocked ? 'INACTIVE' : 'ACTIVE'
      });
      showFeedback('success', `${newLocked ? 'Đã khóa' : 'Đã mở khóa'} tài khoản [${admin.username}]!`);
    } catch (err: any) {
      showFeedback('error', err.message || 'Lỗi khi cập nhật trạng thái tài khoản.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordAdmin) return;

    const trimmedNew = newPasswordInput.trim();
    if (!trimmedNew || trimmedNew.length < 6) {
      showFeedback('error', 'Mật khẩu mới phải có ít nhất 6 ký tự!');
      return;
    }
    if (trimmedNew !== confirmPasswordInput.trim()) {
      showFeedback('error', 'Xác nhận mật khẩu mới không khớp!');
      return;
    }

    try {
      setIsProcessing(true);
      await onUpdateAdmin(resetPasswordAdmin.id, {
        password: trimmedNew,
        lastPasswordChangedAt: new Date().toISOString()
      });
      setResetPasswordAdmin(null);
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      showFeedback('success', `Đã đặt lại mật khẩu cho tài khoản [${resetPasswordAdmin.username}] thành công!`);
    } catch (err: any) {
      showFeedback('error', err.message || 'Lỗi khi đặt lại mật khẩu.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingAdmin) return;
    if (deletingAdmin.isRoot) {
      showFeedback('error', 'Không thể xóa tài khoản Quản trị tối cao!');
      setDeletingAdmin(null);
      return;
    }

    try {
      setIsProcessing(true);
      await onDeleteAdmin(deletingAdmin.id);
      showFeedback('success', `Đã xóa tài khoản quản trị [${deletingAdmin.username}]!`);
      setDeletingAdmin(null);
    } catch (err: any) {
      showFeedback('error', err.message || 'Lỗi khi xóa tài khoản.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0B1E3B] via-[#0E2852] to-[#0B1E3B] border border-amber-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-2.5 mb-1.5">
              <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <ShieldCheck className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                  QUẢN TRỊ HỆ THỐNG & PHÂN QUYỀN TÀI KHOẢN
                </h1>
                <p className="text-xs text-slate-300 mt-0.5">
                  Thêm và quản lý các tài khoản quản trị viên. Các tài khoản được thêm sẽ quản trị bài giảng, chuyên đề nhưng <strong className="text-amber-300">không thể nhìn thấy</strong> chức năng quản trị hệ thống này.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-600 text-slate-200 hover:text-white transition-all text-xs font-semibold flex items-center space-x-1.5"
                title="Làm mới danh sách"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline">Làm mới</span>
              </button>
            )}

            <button
              id="btn-add-system-admin"
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>Thêm tài khoản quản trị</span>
            </button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-slate-700/60 text-xs">
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3">
            <div className="text-slate-400 font-medium">Tổng tài khoản</div>
            <div className="text-lg font-black text-white mt-0.5">{totalAdmins}</div>
          </div>
          <div className="bg-slate-900/60 border border-blue-500/30 rounded-xl p-3">
            <div className="text-blue-400 font-medium">Quản trị viên phụ</div>
            <div className="text-lg font-black text-blue-300 mt-0.5">{subAdminsCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-emerald-500/30 rounded-xl p-3">
            <div className="text-emerald-400 font-medium">Đang hoạt động</div>
            <div className="text-lg font-black text-emerald-300 mt-0.5">{activeCount}</div>
          </div>
          <div className="bg-slate-900/60 border border-rose-500/30 rounded-xl p-3">
            <div className="text-rose-400 font-medium">Đang bị khóa</div>
            <div className="text-lg font-black text-rose-300 mt-0.5">{lockedCount}</div>
          </div>
        </div>
      </div>

      {/* Notification Feedback Toast */}
      {feedbackMsg && (
        <div 
          className={`p-3.5 rounded-xl border text-xs flex items-center space-x-2.5 animate-in fade-in slide-in-from-top-2 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500 text-rose-200'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span className="font-medium leading-relaxed">{feedbackMsg.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm theo tên, tài khoản, đơn vị..."
            className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 text-white placeholder-slate-500 text-xs rounded-xl pl-9 pr-3 py-2.5 outline-none transition-all"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>

        <div className="flex items-center space-x-1.5 w-full sm:w-auto">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            Tất cả ({totalAdmins})
          </button>
          <button
            onClick={() => setStatusFilter('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'ACTIVE'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            Hoạt động ({activeCount})
          </button>
          <button
            onClick={() => setStatusFilter('INACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === 'INACTIVE'
                ? 'bg-rose-500 text-slate-950 font-bold shadow'
                : 'bg-slate-800 text-slate-300 hover:text-white border border-slate-700'
            }`}
          >
            Đang khóa ({lockedCount})
          </button>
        </div>
      </div>

      {/* Admins Table */}
      <div className="bg-[#0B1E3B] border border-slate-700/80 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/80 border-b border-slate-700 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-3.5 px-4">Tài khoản & Phân quyền</th>
                <th className="py-3.5 px-4">Họ và tên / Chức vụ</th>
                <th className="py-3.5 px-4">Đơn vị</th>
                <th className="py-3.5 px-4">Trạng thái</th>
                <th className="py-3.5 px-4">Quyền xem QT Hệ thống</th>
                <th className="py-3.5 px-4 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-xs">
              {filteredAdmins.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-600 opacity-60" />
                    <p className="font-medium">Không tìm thấy tài khoản quản trị nào phù hợp.</p>
                  </td>
                </tr>
              ) : (
                filteredAdmins.map((admin) => {
                  const isCurrent = currentAdmin?.email === admin.email || currentAdmin?.username === admin.username;
                  const isRoot = admin.isRoot === true || admin.id === 'admin-root';
                  const isLocked = admin.isLocked === true || admin.status === 'INACTIVE';

                  return (
                    <tr 
                      key={admin.id} 
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isRoot ? 'bg-amber-500/5' : ''
                      }`}
                    >
                      {/* Account & Role */}
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm shrink-0 border ${
                            isRoot 
                              ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-sm shadow-amber-500/20' 
                              : 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                          }`}>
                            {isRoot ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{admin.username}</span>
                              {isCurrent && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500 text-white uppercase">
                                  BẠN
                                </span>
                              )}
                            </div>
                            {admin.email && admin.email !== admin.username && (
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {admin.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Full Name & Position */}
                      <td className="py-4 px-4">
                        <div className="font-semibold text-slate-200">
                          {admin.fullName || admin.username}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {admin.rankAndPosition || `${admin.rank || ''} - ${admin.position || ''}`.trim() || 'Cán bộ quản trị'}
                        </div>
                      </td>

                      {/* Unit */}
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-1.5 text-slate-300 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-amber-400/80 shrink-0" />
                          <span>{admin.unitName || 'Bộ Tư lệnh Vùng 4 Hải Quân'}</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        {isLocked ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950/80 text-rose-300 border border-rose-500/40">
                            <Lock className="w-3 h-3" />
                            <span>Đã khóa</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Hoạt động</span>
                          </span>
                        )}
                      </td>

                      {/* Visibility of System Admin tab */}
                      <td className="py-4 px-4">
                        {isRoot ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            <CheckCircle className="w-3 h-3 text-amber-400" />
                            <span>Hiển thị (Toàn quyền)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                            <span>Ẩn (Không hiển thị)</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* Reset password button */}
                          <button
                            onClick={() => {
                              setResetPasswordAdmin(admin);
                              setNewPasswordInput('');
                              setConfirmPasswordInput('');
                              setShowNewPassword(false);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-500/20 text-slate-300 hover:text-amber-300 border border-slate-700 transition-all"
                            title="Đặt lại mật khẩu cho tài khoản này"
                          >
                            <Key className="w-4 h-4" />
                          </button>

                          {/* Edit button */}
                          <button
                            onClick={() => setEditingAdmin({ ...admin })}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-500/20 text-slate-300 hover:text-blue-300 border border-slate-700 transition-all"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>

                          {/* Lock / Unlock button (Cannot lock Root) */}
                          <button
                            disabled={isRoot}
                            onClick={() => handleToggleLock(admin)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              isRoot 
                                ? 'opacity-30 cursor-not-allowed bg-slate-800/40 border-slate-800 text-slate-500' 
                                : isLocked
                                ? 'bg-emerald-950/80 hover:bg-emerald-900 border-emerald-500/60 text-emerald-300'
                                : 'bg-slate-800 hover:bg-rose-500/20 border-slate-700 text-slate-300 hover:text-rose-300'
                            }`}
                            title={isRoot ? 'Tài khoản Root không thể khóa' : isLocked ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                          >
                            {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                          </button>

                          {/* Delete button (Cannot delete Root) */}
                          <button
                            disabled={isRoot}
                            onClick={() => setDeletingAdmin(admin)}
                            className={`p-1.5 rounded-lg border transition-all ${
                              isRoot 
                                ? 'opacity-30 cursor-not-allowed bg-slate-800/40 border-slate-800 text-slate-500' 
                                : 'bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border-slate-700'
                            }`}
                            title={isRoot ? 'Tài khoản Root không thể xóa' : 'Xóa tài khoản quản trị này'}
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Modal: Thêm tài khoản quản trị mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0B1E3B] border border-amber-500/40 rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl shadow-black/80 flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-700/80 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center space-x-2.5">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <UserPlus className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    THÊM TÀI KHOẢN QUẢN TRỊ VIÊN MỚI
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Cấp quyền đăng nhập quản trị bài giảng, chuyên đề cho cán bộ
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Lưu ý quan trọng:</strong> Tài khoản được thêm ở đây sẽ có quyền thêm sửa xóa chuyên đề, bài học, kiểm tra, video, tài liệu... nhưng <u>hoàn toàn không thấy</u> menu <strong>"QUẢN TRỊ HỆ THỐNG"</strong> này.
                </div>
              </div>

              {/* Account / Email combined */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Tài khoản / Email đăng nhập <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) => {
                    const val = e.target.value.toLowerCase().replace(/\s+/g, '');
                    setFormData({ ...formData, username: val, email: val });
                  }}
                  placeholder="ví dụ: xuantien@v4.hq"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">Tài khoản dùng để đăng nhập vào hệ thống (ví dụ: xuantien@v4.hq)</span>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Họ và tên cán bộ <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="ví dụ: Trần Văn Toàn"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none font-semibold"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Rank */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Cấp bậc quân sự
                  </label>
                  <select
                    value={formData.rank}
                    onChange={(e) => setFormData({ ...formData, rank: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 text-white text-xs rounded-xl px-3 py-2.5 outline-none"
                  >
                    {MILITARY_RANKS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                {/* Position */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Chức vụ đảm nhiệm
                  </label>
                  <input
                    type="text"
                    value={formData.position}
                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                    placeholder="ví dụ: Trợ lý Tuyên huấn"
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
                  />
                </div>
              </div>

              {/* Unit */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Đơn vị công tác
                </label>
                <select
                  value={formData.unitName}
                  onChange={(e) => {
                    const sel = units.find(u => u.name === e.target.value);
                    setFormData({ 
                      ...formData, 
                      unitName: e.target.value,
                      unitId: sel?.id || ''
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 text-white text-xs rounded-xl px-3 py-2.5 outline-none"
                >
                  {units.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </div>

              {/* Initial Password */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Mật khẩu khởi tạo <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 text-white text-xs rounded-xl pl-3.5 pr-10 py-2.5 outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>Mặc định: <strong className="text-amber-300">123@abc</strong></span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, password: '123@abc' })}
                    className="text-amber-400 hover:underline"
                  >
                    Khôi phục 123@abc
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Ghi chú phân công
                </label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ghi chú về phạm vi chuyên môn hoặc quyền hạn phụ trách..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 text-white text-xs rounded-xl px-3.5 py-2 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50"
                >
                  {isProcessing ? 'ĐANG KHỞI TẠO...' : 'TẠO TÀI KHOẢN QUẢN TRỊ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Chỉnh sửa thông tin tài khoản */}
      {editingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0B1E3B] border border-blue-500/40 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-700/80 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center space-x-2.5">
                <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  <Edit3 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    SỬA THÔNG TIN: {editingAdmin.username}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Cập nhật họ tên, cấp bậc, chức vụ và đơn vị công tác
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setEditingAdmin(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Tài khoản / Email đăng nhập (Cố định)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingAdmin.username}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-400 text-xs rounded-xl px-3.5 py-2.5 outline-none font-mono cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Họ và tên cán bộ <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editingAdmin.fullName}
                  onChange={(e) => setEditingAdmin({ ...editingAdmin, fullName: e.target.value })}
                  placeholder="ví dụ: Trần Văn Toàn"
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-400 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Cấp bậc
                  </label>
                  <select
                    value={editingAdmin.rank || 'Trung tá'}
                    onChange={(e) => setEditingAdmin({ ...editingAdmin, rank: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-blue-400 text-white text-xs rounded-xl px-3 py-2.5 outline-none"
                  >
                    {MILITARY_RANKS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                    {editingAdmin.rank && !MILITARY_RANKS.includes(editingAdmin.rank) && (
                      <option value={editingAdmin.rank}>{editingAdmin.rank}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Chức vụ
                  </label>
                  <input
                    type="text"
                    value={editingAdmin.position || ''}
                    onChange={(e) => setEditingAdmin({ ...editingAdmin, position: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 focus:border-blue-400 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Đơn vị công tác
                </label>
                <select
                  value={editingAdmin.unitName || ''}
                  onChange={(e) => {
                    const sel = units.find(u => u.name === e.target.value);
                    setEditingAdmin({ 
                      ...editingAdmin, 
                      unitName: e.target.value,
                      unitId: sel?.id || editingAdmin.unitId
                    });
                  }}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-400 text-white text-xs rounded-xl px-3 py-2.5 outline-none"
                >
                  {units.map(u => (
                    <option key={u.id} value={u.name}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Ghi chú
                </label>
                <textarea
                  rows={2}
                  value={editingAdmin.notes || ''}
                  onChange={(e) => setEditingAdmin({ ...editingAdmin, notes: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-blue-400 text-white text-xs rounded-xl px-3.5 py-2 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-blue-500/20"
                >
                  LƯU THAY ĐỔI
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Đặt lại mật khẩu */}
      {resetPasswordAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0B1E3B] border border-amber-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col">
            <div className="p-5 border-b border-slate-700/80 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center space-x-2.5">
                <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Key className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    ĐẶT LẠI MẬT KHẨU
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Tài khoản: <strong className="text-amber-300">{resetPasswordAdmin.username}</strong> ({resetPasswordAdmin.fullName})
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setResetPasswordAdmin(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Mật khẩu mới <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Tối thiểu 6 ký tự..."
                    className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 text-white text-xs rounded-xl pl-3.5 pr-10 py-2.5 outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                  Xác nhận mật khẩu mới <span className="text-rose-400">*</span>
                </label>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full bg-slate-900 border border-slate-700 focus:border-amber-400 text-white text-xs rounded-xl px-3.5 py-2.5 outline-none font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-2.5">
                <button
                  type="button"
                  onClick={() => setResetPasswordAdmin(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
                >
                  HỦY
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20"
                >
                  {isProcessing ? 'ĐANG CẬP NHẬT...' : 'XÁC NHẬN ĐỔI MẬT KHẨU'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xác nhận xóa tài khoản */}
      {deletingAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0B1E3B] border border-rose-500/40 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-400 mx-auto flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-white uppercase tracking-tight mb-2">
              XÁC NHẬN XÓA TÀI KHOẢN QUẢN TRỊ
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed mb-6">
              Đồng chí có chắc chắn muốn xóa tài khoản quản trị <strong className="text-rose-400 font-mono">[{deletingAdmin.username}]</strong> ({deletingAdmin.fullName})? Cán bộ này sẽ không còn quyền đăng nhập vào hệ thống quản trị.
            </p>

            <div className="flex items-center justify-center space-x-3">
              <button
                type="button"
                onClick={() => setDeletingAdmin(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                HỦY BỎ
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleDeleteConfirm}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/30 transition-all"
              >
                {isProcessing ? 'ĐANG XÓA...' : 'ĐỒNG Ý XÓA'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
