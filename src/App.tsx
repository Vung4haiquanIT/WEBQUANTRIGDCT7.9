import React, { useState, useEffect, useMemo } from 'react';
import { 
  Course, 
  Lesson, 
  Unit, 
  User, 
  UserProgress, 
  SystemNotification, 
  RealtimeEvent,
  AppBanner,
  UserFeedback
} from './types';
import { api } from './services/api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LessonPreviewModal } from './components/LessonPreviewModal';
import { DashboardView } from './views/DashboardView';
import { CoursesView } from './views/CoursesView';
import { ExamsView } from './views/ExamsView';
import { FeedbacksView } from './views/FeedbacksView';
import { LessonEditorView } from './views/LessonEditorView';
import { UsersView } from './views/UsersView';
import { UnitsView } from './views/UnitsView';
import { BannersView } from './views/BannersView';
import { ProgressView } from './views/ProgressView';
import { NotificationsView } from './views/NotificationsView';
import { SettingsView } from './views/SettingsView';
import { FirebaseDiagnosticsView } from './views/FirebaseDiagnosticsView';
import { LoginView } from './views/LoginView';
import { Radio, Bell, CheckCircle } from 'lucide-react';

export function App() {
  const [adminUser, setAdminUser] = useState<{ email: string; name: string; role: string } | null>(() => {
    try {
      const saved = localStorage.getItem('hq_admin_session') || sessionStorage.getItem('hq_admin_session');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to parse admin session:', e);
    }
    return null;
  });

  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [realtimeNotification, setRealtimeNotification] = useState<string | null>(null);

  // Core domain data
  const [courses, setCourses] = useState<Course[]>([]);
  const [deletedCourses, setDeletedCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [deletedLessons, setDeletedLessons] = useState<Lesson[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [progressList, setProgressList] = useState<UserProgress[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [banners, setBanners] = useState<AppBanner[]>([]);
  const [feedbacks, setFeedbacks] = useState<UserFeedback[]>([]);

  // Navigation & Modal states
  const [selectedLessonForEditing, setSelectedLessonForEditing] = useState<Lesson | null>(null);
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Unresolved feedbacks count (pending, received, in-progress, or without admin response)
  const unresolvedFeedbacksCount = useMemo(() => {
    return feedbacks.filter((f) => {
      const st = (f.status || '').toUpperCase();
      return (
        st === 'PENDING' ||
        st === 'RECEIVED' ||
        st === 'IN_PROGRESS' ||
        (!f.adminResponse && st !== 'RESOLVED' && st !== 'REJECTED')
      );
    }).length;
  }, [feedbacks]);

  // Load all initial data from backend API
  const fetchAllData = async () => {
    if (!adminUser) return;
    try {
      setIsLoading(true);
      const [
        coursesRes,
        deletedCoursesRes,
        lessonsRes,
        deletedLessonsRes,
        unitsRes,
        usersRes,
        progressRes,
        notifsRes,
        bannersRes,
        feedbacksRes,
      ] = await Promise.all([
        api.getCourses(false),
        api.getCourses(true),
        api.getLessons({ isDeleted: false }),
        api.getLessons({ isDeleted: true }),
        api.getUnits(),
        api.getUsers(),
        api.getProgress(),
        api.getNotifications(),
        api.getBanners().catch(() => []),
        api.getFeedbacks().catch(() => []),
      ]);

      setCourses(coursesRes);
      setDeletedCourses(deletedCoursesRes);
      setLessons(lessonsRes);
      setDeletedLessons(deletedLessonsRes);
      setUnits(unitsRes);
      setUsers(usersRes);
      setProgressList(progressRes);
      setNotifications(notifsRes);
      setBanners(bannersRes);
      setFeedbacks(feedbacksRes || []);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (adminUser) {
      fetchAllData();

      // Subscribe to SSE Realtime Synchronization
      const unsubscribe = api.subscribeRealtime((event: RealtimeEvent) => {
        setIsRealtimeConnected(true);
        setRealtimeNotification(`Đồng bộ Realtime: [${event.type}] lúc ${new Date(event.timestamp).toLocaleTimeString('vi-VN')}`);
        setTimeout(() => setRealtimeNotification(null), 4000);

        // Auto refresh data on realtime events
        fetchAllData();
      });

      // Realtime listener for feedbacks to keep unresolved badge immediately synchronized
      const unsubFeedbacks = api.listenFeedbacks((fbs) => {
        setFeedbacks(fbs);
      });

      // Realtime listener for learning progress from mobile app and web
      const unsubProgress = api.listenProgress((progs) => {
        if (progs && progs.length > 0) {
          setProgressList(progs);
        }
      });

      return () => {
        unsubscribe();
        unsubFeedbacks();
        unsubProgress();
      };
    }
  }, [adminUser]);

  const handleLogout = () => {
    localStorage.removeItem('hq_admin_session');
    sessionStorage.removeItem('hq_admin_session');
    setAdminUser(null);
  };

  // -------------------------------------------------------------
  // Course CRUD Handlers
  // -------------------------------------------------------------
  const handleCreateCourse = async (data: Partial<Course>) => {
    await api.createCourse(data);
    await fetchAllData();
  };

  const handleUpdateCourse = async (id: string, data: Partial<Course>) => {
    await api.updateCourse(id, data);
    await fetchAllData();
  };

  const handleDeleteCourse = async (id: string, permanent = false) => {
    // 1. Optimistic removal from UI state immediately
    setCourses(prev => prev.filter(c => c.id !== id));
    if (permanent) {
      setLessons(prev => prev.filter(l => l.courseId !== id));
    }
    // 2. Perform backend & CDN cascade deletion in background
    api.deleteCourse(id, permanent).catch(err => {
      console.warn('Background course delete warning:', err);
    }).finally(() => {
      fetchAllData();
    });
  };

  const handleRestoreCourse = async (id: string) => {
    await api.restoreCourse(id);
    await fetchAllData();
  };

  // -------------------------------------------------------------
  // Lesson CRUD Handlers
  // -------------------------------------------------------------
  const handleCreateLesson = async (data: Partial<Lesson>) => {
    await api.createLesson(data);
    await fetchAllData();
  };

  const handleUpdateLesson = async (id: string, data: Partial<Lesson>) => {
    const updated = await api.updateLesson(id, data);
    if (selectedLessonForEditing && selectedLessonForEditing.id === id) {
      setSelectedLessonForEditing(updated);
    }
    await fetchAllData();
  };

  const handleDuplicateLesson = async (id: string) => {
    await api.duplicateLesson(id);
    await fetchAllData();
  };

  const handleDeleteLesson = async (id: string, permanent = false) => {
    // 1. Optimistic removal from UI state immediately
    setLessons(prev => prev.filter(l => l.id !== id));
    if (selectedLessonForEditing && selectedLessonForEditing.id === id) {
      setSelectedLessonForEditing(null);
      setCurrentView('courses');
    }
    // 2. Perform backend & CDN cascade deletion in background
    api.deleteLesson(id, permanent).catch(err => {
      console.warn('Background lesson delete warning:', err);
    }).finally(() => {
      fetchAllData();
    });
  };

  const handleRestoreLesson = async (id: string) => {
    await api.restoreLesson(id);
    await fetchAllData();
  };

  // -------------------------------------------------------------
  // User CRUD Handlers
  // -------------------------------------------------------------
  const handleCreateUser = async (data: Partial<User>) => {
    try {
      await api.createUser(data);
      await fetchAllData();
    } catch (err: any) {
      console.error('Lỗi tạo người dùng:', err);
      alert('Lỗi tạo người dùng: ' + (err.message || err));
    }
  };

  const handleUpdateUser = async (id: string, data: Partial<User>) => {
    try {
      await api.updateUser(id, data);
      await fetchAllData();
    } catch (err: any) {
      console.error('Lỗi cập nhật người dùng:', err);
      alert('Lỗi cập nhật người dùng: ' + (err.message || err));
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await api.deleteUser(id);
      await fetchAllData();
    } catch (err: any) {
      console.error('Lỗi xóa người dùng:', err);
      alert('Lỗi xóa người dùng: ' + (err.message || err));
    }
  };

  // -------------------------------------------------------------
  // Unit CRUD Handlers
  // -------------------------------------------------------------
  const handleCreateUnit = async (data: Partial<Unit>): Promise<Unit> => {
    const res = await api.createUnit(data);
    await fetchAllData();
    return res;
  };

  const handleUpdateUnit = async (id: string, data: Partial<Unit>) => {
    await api.updateUnit(id, data);
    await fetchAllData();
  };

  // -------------------------------------------------------------
  // Notification Handlers
  // -------------------------------------------------------------
  const handleCreateNotification = async (data: Partial<SystemNotification>) => {
    await api.createNotification(data);
    await fetchAllData();
  };

  const handleDeleteNotification = async (id: string) => {
    await api.deleteNotification(id);
    await fetchAllData();
  };

  // If not logged in as Admin, show the Military Admin Login Portal first
  if (!adminUser) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setAdminUser(user);
        }}
      />
    );
  }

  return (
    <div className="h-screen w-full bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950 overflow-hidden">
      {/* Realtime Notification Toast */}
      {realtimeNotification && (
        <div className="fixed top-5 right-5 z-50 bg-amber-500 text-slate-950 px-4 py-2.5 rounded-2xl font-bold text-xs shadow-xl flex items-center space-x-2 animate-in slide-in-from-top-4 border border-amber-300">
          <Radio className="w-4 h-4 text-slate-950 animate-pulse" />
          <span>{realtimeNotification}</span>
        </div>
      )}

      {/* Main Top Header */}
      <Header
        activeTab={currentView}
        isRealtimeConnected={isRealtimeConnected}
        realtimeConnected={isRealtimeConnected}
        notifications={notifications}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onRefresh={fetchAllData}
        adminUser={adminUser}
        onLogout={handleLogout}
        onSelectTab={(tab) => {
          setSelectedLessonForEditing(null);
          setCurrentView(tab);
        }}
        onOpenTrash={() => {
          setSelectedLessonForEditing(null);
          setCurrentView('courses');
        }}
      />

      {/* App Body with Sidebar and Main Content */}
      <div className="flex-1 flex max-w-[1920px] w-full mx-auto overflow-hidden min-h-0">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={selectedLessonForEditing ? 'courses' : currentView}
          onSelectTab={(tab) => {
            setSelectedLessonForEditing(null);
            setCurrentView(tab);
          }}
          trashCount={deletedCourses.length + deletedLessons.length}
          unresolvedFeedbacksCount={unresolvedFeedbacksCount}
          stats={{
            totalCourses: courses.length,
            totalLessons: lessons.length,
            unreadNotifs: notifications.length,
            pendingFeedbacks: unresolvedFeedbacksCount,
          }}
          onLogout={handleLogout}
        />

        {/* Dynamic Main Content Workspace */}
        <main className="flex-1 h-full min-h-0 p-4 lg:p-7 overflow-y-auto bg-slate-50/70 overscroll-contain">
          {isLoading ? (
            <div className="py-24 text-center text-slate-500 text-xs">
              <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <span>Đang kết nối hệ thống cơ sở dữ liệu Vùng 4 Hải Quân...</span>
            </div>
          ) : selectedLessonForEditing ? (
            <LessonEditorView
              lesson={selectedLessonForEditing}
              onBack={() => setSelectedLessonForEditing(null)}
              onPreview={(l) => setPreviewLesson(l)}
              onLessonUpdated={(updated) => {
                setSelectedLessonForEditing(updated);
                fetchAllData();
              }}
            />
          ) : currentView === 'dashboard' ? (
            <DashboardView
              courses={courses}
              lessons={lessons}
              units={units}
              users={users}
              progressList={progressList}
              notifications={notifications}
              onNavigate={(tab) => setCurrentView(tab)}
              onSelectLesson={(l) => {
                setSelectedLessonForEditing(l);
              }}
            />
          ) : currentView === 'courses' ? (
            <CoursesView
              courses={courses}
              lessons={lessons}
              onSelectLesson={(l) => setSelectedLessonForEditing(l)}
              onPreviewLesson={(l) => setPreviewLesson(l)}
              onCreateCourse={handleCreateCourse}
              onUpdateCourse={handleUpdateCourse}
              onDeleteCourse={handleDeleteCourse}
              onCreateLesson={handleCreateLesson}
              onUpdateLesson={handleUpdateLesson}
              onDuplicateLesson={handleDuplicateLesson}
              onDeleteLesson={handleDeleteLesson}
            />
          ) : currentView === 'exams' ? (
            <ExamsView currentUser={adminUser} units={units} users={users} progressList={progressList} />
          ) : currentView === 'feedbacks' ? (
            <FeedbacksView currentUser={adminUser} units={units} />
          ) : currentView === 'users' ? (
            <UsersView
              users={users}
              units={units}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onCreateUnit={handleCreateUnit}
            />
          ) : currentView === 'units' ? (
            <UnitsView
              units={units}
              onCreateUnit={handleCreateUnit}
              onUpdateUnit={handleUpdateUnit}
            />
          ) : currentView === 'banners' ? (
            <BannersView
              banners={banners}
              courses={courses}
              lessons={lessons}
              onRefresh={fetchAllData}
            />
          ) : currentView === 'progress' ? (
            <ProgressView progressList={progressList} units={units} />
          ) : currentView === 'notifications' ? (
            <NotificationsView
              notifications={notifications}
              units={units}
              onCreateNotification={handleCreateNotification}
              onDeleteNotification={handleDeleteNotification}
            />
          ) : currentView === 'settings' ? (
            <SettingsView />
          ) : currentView === 'firebase-diagnostics' ? (
            <FirebaseDiagnosticsView />
          ) : null}
        </main>
      </div>

      {/* Android Mobile Client Simulator (Section XIV & XV) */}
      {previewLesson && (
        <LessonPreviewModal
          lesson={previewLesson}
          onClose={() => setPreviewLesson(null)}
        />
      )}
    </div>
  );
}

export default App;
