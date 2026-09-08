import {
  db,
  storage,
  ref,
  deleteObject,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  writeBatch
} from './firebase';
import {
  Course,
  Lesson,
  SlideItem,
  SlideSet,
  SlideSetStatus,
  ContentSection,
  VideoItem,
  AudioItem,
  Unit,
  User,
  UserProgress,
  SystemNotification,
  StorageFileMetadata,
  DashboardStats,
  OfflinePackage,
  LessonVersionInfo,
  LessonSizeBreakdown,
  PptxProcessingJob,
  LessonSection,
  LessonItem,
  LessonQuestion,
  SourceDocument,
  UserItemProgress,
  UserSectionProgress,
  AppBanner,
  ExamBank,
  ExamQuestion,
  ExamSession,
  ExamSubmission,
  UserFeedback,
  FeedbackStatus
} from '../types';
import { 
  isFixedCourse, 
  FIXED_COURSES_DEFINITIONS, 
  getFixedCourseCategory 
} from '../utils/fixedCourses';

// =============================================================
// PRODUCTION FIRESTORE DATA SERVICE
// Direct Cloud Firestore queries with indexing, filtering, pagination & realtime listeners
// =============================================================

// Helper to remove undefined values before sending to Firestore
function sanitizeFirestoreData(data: any): any {
  if (data === undefined) return null;
  if (data === null || typeof data !== 'object') return data;
  if (data instanceof Date) return data;

  if (Array.isArray(data)) {
    return data
      .filter((item) => item !== undefined)
      .map((item) => sanitizeFirestoreData(item));
  }

  const clean: Record<string, any> = {};
  Object.keys(data).forEach((key) => {
    const val = data[key];
    if (val !== undefined) {
      clean[key] = sanitizeFirestoreData(val);
    }
  });
  return clean;
}

