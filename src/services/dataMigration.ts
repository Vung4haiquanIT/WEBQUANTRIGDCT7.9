import { db, collection, getDocs, doc, setDoc, writeBatch } from './firebase';
import { 
  Course, Lesson, SlideItem, ContentSection, VideoItem, AudioItem, 
  Unit, User, UserProgress, SystemNotification, StorageFileMetadata 
} from '../types';

export interface MigrationReport {
  coursesCount: number;
  lessonsCount: number;
  slidesCount: number;
  contentsCount: number;
  videosCount: number;
  audiosCount: number;
  unitsCount: number;
  usersCount: number;
  progressCount: number;
  notificationsCount: number;
  storageFilesCount: number;
  isCompleted: boolean;
  migratedAt: string;
}

export async function migrateLocalDataToFirestore(): Promise<MigrationReport> {
  // Check if Firestore already has courses
  const existingCoursesSnap = await getDocs(collection(db, 'courses'));
  if (!existingCoursesSnap.empty) {
    // Already migrated, return current counts
    const [
      lessonsSnap, slidesSnap, contentsSnap, videosSnap, 
      audiosSnap, unitsSnap, usersSnap, progressSnap, notifsSnap, filesSnap
    ] = await Promise.all([
      getDocs(collection(db, 'lessons')),
      getDocs(collection(db, 'slides')),
      getDocs(collection(db, 'contents')),
      getDocs(collection(db, 'videos')),
      getDocs(collection(db, 'audios')),
      getDocs(collection(db, 'units')),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'progress')),
      getDocs(collection(db, 'notifications')),
      getDocs(collection(db, 'storageFiles'))
    ]);

    return {
      coursesCount: existingCoursesSnap.size,
      lessonsCount: lessonsSnap.size,
      slidesCount: slidesSnap.size,
      contentsCount: contentsSnap.size,
      videosCount: videosSnap.size,
      audiosCount: audiosSnap.size,
      unitsCount: unitsSnap.size,
      usersCount: usersSnap.size,
      progressCount: progressSnap.size,
      notificationsCount: notifsSnap.size,
      storageFilesCount: filesSnap.size,
      isCompleted: true,
      migratedAt: new Date().toISOString()
    };
  }

  // If empty, fetch from local backend seed and push into Cloud Firestore in Batches
  const localRes = await fetch('/api/export/backup');
  if (!localRes.ok) {
    throw new Error('Không thể đọc dữ liệu mẫu để chuyển đổi sang Firestore');
  }
  const localDb = await localRes.json();

  const batch = writeBatch(db);

  // 1. Courses
  (localDb.courses || []).forEach((c: Course) => {
    const ref = doc(db, 'courses', c.id);
    batch.set(ref, c);
  });

  // 2. Lessons
  (localDb.lessons || []).forEach((l: Lesson) => {
    const ref = doc(db, 'lessons', l.id);
    batch.set(ref, l);
  });

  // 3. Slides
  (localDb.slides || []).forEach((s: SlideItem) => {
    const ref = doc(db, 'slides', s.id);
    batch.set(ref, s);
  });

  // 4. Contents
  (localDb.contents || []).forEach((ct: ContentSection) => {
    const ref = doc(db, 'contents', ct.id);
    batch.set(ref, ct);
  });

  // 5. Videos
  (localDb.videos || []).forEach((v: VideoItem) => {
    const ref = doc(db, 'videos', v.id);
    batch.set(ref, v);
  });

  // 6. Audios
  (localDb.audios || []).forEach((a: AudioItem) => {
    const ref = doc(db, 'audios', a.id);
    batch.set(ref, a);
  });

  // 7. Units
  (localDb.units || []).forEach((u: Unit) => {
    const ref = doc(db, 'units', u.id);
    batch.set(ref, u);
  });

  // 8. Users
  (localDb.users || []).forEach((u: User) => {
    const ref = doc(db, 'users', u.id);
    batch.set(ref, u);
  });

  // 9. Progress
  (localDb.progress || []).forEach((p: UserProgress) => {
    const ref = doc(db, 'progress', p.id);
    batch.set(ref, p);
  });

  // 10. Notifications
  (localDb.notifications || []).forEach((n: SystemNotification) => {
    const ref = doc(db, 'notifications', n.id);
    batch.set(ref, n);
  });

  // 11. Storage Files Metadata
  (localDb.storageFiles || []).forEach((f: StorageFileMetadata) => {
    const ref = doc(db, 'storageFiles', f.id);
    batch.set(ref, f);
  });

  await batch.commit();

  return {
    coursesCount: (localDb.courses || []).length,
    lessonsCount: (localDb.lessons || []).length,
    slidesCount: (localDb.slides || []).length,
    contentsCount: (localDb.contents || []).length,
    videosCount: (localDb.videos || []).length,
    audiosCount: (localDb.audios || []).length,
    unitsCount: (localDb.units || []).length,
    usersCount: (localDb.users || []).length,
    progressCount: (localDb.progress || []).length,
    notificationsCount: (localDb.notifications || []).length,
    storageFilesCount: (localDb.storageFiles || []).length,
    isCompleted: true,
    migratedAt: new Date().toISOString()
  };
}
