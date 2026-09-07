import React, { useState } from 'react';
import { Send, ShieldAlert, Trash2, Plus } from 'lucide-react';
import { SystemNotification, Unit } from '../types';

interface NotificationsViewProps {
  notifications: SystemNotification[];
  units: Unit[];
  onCreateNotification: (data: Partial<SystemNotification>) => Promise<void>;
  onDeleteNotification: (id: string) => Promise<void>;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  units,
  onCreateNotification,
  onDeleteNotification,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    type: 'DIRECTIVE' as SystemNotification['type'],
    priority: 'HIGH' as SystemNotification['priority'],
    targetUnitId: 'ALL',
    sentBy: 'Bộ Tư lệnh Vùng 4 Hải Quân',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim()) return;

    await onCreateNotification(formData);
    setFormData({
      title: '',
      content: '',
      type: 'DIRECTIVE',
      priority: 'HIGH',
      targetUnitId: 'ALL',
      sentBy: 'Bộ Tư lệnh Vùng 4 Hải Quân',
    });
    setIsModalOpen(false);
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'DIRECTIVE': return 'Chỉ thị';
      case 'ANNOUNCEMENT': return 'Thông báo';
      case 'STUDY_REMINDER': return 'Nhắc nhở';
      default: return type;
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'Khẩn';
      case 'HIGH': return 'Ưu tiên cao';
      case 'NORMAL': return 'Bình thường';
      default: return priority;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-blue-700 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
              Mạng truyền tin quân sự
            </span>
            <span className="text-xs text-slate-500 font-mono">Chỉ thị GDCT & Đồng bộ tức thì</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 uppercase tracking-tight mt-1">
            PHÁT LỆNH & THÔNG BÁO CHỈ THỊ
          </h2>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-xs transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Gửi Chỉ thị / Thông báo mới</span>
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-xs">
            Chưa có thông báo nào được phát lệnh.
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                <div
                  className={`p-3 rounded-xl shrink-0 ${
                    notif.type === 'DIRECTIVE'
                      ? 'bg-rose-50 text-rose-600 border border-rose-200'
                      : 'bg-blue-50 text-blue-600 border border-blue-200'
                  }`}
                >
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                      {getTypeLabel(notif.type)}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        notif.priority === 'URGENT' || notif.priority === 'HIGH'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {getPriorityLabel(notif.priority)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Gửi tới: {notif.targetUnitId === 'ALL' ? 'Toàn bộ cán bộ chiến sĩ' : notif.targetUnitId}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-800 mt-1">{notif.title}</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.content}</p>

                  <div className="mt-2 text-[10px] text-slate-400 flex items-center space-x-3">
                    <span>Ký duyệt: {notif.sentBy}</span>
                    <span>•</span>
                    <span>{new Date(notif.createdAt).toLocaleDateString('vi-VN')}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onDeleteNotification(notif.id)}
                className="p-2 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors self-end md:self-center border border-slate-200"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal: Create Notification */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase">Phát lệnh Thông báo / Chỉ thị</h3>
            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Tiêu đề thông báo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Chỉ thị kiểm tra chất lượng GDCT..."
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Nội dung chỉ đạo *</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Nội dung chi tiết..."
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Loại thông báo</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden font-medium"
                  >
                    <option value="DIRECTIVE">CHỈ THỊ QUÂN SỰ</option>
                    <option value="ANNOUNCEMENT">THÔNG BÁO CHUNG</option>
                    <option value="STUDY_REMINDER">NHẮC NHỞ HỌC TẬP</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Mức độ ưu tiên</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden font-medium"
                  >
                    <option value="URGENT">KHẨN CẤP</option>
                    <option value="HIGH">CAO</option>
                    <option value="NORMAL">BÌNH THƯỜNG</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Đơn vị nhận lệnh</label>
                <select
                  value={formData.targetUnitId}
                  onChange={(e) => setFormData({ ...formData, targetUnitId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 focus:outline-hidden font-medium"
                >
                  <option value="ALL">Tất cả các đơn vị toàn Vùng</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-xl transition-colors"
                >
                  Hủy
                </button>
                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs flex items-center space-x-1 transition-colors">
                  <Send className="w-3.5 h-3.5" />
                  <span>Phát lệnh</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
