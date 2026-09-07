import React, { useState } from 'react';
import { 
  UserPlus, 
  Trash2, 
  Edit3, 
  CheckCircle,
  XCircle,
  Search,
  ShieldAlert,
  FileCheck2,
  Smartphone,
  Info,
  Building2,
  Award
} from 'lucide-react';
import { User, UserRole, Unit } from '../types';

interface UsersViewProps {
  users: User[];
  units: Unit[];
  onCreateUser: (user: Partial<User>) => Promise<void>;
  onUpdateUser: (id: string, user: Partial<User>) => Promise<void>;
  onDeleteUser: (id: string) => Promise<void>;
}

export const UsersView: React.FC<UsersViewProps> = ({
  users,
  units,
  onCreateUser,
  onUpdateUser,
  onDeleteUser,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [unitFilter, setUnitFilter] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

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

    return matchSearch && matchRole;
  });

  // Role Counts
  const countAdmin = users.filter(u => normalizeRole(u.role) === 'ADMIN').length;
  const countApprover = users.filter(u => normalizeRole(u.role) === 'APPROVER').length;
  const countUser = users.filter(u => normalizeRole(u.role) === 'USER').length;

  const handleOpenNew = () => {
    setEditingUser(null);
    const defaultUnit = units[0]?.name || 'Bộ Tư lệnh Vùng 4 Hải Quân';
    setFormData({
      fullName: '',
      email: '',
      password: '123@abc',
      role: 'USER',
      rank: 'Đại úy',
      position: 'Chính trị viên',
      rankAndPosition: 'Đại úy - Chính trị viên',
      unitId: units[0]?.id || 'unit-1',
      unit: defaultUnit,
      status: 'ACTIVE',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (u: User) => {
    setEditingUser(u);
    const normRole = normalizeRole(u.role);
    const r = u.rank || 'Đại úy';
    const p = u.position || 'Cán bộ';
    const rankPos = u.rankAndPosition || `${r} - ${p}`;
    const matchedUnit = units.find(unitItem => unitItem.id === u.unitId || unitItem.name === (u.unit || u.unitName));

    setFormData({
      fullName: u.fullName || u.name,
      email: u.email,
      password: u.password || '123@abc',
      role: normRole,
      rank: r,
      position: p,
      rankAndPosition: rankPos,
      unitId: matchedUnit?.id || u.unitId || units[0]?.id || 'unit-1',
      unit: matchedUnit?.name || u.unit || u.unitName || 'Bộ Tư lệnh Vùng 4 Hải Quân',
      status: u.status || 'ACTIVE',
    });
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

    const payload: Partial<User> = {
      name: formData.fullName.trim(),
      fullName: formData.fullName.trim(),
      email: formData.email.trim(),
      role: formData.role,
      rank: formData.rank.trim(),
      position: formData.position.trim(),
      rankAndPosition: formData.rankAndPosition.trim() || `${formData.rank} - ${formData.position}`.trim(),
      unitId: formData.unitId,
      unitName: formData.unit,
      unit: formData.unit,
      status: formData.status,
    };

    if (editingUser) {
      await onUpdateUser(editingUser.id, payload);
    } else {
      await onCreateUser(payload);
    }
    setIsModalOpen(false);
  };

  // Badge component matching the strict design guidelines
  const renderRoleBadge = (role: string) => {
    const norm = normalizeRole(role);
    switch (norm) {
      case 'ADMIN':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>ADMIN (Quản trị viên)</span>
          </span>
        );
      case 'APPROVER':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>NGƯỜI PHÊ DUYỆT</span>
          </span>
        );
      case 'USER':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">
            <Smartphone className="w-3.5 h-3.5" />
            <span>NGƯỜI DÙNG (Chiến sĩ)</span>
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Title and Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Phân quyền & Tài khoản
            </span>
            <span className="text-xs text-slate-500 font-mono">Hệ thống 3 Vai trò Chuẩn hóa</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight mt-1">
            QUẢN LÝ NGƯỜI DÙNG & TÀI KHOẢN QUÂN SỰ
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Quản trị danh sách tài khoản Web Admin và phân quyền người dùng đăng nhập trên ứng dụng Mobile Android (APK).
          </p>
        </div>

        <button
          id="btn-add-user"
          onClick={handleOpenNew}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all self-start sm:self-auto cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>Thêm Người dùng</span>
        </button>
      </div>

      {/* 3 Role Definition Cards (Visual Breakdown) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card ADMIN */}
        <div 
          onClick={() => setRoleFilter(roleFilter === 'ADMIN' ? 'ALL' : 'ADMIN')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            roleFilter === 'ADMIN' 
              ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-400' 
              : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-purple-50/30 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">ADMIN (Quản trị viên)</h4>
                <p className="text-[10px] text-purple-700 font-semibold">Toàn quyền hệ thống (Full Access)</p>
              </div>
            </div>
            <span className="text-sm font-extrabold text-purple-800 bg-purple-100 px-2.5 py-0.5 rounded-full font-mono">
              {countAdmin}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
            Quản lý người dùng, đơn vị quân sự, cài đặt hệ thống, chẩn đoán Firebase, biên soạn và phê duyệt nội dung bài giảng.
          </p>
        </div>

        {/* Card APPROVER */}
        <div 
          onClick={() => setRoleFilter(roleFilter === 'APPROVER' ? 'ALL' : 'APPROVER')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            roleFilter === 'APPROVER' 
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400' 
              : 'bg-white border-slate-200 hover:border-amber-200 hover:bg-amber-50/30 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">NGƯỜI PHÊ DUYỆT</h4>
                <p className="text-[10px] text-amber-700 font-semibold">Kiểm duyệt & Xuất bản bài giảng</p>
              </div>
            </div>
            <span className="text-sm font-extrabold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full font-mono">
              {countApprover}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
            Xem tài liệu, kiểm duyệt bài giảng để xuất bản (Public) lên App. Nhận thông báo khi có nội dung mới gửi duyệt.
          </p>
        </div>

        {/* Card USER */}
        <div 
          onClick={() => setRoleFilter(roleFilter === 'USER' ? 'ALL' : 'USER')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            roleFilter === 'USER' 
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-400' 
              : 'bg-white border-slate-200 hover:border-blue-200 hover:bg-blue-50/30 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Smartphone className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800">NGƯỜI DÙNG (Chiến sĩ)</h4>
                <p className="text-[10px] text-blue-700 font-semibold">Đăng nhập Mobile App Android</p>
              </div>
            </div>
            <span className="text-sm font-extrabold text-blue-800 bg-blue-100 px-2.5 py-0.5 rounded-full font-mono">
              {countUser}
            </span>
          </div>
          <p className="text-[11px] text-slate-600 mt-2.5 leading-relaxed">
            Tài khoản tạo sẵn từ Web Admin để học viên/chiến sĩ đăng nhập App APK. Tự động đồng bộ tiến độ học và điểm kiểm tra.
          </p>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative w-full max-w-md">
          <input
            id="input-search-users"
            type="text"
            placeholder="Tìm theo họ tên, cấp bậc, chức vụ, đơn vị, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-3 py-2.5 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-colors"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Dropdown Lọc vai trò chuẩn hóa */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-600 font-semibold">Vai trò:</span>
            <select
              id="select-role-filter"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 font-medium cursor-pointer"
            >
              <option value="ALL">Tất cả vai trò ({users.length})</option>
              <option value="ADMIN">Admin (Quản trị viên) ({countAdmin})</option>
              <option value="APPROVER">Người phê duyệt ({countApprover})</option>
              <option value="USER">Người dùng (Học viên / Chiến sĩ) ({countUser})</option>
            </select>
          </div>

          {/* Unit Filter */}
          <div className="flex items-center space-x-2">
            <span className="text-slate-600 font-semibold">Đơn vị:</span>
            <select
              id="select-unit-filter"
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 rounded-xl px-3 py-2 text-xs focus:outline-hidden focus:border-blue-500 font-medium max-w-[180px] truncate cursor-pointer"
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
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200 font-bold">
              <tr>
                <th className="p-4">Họ và tên</th>
                <th className="p-4">Cấp bậc & Chức vụ</th>
                <th className="p-4">Đơn vị trực thuộc</th>
                <th className="p-4">Vai trò (Role)</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Hành động</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Không tìm thấy quân nhân hoặc tài khoản phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const displayName = u.fullName || u.name;
                  const rankPos = u.rankAndPosition || (u.rank && u.position ? `${u.rank} - ${u.position}` : u.rank || u.position || 'Chiến sĩ Hải Quân');
                  const unitDisplayName = u.unit || u.unitName || 'Bộ Tư lệnh Vùng 4 Hải Quân';
                  const isActive = u.status !== 'INACTIVE';

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 p-0.5 shrink-0 flex items-center justify-center font-bold text-white text-xs shadow-xs">
                            {displayName.substring(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{displayName}</div>
                            <div className="text-[10px] text-slate-500 font-mono flex items-center space-x-1.5 mt-0.5">
                              <span>📧 {u.email}</span>
                              <span>•</span>
                              <span className="text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200" title="Mật khẩu đăng nhập App">
                                🔑 {u.password || '123@abc'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-1.5">
                          <Award className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="font-semibold text-slate-800">{rankPos}</span>
                        </div>
                        {u.rank && u.position && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Cấp bậc: {u.rank} | Chức vụ: {u.position}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-1.5 text-slate-700 font-medium">
                          <Building2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="truncate max-w-[220px]" title={unitDisplayName}>
                            {unitDisplayName}
                          </span>
                        </div>
                      </td>
                      <td className="p-4">{renderRoleBadge(u.role)}</td>
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
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            title="Chỉnh sửa thông tin quân nhân"
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

      {/* Modal: Create / Edit User */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">
                  {editingUser ? 'Chỉnh sửa thông tin quân nhân' : 'Thêm Người dùng / Quân nhân mới'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tài khoản tạo mới sẽ được cấu hình vai trò và cấp quyền truy cập hệ thống theo đúng quy định.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {/* Họ và tên */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Họ và tên quân nhân / cán bộ <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-user-fullname"
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn Nam"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white font-medium"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Email quân sự (Tài khoản đăng nhập) <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-user-email"
                  type="email"
                  required
                  placeholder="nam.nv@navy.mil.vn"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono text-[11px] focus:outline-hidden focus:border-blue-500 focus:bg-white"
                />
              </div>

              {/* Mật khẩu đăng nhập App */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  Mật khẩu đăng nhập App <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    id="form-user-password"
                    type="text"
                    required
                    placeholder="Mật khẩu (mặc định 123@abc)"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 font-mono text-xs focus:outline-hidden focus:border-blue-500 focus:bg-white"
                  />
                  <span className="absolute right-3 top-2.5 text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Mặc định: 123@abc
                  </span>
                </div>
              </div>

              {/* Cấp bậc & Chức vụ */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Cấp bậc <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="form-user-rank"
                    type="text"
                    required
                    placeholder="Đại úy, Thượng úy..."
                    value={formData.rank}
                    onChange={(e) => handleRankOrPosChange(e.target.value, formData.position)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Chức vụ <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="form-user-position"
                    type="text"
                    required
                    placeholder="Chính trị viên, TLTH..."
                    value={formData.position}
                    onChange={(e) => handleRankOrPosChange(formData.rank, e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Cấp bậc & Chức vụ gộp (Preview/Edit) */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1 text-[11px]">
                  Cấp bậc & Chức vụ hiển thị (rankAndPosition)
                </label>
                <input
                  id="form-user-rank-position"
                  type="text"
                  placeholder="Ví dụ: Thượng úy - TLTH"
                  value={formData.rankAndPosition}
                  onChange={(e) => setFormData({ ...formData, rankAndPosition: e.target.value })}
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl p-2.5 text-slate-700 text-xs focus:outline-hidden focus:bg-white"
                />
              </div>

              {/* Đơn vị & Vai trò */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Đơn vị trực thuộc <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="form-user-unit"
                    value={formData.unitId}
                    onChange={(e) => handleUnitChange(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden font-medium cursor-pointer"
                  >
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    Vai trò & Phân quyền <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="form-user-role"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden font-bold cursor-pointer"
                  >
                    <option value="USER">NGƯỜI DÙNG (Chiến sĩ)</option>
                    <option value="APPROVER">NGƯỜI PHÊ DUYỆT</option>
                    <option value="ADMIN">ADMIN (Quản trị viên)</option>
                  </select>
                </div>
              </div>

              {/* Trạng thái hoạt động */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">Trạng thái tài khoản</label>
                <div className="flex items-center space-x-4 pt-1">
                  <label className="inline-flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="userStatus"
                      checked={formData.status === 'ACTIVE'}
                      onChange={() => setFormData({ ...formData, status: 'ACTIVE' })}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-semibold text-emerald-700">Hoạt động (Cho phép đăng nhập)</span>
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

              {/* Role Context Explanation Helper Box */}
              <div className="p-3 rounded-xl border text-[11px] leading-relaxed flex items-start space-x-2.5 bg-slate-50 border-slate-200">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  {formData.role === 'ADMIN' && (
                    <p className="text-purple-900 font-medium">
                      <strong className="text-purple-700">ADMIN (Quản trị viên):</strong> Có toàn quyền quản trị hệ thống (Full Access): Quản lý người dùng, đơn vị, cài đặt hệ thống, chẩn đoán Firebase, biên soạn và phê duyệt nội dung bài giảng.
                    </p>
                  )}
                  {formData.role === 'APPROVER' && (
                    <p className="text-amber-900 font-medium">
                      <strong className="text-amber-700">NGƯỜI PHÊ DUYỆT:</strong> Xem tài liệu, duyệt bài giảng để xuất bản (Public) cho người dùng xem trên App. Nhận thông báo trong App/Web khi có bài viết/bài giảng mới gửi duyệt để thực hiện phê duyệt hoặc từ chối. Không có quyền quản lý hệ thống.
                    </p>
                  )}
                  {formData.role === 'USER' && (
                    <p className="text-blue-900 font-medium">
                      <strong className="text-blue-700">NGƯỜI DÙNG / CHIẾN SĨ:</strong> Tài khoản được tạo từ Web Admin để học viên/chiến sĩ đăng nhập trên App Android. Hiển thị rõ Họ tên, Cấp bậc, Chức vụ, Đơn vị. Dữ liệu học tập & điểm kiểm tra sẽ đồng bộ về Web Admin.
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button 
                  id="btn-save-user"
                  type="submit" 
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {editingUser ? 'Lưu thay đổi' : 'Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