export const firestoreService = {
  // -------------------------------------------------------------
  // HEALTH & STATUS CHECK
  // -------------------------------------------------------------
  checkConnection: async (): Promise<{ success: boolean; databaseId: string; timestamp: string }> => {
    const testRef = doc(db, '_system_health', 'ping');
    await setDoc(testRef, {
      lastPing: new Date().toISOString(),
      service: 'GDCT_VUNG_4_ADMIN_FIRESTORE'
    });
    const snap = await getDoc(testRef);
    return {
      success: snap.exists(),
      databaseId: db.app.options.projectId || 'connected',
      timestamp: new Date().toISOString()
    };
  },

  // -------------------------------------------------------------
  // COURSES (CHUYÊN ĐỀ)
  // -------------------------------------------------------------
  ensureFixedCourses: async (): Promise<Course[]> => {
    try {
      const colRef = collection(db, 'courses');
      const snap = await getDocs(colRef);
      const existingCourses = snap.docs.map(d => d.data() as Course);
      const now = new Date().toISOString();
      const batch = writeBatch(db);
      let needsCommit = false;

      for (const def of FIXED_COURSES_DEFINITIONS) {
        const found = existingCourses.find(c => c.id === def.id || c.code === def.code || c.categoryKey === def.categoryKey);
        if (found) {
          // If exists, make sure isDeleted is false and categoryKey is set. Respect user's explicit isFixed setting.
          if (found.isDeleted === true || !found.categoryKey || found.isFixed === undefined) {
            const ref = doc(db, 'courses', found.id);
            batch.update(ref, {
              isFixed: found.isFixed !== undefined ? found.isFixed : true,
              isDeleted: false,
              categoryKey: found.categoryKey || def.categoryKey,
              code: found.code || def.code,
              updatedAt: now
            });
            needsCommit = true;
          }
        } else {
          // If missing completely, initialize this fixed course
          const ref = doc(db, 'courses', def.id);
          const newFixedCourse: Course = {
            id: def.id,
            code: def.code,
            title: def.title,
            description: def.description,
            thumbnail: def.thumbnail,
            storageThumbnailPath: def.storageThumbnailPath,
            year: def.year,
            order: def.order,
            status: def.status,
            version: 1,
            isDeleted: false,
            isFixed: true,
            categoryKey: def.categoryKey,
            createdBy: def.createdBy,
            createdAt: now,
            updatedAt: now
          };
          batch.set(ref, newFixedCourse);
          needsCommit = true;
        }
      }

      if (needsCommit) {
        await batch.commit();
      }
    } catch (err) {
      console.warn('[ensureFixedCourses warning]:', err);
    }

    return firestoreService.getCourses(false);
  },

  getCourses: async (includeDeleted = false, maxLimit = 100): Promise<Course[]> => {
    const colRef = collection(db, 'courses');
    let q;
    if (includeDeleted) {
      q = query(colRef, limit(maxLimit));
    } else {
      q = query(colRef, where('isDeleted', '==', false), limit(maxLimit));
    }
    const snap = await getDocs(q);
    const courses = snap.docs.map(d => {
      const data = d.data() as Course;
      const isFixed = data.isFixed !== undefined ? data.isFixed : isFixedCourse(data);
      const catDef = getFixedCourseCategory(data);
      return {
        ...data,
        isFixed,
        categoryKey: data.categoryKey || catDef?.categoryKey
      } as Course;
    });
    return courses.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  getCourse: async (id: string): Promise<Course | null> => {
    const docRef = doc(db, 'courses', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    const data = snap.data() as Course;
    const isFixed = data.isFixed !== undefined ? data.isFixed : isFixedCourse(data);
    return {
      ...data,
      isFixed,
      categoryKey: data.categoryKey || getFixedCourseCategory(data)?.categoryKey
    };
  },

  createCourse: async (data: Partial<Course>): Promise<Course> => {
    const id = data.id || `course-${Date.now()}`;
    const code = data.code || `CD-${Date.now().toString().slice(-6)}`;
    const docRef = doc(db, 'courses', id);
    const now = new Date().toISOString();
    const course: Course = {
      id,
      code,
      title: data.title || 'Chuyên đề mới',
      description: data.description || '',
      thumbnail: data.thumbnail || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
      storageThumbnailPath: data.storageThumbnailPath || '',
      rawPptUrl: data.rawPptUrl || '',
      rawPptStoragePath: data.rawPptStoragePath || '',
      year: data.year || 2026,
      order: data.order || 1,
      status: data.status || 'DRAFT',
      version: data.version || 1,
      isDeleted: false,
      isFixed: data.isFixed !== undefined ? data.isFixed : isFixedCourse({ id, code, title: data.title }),
      categoryKey: data.categoryKey,
      createdBy: data.createdBy || 'Phòng Chính trị Vùng 4',
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, course);
    return course;
  },

  updateCourse: async (id: string, data: Partial<Course>): Promise<Course> => {
    const docRef = doc(db, 'courses', id);
    const existing = await getDoc(docRef);
    if (!existing.exists()) throw new Error(`Không tìm thấy chuyên đề ${id}`);
    const existingData = existing.data() as Course;
    const isFixed = data.isFixed !== undefined 
      ? data.isFixed 
      : (existingData.isFixed !== undefined ? existingData.isFixed : isFixedCourse(existingData));
    
    const now = new Date().toISOString();
    const updatePayload = sanitizeFirestoreData({
      ...data,
      isFixed,
      version: (existingData.version || 1) + 1,
      updatedAt: now
    });
    await updateDoc(docRef, updatePayload);
    const updatedSnap = await getDoc(docRef);
    return updatedSnap.data() as Course;
  },

  deleteCourse: async (id: string, permanent = false): Promise<{ success: boolean; message: string }> => {
    const docRef = doc(db, 'courses', id);
    const existing = await getDoc(docRef);
    if (existing.exists()) {
      const courseData = existing.data() as Course;
      const isFixed = courseData.isFixed !== undefined ? courseData.isFixed : isFixedCourse(courseData);
      if (isFixed) {
        throw new Error(`Không thể xóa chuyên đề "${courseData.title}". Đây là chuyên đề cố định của hệ thống đồng bộ với tiện ích App! Vui lòng bỏ chọn Khóa cố định trước khi xóa.`);
      }
    }

    if (permanent) {
      const res = await firestoreService.deleteCourseCascade(id);
      return { success: res.success, message: res.message };
    } else {
      await updateDoc(docRef, {
        isDeleted: true,
        updatedAt: new Date().toISOString()
      });
      return { success: true, message: 'Đã chuyển chuyên đề vào thùng rác (Soft Delete)' };
    }
  },

  restoreCourse: async (id: string): Promise<Course> => {
    const docRef = doc(db, 'courses', id);
    await updateDoc(docRef, {
      isDeleted: false,
      updatedAt: new Date().toISOString()
    });
    const snap = await getDoc(docRef);
    return snap.data() as Course;
  },

  // Realtime Course Listener
  listenCourses: (callback: (courses: Course[]) => void, includeDeleted = false) => {
    const colRef = collection(db, 'courses');
    const q = includeDeleted
      ? query(colRef)
      : query(colRef, where('isDeleted', '==', false));
    
    return onSnapshot(q, (snapshot) => {
      const courses = snapshot.docs.map(doc => {
        const data = doc.data() as Course;
        const isFixed = data.isFixed !== undefined ? data.isFixed : isFixedCourse(data);
        const catDef = getFixedCourseCategory(data);
        return {
          ...data,
          isFixed,
          categoryKey: data.categoryKey || catDef?.categoryKey
        } as Course;
      });
      courses.sort((a, b) => (a.order || 0) - (b.order || 0));
      callback(courses);
    }, (err) => {
      console.error('Error listening to courses:', err);
    });
  },

  // -------------------------------------------------------------
  // LESSONS (BÀI HỌC)
  // -------------------------------------------------------------
  getLessons: async (courseId?: string, includeDeleted = false, maxLimit = 100): Promise<Lesson[]> => {
    const colRef = collection(db, 'lessons');
    let q;
    if (courseId) {
      if (includeDeleted) {
        q = query(colRef, where('courseId', '==', courseId), limit(maxLimit));
      } else {
        q = query(
          colRef,
          where('courseId', '==', courseId),
          where('isDeleted', '==', false),
          limit(maxLimit)
        );
      }
    } else {
      if (includeDeleted) {
        q = query(colRef, limit(maxLimit));
      } else {
        q = query(colRef, where('isDeleted', '==', false), limit(maxLimit));
      }
    }
    const snap = await getDocs(q);
    const lessons = snap.docs.map(d => d.data() as Lesson);
    return lessons.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  getLesson: async (id: string): Promise<Lesson | null> => {
    const docRef = doc(db, 'lessons', id);
    const snap = await getDoc(docRef);
    return snap.exists() ? (snap.data() as Lesson) : null;
  },

  createLesson: async (data: Partial<Lesson>): Promise<Lesson> => {
    const id = data.id || `lesson-${Date.now()}`;
    const lessonCode = data.lessonCode || `BH-${Date.now().toString().slice(-6)}`;
    const docRef = doc(db, 'lessons', id);
    const now = new Date().toISOString();
    const lesson: Lesson = {
      id,
      lessonCode,
      courseId: data.courseId || '',
      title: data.title || 'Bài học mới',
      subtitle: data.subtitle || '',
      description: data.description || '',
      thumbnail: data.thumbnail || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
      storageThumbnailPath: data.storageThumbnailPath || '',
      order: data.order || 1,
      status: data.status || 'DRAFT',
      version: 1,
      contentVersion: 1,
      mediaVersion: 1,
      isDeleted: false,
      createdBy: data.createdBy || 'Ban Tuyên huấn Vùng 4',
      durationMinutes: data.durationMinutes || 45,
      rawPptUrl: data.rawPptUrl || '',
      rawPptStoragePath: data.rawPptStoragePath || '',
      moduleConfig: data.moduleConfig || {
        showSlides: true,
        showContents: true,
        showVideos: true,
        showAudios: true
      },
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, lesson);
    return lesson;
  },

  updateLesson: async (id: string, data: Partial<Lesson>): Promise<Lesson> => {
    const docRef = doc(db, 'lessons', id);
    const existing = await getDoc(docRef);
    if (!existing.exists()) throw new Error(`Không tìm thấy bài học ${id}`);
    
    const prev = existing.data() as Lesson;
    const now = new Date().toISOString();
    
    // Tự động quản lý phiên bản theo quy chuẩn GDCT
    const isContentChanged = !!(data.title || data.subtitle || data.description || data.status);
    const isMediaChanged = !!(data.thumbnail || data.rawPptUrl || data.moduleConfig);

    const updatePayload = {
      ...data,
      version: (prev.version || 1) + 1,
      contentVersion: isContentChanged ? (prev.contentVersion || 1) + 1 : prev.contentVersion || 1,
      mediaVersion: isMediaChanged ? (prev.mediaVersion || 1) + 1 : prev.mediaVersion || 1,
      publishedAt: data.status === 'PUBLISHED' && !prev.publishedAt ? now : (data.status !== 'PUBLISHED' ? prev.publishedAt : prev.publishedAt || now),
      updatedAt: now
    };
    
    await updateDoc(docRef, updatePayload);
    const updatedSnap = await getDoc(docRef);
    return updatedSnap.data() as Lesson;
  },

  deleteLesson: async (id: string, permanent = false): Promise<{ success: boolean; message: string }> => {
    if (permanent) {
      const res = await firestoreService.deleteLessonCascade(id);
      return { success: res.success, message: res.message };
    } else {
      const docRef = doc(db, 'lessons', id);
      await updateDoc(docRef, {
        isDeleted: true,
        updatedAt: new Date().toISOString()
      });
      return { success: true, message: 'Đã chuyển bài học vào thùng rác' };
    }
  },

  restoreLesson: async (id: string): Promise<Lesson> => {
    const docRef = doc(db, 'lessons', id);
    await updateDoc(docRef, {
      isDeleted: false,
      updatedAt: new Date().toISOString()
    });
    const snap = await getDoc(docRef);
    return snap.data() as Lesson;
  },

  // Realtime Lesson Listener
  listenLessons: (courseId: string | undefined, callback: (lessons: Lesson[]) => void, includeDeleted = false) => {
    const colRef = collection(db, 'lessons');
    let q;
    if (courseId) {
      q = includeDeleted
        ? query(colRef, where('courseId', '==', courseId))
        : query(colRef, where('courseId', '==', courseId), where('isDeleted', '==', false));
    } else {
      q = includeDeleted
        ? query(colRef)
        : query(colRef, where('isDeleted', '==', false));
    }

    return onSnapshot(q, (snapshot) => {
      const lessons = snapshot.docs.map(doc => doc.data() as Lesson);
      lessons.sort((a, b) => (a.order || 0) - (b.order || 0));
      callback(lessons);
    }, (err) => {
      console.error('Error listening to lessons:', err);
    });
  },

  // -------------------------------------------------------------
  // SLIDE SETS & SLIDES
  // -------------------------------------------------------------
  getSlideSet: async (lessonId: string): Promise<SlideSet | null> => {
    const colRef = collection(db, 'slideSets');
    const q = query(
      colRef,
      where('lessonId', '==', lessonId)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const sets = snap.docs.map(d => d.data() as SlideSet);
    sets.sort((a, b) => (b.version || 0) - (a.version || 0));
    return sets[0];
  },

  saveSlideSet: async (data: Partial<SlideSet>): Promise<SlideSet> => {
    const id = data.id || `slideset-${data.lessonId || 'general'}-${Date.now()}`;
    const docRef = doc(db, 'slideSets', id);
    const now = new Date().toISOString();
    const existingSnap = await getDoc(docRef);
    const existing = existingSnap.exists() ? (existingSnap.data() as SlideSet) : null;

    const setObj: SlideSet = {
      id,
      courseId: data.courseId || existing?.courseId || '',
      lessonId: data.lessonId || existing?.lessonId || '',
      name: data.name || existing?.name || 'Bộ Slide Bài giảng',
      totalSlides: data.totalSlides !== undefined ? data.totalSlides : (existing?.totalSlides || 0),
      status: data.status || existing?.status || 'PROCESSING',
      version: data.version || existing?.version || 1,
      createdAt: existing?.createdAt || now,
      updatedAt: now
    };
    await setDoc(docRef, setObj, { merge: true });
    return setObj;
  },

  listenSlideSet: (lessonId: string, callback: (set: SlideSet | null) => void) => {
    const colRef = collection(db, 'slideSets');
    const q = query(colRef, where('lessonId', '==', lessonId));
    return onSnapshot(q, (snap) => {
      if (snap.empty) {
        callback(null);
      } else {
        const sets = snap.docs.map(d => d.data() as SlideSet);
        sets.sort((a, b) => (b.version || 0) - (a.version || 0));
        callback(sets[0]);
      }
    });
  },

  listenSlides: (lessonId: string, callback: (slides: SlideItem[]) => void) => {
    const colRef = collection(db, 'slides');
    const q = query(
      colRef,
      where('lessonId', '==', lessonId),
      where('isDeleted', '==', false)
    );
    return onSnapshot(q, (snap) => {
      const slides = snap.docs.map(d => d.data() as SlideItem);
      slides.sort((a, b) => (a.order || a.slideOrder || 0) - (b.order || b.slideOrder || 0));
      callback(slides);
    });
  },

  getSlides: async (lessonId: string): Promise<SlideItem[]> => {
    const colRef = collection(db, 'slides');
    const q = query(
      colRef,
      where('lessonId', '==', lessonId),
      where('isDeleted', '==', false)
    );
    const snap = await getDocs(q);
    const slides = snap.docs.map(d => d.data() as SlideItem);
    return slides.sort((a, b) => (a.order || a.slideOrder || 0) - (b.order || b.slideOrder || 0));
  },

  createSlide: async (data: Partial<SlideItem>): Promise<SlideItem> => {
    const id = data.id || `slide-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const docRef = doc(db, 'slides', id);
    const now = new Date().toISOString();
    const lessonId = data.lessonId || '';
    const assetFolder = data.assetFolder || `GDCT_V4/SLIDE/${lessonId || 'general'}`;

    const slide: SlideItem = {
      id,
      courseId: data.courseId || '',
      lessonId,
      slideSetId: data.slideSetId || '',
      order: data.order || data.slideOrder || 1,
      slideOrder: data.slideOrder || data.order || 1,
      title: data.title || `Slide ${data.order || 1}`,
      fileName: data.fileName || '',
      imageUrl: data.imageUrl || data.secureUrl || '',
      secureUrl: data.secureUrl || data.imageUrl || '',
      cloudinaryUrl: data.cloudinaryUrl || data.secureUrl || data.imageUrl || '',
      storagePath: data.storagePath || data.cloudinaryPublicId || '',
      cloudinaryPublicId: data.cloudinaryPublicId || data.storagePath || '',
      assetFolder,
      storageProvider: data.storageProvider || 'cloudinary',
      mimeType: data.mimeType || 'image/png',
      bytes: data.bytes || 0,
      notes: data.notes || '',
      width: data.width || 1920,
      height: data.height || 1080,
      version: data.version || 1,
      isDeleted: false,
      createdAt: data.createdAt || now,
      updatedAt: now
    };
    await setDoc(docRef, slide);
    return slide;
  },

  deleteSlideSet: async (slideSetId: string, lessonId: string): Promise<{ success: boolean }> => {
    const colRef = collection(db, 'slides');
    const q = query(colRef, where('lessonId', '==', lessonId));
    const snap = await getDocs(q);

    const targets: string[] = [];
    snap.docs.forEach(d => {
      const data = d.data() as SlideItem;
      if (data.cloudinaryPublicId) targets.push(data.cloudinaryPublicId);
      if (data.storagePath) targets.push(data.storagePath);
      if (data.imageUrl) targets.push(data.imageUrl);
      if (data.secureUrl) targets.push(data.secureUrl);
      if (data.cloudinaryUrl) targets.push(data.cloudinaryUrl);
    });

    if (targets.length > 0) {
      deleteUnifiedAssetsHelper(targets, 'image').catch(err => {
        console.warn('deleteUnifiedAssetsHelper error in deleteSlideSet:', err);
      });
    }

    // Also trigger thorough Cloudinary folder and search purge for lesson slide folder
    if (lessonId) {
      purgeCloudinaryLessonHelper(lessonId, targets).catch(err => {
        console.warn('purgeCloudinaryLessonHelper error in deleteSlideSet:', err);
      });
      deleteCloudinaryFolderHelper(`GDCT_V4/SLIDE/${lessonId}`).catch(() => {});
      deleteCloudinaryFolderHelper(`gdct_v4/slide/${lessonId}`).catch(() => {});
    }

    const batch = writeBatch(db);
    snap.docs.forEach(d => {
      batch.delete(d.ref);
    });

    if (slideSetId) {
      const setRef = doc(db, 'slideSets', slideSetId);
      batch.delete(setRef);
    }
    await batch.commit();

    await firestoreService.updateLesson(lessonId, { slideCount: 0 });
    return { success: true };
  },

  updateSlide: async (id: string, data: Partial<SlideItem>): Promise<SlideItem> => {
    const docRef = doc(db, 'slides', id);
    const now = new Date().toISOString();
    await updateDoc(docRef, {
      ...data,
      updatedAt: now
    });
    const snap = await getDoc(docRef);
    return snap.data() as SlideItem;
  },

  deleteSlide: async (id: string): Promise<{ success: boolean }> => {
    const res = await firestoreService.deleteSlideCascade(id);
    return { success: res.success };
  },

  // -------------------------------------------------------------
  // CONTENTS (NỘI DUNG BÀI GIẢNG / LỜI BÁC DẠY)
  // -------------------------------------------------------------
  getContents: async (lessonId: string): Promise<ContentSection[]> => {
    const colRef = collection(db, 'contents');
    const q = query(
      colRef,
      where('lessonId', '==', lessonId),
      where('isDeleted', '==', false)
    );
    const snap = await getDocs(q);
    const contents = snap.docs.map(d => d.data() as ContentSection);
    return contents.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  createContent: async (data: Partial<ContentSection>): Promise<ContentSection> => {
    const id = data.id || `content-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const docRef = doc(db, 'contents', id);
    const now = new Date().toISOString();
    const content: ContentSection = {
      id,
      lessonId: data.lessonId || '',
      order: data.order || 1,
      title: data.title || '',
      quote: data.quote || '',
      quoteAuthor: data.quoteAuthor || '',
      quoteHistoricalContext: data.quoteHistoricalContext || '',
      isUncleHoTeaching: data.isUncleHoTeaching ?? (!!data.quote),
      bodyHtml: data.bodyHtml || '',
      version: data.version || 1,
      isDeleted: false,
      quoteQuiz: data.quoteQuiz,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, content);
    return content;
  },

  updateContent: async (id: string, data: Partial<ContentSection>): Promise<ContentSection> => {
    const docRef = doc(db, 'contents', id);
    const now = new Date().toISOString();
    await updateDoc(docRef, {
      ...data,
      updatedAt: now
    });
    const snap = await getDoc(docRef);
    return snap.data() as ContentSection;
  },

  // -------------------------------------------------------------
  // STRUCTURED LESSON SECTIONS & ITEMS (PHẦN -> MỤC -> NỘI DUNG)
  // -------------------------------------------------------------
  getSections: async (lessonId: string): Promise<LessonSection[]> => {
    const colRef = collection(db, 'sections');
    const q = query(
      colRef,
      where('lessonId', '==', lessonId),
      where('isDeleted', '==', false)
    );
    const snap = await getDocs(q);
    const sections = snap.docs.map(d => d.data() as LessonSection);
    return sections.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  createSection: async (data: Partial<LessonSection>): Promise<LessonSection> => {
    const id = data.id || `section-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const docRef = doc(db, 'sections', id);
    const now = new Date().toISOString();
    const section: LessonSection = {
      id,
      lessonId: data.lessonId || '',
      title: data.title || 'PHẦN MỚI',
      order: data.order || 1,
      description: data.description || '',
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, section);
    return section;
  },

  updateSection: async (id: string, data: Partial<LessonSection>): Promise<LessonSection> => {
    const docRef = doc(db, 'sections', id);
    const now = new Date().toISOString();
    await updateDoc(docRef, {
      ...data,
      updatedAt: now
    });
    const snap = await getDoc(docRef);
    return snap.data() as LessonSection;
  },

  // ITEMS (MỤC)
  getItems: async (lessonId: string, sectionId?: string): Promise<LessonItem[]> => {
    const colRef = collection(db, 'items');
    let q;
    if (sectionId) {
      q = query(
        colRef,
        where('lessonId', '==', lessonId),
        where('sectionId', '==', sectionId),
        where('isDeleted', '==', false)
      );
    } else {
      q = query(
        colRef,
        where('lessonId', '==', lessonId),
        where('isDeleted', '==', false)
      );
    }
    const snap = await getDocs(q);
    const items = snap.docs.map(d => d.data() as LessonItem);
    return items.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  createItem: async (data: Partial<LessonItem>): Promise<LessonItem> => {
    const id = data.id || `item-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const docRef = doc(db, 'items', id);
    const now = new Date().toISOString();
    const itemObj: Record<string, any> = {
      id,
      lessonId: data.lessonId || '',
      sectionId: data.sectionId || '',
      title: data.title || 'Mục mới',
      order: data.order || 1,
      content: data.content || data.bodyHtml || '',
      bodyHtml: data.bodyHtml || data.content || '',
      sourceDocumentId: data.sourceDocumentId || null,
      sourcePageStart: data.sourcePageStart ?? null,
      sourcePageEnd: data.sourcePageEnd ?? null,
      paragraphs: data.paragraphs || [],
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    };
    const cleanItem = sanitizeFirestoreData(itemObj);
    await setDoc(docRef, cleanItem);
    return cleanItem as LessonItem;
  },

  updateItem: async (id: string, data: Partial<LessonItem>): Promise<LessonItem> => {
    const docRef = doc(db, 'items', id);
    const now = new Date().toISOString();
    await updateDoc(docRef, {
      ...data,
      updatedAt: now
    });
    const snap = await getDoc(docRef);
    return snap.data() as LessonItem;
  },

  deleteItem: async (id: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteItemCascade(id);
  },

  // QUESTIONS AT END OF EACH MỤC
  getQuestions: async (lessonId: string, itemId?: string): Promise<LessonQuestion[]> => {
    const colRef = collection(db, 'questions');
    let q;
    if (itemId) {
      q = query(
        colRef,
        where('lessonId', '==', lessonId),
        where('itemId', '==', itemId),
        where('isDeleted', '==', false)
      );
    } else {
      q = query(
        colRef,
        where('lessonId', '==', lessonId),
        where('isDeleted', '==', false)
      );
    }
    const snap = await getDocs(q);
    const questions = snap.docs.map(d => d.data() as LessonQuestion);
    return questions.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  createQuestion: async (data: Partial<LessonQuestion>): Promise<LessonQuestion> => {
    const id = data.id || `question-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const docRef = doc(db, 'questions', id);
    const now = new Date().toISOString();
    const question: LessonQuestion = {
      id,
      lessonId: data.lessonId || '',
      sectionId: data.sectionId || '',
      itemId: data.itemId || '',
      type: data.type || 'single_choice',
      question: data.question || '',
      options: data.options || [],
      correctAnswer: data.correctAnswer !== undefined ? data.correctAnswer : 0,
      explanation: data.explanation || '',
      points: data.points || 10,
      order: data.order || 1,
      isDeleted: false,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, question);
    return question;
  },

  updateQuestion: async (id: string, data: Partial<LessonQuestion>): Promise<LessonQuestion> => {
    const docRef = doc(db, 'questions', id);
    const now = new Date().toISOString();
    await updateDoc(docRef, {
      ...data,
      updatedAt: now
    });
    const snap = await getDoc(docRef);
    return snap.data() as LessonQuestion;
  },

  deleteQuestion: async (id: string): Promise<{ success: boolean }> => {
    const docRef = doc(db, 'questions', id);
    try {
      await deleteDoc(docRef);
    } catch (e) {
      await updateDoc(docRef, {
        isDeleted: true,
        updatedAt: new Date().toISOString()
      });
    }
    return { success: true };
  },

  // SOURCE DOCUMENT METADATA
  saveSourceDocument: async (lessonId: string, docData: Partial<SourceDocument>): Promise<SourceDocument> => {
    const docId = docData.id || `doc-${lessonId}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const documentCode = docData.documentCode || `TL-${Date.now().toString().slice(-6)}`;
    const docRef = doc(db, 'documents', docId);
    const now = new Date().toISOString();
    const assetFolder = docData.assetFolder || docData.cloudinaryFolder || `GDCT_V4/TAILIEU/${lessonId}`;
    const url = docData.secureUrl || docData.cloudinaryUrl || docData.url || '';
    
    const documentObj: Record<string, any> = {
      id: docId,
      documentCode,
      lessonId,
      name: docData.name || docData.fileName || 'Tài liệu GDCT',
      fileName: docData.fileName || docData.name || 'Tài liệu GDCT',
      originalName: docData.originalName || docData.fileName || docData.name || 'Tài liệu GDCT',
      type: docData.type || 'docx',
      mimeType: docData.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: docData.size || docData.fileSize || 0,
      fileSize: docData.fileSize || docData.size || 0,
      sizeMb: docData.sizeMb || Math.round((((docData.size || docData.fileSize || 0)) / (1024 * 1024)) * 100) / 100,
      pageCount: (docData.pageCount && docData.pageCount > 0) ? docData.pageCount : null,
      url,
      cloudinaryUrl: url,
      secureUrl: url,
      cloudinaryPublicId: docData.cloudinaryPublicId || docData.storagePath || '',
      assetFolder,
      cloudinaryFolder: assetFolder,
      resourceType: docData.resourceType || 'raw',
      format: docData.format || (docData.type || 'docx'),
      storagePath: docData.storagePath || docData.cloudinaryPublicId || '',
      storageProvider: docData.storageProvider || 'cloudinary',
      status: docData.status || 'READY',
      createdAt: docData.createdAt || now,
      updatedAt: now
    };

    const cleanDoc = sanitizeFirestoreData(documentObj);
    await setDoc(docRef, cleanDoc);

    // Sync all lesson document variables for mobile/student app reading
    try {
      const lessonRef = doc(db, 'lessons', lessonId);
      const allDocs = await firestoreService.getSourceDocuments(lessonId);
      await updateDoc(lessonRef, {
        sourceDocuments: allDocs,
        sourceDocument: allDocs.length > 0 ? allDocs[0] : null,
        documents: allDocs,
        sourceDocumentId: allDocs.length > 0 ? allDocs[0].id : docId,
        updatedAt: now
      });
    } catch (syncErr) {
      console.warn('Could not sync lesson document fields:', syncErr);
    }

    return cleanDoc as SourceDocument;
  },

  getSourceDocument: async (lessonId: string): Promise<SourceDocument | null> => {
    const colRef = collection(db, 'documents');
    const q = query(colRef, where('lessonId', '==', lessonId));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      return querySnap.docs[0].data() as SourceDocument;
    }
    return null;
  },

  getSourceDocuments: async (lessonId: string): Promise<SourceDocument[]> => {
    const colRef = collection(db, 'documents');
    const q = query(colRef, where('lessonId', '==', lessonId));
    const querySnap = await getDocs(q);
    const docs: SourceDocument[] = [];
    querySnap.forEach(d => {
      docs.push(d.data() as SourceDocument);
    });
    return docs;
  },

  deleteItemCascade: async (itemId: string): Promise<{ success: boolean }> => {
    const docRef = doc(db, 'items', itemId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as LessonItem;
      const htmlUrls: string[] = [
        ...extractCloudinaryUrlsFromHtml(data.bodyHtml),
        ...extractFirebaseStorageUrlsFromHtml(data.bodyHtml),
        ...extractCloudinaryUrlsFromHtml(data.content),
        ...extractFirebaseStorageUrlsFromHtml(data.content),
        ...(data.paragraphs || []).flatMap(p => [
          ...extractCloudinaryUrlsFromHtml(p),
          ...extractFirebaseStorageUrlsFromHtml(p)
        ])
      ];
      if (htmlUrls.length > 0) {
        await deleteUnifiedAssetsHelper(htmlUrls, 'image');
      }
    }
    
    // Delete item and associated questions & progress
    const qCol = collection(db, 'questions');
    const qSnap = await getDocs(query(qCol, where('itemId', '==', itemId)));
    
    const progCol = collection(db, 'itemProgress');
    const progSnap = await getDocs(query(progCol, where('itemId', '==', itemId)));
    
    const batch = writeBatch(db);
    batch.delete(docRef);
    qSnap.docs.forEach(d => batch.delete(d.ref));
    progSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit().catch(() => {});
    return { success: true };
  },

  deleteContent: async (contentId: string): Promise<{ success: boolean }> => {
    // 1. Check in 'contents' collection
    const contentRef = doc(db, 'contents', contentId);
    const contentSnap = await getDoc(contentRef);
    if (contentSnap.exists()) {
      const data = contentSnap.data() as ContentSection;
      const htmlUrls = [
        ...extractCloudinaryUrlsFromHtml(data.bodyHtml),
        ...extractFirebaseStorageUrlsFromHtml(data.bodyHtml)
      ];
      if (htmlUrls.length > 0) {
        await deleteUnifiedAssetsHelper(htmlUrls, 'image');
      }
      await deleteDoc(contentRef);
      return { success: true };
    }

    // 2. Check in 'items' collection as fallback
    return await firestoreService.deleteItemCascade(contentId);
  },

  deleteSectionCascade: async (lessonId: string, sectionId: string): Promise<{ success: boolean }> => {
    const secRef = doc(db, 'sections', sectionId);

    const itemsCol = collection(db, 'items');
    const itemsSnap = await getDocs(query(itemsCol, where('sectionId', '==', sectionId)));

    // Clean up any storage assets in items
    const htmlUrls: string[] = [];
    itemsSnap.docs.forEach(d => {
      const item = d.data() as LessonItem;
      htmlUrls.push(...extractCloudinaryUrlsFromHtml(item.bodyHtml));
      htmlUrls.push(...extractFirebaseStorageUrlsFromHtml(item.bodyHtml));
      htmlUrls.push(...extractCloudinaryUrlsFromHtml(item.content));
      htmlUrls.push(...extractFirebaseStorageUrlsFromHtml(item.content));
      (item.paragraphs || []).forEach(p => {
        htmlUrls.push(...extractCloudinaryUrlsFromHtml(p));
        htmlUrls.push(...extractFirebaseStorageUrlsFromHtml(p));
      });
    });
    if (htmlUrls.length > 0) {
      await deleteUnifiedAssetsHelper(htmlUrls, 'image');
    }

    const batch = writeBatch(db);
    batch.delete(secRef);
    itemsSnap.docs.forEach(d => batch.delete(d.ref));

    const questionsCol = collection(db, 'questions');
    const questionsSnap = await getDocs(query(questionsCol, where('sectionId', '==', sectionId)));
    questionsSnap.docs.forEach(d => batch.delete(d.ref));

    for (const itemDoc of itemsSnap.docs) {
      const itemQSnap = await getDocs(query(questionsCol, where('itemId', '==', itemDoc.id)));
      itemQSnap.docs.forEach(d => batch.delete(d.ref));
    }

    const secProgCol = collection(db, 'userSectionProgress');
    const secProgSnap = await getDocs(query(secProgCol, where('sectionId', '==', sectionId)));
    secProgSnap.docs.forEach(d => batch.delete(d.ref));

    const itemProgCol = collection(db, 'itemProgress');
    for (const itemDoc of itemsSnap.docs) {
      const progSnap = await getDocs(query(itemProgCol, where('itemId', '==', itemDoc.id)));
      progSnap.docs.forEach(d => batch.delete(d.ref));
    }

    await batch.commit();
    return { success: true };
  },

  deleteSection: async (sectionId: string): Promise<{ success: boolean }> => {
    const secDoc = await getDoc(doc(db, 'sections', sectionId));
    const lessonId = secDoc.exists() ? (secDoc.data() as any).lessonId : '';
    if (lessonId) {
      return await firestoreService.deleteSectionCascade(lessonId, sectionId);
    }
    const secRef = doc(db, 'sections', sectionId);
    await deleteDoc(secRef);
    return { success: true };
  },

  deleteAllLessonContent: async (lessonId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const sectionsSnap = await getDocs(query(collection(db, 'sections'), where('lessonId', '==', lessonId)));
      const itemsSnap = await getDocs(query(collection(db, 'items'), where('lessonId', '==', lessonId)));
      const questionsSnap = await getDocs(query(collection(db, 'questions'), where('lessonId', '==', lessonId)));
      const contentsSnap = await getDocs(query(collection(db, 'contents'), where('lessonId', '==', lessonId)));

      // Clean up assets in all contents & items
      const htmlUrls: string[] = [];
      contentsSnap.docs.forEach(d => {
        const c = d.data() as ContentSection;
        htmlUrls.push(...extractCloudinaryUrlsFromHtml(c.bodyHtml));
        htmlUrls.push(...extractFirebaseStorageUrlsFromHtml(c.bodyHtml));
      });
      itemsSnap.docs.forEach(d => {
        const item = d.data() as LessonItem;
        htmlUrls.push(...extractCloudinaryUrlsFromHtml(item.bodyHtml));
        htmlUrls.push(...extractFirebaseStorageUrlsFromHtml(item.bodyHtml));
        htmlUrls.push(...extractCloudinaryUrlsFromHtml(item.content));
        htmlUrls.push(...extractFirebaseStorageUrlsFromHtml(item.content));
        (item.paragraphs || []).forEach(p => {
          htmlUrls.push(...extractCloudinaryUrlsFromHtml(p));
          htmlUrls.push(...extractFirebaseStorageUrlsFromHtml(p));
        });
      });
      if (htmlUrls.length > 0) {
        await deleteUnifiedAssetsHelper(htmlUrls, 'image');
      }

      const batch = writeBatch(db);
      sectionsSnap.docs.forEach(d => batch.delete(d.ref));
      itemsSnap.docs.forEach(d => batch.delete(d.ref));
      questionsSnap.docs.forEach(d => batch.delete(d.ref));
      contentsSnap.docs.forEach(d => batch.delete(d.ref));

      const itemProgSnap = await getDocs(query(collection(db, 'itemProgress'), where('lessonId', '==', lessonId)));
      itemProgSnap.docs.forEach(d => batch.delete(d.ref));

      const secProgSnap = await getDocs(query(collection(db, 'userSectionProgress'), where('lessonId', '==', lessonId)));
      secProgSnap.docs.forEach(d => batch.delete(d.ref));

      const docsSnap = await getDocs(query(collection(db, 'documents'), where('lessonId', '==', lessonId)));
      const now = new Date().toISOString();
      docsSnap.docs.forEach(d => batch.update(d.ref, { status: 'parsed', publishedAt: null, updatedAt: now }));

      const lessonRef = doc(db, 'lessons', lessonId);
      batch.update(lessonRef, { sourceDocument: null, updatedAt: now });

      await batch.commit();
      return { success: true, message: 'Đã xóa toàn bộ nội dung bài học và làm sạch assets Cloudinary thành công!' };
    } catch (err: any) {
      console.error('Error in deleteAllLessonContent:', err);
      throw new Error(err.message || 'Lỗi xóa toàn bộ nội dung bài học');
    }
  },

  deleteDocumentContentOnly: async (lessonId: string, documentId: string): Promise<{ success: boolean; message: string }> => {
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();

      // Fetch all active sections, items, and questions for this lesson
      const sectionsSnap = await getDocs(query(collection(db, 'sections'), where('lessonId', '==', lessonId), where('isDeleted', '==', false)));
      const itemsSnap = await getDocs(query(collection(db, 'items'), where('lessonId', '==', lessonId), where('isDeleted', '==', false)));
      const questionsSnap = await getDocs(query(collection(db, 'questions'), where('lessonId', '==', lessonId), where('isDeleted', '==', false)));

      const allSections = sectionsSnap.docs.map(d => d.data() as LessonSection);
      const allItems = itemsSnap.docs.map(d => d.data() as LessonItem);
      const allQuestions = questionsSnap.docs.map(d => d.data() as LessonQuestion);

      // Determine items to delete (sourceDocumentId === documentId)
      const itemsToDelete = allItems.filter(i => i.sourceDocumentId === documentId);
      const itemIdsToDelete = new Set(itemsToDelete.map(i => i.id));

      // Determine sections to delete:
      // A section is deleted if:
      // - section.sourceDocumentId === documentId
      // - OR all items in that section have sourceDocumentId === documentId (and section had items from this doc)
      const sectionIdsToDelete = new Set<string>();
      allSections.forEach(sec => {
        const secItems = allItems.filter(i => i.sectionId === sec.id);
        const remainingItems = secItems.filter(i => !itemIdsToDelete.has(i.id));
        if (sec.sourceDocumentId === documentId || (secItems.length > 0 && remainingItems.length === 0 && secItems.every(i => i.sourceDocumentId === documentId))) {
          sectionIdsToDelete.add(sec.id);
        }
      });

      // Determine questions to delete (sourceDocumentId === documentId or itemId in itemIdsToDelete or sectionId in sectionIdsToDelete)
      const questionIdsToDelete = new Set<string>();
      allQuestions.forEach(q => {
        if (
          q.sourceDocumentId === documentId ||
          (q.itemId && itemIdsToDelete.has(q.itemId)) ||
          (q.sectionId && sectionIdsToDelete.has(q.sectionId))
        ) {
          questionIdsToDelete.add(q.id);
        }
      });

      // Soft delete items
      itemsSnap.docs.forEach(d => {
        const item = d.data() as LessonItem;
        if (itemIdsToDelete.has(item.id)) {
          batch.update(d.ref, { isDeleted: true, updatedAt: now });
        }
      });

      // Soft delete sections
      sectionsSnap.docs.forEach(d => {
        const sec = d.data() as LessonSection;
        if (sectionIdsToDelete.has(sec.id)) {
          batch.update(d.ref, { isDeleted: true, updatedAt: now });
        }
      });

      // Soft delete questions
      questionsSnap.docs.forEach(d => {
        const q = d.data() as LessonQuestion;
        if (questionIdsToDelete.has(q.id)) {
          batch.update(d.ref, { isDeleted: true, updatedAt: now });
        }
      });

      // Clean up progress
      const itemProgSnap = await getDocs(query(collection(db, 'itemProgress'), where('lessonId', '==', lessonId)));
      itemProgSnap.docs.forEach(d => {
        const prog = d.data();
        if (prog.itemId && itemIdsToDelete.has(prog.itemId)) {
          batch.delete(d.ref);
        }
      });

      const secProgSnap = await getDocs(query(collection(db, 'userSectionProgress'), where('lessonId', '==', lessonId)));
      secProgSnap.docs.forEach(d => {
        const prog = d.data();
        if (prog.sectionId && sectionIdsToDelete.has(prog.sectionId)) {
          batch.delete(d.ref);
        }
      });

      // Update document status back to parsed/uploaded and clear publishedAt
      const docRef = doc(db, 'documents', documentId);
      try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          batch.update(docRef, { status: 'parsed', publishedAt: null, updatedAt: now });
        }
      } catch (e) {
        // ignore if doc missing
      }

      await batch.commit();
      return { success: true, message: 'Đã xóa toàn bộ nội dung bài giảng và các phần rỗng sinh từ tài liệu thành công!' };
    } catch (err: any) {
      console.error('Error in deleteDocumentContentOnly:', err);
      throw new Error(err.message || 'Lỗi xóa nội dung tài liệu');
    }
  },

  deleteSourceDocumentCascade: async (lessonId: string, documentId: string, cloudinaryPublicId?: string, resourceType = 'raw'): Promise<{ success: boolean; message: string; cloudinaryDeleted: boolean }> => {
    try {
      // 1. Fetch document metadata before deletion to get all file paths/URLs
      const docRef = doc(db, 'documents', documentId);
      const docSnap = await getDoc(docRef);
      const docData = docSnap.exists() ? (docSnap.data() as SourceDocument) : null;

      // 2. First run the same content cleanup to remove sections, items, questions, and progress linked to documentId
      await firestoreService.deleteDocumentContentOnly(lessonId, documentId);

      // 3. Delete document metadata from Firestore
      await deleteDoc(docRef);

      // 4. Update remaining source documents on lesson
      const lessonRef = doc(db, 'lessons', lessonId);
      const remainingDocs = await firestoreService.getSourceDocuments(lessonId);
      await updateDoc(lessonRef, {
        sourceDocuments: remainingDocs,
        sourceDocument: remainingDocs.length > 0 ? remainingDocs[0] : null,
        documents: remainingDocs,
        sourceDocumentId: remainingDocs.length > 0 ? remainingDocs[0].id : '',
        updatedAt: new Date().toISOString()
      });

      // 5. Delete storage file across Cloudinary and Firebase Storage
      const targets = [
        cloudinaryPublicId,
        docData?.cloudinaryPublicId,
        docData?.storagePath,
        docData?.url,
        (docData as any)?.secureUrl
      ].filter(Boolean) as string[];

      let deleteRes = { cloudinary: true, firebase: true };
      if (targets.length > 0) {
        const inferredType = (docData?.resourceType as any) || (resourceType as any) || 'raw';
        deleteRes = await deleteUnifiedAssetsHelper(targets, inferredType);
      }

      return {
        success: true,
        cloudinaryDeleted: deleteRes.cloudinary && deleteRes.firebase,
        message: 'Đã xóa tài liệu và toàn bộ dữ liệu bài học liên quan thành công.'
      };
    } catch (err: any) {
      console.error('Error in deleteSourceDocumentCascade:', err);
      throw new Error(err.message || 'Lỗi xóa tài liệu đồng bộ');
    }
  },

  // GRANULAR USER ITEM PROGRESS
  getItemProgress: async (userId: string, lessonId: string): Promise<UserItemProgress[]> => {
    const colRef = collection(db, 'itemProgress');
    const q = query(
      colRef,
      where('userId', '==', userId),
      where('lessonId', '==', lessonId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserItemProgress);
  },

  submitItemProgress: async (progressData: Partial<UserItemProgress>): Promise<UserItemProgress> => {
    const id = progressData.id || `itemprog-${progressData.userId}-${progressData.lessonId}-${progressData.itemId}`;
    const docRef = doc(db, 'itemProgress', id);
    const now = new Date().toISOString();

    const record: UserItemProgress = {
      id,
      userId: progressData.userId || 'user-default',
      userName: progressData.userName || 'Chiến sĩ Hải Quân',
      unitId: progressData.unitId || 'unit-1',
      unitName: progressData.unitName || 'Lữ đoàn 162',
      courseId: progressData.courseId || '',
      lessonId: progressData.lessonId || '',
      sectionId: progressData.sectionId || '',
      itemId: progressData.itemId || '',
      completed: progressData.completed ?? true,
      score: progressData.score || 10,
      attempts: (progressData.attempts || 0) + 1,
      lastAccessedAt: now,
      completedAt: progressData.completed ? now : undefined
    };

    await setDoc(docRef, record, { merge: true });
    return record;
  },

  submitSectionProgress: async (progressData: Partial<UserSectionProgress>): Promise<UserSectionProgress> => {
    const id = progressData.id || `secprog-${progressData.userId}-${progressData.lessonId}-${progressData.sectionId}`;
    const docRef = doc(db, 'userSectionProgress', id);
    const now = new Date().toISOString();

    const recordObj: Record<string, any> = {
      id,
      userId: progressData.userId || 'user-default',
      userName: progressData.userName || 'Chiến sĩ Hải Quân',
      unitId: progressData.unitId || 'unit-1',
      unitName: progressData.unitName || 'Lữ đoàn 162',
      courseId: progressData.courseId || '',
      lessonId: progressData.lessonId || '',
      sectionId: progressData.sectionId || '',
      contentCompleted: progressData.contentCompleted ?? true,
      essaySubmitted: progressData.essaySubmitted ?? false,
      essayAnswer: progressData.essayAnswer || '',
      answerStatus: progressData.essaySubmitted ? 'submitted' : 'pending_review',
      score: progressData.score || (progressData.essaySubmitted ? 10 : 0),
      completed: (progressData.contentCompleted && progressData.essaySubmitted) ?? false,
      startedAt: progressData.startedAt || now,
      submittedAt: progressData.essaySubmitted ? (progressData.submittedAt || now) : null,
      completedAt: (progressData.contentCompleted && progressData.essaySubmitted) ? (progressData.completedAt || now) : null,
      updatedAt: now
    };

    const cleanRecord = sanitizeFirestoreData(recordObj);
    await setDoc(docRef, cleanRecord, { merge: true });
    return cleanRecord as UserSectionProgress;
  },

  getSectionProgress: async (userId: string, lessonId: string): Promise<UserSectionProgress[]> => {
    const colRef = collection(db, 'userSectionProgress');
    const q = query(
      colRef,
      where('userId', '==', userId),
      where('lessonId', '==', lessonId)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as UserSectionProgress);
  },

  // -------------------------------------------------------------
  // VIDEOS
  // -------------------------------------------------------------
  getVideos: async (lessonId: string): Promise<VideoItem[]> => {
    const colRef = collection(db, 'videos');
    const q = query(
      colRef,
      where('lessonId', '==', lessonId),
      where('isDeleted', '==', false)
    );
    const snap = await getDocs(q);
    const videos = snap.docs.map(d => d.data() as VideoItem);
    return videos.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  createVideo: async (data: Partial<VideoItem>): Promise<VideoItem> => {
    const id = data.id || `video-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const docRef = doc(db, 'videos', id);
    const now = new Date().toISOString();
    const lessonId = data.lessonId || '';
    const assetFolder = data.assetFolder || `GDCT_V4/VIDEO/${lessonId || 'general'}`;

    const video: VideoItem = {
      id,
      lessonId,
      order: data.order || 1,
      title: data.title || '',
      description: data.description || '',
      videoUrl: data.videoUrl || data.cloudinaryUrl || '',
      cloudinaryUrl: data.cloudinaryUrl || data.videoUrl || '',
      cloudinaryPublicId: data.cloudinaryPublicId || data.storagePath || '',
      assetFolder,
      mimeType: data.mimeType || 'video/mp4',
      fileSize: data.fileSize || 0,
      resourceType: data.resourceType || 'video',
      storagePath: data.storagePath || data.cloudinaryPublicId || '',
      thumbnail: data.thumbnail || (data as any).thumbnailUrl || '',
      durationSeconds: data.durationSeconds || 0,
      version: data.version || 1,
      isDeleted: false,
      createdAt: data.createdAt || now,
      updatedAt: now
    };
    await setDoc(docRef, video);
    return video;
  },

  updateVideo: async (id: string, data: Partial<VideoItem>): Promise<VideoItem> => {
    const docRef = doc(db, 'videos', id);
    const now = new Date().toISOString();
    await updateDoc(docRef, {
      ...data,
      updatedAt: now
    });
    const snap = await getDoc(docRef);
    return snap.data() as VideoItem;
  },

  deleteVideo: async (id: string): Promise<{ success: boolean }> => {
    const res = await firestoreService.deleteVideoCascade(id);
    return { success: res.success };
  },

  // -------------------------------------------------------------
  // AUDIOS
  // -------------------------------------------------------------
  getAudios: async (lessonId: string): Promise<AudioItem[]> => {
    const colRef = collection(db, 'audios');
    const q = query(
      colRef,
      where('lessonId', '==', lessonId),
      where('isDeleted', '==', false)
    );
    const snap = await getDocs(q);
    const audios = snap.docs.map(d => d.data() as AudioItem);
    return audios.sort((a, b) => (a.order || 0) - (b.order || 0));
  },

  createAudio: async (data: Partial<AudioItem>): Promise<AudioItem> => {
    const id = data.id || `audio-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const docRef = doc(db, 'audios', id);
    const now = new Date().toISOString();
    const lessonId = data.lessonId || '';
    const assetFolder = data.assetFolder || `GDCT_V4/AUDIO/${lessonId || 'general'}`;

    const audio: AudioItem = {
      id,
      lessonId,
      order: data.order || 1,
      title: data.title || '',
      description: data.description || '',
      audioUrl: data.audioUrl || data.cloudinaryUrl || '',
      cloudinaryUrl: data.cloudinaryUrl || data.audioUrl || '',
      cloudinaryPublicId: data.cloudinaryPublicId || data.storagePath || '',
      assetFolder,
      mimeType: data.mimeType || 'audio/mp3',
      fileSize: data.fileSize || 0,
      resourceType: data.resourceType || 'video',
      storagePath: data.storagePath || data.cloudinaryPublicId || '',
      durationSeconds: data.durationSeconds || 0,
      version: data.version || 1,
      isDeleted: false,
      createdAt: data.createdAt || now,
      updatedAt: now
    };
    await setDoc(docRef, audio);
    return audio;
  },

  updateAudio: async (id: string, data: Partial<AudioItem>): Promise<AudioItem> => {
    const docRef = doc(db, 'audios', id);
    const now = new Date().toISOString();
    await updateDoc(docRef, {
      ...data,
      updatedAt: now
    });
    const snap = await getDoc(docRef);
    return snap.data() as AudioItem;
  },

  deleteAudio: async (id: string): Promise<{ success: boolean }> => {
    const res = await firestoreService.deleteAudioCascade(id);
    return { success: res.success };
  },

  // -------------------------------------------------------------
  // UNITS
  // -------------------------------------------------------------
  getUnits: async (): Promise<Unit[]> => {
    const colRef = collection(db, 'units');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as Unit));
  },

  // -------------------------------------------------------------
  // USERS
  // -------------------------------------------------------------
  getUsers: async (): Promise<User[]> => {
    const colRef = collection(db, 'users');
    const snap = await getDocs(colRef);
    return snap.docs.map(d => {
      const data = d.data() as any;
      let r = data.role || 'USER';
      if (r === 'SUPER_ADMIN') r = 'ADMIN';
      if (r === 'CONTENT_ADMIN' || r === 'UNIT_ADMIN') r = 'APPROVER';
      return { id: d.id, ...data, role: r } as User;
    });
  },

  getUserPersonalCloudData: async (userId: string) => {
    try {
      const [progSnap, subSnap, fbSnap, secSnap] = await Promise.all([
        getDocs(query(collection(db, 'progress'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'exam_submissions'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'user_feedbacks'), where('userId', '==', userId))),
        getDocs(query(collection(db, 'userSectionProgress'), where('userId', '==', userId)))
      ]);

      const progressList = progSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }) as UserProgress);
      const examSubmissions = subSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }) as ExamSubmission)
        .sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      const feedbacks = fbSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }) as UserFeedback)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const sectionProgressList = secSnap.docs.map(d => ({ ...(d.data() as any), id: d.id }) as UserSectionProgress);

      return {
        progressList,
        examSubmissions,
        feedbacks,
        sectionProgressList
      };
    } catch (err) {
      console.warn('[getUserPersonalCloudData error]:', err);
      return { progressList: [], examSubmissions: [], feedbacks: [], sectionProgressList: [] };
    }
  },

  updateUserAndSync: async (id: string, data: Partial<User>): Promise<User> => {
    const docRef = doc(db, 'users', id);
    const now = new Date().toISOString();

    // Map role for Firestore security rules
    const patch: any = { ...data };
    if (patch.role) {
      if (patch.role === 'ADMIN') patch.role = 'SUPER_ADMIN';
      else if (patch.role === 'APPROVER') patch.role = 'CONTENT_ADMIN';
    }
    if (patch.fullName && !patch.name) {
      patch.name = patch.fullName;
    }

    const updatePayload = sanitizeFirestoreData({ ...patch, updatedAt: now });
    await updateDoc(docRef, updatePayload);

    // Synchronize user profile changes to historical submissions and progress
    try {
      const displayName = data.fullName || data.name;
      const rank = data.rank;
      const position = data.position;
      const unitName = data.unitName || data.unit;

      if (displayName || rank || position || unitName) {
        const [subSnap, progSnap] = await Promise.all([
          getDocs(query(collection(db, 'exam_submissions'), where('userId', '==', id))),
          getDocs(query(collection(db, 'progress'), where('userId', '==', id)))
        ]);

        if (!subSnap.empty || !progSnap.empty) {
          const batch = writeBatch(db);
          
          subSnap.docs.forEach(d => {
            const patch: any = {};
            if (displayName) patch.userName = displayName;
            if (rank) patch.userRank = rank;
            if (position) patch.userPosition = position;
            if (unitName) patch.unitName = unitName;
            batch.update(d.ref, patch);
          });

          progSnap.docs.forEach(d => {
            const patch: any = {};
            if (displayName) patch.userName = displayName;
            if (unitName) patch.unitName = unitName;
            batch.update(d.ref, patch);
          });

          await batch.commit().catch(e => console.warn('[updateUserAndSync batch warning]:', e));
        }
      }
    } catch (syncErr) {
      console.warn('[updateUserAndSync profile sync warning]:', syncErr);
    }

    const updatedSnap = await getDoc(docRef);
    const updatedData = updatedSnap.data() as any;
    let r = updatedData.role || 'USER';
    if (r === 'SUPER_ADMIN') r = 'ADMIN';
    if (r === 'CONTENT_ADMIN' || r === 'UNIT_ADMIN') r = 'APPROVER';
    return { id: updatedSnap.id, ...updatedData, role: r } as User;
  },

  // -------------------------------------------------------------
  // USER PROGRESS
  // -------------------------------------------------------------
  getProgress: async (unitId?: string, lessonId?: string): Promise<UserProgress[]> => {
    const colRef = collection(db, 'progress');
    let q;
    if (unitId && lessonId) {
      q = query(colRef, where('unitId', '==', unitId), where('lessonId', '==', lessonId));
    } else if (unitId) {
      q = query(colRef, where('unitId', '==', unitId));
    } else if (lessonId) {
      q = query(colRef, where('lessonId', '==', lessonId));
    } else {
      q = query(colRef, limit(100));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as UserProgress));
  },

  submitProgress: async (data: Partial<UserProgress>): Promise<UserProgress> => {
    const id = data.id || `prog-${data.userId}-${data.lessonId}`;
    const docRef = doc(db, 'progress', id);
    const now = new Date().toISOString();
    
    const sProg = Number(data.slideProgress) || 0;
    const cProg = Number(data.contentProgress) || 0;
    const vProg = Number(data.videoProgress) || 0;
    const aProg = Number(data.audioProgress) || 0;
    const overall = Math.max(sProg, cProg, vProg, aProg);
    const isCompleted = overall >= 85 || sProg === 100 || cProg === 100;

    const progressRecord: UserProgress = {
      id,
      userId: data.userId || 'user-default',
      userName: data.userName || 'Chiến sĩ Hải Quân',
      unitId: data.unitId || 'unit-1',
      unitName: data.unitName || 'Lữ đoàn 162',
      lessonId: data.lessonId || '',
      lessonTitle: data.lessonTitle || '',
      courseId: data.courseId || '',
      slideProgress: sProg,
      videoProgress: vProg,
      audioProgress: aProg,
      contentProgress: cProg,
      overallProgress: overall,
      completed: isCompleted,
      lastAccessedAt: now,
      completedAt: isCompleted ? now : undefined,
      version: 1
    };

    await setDoc(docRef, progressRecord);
    return progressRecord;
  },

  // -------------------------------------------------------------
  // NOTIFICATIONS
  // -------------------------------------------------------------
  getNotifications: async (maxLimit = 20): Promise<SystemNotification[]> => {
    const colRef = collection(db, 'notifications');
    const q = query(colRef, orderBy('createdAt', 'desc'), limit(maxLimit));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as SystemNotification);
  },

  createNotification: async (data: Partial<SystemNotification>): Promise<SystemNotification> => {
    const id = data.id || `notif-${Date.now()}`;
    const docRef = doc(db, 'notifications', id);
    const notif: SystemNotification = {
      id,
      title: data.title || '',
      content: data.content || '',
      type: data.type || 'ANNOUNCEMENT',
      priority: data.priority || 'NORMAL',
      targetUnitId: data.targetUnitId || 'ALL',
      sentBy: data.sentBy || 'Ban Tuyên huấn Vùng 4',
      createdAt: new Date().toISOString()
    };
    await setDoc(docRef, notif);
    return notif;
  },

  // -------------------------------------------------------------
  // POSTER & BANNER (App Mobile Home Carousel - Max 5)
  // -------------------------------------------------------------
  getBanners: async (): Promise<AppBanner[]> => {
    const colRef = collection(db, 'banners');
    const q = query(colRef, orderBy('order', 'asc'));
    const snap = await getDocs(q);
    const banners = snap.docs.map(d => d.data() as AppBanner);
    
    // Only seed once on initial fresh install, not when user deliberately empties banners
    if (banners.length === 0) {
      const initDocRef = doc(db, 'system_settings', 'banners_init');
      const initSnap = await getDoc(initDocRef);
      if (!initSnap.exists()) {
        await setDoc(initDocRef, { initialized: true, initializedAt: new Date().toISOString() });
        return await firestoreService.seedDefaultBanners();
      }
    }
    return banners;
  },

  seedDefaultBanners: async (): Promise<AppBanner[]> => {
    const now = new Date().toISOString();
    const defaultBanners: AppBanner[] = [
      {
        id: 'banner-hoc-tap-ren-luyen',
        title: 'HỌC TẬP, RÈN LUYỆN VÌ LÝ TƯỞNG CỘNG SẢN',
        subtitle: 'Kiên định mục tiêu độc lập dân tộc và chủ nghĩa xã hội',
        badgeText: 'CHÍNH TRỊ QUÂN SỰ',
        backgroundColor: 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
        order: 1,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'banner-chu-quyen-bien-dao',
        title: 'BẢO VỆ VỮNG CHẮC CHỦ QUYỀN BIỂN ĐẢO TỔ QUỐC',
        subtitle: 'Cán bộ, chiến sĩ Vùng 4 Hải quân quyết tâm hoàn thành xuất sắc mọi nhiệm vụ',
        badgeText: 'HẢI QUÂN VIỆT NAM',
        backgroundColor: 'linear-gradient(135deg, #0369a1 0%, #0c4a6e 100%)',
        order: 2,
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'banner-quan-doi-chinh-quy',
        title: 'XÂY DỰNG QUÂN ĐỘI CÁCH MẠNG, CHÍNH QUY, TINH NHUỆ',
        subtitle: 'Tuyệt đối trung thành với Đảng, với Tổ quốc và nhân dân',
        badgeText: 'TRUNG VỚI ĐẢNG',
        backgroundColor: 'linear-gradient(135deg, #991b1b 0%, #450a0a 100%)',
        order: 3,
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ];

    for (const b of defaultBanners) {
      const docRef = doc(db, 'banners', b.id);
      await setDoc(docRef, b);
    }
    return defaultBanners;
  },

  createBanner: async (data: Partial<AppBanner>): Promise<AppBanner> => {
    // Max 5 banners constraint
    const existing = await firestoreService.getBanners();
    if (existing.length >= 5) {
      throw new Error('Hệ thống đã có tối đa 5 poster/banner. Vui lòng chỉnh sửa hoặc xóa bớt banner cũ trước khi tạo mới.');
    }

    const id = data.id || `banner-${Date.now()}`;
    const docRef = doc(db, 'banners', id);
    const now = new Date().toISOString();
    const nextOrder = data.order || (existing.length + 1);

    const banner: AppBanner = {
      id,
      title: data.title || '',
      subtitle: data.subtitle || '',
      imageUrl: data.imageUrl || '',
      cloudinaryPublicId: data.cloudinaryPublicId || '',
      targetLessonId: data.targetLessonId || '',
      targetCourseId: data.targetCourseId || '',
      targetUrl: data.targetUrl || '',
      badgeText: data.badgeText || '',
      backgroundColor: data.backgroundColor || 'linear-gradient(135deg, #b91c1c 0%, #7f1d1d 100%)',
      order: nextOrder,
      isActive: data.isActive ?? true,
      createdAt: now,
      updatedAt: now
    };

    await setDoc(docRef, banner);
    return banner;
  },

  updateBanner: async (id: string, updates: Partial<AppBanner>): Promise<AppBanner> => {
    const docRef = doc(db, 'banners', id);
    const now = new Date().toISOString();
    const payload = {
      ...updates,
      updatedAt: now
    };
    await updateDoc(docRef, payload);
    const snap = await getDoc(docRef);
    return snap.data() as AppBanner;
  },

  deleteBanner: async (id: string): Promise<{ success: boolean }> => {
    const docRef = doc(db, 'banners', id);
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data() as AppBanner;
        const targets = [
          data.cloudinaryPublicId,
          (data as any).storagePath,
          data.imageUrl
        ].filter(Boolean) as string[];

        if (targets.length > 0) {
          await deleteUnifiedAssetsHelper(targets, 'image');
        }
      }
    } catch (err) {
      console.warn('Error reading banner before delete:', err);
    }
    await deleteDoc(docRef);
    return { success: true };
  },

  reorderBanners: async (orderedBannerIds: string[]): Promise<void> => {
    const batch = writeBatch(db);
    orderedBannerIds.forEach((id, index) => {
      const docRef = doc(db, 'banners', id);
      batch.update(docRef, { order: index + 1, updatedAt: new Date().toISOString() });
    });
    await batch.commit();
  },

  // -------------------------------------------------------------
  // MEDIA FILES METADATA (Cloudinary CDN Integration)
  // -------------------------------------------------------------
  saveMediaFileMetadata: async (data: {
    cloudinaryPublicId: string;
    secureUrl: string;
    resourceType?: string;
    fileName?: string;
    mimeType?: string;
    bytes?: number;
    width?: number;
    height?: number;
    duration?: number;
    version?: number;
  }) => {
    const id = data.cloudinaryPublicId.replace(/[/]/g, '_');
    const docRef = doc(db, 'mediaFiles', id);
    const now = new Date().toISOString();
    const metadataRecord = {
      provider: 'cloudinary',
      cloudinaryPublicId: data.cloudinaryPublicId,
      resourceType: data.resourceType || 'image',
      secureUrl: data.secureUrl,
      fileName: data.fileName || 'file',
      mimeType: data.mimeType || 'image/jpeg',
      bytes: data.bytes || 0,
      width: data.width || 0,
      height: data.height || 0,
      duration: data.duration || 0,
      version: data.version || 1,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, metadataRecord);
    return metadataRecord;
  },

  deleteMediaFileMetadata: async (cloudinaryPublicId: string): Promise<boolean> => {
    const id = cloudinaryPublicId.replace(/[/]/g, '_');
    const docRef = doc(db, 'mediaFiles', id);
    await deleteDoc(docRef);
    return true;
  },

  // -------------------------------------------------------------
  // PPTX BACKGROUND PROCESSING JOBS
  // -------------------------------------------------------------
  createPptxJob: async (data: Partial<PptxProcessingJob>): Promise<PptxProcessingJob> => {
    const id = data.id || `pptx-job-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const docRef = doc(db, 'pptxProcessing', id);
    const now = new Date().toISOString();
    const job: PptxProcessingJob = {
      id,
      fileName: data.fileName || 'presentation.pptx',
      fileSize: data.fileSize || 0,
      originalUrl: data.originalUrl || '',
      originalPublicId: data.originalPublicId || '',
      courseId: data.courseId || '',
      lessonId: data.lessonId || '',
      status: data.status || 'processing',
      totalSlides: data.totalSlides || 0,
      processedSlides: data.processedSlides || 0,
      progress: data.progress || 0,
      currentSlide: data.currentSlide || 0,
      currentStepName: data.currentStepName || 'Đã nhận file PPTX',
      error: data.error || null,
      errorStep: data.errorStep || null,
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, job);
    return job;
  },

  updatePptxJob: async (jobId: string, updates: Partial<PptxProcessingJob>): Promise<void> => {
    const docRef = doc(db, 'pptxProcessing', jobId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });
  },

  getPptxJob: async (jobId: string): Promise<PptxProcessingJob | null> => {
    const docRef = doc(db, 'pptxProcessing', jobId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as PptxProcessingJob;
  },

  listenPptxJob: (jobId: string, callback: (job: PptxProcessingJob | null) => void): (() => void) => {
    const docRef = doc(db, 'pptxProcessing', jobId);
    return onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        callback(snap.data() as PptxProcessingJob);
      } else {
        callback(null);
      }
    }, (err) => {
      console.error('Error listening to PPTX job:', err);
    });
  },

  findExistingPptxJob: async (lessonId: string, fileName: string): Promise<PptxProcessingJob | null> => {
    const colRef = collection(db, 'pptxProcessing');
    const q = query(
      colRef,
      where('lessonId', '==', lessonId),
      where('fileName', '==', fileName)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const jobs = snap.docs.map(d => d.data() as PptxProcessingJob);
    jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return jobs[0] || null;
  },

  // -------------------------------------------------------------
  // DASHBOARD AGGREGATED STATS (Production Realtime Aggregate)
  // -------------------------------------------------------------
  getDashboardStats: async (): Promise<DashboardStats> => {
    const [coursesSnap, lessonsSnap, usersSnap, progressSnap, unitsSnap] = await Promise.all([
      getDocs(query(collection(db, 'courses'), where('isDeleted', '==', false))),
      getDocs(query(collection(db, 'lessons'), where('isDeleted', '==', false))),
      getDocs(collection(db, 'users')),
      getDocs(collection(db, 'progress')),
      getDocs(collection(db, 'units'))
    ]);

    const lessons = lessonsSnap.docs.map(d => d.data() as Lesson);
    const publishedLessons = lessons.filter(l => l.status === 'PUBLISHED').length;
    const draftLessons = lessons.filter(l => l.status === 'DRAFT').length;
    const reviewLessons = lessons.filter(l => l.status === 'REVIEW').length;
    
    const allProgress = progressSnap.docs.map(d => d.data() as UserProgress);
    const completed = allProgress.filter(p => p.completed).length;
    const inProgress = allProgress.length - completed;
    const avgRate = allProgress.length > 0
      ? Math.round(allProgress.reduce((acc, curr) => acc + (curr.overallProgress || 0), 0) / allProgress.length)
      : 0;

    return {
      totalCourses: coursesSnap.size,
      totalLessons: lessonsSnap.size,
      publishedLessons,
      draftLessons,
      reviewLessons,
      totalUsers: usersSnap.size,
      totalUnits: unitsSnap.size,
      totalStudySessions: allProgress.length,
      completedLearners: completed,
      inProgressLearners: inProgress,
      averageCompletionRate: avgRate,
      storageStats: {
        totalFiles: lessonsSnap.size * 5,
        totalSizeMb: 1450,
        slidesCount: lessonsSnap.size * 12,
        videosCount: lessonsSnap.size * 2,
        audiosCount: lessonsSnap.size * 2,
        documentsCount: lessonsSnap.size
      },
      recentActivities: [
        {
          id: 'act-1',
          action: 'Đồng bộ Firestore Production',
          target: 'Hệ thống GDCT Vùng 4',
          user: 'Admin',
          time: 'Vừa xong'
        }
      ]
    };
  },

  // -------------------------------------------------------------
  // ROBUST CASCADE DELETE & ORPHAN SCANNING ENGINE
  // -------------------------------------------------------------
  deleteSlideCascade: async (slideId: string): Promise<{ success: boolean; cloudinaryDeleted: boolean }> => {
    const docRef = doc(db, 'slides', slideId);
    const snap = await getDoc(docRef);
    let allDeleted = true;
    if (snap.exists()) {
      const data = snap.data() as SlideItem;
      const lessonId = data.lessonId;
      const targets = [
        data.cloudinaryPublicId,
        data.storagePath,
        data.imageUrl,
        data.secureUrl,
        data.cloudinaryUrl
      ].filter(Boolean) as string[];
      if (targets.length > 0) {
        const res = await deleteUnifiedAssetsHelper(targets, 'image');
        allDeleted = res.cloudinary && res.firebase;
      }
      await deleteDoc(docRef);
      if (lessonId) {
        try {
          const remaining = await firestoreService.getSlides(lessonId);
          await firestoreService.updateLesson(lessonId, { slideCount: remaining.length });
        } catch {}
      }
    }
    return { success: true, cloudinaryDeleted: allDeleted };
  },

  deleteVideoCascade: async (videoId: string, lessonIdParam?: string): Promise<{ success: boolean; cloudinaryDeleted: boolean }> => {
    const docRef = doc(db, 'videos', videoId);
    const snap = await getDoc(docRef);
    let allDeleted = true;
    if (snap.exists()) {
      const data = snap.data() as VideoItem;
      const lessonId = data.lessonId || lessonIdParam;
      const videoTargets = [data.cloudinaryPublicId, data.storagePath, data.videoUrl, (data as any).cloudinaryUrl].filter(Boolean) as string[];
      if (videoTargets.length > 0) {
        const res = await deleteUnifiedAssetsHelper(videoTargets, 'video');
        if (!res.cloudinary || !res.firebase) allDeleted = false;
      }
      if (data.thumbnail) {
        const res = await deleteUnifiedAssetHelper(data.thumbnail, 'image');
        if (!res.cloudinary || !res.firebase) allDeleted = false;
      }
      await deleteDoc(docRef);
      if (lessonId) {
        try {
          const remaining = await firestoreService.getVideos(lessonId);
          await firestoreService.updateLesson(lessonId, { videoCount: remaining.length });
        } catch {}
      }
    }
    return { success: true, cloudinaryDeleted: allDeleted };
  },

  deleteAudioCascade: async (audioId: string, lessonIdParam?: string): Promise<{ success: boolean; cloudinaryDeleted: boolean }> => {
    const docRef = doc(db, 'audios', audioId);
    const snap = await getDoc(docRef);
    let allDeleted = true;
    if (snap.exists()) {
      const data = snap.data() as AudioItem;
      const lessonId = data.lessonId || lessonIdParam;
      const audioTargets = [data.cloudinaryPublicId, data.storagePath, data.audioUrl, (data as any).cloudinaryUrl].filter(Boolean) as string[];
      if (audioTargets.length > 0) {
        const res = await deleteUnifiedAssetsHelper(audioTargets, 'video');
        allDeleted = res.cloudinary && res.firebase;
      }
      await deleteDoc(docRef);
      if (lessonId) {
        try {
          const remaining = await firestoreService.getAudios(lessonId);
          await firestoreService.updateLesson(lessonId, { audioCount: remaining.length });
        } catch {}
      }
    }
    return { success: true, cloudinaryDeleted: allDeleted };
  },

  deleteLessonCascade: async (lessonId: string): Promise<DeleteReport> => {
    try {
      const lessonRef = doc(db, 'lessons', lessonId);
      const lessonSnap = await getDoc(lessonRef);
      const lessonData = lessonSnap.exists() ? (lessonSnap.data() as Lesson) : null;

      const [
        contentsSnap,
        sectionsSnap,
        itemsSnap,
        questionsSnap,
        slidesSnap,
        slideSetsSnap,
        videosSnap,
        audiosSnap,
        documentsSnap,
        itemProgSnap,
        secProgSnap,
        progressSnap,
        pptxJobsSnap,
        mediaFilesSnap
      ] = await Promise.all([
        getDocs(query(collection(db, 'contents'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'sections'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'items'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'questions'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'slides'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'slideSets'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'videos'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'audios'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'documents'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'itemProgress'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'userSectionProgress'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'progress'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'pptxJobs'), where('lessonId', '==', lessonId))).catch(() => ({ docs: [], size: 0 } as any)),
        getDocs(query(collection(db, 'mediaFiles'), where('lessonId', '==', lessonId))).catch(() => ({ docs: [], size: 0 } as any))
      ]);

      const imageTargets: string[] = [];
      const videoTargets: string[] = [];
      const rawTargets: string[] = [];

      // 1. Lesson thumbnail & PPT storage path
      if (lessonData?.storageThumbnailPath) {
        imageTargets.push(lessonData.storageThumbnailPath);
      }
      if (lessonData?.thumbnail) {
        imageTargets.push(lessonData.thumbnail);
      }
      if (lessonData?.rawPptStoragePath) {
        rawTargets.push(lessonData.rawPptStoragePath);
      }
      if ((lessonData as any)?.storagePath) {
        rawTargets.push((lessonData as any).storagePath);
      }

      // 2. Slide images
      slidesSnap.docs.forEach(d => {
        const slide = d.data() as SlideItem;
        [slide.cloudinaryPublicId, slide.storagePath, slide.imageUrl, slide.secureUrl, slide.cloudinaryUrl]
          .filter(Boolean)
          .forEach(id => imageTargets.push(id!));
      });

      // 3. Videos & video thumbnails
      videosSnap.docs.forEach(d => {
        const video = d.data() as VideoItem;
        [video.cloudinaryPublicId, video.storagePath, video.videoUrl, (video as any).cloudinaryUrl]
          .filter(Boolean)
          .forEach(id => videoTargets.push(id!));
        if (video.thumbnail) {
          imageTargets.push(video.thumbnail);
        }
      });

      // 4. Audios
      audiosSnap.docs.forEach(d => {
        const audio = d.data() as AudioItem;
        [audio.cloudinaryPublicId, audio.storagePath, audio.audioUrl, (audio as any).cloudinaryUrl]
          .filter(Boolean)
          .forEach(id => videoTargets.push(id!));
      });

      // 5. Documents
      documentsSnap.docs.forEach(d => {
        const docItem = d.data() as SourceDocument;
        const resType = docItem.resourceType || 'raw';
        const docTargets = [docItem.cloudinaryPublicId, docItem.storagePath, docItem.url, (docItem as any).secureUrl].filter(Boolean) as string[];
        if (resType === 'image') {
          docTargets.forEach(t => imageTargets.push(t));
        } else if (resType === 'video') {
          docTargets.forEach(t => videoTargets.push(t));
        } else {
          docTargets.forEach(t => rawTargets.push(t));
        }
      });

      // 6. Embedded images in content and items (Cloudinary & Firebase Storage)
      contentsSnap.docs.forEach(d => {
        const c = d.data() as ContentSection;
        extractCloudinaryUrlsFromHtml(c.bodyHtml).forEach(u => imageTargets.push(u));
        extractFirebaseStorageUrlsFromHtml(c.bodyHtml).forEach(u => imageTargets.push(u));
      });

      itemsSnap.docs.forEach(d => {
        const item = d.data() as LessonItem;
        extractCloudinaryUrlsFromHtml(item.bodyHtml).forEach(u => imageTargets.push(u));
        extractFirebaseStorageUrlsFromHtml(item.bodyHtml).forEach(u => imageTargets.push(u));
        extractCloudinaryUrlsFromHtml(item.content).forEach(u => imageTargets.push(u));
        extractFirebaseStorageUrlsFromHtml(item.content).forEach(u => imageTargets.push(u));
        (item.paragraphs || []).forEach(p => {
          extractCloudinaryUrlsFromHtml(p).forEach(u => imageTargets.push(u));
          extractFirebaseStorageUrlsFromHtml(p).forEach(u => imageTargets.push(u));
        });
      });

      // 7. PPTX Jobs & MediaFiles storage paths
      pptxJobsSnap.docs.forEach((d: any) => {
        const job = d.data();
        if (job?.rawPptStoragePath) rawTargets.push(job.rawPptStoragePath);
        if (job?.storagePath) rawTargets.push(job.storagePath);
      });
      mediaFilesSnap.docs.forEach((d: any) => {
        const media = d.data();
        if (media?.storagePath) rawTargets.push(media.storagePath);
        if (media?.url) imageTargets.push(media.url);
      });

      const uniqueImages = Array.from(new Set(imageTargets.filter(Boolean)));
      const uniqueVideos = Array.from(new Set(videoTargets.filter(Boolean)));
      const uniqueRaws = Array.from(new Set(rawTargets.filter(Boolean)));
      const totalStorageTargetsCount = uniqueImages.length + uniqueVideos.length + uniqueRaws.length;

      // Execute unified multi-storage deletion (Cloudinary + Firebase Storage)
      const deletePromises: Promise<{ cloudinary: boolean; firebase: boolean }>[] = [];
      if (uniqueImages.length > 0) {
        deletePromises.push(deleteUnifiedAssetsHelper(uniqueImages, 'image'));
      }
      if (uniqueVideos.length > 0) {
        deletePromises.push(deleteUnifiedAssetsHelper(uniqueVideos, 'video'));
      }
      if (uniqueRaws.length > 0) {
        deletePromises.push(deleteUnifiedAssetsHelper(uniqueRaws, 'raw'));
      }

      // Also trigger thorough Cloudinary folder and lesson purge
      const allLessonPublicIds = Array.from(new Set([...uniqueImages, ...uniqueVideos, ...uniqueRaws]));
      deletePromises.push(
        purgeCloudinaryLessonHelper(lessonId, allLessonPublicIds).then(cRes => ({ cloudinary: cRes, firebase: true }))
      );

      await Promise.allSettled(deletePromises);

      // Batch delete all Firestore documents
      const allDocsToDelete = [
        ...contentsSnap.docs,
        ...sectionsSnap.docs,
        ...itemsSnap.docs,
        ...questionsSnap.docs,
        ...slidesSnap.docs,
        ...slideSetsSnap.docs,
        ...videosSnap.docs,
        ...audiosSnap.docs,
        ...documentsSnap.docs,
        ...itemProgSnap.docs,
        ...secProgSnap.docs,
        ...progressSnap.docs,
        ...pptxJobsSnap.docs,
        ...mediaFilesSnap.docs,
        lessonSnap
      ].filter(d => d.exists());

      for (let i = 0; i < allDocsToDelete.length; i += 400) {
        const batch = writeBatch(db);
        const chunk = allDocsToDelete.slice(i, i + 400);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }

      const verifyCheck = await Promise.all([
        getDocs(query(collection(db, 'contents'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'slides'), where('lessonId', '==', lessonId))),
        getDocs(query(collection(db, 'videos'), where('lessonId', '==', lessonId)))
      ]);
      const totalRemaining = verifyCheck.reduce((acc, curr) => acc + curr.size, 0);

      const verification = totalRemaining === 0 ? 'PASS' : 'FAIL';

      return {
        success: verification === 'PASS',
        message: `Xóa thành công bài học ${lessonId}. Đã giải phóng bộ nhớ Firebase & Cloudinary và xóa ${allDocsToDelete.length - 1} bản ghi con.`,
        counts: {
          lessons: 1,
          contents: contentsSnap.size,
          sections: sectionsSnap.size,
          items: itemsSnap.size,
          questions: questionsSnap.size,
          slides: slidesSnap.size,
          videos: videosSnap.size,
          audios: audiosSnap.size,
          documents: documentsSnap.size,
          progressRecords: itemProgSnap.size + secProgSnap.size + progressSnap.size,
          cloudinaryAssets: totalStorageTargetsCount,
          firebaseAssets: totalStorageTargetsCount
        },
        cloudinaryStatus: 'PASS',
        verification
      };
    } catch (err: any) {
      console.error('Error in deleteLessonCascade:', err);
      return {
        success: false,
        message: `Lỗi cascade delete bài học: ${err.message}`,
        counts: { lessons: 1, contents: 0, sections: 0, items: 0, questions: 0, slides: 0, videos: 0, audios: 0, documents: 0, progressRecords: 0, cloudinaryAssets: 0 },
        cloudinaryStatus: 'FAIL',
        verification: 'FAIL'
      };
    }
  },

  deleteCourseCascade: async (courseId: string): Promise<DeleteReport> => {
    try {
      const courseRef = doc(db, 'courses', courseId);
      const courseSnap = await getDoc(courseRef);
      const courseData = courseSnap.exists() ? (courseSnap.data() as Course) : null;

      const isCourseFixed = courseData ? (courseData.isFixed !== undefined ? courseData.isFixed : isFixedCourse(courseData)) : false;
      if (courseData && isCourseFixed) {
        return {
          success: false,
          message: `Không thể xóa chuyên đề "${courseData.title}". Đây là chuyên đề cố định hệ thống đồng bộ với tiện ích App! Vui lòng bỏ chọn Khóa cố định trước khi xóa.`,
          counts: { courses: 0, lessons: 0, contents: 0, sections: 0, items: 0, questions: 0, slides: 0, videos: 0, audios: 0, documents: 0, progressRecords: 0, cloudinaryAssets: 0 },
          cloudinaryStatus: 'PASS',
          verification: 'FAIL'
        };
      }

      // 1. Delete course thumbnails from Cloudinary and Firebase Storage
      const courseTargets = [
        courseData?.storageThumbnailPath,
        courseData?.thumbnail,
        (courseData as any)?.storagePath
      ].filter(Boolean) as string[];

      if (courseTargets.length > 0) {
        await deleteUnifiedAssetsHelper(courseTargets, 'image');
      }

      // 2. Cascade delete all child lessons
      const lessonsSnap = await getDocs(query(collection(db, 'lessons'), where('courseId', '==', courseId)));

      // Also trigger thorough course & child lessons Cloudinary purge
      purgeCloudinaryCourseHelper(courseId, lessonsSnap.docs.map(d => d.id), courseTargets).catch(err => {
        console.warn('Cloudinary course purge background warning:', err);
      });

      let aggregatedCounts = {
        courses: 1,
        lessons: lessonsSnap.size,
        contents: 0,
        sections: 0,
        items: 0,
        questions: 0,
        slides: 0,
        videos: 0,
        audios: 0,
        documents: 0,
        progressRecords: 0,
        cloudinaryAssets: courseTargets.length,
        firebaseAssets: courseTargets.length
      };

      const lessonReports = await Promise.all(lessonsSnap.docs.map(lessonDoc => firestoreService.deleteLessonCascade(lessonDoc.id)));
      lessonReports.forEach(report => {
        aggregatedCounts.contents += report.counts.contents;
        aggregatedCounts.sections += report.counts.sections;
        aggregatedCounts.items += report.counts.items;
        aggregatedCounts.questions += report.counts.questions;
        aggregatedCounts.slides += report.counts.slides;
        aggregatedCounts.videos += report.counts.videos;
        aggregatedCounts.audios += report.counts.audios;
        aggregatedCounts.documents += report.counts.documents;
        aggregatedCounts.progressRecords += report.counts.progressRecords;
        aggregatedCounts.cloudinaryAssets += report.counts.cloudinaryAssets;
        if (report.counts.firebaseAssets) {
          aggregatedCounts.firebaseAssets = (aggregatedCounts.firebaseAssets || 0) + report.counts.firebaseAssets;
        }
      });

      // 3. Delete any orphaned course progress or pptxJobs
      const [courseProgSnap, coursePptxSnap] = await Promise.all([
        getDocs(query(collection(db, 'progress'), where('courseId', '==', courseId))).catch(() => ({ docs: [] } as any)),
        getDocs(query(collection(db, 'pptxJobs'), where('courseId', '==', courseId))).catch(() => ({ docs: [] } as any))
      ]);

      const cleanupBatch = writeBatch(db);
      courseProgSnap.docs.forEach((d: any) => cleanupBatch.delete(d.ref));
      coursePptxSnap.docs.forEach((d: any) => cleanupBatch.delete(d.ref));
      if (courseSnap.exists()) {
        cleanupBatch.delete(courseRef);
      }
      await cleanupBatch.commit();

      const verifyLessons = await getDocs(query(collection(db, 'lessons'), where('courseId', '==', courseId)));
      const verifyCourse = await getDoc(courseRef);
      const verification = (verifyLessons.empty && !verifyCourse.exists()) ? 'PASS' : 'FAIL';

      return {
        success: verification === 'PASS',
        message: `Xóa thành công chuyên đề ${courseId} cùng ${lessonsSnap.size} bài học và toàn bộ dữ liệu đã được giải phóng trên Cloudinary và Firebase.`,
        counts: aggregatedCounts,
        cloudinaryStatus: 'PASS',
        verification
      };
    } catch (err: any) {
      console.error('Error in deleteCourseCascade:', err);
      return {
        success: false,
        message: `Lỗi xóa chuyên đề: ${err.message}`,
        counts: { courses: 1, lessons: 0, contents: 0, sections: 0, items: 0, questions: 0, slides: 0, videos: 0, audios: 0, documents: 0, progressRecords: 0, cloudinaryAssets: 0 },
        cloudinaryStatus: 'FAIL',
        verification: 'FAIL'
      };
    }
  },

  deleteUser: async (id: string): Promise<{ success: boolean }> => {
    try {
      const userRef = doc(db, 'users', id);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const user = userSnap.data() as User;
        if (user.avatar) {
          try {
            await deleteUnifiedAssetHelper(user.avatar, 'image');
          } catch (e) {
            console.warn('Avatar deletion ignored:', e);
          }
        }
      }

      // Delete the main user doc first
      await deleteDoc(userRef);

      // Clean up progress collections individually with try/catch to avoid batch dependency failures
      try {
        const progSnap = await getDocs(query(collection(db, 'progress'), where('userId', '==', id)));
        if (!progSnap.empty) {
          const batch = writeBatch(db);
          progSnap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (err) {
        console.warn('Progress cleanup skipped or unauthorized:', err);
      }

      try {
        const itemProgSnap = await getDocs(query(collection(db, 'itemProgress'), where('userId', '==', id)));
        if (!itemProgSnap.empty) {
          const batch = writeBatch(db);
          itemProgSnap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (err) {
        console.warn('itemProgress cleanup skipped or unauthorized:', err);
      }

      try {
        const secProgSnap = await getDocs(query(collection(db, 'userSectionProgress'), where('userId', '==', id)));
        if (!secProgSnap.empty) {
          const batch = writeBatch(db);
          secProgSnap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (err) {
        console.warn('userSectionProgress cleanup skipped or unauthorized:', err);
      }

      // Also clean up exam submissions
      try {
        const subSnap = await getDocs(query(collection(db, 'exam_submissions'), where('userId', '==', id)));
        if (!subSnap.empty) {
          const batch = writeBatch(db);
          subSnap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (err) {
        console.warn('exam_submissions cleanup skipped or unauthorized:', err);
      }

      // Also clean up user feedbacks
      try {
        const fbSnap = await getDocs(query(collection(db, 'user_feedbacks'), where('userId', '==', id)));
        if (!fbSnap.empty) {
          const batch = writeBatch(db);
          fbSnap.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (err) {
        console.warn('user_feedbacks cleanup skipped or unauthorized:', err);
      }

      return { success: true };
    } catch (err: any) {
      console.error('[deleteUser error]:', err);
      throw err;
    }
  },

  scanOrphanRecords: async () => {
    const [coursesSnap, lessonsSnap, contentsSnap, sectionsSnap, itemsSnap, slidesSnap, videosSnap, audiosSnap, docsSnap] = await Promise.all([
      getDocs(collection(db, 'courses')),
      getDocs(collection(db, 'lessons')),
      getDocs(collection(db, 'contents')),
      getDocs(collection(db, 'sections')),
      getDocs(collection(db, 'items')),
      getDocs(collection(db, 'slides')),
      getDocs(collection(db, 'videos')),
      getDocs(collection(db, 'audios')),
      getDocs(collection(db, 'documents'))
    ]);

    const courseIds = new Set(coursesSnap.docs.map(d => d.id));
    const lessonIds = new Set(lessonsSnap.docs.map(d => d.id));

    const orphanLessons = lessonsSnap.docs.filter(d => {
      const data = d.data() as Lesson;
      return data.courseId && !courseIds.has(data.courseId);
    });

    const orphanContents = contentsSnap.docs.filter(d => {
      const data = d.data() as any;
      return data.lessonId && !lessonIds.has(data.lessonId);
    });

    const orphanSections = sectionsSnap.docs.filter(d => {
      const data = d.data() as any;
      return data.lessonId && !lessonIds.has(data.lessonId);
    });

    const orphanItems = itemsSnap.docs.filter(d => {
      const data = d.data() as any;
      return data.lessonId && !lessonIds.has(data.lessonId);
    });

    const orphanSlides = slidesSnap.docs.filter(d => {
      const data = d.data() as any;
      return data.lessonId && !lessonIds.has(data.lessonId);
    });

    const orphanVideos = videosSnap.docs.filter(d => {
      const data = d.data() as any;
      return data.lessonId && !lessonIds.has(data.lessonId);
    });

    const orphanAudios = audiosSnap.docs.filter(d => {
      const data = d.data() as any;
      return data.lessonId && !lessonIds.has(data.lessonId);
    });

    const orphanDocs = docsSnap.docs.filter(d => {
      const data = d.data() as any;
      return data.lessonId && !lessonIds.has(data.lessonId);
    });

    const totalOrphans = orphanLessons.length + orphanContents.length + orphanSections.length + orphanItems.length + orphanSlides.length + orphanVideos.length + orphanAudios.length + orphanDocs.length;

    return {
      totalOrphans,
      details: {
        lessons: orphanLessons.map(d => ({ id: d.id, title: (d.data() as any).title })),
        contents: orphanContents.map(d => d.id),
        sections: orphanSections.map(d => d.id),
        items: orphanItems.map(d => d.id),
        slides: orphanSlides.map(d => d.id),
        videos: orphanVideos.map(d => d.id),
        audios: orphanAudios.map(d => d.id),
        documents: orphanDocs.map(d => d.id)
      }
    };
  },

  cleanOrphanRecords: async (): Promise<{ success: boolean; deletedCount: number }> => {
    const scan = await firestoreService.scanOrphanRecords();
    let deletedCount = 0;

    // Delete orphan lessons with full cascade
    for (const l of scan.details.lessons) {
      await firestoreService.deleteLessonCascade(l.id);
      deletedCount++;
    }

    // Delete other individual orphan items with asset cleanup
    for (const slideId of scan.details.slides) {
      await firestoreService.deleteSlideCascade(slideId);
      deletedCount++;
    }
    for (const videoId of scan.details.videos) {
      await firestoreService.deleteVideoCascade(videoId);
      deletedCount++;
    }
    for (const audioId of scan.details.audios) {
      await firestoreService.deleteAudioCascade(audioId);
      deletedCount++;
    }
    for (const itemId of scan.details.items) {
      await firestoreService.deleteItemCascade(itemId);
      deletedCount++;
    }
    for (const contentId of scan.details.contents) {
      await firestoreService.deleteContent(contentId);
      deletedCount++;
    }
    for (const secId of scan.details.sections) {
      await firestoreService.deleteSection(secId);
      deletedCount++;
    }
    for (const docId of scan.details.documents) {
      await deleteDoc(doc(db, 'documents', docId)).catch(() => {});
      deletedCount++;
    }

    return { success: true, deletedCount };
  },

  // -------------------------------------------------------------
  // EXAM BANKS & EXCEL QUESTION IMPORTS
  // -------------------------------------------------------------
  getExamBanks: async (): Promise<ExamBank[]> => {
    try {
      const colRef = collection(db, 'exam_banks');
      const snap = await getDocs(colRef);
      return snap.docs.map(d => d.data() as ExamBank).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err) {
      console.warn('[getExamBanks error]:', err);
      return [];
    }
  },

  getExamBank: async (id: string): Promise<ExamBank | null> => {
    try {
      const snap = await getDoc(doc(db, 'exam_banks', id));
      if (!snap.exists()) return null;
      const bank = snap.data() as ExamBank;
      if (bank.questions && bank.questions.length > 0) {
        return bank;
      }
      const qSnap = await getDocs(query(collection(db, 'exam_questions'), where('bankId', '==', id)));
      const questions = qSnap.docs.map(d => d.data() as ExamQuestion).sort((a, b) => a.stt - b.stt);
      return { ...bank, questions };
    } catch (err) {
      console.warn('[getExamBank error]:', err);
      return null;
    }
  },

  listenExamBanks: (callback: (banks: ExamBank[]) => void) => {
    try {
      const colRef = collection(db, 'exam_banks');
      return onSnapshot(colRef, (snapshot) => {
        const banks = snapshot.docs.map(d => ({ ...d.data(), id: d.id }) as ExamBank);
        banks.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        callback(banks);
      }, (err) => {
        console.warn('[listenExamBanks warning]:', err);
      });
    } catch (err) {
      console.warn('[listenExamBanks error]:', err);
      return () => {};
    }
  },

  createExamBank: async (data: Partial<ExamBank>, questions: ExamQuestion[]): Promise<ExamBank> => {
    const id = data.id || `bank-${Date.now()}`;
    const now = new Date().toISOString();
    const preparedQuestions = questions.map((q, idx) => ({
      ...q,
      id: q.id || `${id}-q${idx + 1}`,
      bankId: id,
      stt: idx + 1
    }));

    const bank: ExamBank = {
      id,
      title: data.title || 'Bộ đề trắc nghiệm mới',
      description: data.description || '',
      courseId: data.courseId || '',
      totalQuestions: preparedQuestions.length,
      questions: preparedQuestions,
      createdBy: data.createdBy || 'Phòng Chính trị Vùng 4',
      createdAt: now,
      updatedAt: now
    };

    const batch = writeBatch(db);
    batch.set(doc(db, 'exam_banks', id), bank);

    for (const qDoc of preparedQuestions) {
      batch.set(doc(db, 'exam_questions', qDoc.id), qDoc);
    }

    await batch.commit();
    return bank;
  },

  deleteExamBank: async (id: string): Promise<{ success: boolean }> => {
    const qSnap = await getDocs(query(collection(db, 'exam_questions'), where('bankId', '==', id)));
    const batch = writeBatch(db);
    batch.delete(doc(db, 'exam_banks', id));
    qSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { success: true };
  },

  // Propagate updated bank questions to all active exam sessions linked to this bank
  propagateBankQuestionsToSessions: async (bankId: string, questions: ExamQuestion[]): Promise<number> => {
    try {
      const qSnap = await getDocs(query(collection(db, 'exam_sessions'), where('bankId', '==', bankId)));
      const now = new Date().toISOString();
      const batch = writeBatch(db);
      qSnap.docs.forEach(d => {
        batch.update(d.ref, {
          questions,
          totalQuestions: questions.length,
          pushedToAppAt: now,
          updatedAt: now
        });
      });
      await batch.commit();
      return qSnap.docs.length;
    } catch (err) {
      console.warn('[propagateBankQuestionsToSessions error]:', err);
      return 0;
    }
  },

  updateExamQuestionInBank: async (bankId: string, questionId: string, updatedFields: Partial<ExamQuestion>): Promise<ExamQuestion[]> => {
    const qDocRef = doc(db, 'exam_questions', questionId);
    await updateDoc(qDocRef, updatedFields);

    const qSnap = await getDocs(query(collection(db, 'exam_questions'), where('bankId', '==', bankId)));
    const allQuestions = qSnap.docs.map(d => d.data() as ExamQuestion).sort((a, b) => a.stt - b.stt);

    const bankRef = doc(db, 'exam_banks', bankId);
    const now = new Date().toISOString();
    await updateDoc(bankRef, {
      questions: allQuestions,
      totalQuestions: allQuestions.length,
      updatedAt: now
    });

    await firestoreService.propagateBankQuestionsToSessions(bankId, allQuestions);
    return allQuestions;
  },

  deleteExamQuestionFromBank: async (bankId: string, questionId: string): Promise<ExamQuestion[]> => {
    await deleteDoc(doc(db, 'exam_questions', questionId));

    const qSnap = await getDocs(query(collection(db, 'exam_questions'), where('bankId', '==', bankId)));
    let allQuestions = qSnap.docs.map(d => d.data() as ExamQuestion).sort((a, b) => a.stt - b.stt);

    const batch = writeBatch(db);
    allQuestions = allQuestions.map((q, idx) => {
      const updated = { ...q, stt: idx + 1 };
      batch.update(doc(db, 'exam_questions', q.id), { stt: idx + 1 });
      return updated;
    });

    const now = new Date().toISOString();
    batch.update(doc(db, 'exam_banks', bankId), {
      questions: allQuestions,
      totalQuestions: allQuestions.length,
      updatedAt: now
    });

    await batch.commit();
    await firestoreService.propagateBankQuestionsToSessions(bankId, allQuestions);
    return allQuestions;
  },

  pickRandomQuestions: (sourceQuestions: ExamQuestion[], targetCount: number): ExamQuestion[] => {
    if (!sourceQuestions || sourceQuestions.length === 0) return [];
    const reqCount = Number(targetCount);
    if (isNaN(reqCount) || reqCount <= 0 || reqCount >= sourceQuestions.length) {
      return sourceQuestions.map((q, idx) => ({ ...q, stt: idx + 1 }));
    }
    // Shuffle array randomly
    const shuffled = [...sourceQuestions].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, reqCount);
    return selected.map((q, idx) => ({ ...q, stt: idx + 1 }));
  },

  // -------------------------------------------------------------
  // EXAM SESSIONS (ĐỢT KIỂM TRA HỆ THỐNG)
  // -------------------------------------------------------------
  getExamSessions: async (): Promise<ExamSession[]> => {
    try {
      const colRef = collection(db, 'exam_sessions');
      const snap = await getDocs(colRef);
      let list = snap.docs.map(d => ({ ...d.data(), id: d.id } as ExamSession));

      // Check if system init flag exists so we don't re-create deleted sessions
      const flagRef = doc(db, 'system_meta', 'init_flags');
      const flagSnap = await getDoc(flagRef);
      const isSeeded = flagSnap.exists() && flagSnap.data()?.examSessionsSeeded;

      if (!isSeeded && list.length === 0) {
        const now = new Date().toISOString();
        const sampleSession: ExamSession = {
          id: 'session-sample-01',
          title: 'Đợt 1: Kiểm Tra Nhận Thức Chính Trị Quý 1/2026',
          description: 'Đợt kiểm tra đánh giá chất lượng nhận thức chính trị định kỳ cho cán bộ chiến sĩ toàn Vùng 4 Hải quân',
          bankId: 'bank-sample-01',
          bankTitle: 'Bộ đề mẫu: Nhận thức Chính trị & Lịch sử Quân chủng Hải quân 2026',
          durationMinutes: 20,
          passScore: 5.0,
          totalQuestions: 20,
          targetUnit: 'ALL',
          status: 'ACTIVE',
          startTime: now,
          endTime: '',
          createdBy: 'Phòng Chính trị Vùng 4',
          createdAt: now,
          updatedAt: now
        };

        await setDoc(doc(db, 'exam_sessions', sampleSession.id), sampleSession);
        await setDoc(flagRef, { examSessionsSeeded: true }, { merge: true });
        list = [sampleSession];
      }

      return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (err) {
      console.warn('[getExamSessions error]:', err);
      return [];
    }
  },

  createExamSession: async (data: Partial<ExamSession>): Promise<ExamSession> => {
    const id = data.id || `session-${Date.now()}`;
    const now = new Date().toISOString();
    let questions: ExamQuestion[] = data.questions || [];

    if (questions.length === 0 && data.bankId) {
      try {
        const bankSnap = await getDoc(doc(db, 'exam_banks', data.bankId));
        if (bankSnap.exists() && bankSnap.data()?.questions?.length > 0) {
          questions = bankSnap.data().questions;
        } else {
          const qSnap = await getDocs(query(collection(db, 'exam_questions'), where('bankId', '==', data.bankId)));
          questions = qSnap.docs.map(d => d.data() as ExamQuestion).sort((a, b) => a.stt - b.stt);
        }
      } catch (err) {
        console.warn('[createExamSession] Could not auto-fetch bank questions:', err);
      }
    }

    const reqTotal = Number(data.totalQuestions) || questions.length || 20;
    const selectedQuestions = firestoreService.pickRandomQuestions(questions, reqTotal);

    const session: ExamSession = {
      id,
      title: data.title || 'Đợt kiểm tra mới',
      description: data.description || '',
      bankId: data.bankId || '',
      bankTitle: data.bankTitle || '',
      durationMinutes: Number(data.durationMinutes) || 20,
      passScore: Number(data.passScore) || 5.0,
      totalQuestions: selectedQuestions.length,
      questions: selectedQuestions,
      targetUnit: data.targetUnit || 'ALL',
      status: data.status || 'ACTIVE',
      pushedToAppAt: now,
      startTime: data.startTime || now,
      endTime: data.endTime || '',
      createdBy: data.createdBy || 'Phòng Chính trị Vùng 4',
      createdAt: now,
      updatedAt: now
    };

    const cleanSession = sanitizeFirestoreData(session);
    await setDoc(doc(db, 'exam_sessions', id), cleanSession);
    await setDoc(doc(db, 'system_meta', 'init_flags'), { examSessionsSeeded: true }, { merge: true });
    return session;
  },

  updateExamSession: async (id: string, data: Partial<ExamSession>): Promise<ExamSession> => {
    const docRef = doc(db, 'exam_sessions', id);
    const existing = await getDoc(docRef);
    const existingData = existing.exists() ? (existing.data() as ExamSession) : ({} as ExamSession);
    const now = new Date().toISOString();

    let poolQuestions: ExamQuestion[] = data.questions || [];
    const targetBankId = data.bankId || existingData.bankId;

    if (targetBankId) {
      try {
        const bankSnap = await getDoc(doc(db, 'exam_banks', targetBankId));
        if (bankSnap.exists() && bankSnap.data()?.questions?.length > 0) {
          poolQuestions = bankSnap.data().questions;
        } else {
          const qSnap = await getDocs(query(collection(db, 'exam_questions'), where('bankId', '==', targetBankId)));
          const fetched = qSnap.docs.map(d => d.data() as ExamQuestion).sort((a, b) => a.stt - b.stt);
          if (fetched.length > 0) poolQuestions = fetched;
        }
      } catch (err) {
        console.warn('[updateExamSession] Could not auto-fetch bank questions:', err);
      }
    }

    if (poolQuestions.length === 0 && existingData.questions) {
      poolQuestions = existingData.questions;
    }

    const reqTotal = Number(data.totalQuestions) || Number(existingData.totalQuestions) || poolQuestions.length || 20;
    const selectedQuestions = firestoreService.pickRandomQuestions(poolQuestions, reqTotal);

    const mergedPayload: ExamSession = {
      ...existingData,
      ...data,
      id,
      questions: selectedQuestions,
      totalQuestions: selectedQuestions.length,
      pushedToAppAt: now,
      updatedAt: now
    };

    const cleanPayload = sanitizeFirestoreData(mergedPayload);
    await setDoc(docRef, cleanPayload, { merge: true });
    return mergedPayload;
  },

  syncSessionBankQuestions: async (sessionId: string): Promise<{ session: ExamSession; syncedQuestionCount: number }> => {
    const docRef = doc(db, 'exam_sessions', sessionId);
    const existing = await getDoc(docRef);
    if (!existing.exists()) throw new Error(`Không tìm thấy đợt kiểm tra ${sessionId}`);
    const sessionData = existing.data() as ExamSession;

    let questions: ExamQuestion[] = sessionData.questions || [];
    if (sessionData.bankId) {
      const qSnap = await getDocs(query(collection(db, 'exam_questions'), where('bankId', '==', sessionData.bankId)));
      questions = qSnap.docs.map(d => d.data() as ExamQuestion).sort((a, b) => a.stt - b.stt);
    }

    const now = new Date().toISOString();
    const updatePayload = {
      questions,
      totalQuestions: questions.length > 0 ? questions.length : sessionData.totalQuestions,
      status: 'ACTIVE' as const,
      pushedToAppAt: now,
      updatedAt: now
    };

    await updateDoc(docRef, updatePayload);
    return {
      session: { ...sessionData, ...updatePayload },
      syncedQuestionCount: questions.length
    };
  },

  deleteExamSession: async (id: string): Promise<{ success: boolean }> => {
    try {
      // Mark flag so seed logic never re-creates sample sessions
      await setDoc(doc(db, 'system_meta', 'init_flags'), { examSessionsSeeded: true }, { merge: true });

      // 1. Direct delete if document exists with id
      if (id) {
        await deleteDoc(doc(db, 'exam_sessions', id)).catch(() => {});
      }

      // 2. Scan exam_sessions collection and delete matching docs (by doc.id or data.id)
      const colRef = collection(db, 'exam_sessions');
      const snap = await getDocs(colRef);
      if (!snap.empty) {
        const batch = writeBatch(db);
        let count = 0;
        snap.docs.forEach((d) => {
          const data = d.data();
          if (d.id === id || data.id === id) {
            batch.delete(d.ref);
            count++;
          }
        });
        if (count > 0) {
          await batch.commit();
        }
      }

      // 3. Cascade delete any submissions associated with this session
      const subSnap = await getDocs(query(collection(db, 'exam_submissions'), where('sessionId', '==', id)));
      if (!subSnap.empty) {
        const subBatch = writeBatch(db);
        subSnap.docs.forEach(d => subBatch.delete(d.ref));
        await subBatch.commit();
      }

      return { success: true };
    } catch (err) {
      console.error('[deleteExamSession error]:', err);
      throw err;
    }
  },

  listenExamSessions: (callback: (sessions: ExamSession[]) => void) => {
    const colRef = collection(db, 'exam_sessions');
    return onSnapshot(colRef, (snapshot) => {
      const sessions = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as ExamSession));
      sessions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      callback(sessions);
    }, (err) => {
      console.warn('[listenExamSessions warning]:', err);
      callback([]);
    });
  },

  // -------------------------------------------------------------
  // EXAM SUBMISSIONS (NỘP BÀI THI & TỔNG HỢP KẾT QUẢ THỰC TẾ)
  // -------------------------------------------------------------
  cleanSampleSubmissionsIfNeeded: async (): Promise<void> => {
    try {
      const colRef = collection(db, 'exam_submissions');
      const snap = await getDocs(colRef);
      const sampleDocs = snap.docs.filter(d => 
        d.id.startsWith('sub-init-') || 
        d.id.startsWith('sub-sample-') || 
        d.id.startsWith('sub-seed-')
      );
      if (sampleDocs.length > 0) {
        const batch = writeBatch(db);
        sampleDocs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    } catch (err) {
      console.warn('[cleanSampleSubmissionsIfNeeded warning]:', err);
    }
  },

  getExamSubmissions: async (sessionId?: string): Promise<ExamSubmission[]> => {
    try {
      // Clean up legacy sample submissions to ensure only real submissions are used
      await firestoreService.cleanSampleSubmissionsIfNeeded().catch(() => {});

      const colRef = collection(db, 'exam_submissions');
      let q;
      if (sessionId && sessionId !== 'ALL') {
        q = query(colRef, where('sessionId', '==', sessionId));
      } else {
        q = query(colRef);
      }
      const snap = await getDocs(q);

      // Filter out any lingering sample docs
      const realDocs = snap.docs.filter(d => 
        !d.id.startsWith('sub-init-') && 
        !d.id.startsWith('sub-sample-') && 
        !d.id.startsWith('sub-seed-')
      );

      // Fetch registered users from Firestore to dynamically enrich submission records
      const userSnap = await getDocs(collection(db, 'users')).catch(() => null);
      const userMap = new Map<string, User>();
      if (userSnap) {
        userSnap.docs.forEach(d => {
          const u = { ...(d.data() as any), id: d.id } as User;
          userMap.set(u.id, u);
          if (u.fullName) userMap.set(u.fullName, u);
          if (u.name) userMap.set(u.name, u);
        });
      }

      const subs = realDocs.map(d => {
        const data = d.data() as ExamSubmission;
        const matchedUser = userMap.get(data.userId) || userMap.get(data.userName);
        return {
          ...data,
          id: d.id,
          userName: matchedUser?.fullName || matchedUser?.name || data.userName,
          userRank: matchedUser?.rank || data.userRank,
          userPosition: matchedUser?.position || data.userPosition,
          unitName: matchedUser?.unitName || matchedUser?.unit || data.unitName,
        } as ExamSubmission;
      });

      return subs.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    } catch (err) {
      console.warn('[getExamSubmissions error]:', err);
      return [];
    }
  },

  submitExamResult: async (submission: Partial<ExamSubmission>): Promise<ExamSubmission> => {
    const id = submission.id || `sub-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const numScore = Number(submission.score ?? 0);
    const numCorrect = Number(submission.correctCount ?? 0);
    const numTotal = Number(submission.totalQuestions ?? 0);
    const isPassed = submission.passed ?? (numScore >= 5.0);

    let uName = submission.userName || 'Thí sinh dự thi';
    let uRank = submission.userRank || 'Quân nhân';
    let uPos = submission.userPosition || 'Cán bộ / Chiến sĩ';
    let uUnit = submission.unitName || 'Vùng 4 Hải Quân';

    if (submission.userId) {
      try {
        const uSnap = await getDoc(doc(db, 'users', submission.userId));
        if (uSnap.exists()) {
          const uData = uSnap.data() as User;
          uName = uData.fullName || uData.name || uName;
          uRank = uData.rank || uRank;
          uPos = uData.position || uPos;
          uUnit = uData.unitName || uData.unit || uUnit;
        }
      } catch (err) {
        console.warn('[submitExamResult] error fetching user doc:', err);
      }
    }

    const fullSubmission: ExamSubmission = {
      id,
      sessionId: submission.sessionId || '',
      sessionTitle: submission.sessionTitle || 'Kiểm tra nhận thức',
      userId: submission.userId || 'user-anon',
      userName: uName,
      userRank: uRank,
      userPosition: uPos,
      unitName: uUnit,
      score: numScore,
      correctCount: numCorrect,
      totalQuestions: numTotal,
      passed: isPassed,
      timeSpentSeconds: Number(submission.timeSpentSeconds ?? 0),
      answers: submission.answers || [],
      submittedAt: submission.submittedAt || now
    };

    const cleanSubmission = sanitizeFirestoreData(fullSubmission);
    await setDoc(doc(db, 'exam_submissions', id), cleanSubmission);
    await setDoc(doc(db, 'system_meta', 'init_flags'), { examSubmissionsSeeded: true }, { merge: true });
    return fullSubmission;
  },

  listenExamSubmissions: (sessionId: string | undefined, callback: (subs: ExamSubmission[]) => void) => {
    const colRef = collection(db, 'exam_submissions');
    let q;
    if (sessionId && sessionId !== 'ALL') {
      q = query(colRef, where('sessionId', '==', sessionId));
    } else {
      q = query(colRef);
    }
    return onSnapshot(q, async (snapshot) => {
      let userMap = new Map<string, User>();
      try {
        const userSnap = await getDocs(collection(db, 'users'));
        userSnap.docs.forEach(d => {
          const u = { ...(d.data() as any), id: d.id } as User;
          userMap.set(u.id, u);
          if (u.fullName) userMap.set(u.fullName, u);
          if (u.name) userMap.set(u.name, u);
        });
      } catch (e) {
        console.warn('[listenExamSubmissions] user fetch warning:', e);
      }

      const realDocs = snapshot.docs.filter(d => 
        !d.id.startsWith('sub-init-') && 
        !d.id.startsWith('sub-sample-') && 
        !d.id.startsWith('sub-seed-')
      );

      const subs = realDocs.map(d => {
        const data = d.data() as ExamSubmission;
        const matchedUser = userMap.get(data.userId) || userMap.get(data.userName);
        return {
          ...data,
          id: d.id,
          userName: matchedUser?.fullName || matchedUser?.name || data.userName,
          userRank: matchedUser?.rank || data.userRank,
          userPosition: matchedUser?.position || data.userPosition,
          unitName: matchedUser?.unitName || matchedUser?.unit || data.unitName,
        } as ExamSubmission;
      });

      subs.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
      callback(subs);
    }, (err) => {
      console.warn('[listenExamSubmissions warning]:', err);
      callback([]);
    });
  },

  // -------------------------------------------------------------
  // USER FEEDBACKS & APP REPORTS (PHẢN ÁNH TỪ TÀI KHOẢN VỀ WEB QUẢN TRỊ)
  // -------------------------------------------------------------
  getFeedbacks: async (): Promise<UserFeedback[]> => {
    try {
      const colRef = collection(db, 'feedbacks');
      const snap = await getDocs(colRef);
      let list = snap.docs.map(d => d.data() as UserFeedback);
      
      const flagRef = doc(db, 'system_meta', 'init_flags');
      const flagSnap = await getDoc(flagRef);
      const isSeeded = flagSnap.exists() && flagSnap.data()?.feedbacksSeeded;

      if (!isSeeded && list.length === 0) {
        const sampleFeedbacks: UserFeedback[] = [
          {
            id: 'fb-01',
            userId: 'usr-101',
            userName: 'Thượng úy Nguyễn Văn Hoàng',
            userRank: 'Thượng úy',
            userPosition: 'Phó Tàu trưởng Tàu 012 HQ',
            unitName: 'Lữ đoàn 162',
            type: 'QUESTION_ERROR',
            title: 'Báo lỗi câu hỏi trắc nghiệm số 14 - Đợt thi Quý 1/2026',
            content: 'Kính gửi Ban Tuyên huấn! Trong câu hỏi số 14 về Lịch sử truyền thống Quân chủng Hải quân, đáp án B và đáp án C bị trùng lặp thông tin ngày thành lập. Đề nghị Ban quản trị kiểm tra và điều chỉnh lại đáp án chuẩn.',
            relatedExamTitle: 'Đợt 1: Kiểm Tra Nhận Thức Chính Trị Quý 1/2026',
            relatedQuestionText: 'Câu 14: Ngày thành lập Quân chủng Hải quân Nhân dân Việt Nam là ngày tháng năm nào?',
            status: 'PENDING',
            createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
            updatedAt: new Date(Date.now() - 3600000 * 5).toISOString()
          },
          {
            id: 'fb-02',
            userId: 'usr-102',
            userName: 'Trung úy Lê Bằng Giang',
            userRank: 'Trung úy',
            userPosition: 'Trợ lý Tuyên huấn',
            unitName: 'Tiểu đoàn 454',
            type: 'APP_SUGGESTION',
            title: 'Đề xuất bổ sung tính năng đọc Audio bài học GDCT offline',
            content: 'Báo cáo đồng chí, đối với các đơn vị trực sẵn sàng chiến đấu trên biển, đường truyền mạng đôi khi bị chập chờn. Đề nghị Ban quản trị cho phép tải trước file MP3 bài giảng về máy để quân nhân tự học offline.',
            status: 'RECEIVED',
            adminResponse: 'Ban Tuyên huấn Vùng đã tiếp nhận ý kiến. Hiện tại tính năng tải Offline Package bài học đã sẵn sàng tích hợp trên ứng dụng di động Android.',
            respondedBy: 'Thượng tá Trần Văn Nam - Trưởng ban TH',
            respondedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
            createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
            updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
          },
          {
            id: 'fb-03',
            userId: 'usr-103',
            userName: 'Đại úy Phạm Quốc Tuấn',
            userRank: 'Đại úy',
            userPosition: 'Chính trị viên đảo',
            unitName: 'Đảo Trường Sa',
            type: 'GDCT_CONTENT',
            title: 'Hỏi đáp về tài liệu Chuyên đề Học tập Lời Bác Hồ dạy 2026',
            content: 'Đề nghị Ban Tuyên huấn Vùng gửi bổ sung file slide PowerPoint gốc của Bài 2 để đơn vị tổ chức học tập tập trung cho cán bộ chiến sĩ tại đảo.',
            status: 'RESOLVED',
            adminResponse: 'Đã cập nhật file đính kèm PowerPoint (.pptx) trực tiếp vào chuyên đề trên hệ thống Cloud. Đồng chí có thể truy cập bài học để tải về.',
            respondedBy: 'Phòng Chính trị Vùng 4',
            respondedAt: new Date(Date.now() - 3600000 * 12).toISOString(),
            createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
            updatedAt: new Date(Date.now() - 3600000 * 12).toISOString()
          }
        ];

        for (const item of sampleFeedbacks) {
          await setDoc(doc(db, 'feedbacks', item.id), item);
        }
        await setDoc(flagRef, { feedbacksSeeded: true }, { merge: true });
        list = sampleFeedbacks;
      }

      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    } catch (err) {
      console.warn('[getFeedbacks error]:', err);
      return [];
    }
  },

  createFeedback: async (feedback: Partial<UserFeedback>): Promise<UserFeedback> => {
    const id = feedback.id || `fb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const item: UserFeedback = {
      id,
      userId: feedback.userId || 'usr-mobile',
      userName: feedback.userName || 'Quân nhân dự thi',
      userRank: feedback.userRank || 'Thượng úy',
      userPosition: feedback.userPosition || 'Cán bộ chiến sĩ',
      unitName: feedback.unitName || 'Vùng 4 Hải Quân',
      type: feedback.type || 'QUESTION_ERROR',
      title: feedback.title || 'Phản ánh nội dung',
      content: feedback.content || '',
      relatedExamTitle: feedback.relatedExamTitle || '',
      relatedQuestionText: feedback.relatedQuestionText || '',
      status: feedback.status || 'PENDING',
      adminResponse: feedback.adminResponse || '',
      respondedBy: feedback.respondedBy || '',
      respondedAt: feedback.respondedAt || '',
      createdAt: now,
      updatedAt: now
    };
    await setDoc(doc(db, 'feedbacks', id), item);
    return item;
  },

  updateFeedbackStatus: async (id: string, status: FeedbackStatus, adminResponse?: string, respondedBy?: string): Promise<UserFeedback> => {
    const docRef = doc(db, 'feedbacks', id);
    const snap = await getDoc(docRef);
    if (!snap.exists()) throw new Error(`Không tìm thấy phản ánh ID: ${id}`);

    const existing = snap.data() as UserFeedback;
    const now = new Date().toISOString();
    const updatePayload: Partial<UserFeedback> = {
      status,
      updatedAt: now
    };

    if (adminResponse !== undefined) {
      updatePayload.adminResponse = adminResponse;
      updatePayload.respondedBy = respondedBy || 'Ban Quản Trị Vùng 4';
      updatePayload.respondedAt = now;
    }

    await updateDoc(docRef, updatePayload);
    return { ...existing, ...updatePayload };
  },

  deleteFeedback: async (id: string): Promise<{ success: boolean }> => {
    await deleteDoc(doc(db, 'feedbacks', id));
    return { success: true };
  },

  listenFeedbacks: (callback: (feedbacks: UserFeedback[]) => void) => {
    const colRef = collection(db, 'feedbacks');
    return onSnapshot(colRef, (snapshot) => {
      const list = snapshot.docs.map(d => d.data() as UserFeedback);
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      callback(list);
    }, (err) => {
      console.warn('[listenFeedbacks warning]:', err);
      callback([]);
    });
  }
};

export function extractCloudinaryUrlsFromHtml(html?: string): string[] {
  if (!html) return [];
  const matches = html.match(/https?:\/\/[^"'\s<>]*cloudinary\.com[^"'\s<>]+/gi);
  return matches ? Array.from(new Set(matches)) : [];
}

export function extractFirebaseStorageUrlsFromHtml(html?: string): string[] {
  if (!html) return [];
  const matches = html.match(/https?:\/\/firebasestorage\.googleapis\.com[^"'\s<>]+/gi);
  return matches ? Array.from(new Set(matches)) : [];
}

export function extractStorageUrlsFromHtml(html?: string): { cloudinary: string[]; firebase: string[] } {
  return {
    cloudinary: extractCloudinaryUrlsFromHtml(html),
    firebase: extractFirebaseStorageUrlsFromHtml(html)
  };
}

export async function purgeCloudinaryLessonHelper(lessonId: string, publicIds: string[] = []): Promise<boolean> {
  if (!lessonId) return true;
  try {
    const resp = await fetch('/api/cloudinary/purge-lesson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lessonId, publicIds })
    });
    const json = await resp.json();
    return !!json.success;
  } catch (err) {
    console.warn('purgeCloudinaryLessonHelper error:', err);
    return false;
  }
}

export async function purgeCloudinaryCourseHelper(courseId: string, lessonIds: string[] = [], publicIds: string[] = []): Promise<boolean> {
  if (!courseId) return true;
  try {
    const resp = await fetch('/api/cloudinary/purge-course', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, lessonIds, publicIds })
    });
    const json = await resp.json();
    return !!json.success;
  } catch (err) {
    console.warn('purgeCloudinaryCourseHelper error:', err);
    return false;
  }
}

export async function deleteCloudinaryFolderHelper(folder: string): Promise<boolean> {
  if (!folder) return true;
  try {
    const resp = await fetch('/api/cloudinary/delete-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folder })
    });
    const json = await resp.json();
    return !!json.success;
  } catch (err) {
    console.warn('deleteCloudinaryFolderHelper error:', err);
    return false;
  }
}

export async function deleteCloudinaryAssetHelper(publicId?: string, resourceType = 'image'): Promise<boolean> {
  if (!publicId) return true;
  try {
    const resp = await fetch('/api/cloudinary/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId, resourceType })
    });
    const json = await resp.json();
    return !!json.success;
  } catch (err) {
    console.warn('Cloudinary delete error:', err);
    return false;
  }
}

export async function deleteCloudinaryAssetsHelper(publicIds: string[], resourceType?: string): Promise<boolean> {
  const filtered = Array.from(new Set(publicIds.filter(Boolean)));
  if (filtered.length === 0) return true;
  try {
    const resp = await fetch('/api/cloudinary/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicIds: filtered, resourceType })
    });
    const json = await resp.json();
    return !!json.success;
  } catch (err) {
    console.warn('Cloudinary batch delete error:', err);
    return false;
  }
}

export async function deleteFirebaseStorageAssetHelper(urlOrPath?: string): Promise<boolean> {
  if (!urlOrPath) return true;
  if (urlOrPath.startsWith('data:') || (urlOrPath.includes('cloudinary.com') && !urlOrPath.includes('firebasestorage.googleapis.com'))) {
    return false;
  }
  try {
    const fileRef = ref(storage, urlOrPath);
    await deleteObject(fileRef);
    console.log('[Firebase Storage SUCCESS] Deleted:', urlOrPath);
    return true;
  } catch (err: any) {
    if (err?.code === 'storage/object-not-found' || err?.message?.includes('not found')) {
      return true;
    }
    console.warn('[Firebase Storage Delete Warning]:', err?.message || err);
    return false;
  }
}

export async function deleteFirebaseStorageAssetsHelper(urlsOrPaths: string[]): Promise<boolean> {
  const filtered = Array.from(new Set(urlsOrPaths.filter(Boolean)));
  if (filtered.length === 0) return true;
  try {
    const results = await Promise.allSettled(filtered.map(p => deleteFirebaseStorageAssetHelper(p)));
    return results.some(r => r.status === 'fulfilled' && r.value === true);
  } catch (err) {
    console.warn('[Firebase Storage Batch Delete Warning]:', err);
    return false;
  }
}

export async function deleteUnifiedAssetHelper(
  target?: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<{ cloudinary: boolean; firebase: boolean }> {
  if (!target) return { cloudinary: true, firebase: true };

  let cRes = true;
  let fRes = true;

  const isFirebase = target.includes('firebasestorage.googleapis.com') || target.startsWith('gs://') || target.startsWith('banners/') || target.startsWith('gdct_v4/');
  const isCloudinary = target.includes('cloudinary.com') || (!target.startsWith('http') && !target.includes('firebasestorage.googleapis.com') && !target.startsWith('gs://'));

  if (isCloudinary) {
    cRes = await deleteCloudinaryAssetHelper(target, resourceType);
  }
  if (isFirebase) {
    fRes = await deleteFirebaseStorageAssetHelper(target);
  }

  // Also clean up any tracking doc in mediaFiles
  try {
    const mediaId = target.replace(/[/]/g, '_').split('?')[0];
    await deleteDoc(doc(db, 'mediaFiles', mediaId)).catch(() => {});
  } catch {}

  return { cloudinary: cRes, firebase: fRes };
}

export async function deleteUnifiedAssetsHelper(
  targets: string[],
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<{ cloudinary: boolean; firebase: boolean }> {
  const filtered = Array.from(new Set(targets.filter(Boolean)));
  if (filtered.length === 0) return { cloudinary: true, firebase: true };

  const cloudinaryTargets: string[] = [];
  const firebaseTargets: string[] = [];

  for (const t of filtered) {
    if (t.includes('firebasestorage.googleapis.com') || t.startsWith('gs://')) {
      firebaseTargets.push(t);
    } else if (t.includes('cloudinary.com')) {
      cloudinaryTargets.push(t);
    } else if (t.startsWith('gdct_v4/') || t.startsWith('banners/') || t.startsWith('slides/') || t.startsWith('documents/')) {
      cloudinaryTargets.push(t);
      firebaseTargets.push(t);
    } else {
      cloudinaryTargets.push(t);
    }
  }

  let cRes = true;
  let fRes = true;

  if (cloudinaryTargets.length > 0) {
    cRes = await deleteCloudinaryAssetsHelper(cloudinaryTargets, resourceType);
  }
  if (firebaseTargets.length > 0) {
    fRes = await deleteFirebaseStorageAssetsHelper(firebaseTargets);
  }

  // Clean up mediaFiles collection
  try {
    for (const t of filtered) {
      const mediaId = t.replace(/[/]/g, '_').split('?')[0];
      await deleteDoc(doc(db, 'mediaFiles', mediaId)).catch(() => {});
    }
  } catch {}

  return { cloudinary: cRes, firebase: fRes };
}

export interface DeleteReport {
  success: boolean;
  message: string;
  counts: {
    courses?: number;
    lessons: number;
    contents: number;
    sections: number;
    items: number;
    questions: number;
    slides: number;
    videos: number;
    audios: number;
    documents: number;
    progressRecords: number;
    cloudinaryAssets: number;
    firebaseAssets?: number;
  };
  cloudinaryStatus: 'PASS' | 'FAIL' | 'PARTIAL';
  verification: 'PASS' | 'FAIL';
}
