import React, { useState, useEffect } from 'react';
import { 
  Course, 
  Lesson, 
  Unit, 
  User, 
  UserProgress, 
  SystemNotification, 
  RealtimeEvent 
} from './types';
import { api } from './services/api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { LessonPreviewModal } from './components/LessonPreviewModal';
import { DashboardView } from './views/DashboardView';
import { CoursesView } from './views/CoursesView';
import { LessonEditorView } from './views/LessonEditorView';
import { UsersView } from './views/UsersView';
import { UnitsView } from './views/UnitsView';
import { ProgressView } from './views/ProgressView';
import { NotificationsView } from './views/NotificationsView';
import { SettingsView } from './views/SettingsView';
import { FirebaseDiagnosticsView } from './views/FirebaseDiagnosticsView';
import { Radio, Bell, CheckCircle } from 'lucide-react';

export function App() {
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

  // Navigation & Modal states
  const [selectedLessonForEditing, setSelectedLessonForEditing] = useState<Lesson | null>(null);
  const [previewLesson, setPreviewLesson] = useState<Lesson | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Load all initial data from backend API
  const fetchAllData = async () => {
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
      ] = await Promise.all([
        api.getCourses(false),
        api.getCourses(true),
        api.getLessons({ isDeleted: false }),
        api.getLessons({ isDeleted: true }),
        api.getUnits(),
        api.getUsers(),
        api.getProgress(),
        api.getNotifications(),
      ]);

      setCourses(coursesRes);
      setDeletedCourses(deletedCoursesRes);
      setLessons(lessonsRes);
      setDeletedLessons(deletedLessonsRes);
      setUnits(unitsRes);
      setUsers(usersRes);
      setProgressList(progressRes);
      setNotifications(notifsRes);
    } catch (err) {
      console.error('Error fetching initial data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    // Subscribe to SSE Realtime Synchronization
    const unsubscribe = api.subscribeRealtime((event: RealtimeEvent) => {
      setIsRealtimeConnected(true);
      setRealtimeNotification(`Đồng bộ Realtime: [${event.type}] lúc ${new Date(event.timestamp).toLocaleTimeString('vi-VN')}`);
      setTimeout(() => setRealtimeNotification(null), 4000);

      // Auto refresh data on realtime events
      fetchAllData();
    });

    return () => {
      unsubscribe();
    };
  }, []);

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
    await api.deleteCourse(id, permanent);
    await fetchAllData();
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
    await api.deleteLesson(id, permanent);
    if (selectedLessonForEditing && selectedLessonForEditing.id === id) {
      setSelectedLessonForEditing(null);
      setCurrentView('courses');
    }
    await fetchAllData();
  };

  const handleRestoreLesson = async (id: string) => {
    await api.restoreLesson(id);
    await fetchAllData();
  };

  // -------------------------------------------------------------
  // User CRUD Handlers
  // -------------------------------------------------------------
  const handleCreateUser = async (data: Partial<User>) => {
    await api.createUser(data);
    await fetchAllData();
  };

  const handleUpdateUser = async (id: string, data: Partial<User>) => {
    await api.updateUser(id, data);
    await fetchAllData();
  };

  const handleDeleteUser = async (id: string) => {
    await api.deleteUser(id);
    await fetchAllData();
  };

  // -------------------------------------------------------------
  // Unit CRUD Handlers
  // -------------------------------------------------------------
  const handleCreateUnit = async (data: Partial<Unit>) => {
    await api.createUnit(data);
    await fetchAllData();
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

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col font-sans selection:bg-amber-400 selection:text-slate-950">
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
        onOpenTrash={() => {
          setSelectedLessonForEditing(null);
          setCurrentView('courses');
        }}
      />

      {/* App Body with Sidebar and Main Content */}
      <div className="flex-1 flex max-w-[1920px] w-full mx-auto">
        {/* Left Navigation Sidebar */}
        <Sidebar
          activeTab={selectedLessonForEditing ? 'courses' : currentView}
          onSelectTab={(tab) => {
            setSelectedLessonForEditing(null);
            setCurrentView(tab);
          }}
          trashCount={deletedCourses.length + deletedLessons.length}
        />

        {/* Dynamic Main Content Workspace */}
        <main className="flex-1 p-4 lg:p-7 overflow-y-auto max-h-[calc(100vh-73px)] bg-slate-50/70">
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
          ) : currentView === 'users' ? (
            <UsersView
              users={users}
              units={units}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          ) : currentView === 'units' ? (
            <UnitsView
              units={units}
              onCreateUnit={handleCreateUnit}
              onUpdateUnit={handleUpdateUnit}
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
