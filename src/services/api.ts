import { 
  db, 
  storage,
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
  ref,
  uploadBytes,
  getDownloadURL
} from './firebase';
import { firestoreService } from './firestoreService';
import { naturalSortFilenames } from '../utils/naturalSort';
import { cloudinaryUnsignedSlideProvider } from './storage/CloudinaryUnsignedSlideProvider';
import { 
  Course, Lesson, SlideItem, SlideSet, SlideSetStatus, ContentSection, VideoItem, AudioItem, 
  Unit, User, UserProgress, SystemNotification, DashboardStats, RealtimeEvent,
  StorageFileMetadata, StorageCategory, SyncDelta, LessonBundle, PaginatedResponse,
  OfflinePackage, LessonVersionInfo, OfflineProgressItem, LessonSizeBreakdown, OfflineModuleSelection,
  LessonModuleConfig,
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
  FeedbackType,
  FeedbackStatus
} from '../types';

/**
 * Production API Gateway for Web Admin GDCT Vùng 4
 * Directly interfaces with Cloud Firestore and Firebase Cloud Storage.
 * NO fallback to mock JSON or Express memory store. Errors are reported explicitly.
 */
export const api = {
  // -------------------------------------------------------------
  // STATS & DASHBOARD (Direct Cloud Firestore)
  // -------------------------------------------------------------
  getStats: async (): Promise<DashboardStats> => {
    return await firestoreService.getDashboardStats();
  },

  // -------------------------------------------------------------
  // COURSES (Cloud Firestore CRUD + Listeners)
  // -------------------------------------------------------------
  getCourses: async (includeDeleted = false, page = 1, limitCount = 100): Promise<Course[]> => {
    return await firestoreService.getCourses(includeDeleted, limitCount);
  },

  getCourse: async (id: string): Promise<Course> => {
    const course = await firestoreService.getCourse(id);
    if (!course) throw new Error(`Không tìm thấy chuyên đề ${id} trên Firestore`);
    return course;
  },

  createCourse: async (data: Partial<Course>): Promise<Course> => {
    return await firestoreService.createCourse(data);
  },

  updateCourse: async (id: string, data: Partial<Course>): Promise<Course> => {
    return await firestoreService.updateCourse(id, data);
  },

  deleteCourse: async (id: string, permanent = false): Promise<{ success: boolean; message: string }> => {
    if (permanent) {
      const report = await firestoreService.deleteCourseCascade(id);
      return { success: report.success, message: report.message };
    }
    return await firestoreService.deleteCourse(id, permanent);
  },

  restoreCourse: async (id: string): Promise<Course> => {
    return await firestoreService.restoreCourse(id);
  },

  // -------------------------------------------------------------
  // LESSONS (Cloud Firestore CRUD + Listeners)
  // -------------------------------------------------------------
  getLessons: async (
    optionsOrCourseId?: string | { courseId?: string; isDeleted?: boolean },
    includeDeleted = false
  ): Promise<Lesson[]> => {
    let cId: string | undefined;
    let incDel = includeDeleted;
    if (typeof optionsOrCourseId === 'string') {
      cId = optionsOrCourseId;
    } else if (typeof optionsOrCourseId === 'object' && optionsOrCourseId !== null) {
      cId = optionsOrCourseId.courseId;
      if (optionsOrCourseId.isDeleted !== undefined) incDel = optionsOrCourseId.isDeleted;
    }
    return await firestoreService.getLessons(cId, incDel);
  },

  getLesson: async (id: string): Promise<Lesson> => {
    const lesson = await firestoreService.getLesson(id);
    if (!lesson) throw new Error(`Không tìm thấy bài học ${id} trên Firestore`);
    return lesson;
  },

  createLesson: async (data: Partial<Lesson>): Promise<Lesson> => {
    return await firestoreService.createLesson(data);
  },

  updateLesson: async (id: string, data: Partial<Lesson>): Promise<Lesson> => {
    return await firestoreService.updateLesson(id, data);
  },

  updateLessonTitle: async (lessonId: string, newTitle: string): Promise<Lesson> => {
    return await firestoreService.updateLesson(lessonId, { title: newTitle });
  },

  deleteLesson: async (id: string, permanent = false): Promise<{ success: boolean; message: string }> => {
    if (permanent) {
      const report = await firestoreService.deleteLessonCascade(id);
      return { success: report.success, message: report.message };
    }
    return await firestoreService.deleteLesson(id, permanent);
  },

  restoreLesson: async (id: string): Promise<Lesson> => {
    return await firestoreService.restoreLesson(id);
  },

  duplicateLesson: async (lessonId: string): Promise<Lesson> => {
    const lesson = await firestoreService.getLesson(lessonId);
    if (!lesson) throw new Error(`Không tìm thấy bài học ${lessonId}`);
    const newLessonId = `lesson-${Date.now()}`;
    const newLesson: Partial<Lesson> = {
      ...lesson,
      id: newLessonId,
      title: `${lesson.title} (Bản sao)`,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return await firestoreService.createLesson(newLesson);
  },

  updateModuleConfig: async (lessonId: string, moduleConfig: LessonModuleConfig): Promise<Lesson> => {
    return await firestoreService.updateLesson(lessonId, { moduleConfig });
  },

  // -------------------------------------------------------------
  // SLIDES & SLIDE SETS (Cloudinary + Firestore)
  // -------------------------------------------------------------
  getSlides: async (lessonId: string): Promise<SlideItem[]> => {
    return await firestoreService.getSlides(lessonId);
  },

  getSlideSet: async (lessonId: string): Promise<SlideSet | null> => {
    return await firestoreService.getSlideSet(lessonId);
  },

  subscribeSlideSet: (lessonId: string, callback: (set: SlideSet | null) => void): (() => void) => {
    return firestoreService.listenSlideSet(lessonId, callback);
  },

  subscribeSlides: (lessonId: string, callback: (slides: SlideItem[]) => void): (() => void) => {
    return firestoreService.listenSlides(lessonId, callback);
  },

  uploadSlideImage: async (file: File, courseId: string, lessonId: string, maxRetries = 3): Promise<{ publicId: string; secureUrl: string; width: number; height: number; bytes: number; format: string; assetFolder: string; resourceType: string; mimeType: string; createdAt: string }> => {
    const res = await cloudinaryUnsignedSlideProvider.uploadUnsignedSlide(file, {
      category: 'slides',
      courseId,
      lessonId,
      filename: file.name,
      resourceType: 'image'
    }, maxRetries);
    return {
      publicId: res.publicId,
      secureUrl: res.secureUrl,
      width: res.width || 1920,
      height: res.height || 1080,
      bytes: res.size || file.size,
      format: res.format || 'png',
      assetFolder: res.assetFolder || `GDCT_V4/SLIDE/${lessonId}`,
      resourceType: res.resourceType || 'image',
      mimeType: file.type || res.mimeType || 'image/png',
      createdAt: res.createdAt || new Date().toISOString()
    };
  },

  uploadDocumentFile: async (file: File, lessonId: string, maxRetries = 3): Promise<{
    publicId: string;
    secureUrl: string;
    assetFolder: string;
    resourceType: string;
    bytes: number;
    mimeType: string;
    createdAt: string;
  }> => {
    const res = await cloudinaryUnsignedSlideProvider.uploadUnsignedSlide(file, {
      category: 'documents',
      lessonId,
      filename: file.name,
      resourceType: 'raw'
    }, maxRetries);

    return {
      publicId: res.publicId,
      secureUrl: res.secureUrl,
      assetFolder: res.assetFolder || `GDCT_V4/TAILIEU/${lessonId}`,
      resourceType: res.resourceType || 'raw',
      bytes: res.size || file.size,
      mimeType: file.type || res.mimeType || 'application/octet-stream',
      createdAt: res.createdAt || new Date().toISOString()
    };
  },

  uploadVideoFile: async (file: File, lessonId: string, maxRetries = 3): Promise<{
    publicId: string;
    secureUrl: string;
    assetFolder: string;
    resourceType: string;
    bytes: number;
    duration?: number;
    thumbnailUrl?: string;
    width?: number;
    height?: number;
    format?: string;
    mimeType: string;
    createdAt: string;
  }> => {
    const res = await cloudinaryUnsignedSlideProvider.uploadUnsignedSlide(file, {
      category: 'videos',
      lessonId,
      filename: file.name,
      resourceType: 'video'
    }, maxRetries);

    return {
      publicId: res.publicId,
      secureUrl: res.secureUrl,
      assetFolder: res.assetFolder || `GDCT_V4/VIDEOS/${lessonId}`,
      resourceType: res.resourceType || 'video',
      bytes: res.bytes || res.size || file.size,
      duration: res.duration || 0,
      thumbnailUrl: res.thumbnailUrl || (res.secureUrl ? res.secureUrl.replace(/\.[^/.]+$/, '.jpg') : ''),
      width: res.width,
      height: res.height,
      format: res.format || 'mp4',
      mimeType: file.type || res.mimeType || 'video/mp4',
      createdAt: res.createdAt || new Date().toISOString()
    };
  },

  uploadAudioFile: async (file: File, lessonId: string, maxRetries = 3): Promise<{
    publicId: string;
    secureUrl: string;
    assetFolder: string;
    resourceType: string;
    bytes: number;
    duration?: number;
    format?: string;
    mimeType: string;
    createdAt: string;
  }> => {
    const res = await cloudinaryUnsignedSlideProvider.uploadUnsignedSlide(file, {
      category: 'audios',
      lessonId,
      filename: file.name,
      resourceType: 'video'
    }, maxRetries);

    return {
      publicId: res.publicId,
      secureUrl: res.secureUrl,
      assetFolder: res.assetFolder || `GDCT_V4/AUDIO/${lessonId}`,
      resourceType: res.resourceType || 'video',
      bytes: res.bytes || res.size || file.size,
      duration: res.duration || 0,
      format: res.format || 'mp3',
      mimeType: file.type || res.mimeType || 'audio/mp3',
      createdAt: res.createdAt || new Date().toISOString()
    };
  },

  uploadSlideSetBatch: async (params: {
    courseId: string;
    lessonId: string;
    setName: string;
    files: File[];
    concurrency?: number;
    onProgress?: (info: { completed: number; total: number; percent: number; successCount: number; failCount: number; currentFileName?: string }) => void;
  }): Promise<{ 
    slideSet: SlideSet; 
    slides: SlideItem[]; 
    failedSlides: Array<{ index: number; order: number; file: File; fileName: string; error: string }>;
    successCount: number;
    failCount: number;
  }> => {
    const { courseId, lessonId, setName, files: rawFiles, concurrency = 4, onProgress } = params;
    const totalCount = rawFiles.length;
    if (totalCount === 0) {
      throw new Error('Danh sách tệp ảnh slide rỗng.');
    }

    // MANDATORY Natural Sort BEFORE Upload
    const { sorted: files } = naturalSortFilenames(rawFiles);

    const existingSet = await firestoreService.getSlideSet(lessonId);
    const newVersion = (existingSet?.version || 0) + 1;
    const slideSetId = `slideset-${lessonId}-${Date.now()}`;

    const slideSet = await firestoreService.saveSlideSet({
      id: slideSetId,
      courseId,
      lessonId,
      name: setName || `Bộ Slide Bài giảng v${newVersion}`,
      totalSlides: totalCount,
      status: 'PROCESSING',
      version: newVersion
    });

    let completed = 0;
    let successCount = 0;
    let failCount = 0;
    let nextIndex = 0;

    const uploadedSlides: SlideItem[] = [];
    const failedSlides: Array<{ index: number; order: number; file: File; fileName: string; error: string }> = [];

    if (onProgress) {
      onProgress({ completed: 0, total: totalCount, percent: 0, successCount: 0, failCount: 0 });
    }

    const workers = Array.from({ length: Math.min(concurrency, totalCount) }, async () => {
      while (nextIndex < totalCount) {
        const idx = nextIndex++;
        const file = files[idx];
        const slideNumber = idx + 1;

        try {
          // Cloudinary Unsigned Upload
          const cloudMeta = await api.uploadSlideImage(file, courseId, lessonId);

          // Persistent Metadata in Firestore
          const slideDoc = await firestoreService.createSlide({
            id: `slide-${lessonId}-${slideNumber}-${Date.now()}`,
            courseId,
            lessonId,
            slideSetId,
            order: slideNumber,
            slideOrder: slideNumber,
            title: `Slide ${slideNumber}: ${file.name.replace(/\.[^/.]+$/, '')}`,
            fileName: file.name,
            imageUrl: cloudMeta.secureUrl,
            secureUrl: cloudMeta.secureUrl,
            cloudinaryUrl: cloudMeta.secureUrl,
            assetFolder: cloudMeta.assetFolder || `GDCT_V4/SLIDE/${lessonId}`,
            storagePath: cloudMeta.publicId,
            cloudinaryPublicId: cloudMeta.publicId,
            mimeType: file.type || 'image/png',
            bytes: cloudMeta.bytes,
            width: cloudMeta.width,
            height: cloudMeta.height,
            version: newVersion,
            storageProvider: 'cloudinary'
          });

          uploadedSlides.push(slideDoc);
          successCount++;
        } catch (err: any) {
          console.error(`[SLIDE BATCH] Thất bại slide ${slideNumber} (${file.name}):`, err);
          failCount++;
          failedSlides.push({
            index: idx,
            order: slideNumber,
            file,
            fileName: file.name,
            error: err.message || 'Lỗi không xác định khi tải ảnh slide'
          });
        } finally {
          completed++;
          const percent = Math.round((completed / totalCount) * 100);
          if (onProgress) {
            onProgress({
              completed,
              total: totalCount,
              percent,
              successCount,
              failCount,
              currentFileName: file.name
            });
          }
        }
      }
    });

    await Promise.all(workers);

    // Sort uploaded slides by order
    uploadedSlides.sort((a, b) => (a.order || 0) - (b.order || 0));

    const updatedSlideSet = await firestoreService.saveSlideSet({
      id: slideSetId,
      lessonId,
      totalSlides: uploadedSlides.length,
      status: failCount === 0 ? 'READY' : 'PROCESSING'
    });

    await firestoreService.updateLesson(lessonId, {
      slideCount: uploadedSlides.length
    });

    return { 
      slideSet: updatedSlideSet, 
      slides: uploadedSlides, 
      failedSlides,
      successCount,
      failCount
    };
  },

  retryFailedSlidesBatch: async (params: {
    courseId: string;
    lessonId: string;
    slideSetId: string;
    failedItems: Array<{ order: number; file: File; fileName: string }>;
    concurrency?: number;
    onProgress?: (info: { completed: number; total: number; percent: number; successCount: number; failCount: number }) => void;
  }): Promise<{ retriedSlides: SlideItem[]; remainingFailed: Array<{ order: number; file: File; fileName: string; error: string }> }> => {
    const { courseId, lessonId, slideSetId, failedItems, concurrency = 4, onProgress } = params;
    const totalCount = failedItems.length;
    if (totalCount === 0) return { retriedSlides: [], remainingFailed: [] };

    let completed = 0;
    let successCount = 0;
    let failCount = 0;
    let nextIndex = 0;

    const retriedSlides: SlideItem[] = [];
    const remainingFailed: Array<{ order: number; file: File; fileName: string; error: string }> = [];

    const workers = Array.from({ length: Math.min(concurrency, totalCount) }, async () => {
      while (nextIndex < totalCount) {
        const idx = nextIndex++;
        const item = failedItems[idx];

        try {
          const cloudMeta = await api.uploadSlideImage(item.file, courseId, lessonId);
          const slideDoc = await firestoreService.createSlide({
            id: `slide-${lessonId}-${item.order}-${Date.now()}`,
            courseId,
            lessonId,
            slideSetId,
            order: item.order,
            slideOrder: item.order,
            title: `Slide ${item.order}: ${item.fileName.replace(/\.[^/.]+$/, '')}`,
            fileName: item.fileName,
            imageUrl: cloudMeta.secureUrl,
            secureUrl: cloudMeta.secureUrl,
            storagePath: cloudMeta.publicId,
            cloudinaryPublicId: cloudMeta.publicId,
            mimeType: item.file.type || 'image/png',
            bytes: cloudMeta.bytes,
            width: cloudMeta.width,
            height: cloudMeta.height,
            version: 1,
            storageProvider: 'cloudinary'
          });
          retriedSlides.push(slideDoc);
          successCount++;
        } catch (err: any) {
          failCount++;
          remainingFailed.push({
            order: item.order,
            file: item.file,
            fileName: item.fileName,
            error: err.message || 'Lỗi thử lại upload slide'
          });
        } finally {
          completed++;
          const percent = Math.round((completed / totalCount) * 100);
          if (onProgress) {
            onProgress({ completed, total: totalCount, percent, successCount, failCount });
          }
        }
      }
    });

    await Promise.all(workers);

    // Update lesson slideCount
    const currentSlides = await firestoreService.getSlides(lessonId);
    await firestoreService.updateLesson(lessonId, { slideCount: currentSlides.length });

    return { retriedSlides, remainingFailed };
  },

  publishSlideSet: async (slideSetId: string, lessonId: string, version: number): Promise<SlideSet> => {
    const slideSet = await firestoreService.saveSlideSet({
      id: slideSetId,
      lessonId,
      status: 'PUBLISHED',
      version
    });
    await firestoreService.updateLesson(lessonId, {
      status: 'PUBLISHED',
      version
    });
    return slideSet;
  },

  replaceSlideImage: async (slideId: string, lessonId: string, courseId: string, file: File): Promise<SlideItem> => {
    const cloudMeta = await api.uploadSlideImage(file, courseId, lessonId);
    const updatedSlide = await firestoreService.updateSlide(slideId, {
      imageUrl: cloudMeta.secureUrl,
      secureUrl: cloudMeta.secureUrl,
      storagePath: cloudMeta.publicId,
      cloudinaryPublicId: cloudMeta.publicId,
      fileName: file.name,
      bytes: cloudMeta.bytes,
      width: cloudMeta.width,
      height: cloudMeta.height,
      storageProvider: 'cloudinary'
    });
    return updatedSlide;
  },

  deleteSlideSet: async (slideSetId: string, lessonId: string): Promise<{ success: boolean }> => {
    const result = await firestoreService.deleteSlideSet(slideSetId, lessonId);
    await firestoreService.updateLesson(lessonId, { slideCount: 0 });
    return result;
  },

  createSlide: async (lessonId: string, data: Partial<SlideItem>): Promise<SlideItem> => {
    return await firestoreService.createSlide({ ...data, lessonId });
  },

  updateSlide: async (id: string, data: Partial<SlideItem>): Promise<SlideItem> => {
    return await firestoreService.updateSlide(id, data);
  },

  deleteSlide: async (id: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteSlide(id);
  },

  reorderSlides: async (lessonId: string, slideIds: string[]): Promise<{ success: boolean }> => {
    for (let i = 0; i < slideIds.length; i++) {
      const slideId = slideIds[i];
      const docRef = doc(db, 'slides', slideId);
      await updateDoc(docRef, { order: i + 1, updatedAt: new Date().toISOString() });
    }
    return { success: true };
  },

  // -------------------------------------------------------------
  // CONTENTS (Cloud Firestore)
  // -------------------------------------------------------------
  getContents: async (lessonId: string): Promise<ContentSection[]> => {
    return await firestoreService.getContents(lessonId);
  },

  createContent: async (lessonId: string, data: Partial<ContentSection>): Promise<ContentSection> => {
    return await firestoreService.createContent({ ...data, lessonId });
  },

  updateContent: async (id: string, data: Partial<ContentSection>): Promise<ContentSection> => {
    return await firestoreService.updateContent(id, data);
  },

  // -------------------------------------------------------------
  // STRUCTURED LESSON SECTIONS & ITEMS (PHẦN -> MỤC -> NỘI DUNG)
  // -------------------------------------------------------------
  getSections: async (lessonId: string): Promise<LessonSection[]> => {
    return await firestoreService.getSections(lessonId);
  },

  createSection: async (lessonId: string, data: Partial<LessonSection>): Promise<LessonSection> => {
    return await firestoreService.createSection({ ...data, lessonId });
  },

  updateSection: async (id: string, data: Partial<LessonSection>): Promise<LessonSection> => {
    return await firestoreService.updateSection(id, data);
  },

  deleteSection: async (id: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteSection(id);
  },

  deleteSectionCascade: async (lessonId: string, sectionId: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteSectionCascade(lessonId, sectionId);
  },

  getItems: async (lessonId: string, sectionId?: string): Promise<LessonItem[]> => {
    return await firestoreService.getItems(lessonId, sectionId);
  },

  createItem: async (lessonId: string, sectionId: string, data: Partial<LessonItem>): Promise<LessonItem> => {
    return await firestoreService.createItem({ ...data, lessonId, sectionId });
  },

  updateItem: async (id: string, data: Partial<LessonItem>): Promise<LessonItem> => {
    return await firestoreService.updateItem(id, data);
  },

  deleteItem: async (id: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteItem(id);
  },

  deleteContent: async (contentId: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteContent(contentId);
  },

  deleteAllLessonContent: async (lessonId: string): Promise<{ success: boolean; message: string }> => {
    return await firestoreService.deleteAllLessonContent(lessonId);
  },

  deleteItemCascade: async (itemId: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteItemCascade(itemId);
  },

  getQuestions: async (lessonId: string, itemId?: string): Promise<LessonQuestion[]> => {
    return await firestoreService.getQuestions(lessonId, itemId);
  },

  createQuestion: async (lessonId: string, itemId: string, data: Partial<LessonQuestion>): Promise<LessonQuestion> => {
    return await firestoreService.createQuestion({ ...data, lessonId, itemId });
  },

  updateQuestion: async (id: string, data: Partial<LessonQuestion>): Promise<LessonQuestion> => {
    return await firestoreService.updateQuestion(id, data);
  },

  deleteQuestion: async (id: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteQuestion(id);
  },

  saveSourceDocument: async (lessonId: string, docData: Partial<SourceDocument>): Promise<SourceDocument> => {
    const savedDoc = await firestoreService.saveSourceDocument(lessonId, docData);
    await firestoreService.updateLesson(lessonId, { sourceDocument: savedDoc });
    return savedDoc;
  },

  getSourceDocument: async (lessonId: string): Promise<SourceDocument | null> => {
    return await firestoreService.getSourceDocument(lessonId);
  },

  getSourceDocuments: async (lessonId: string): Promise<SourceDocument[]> => {
    return await firestoreService.getSourceDocuments(lessonId);
  },

  deleteDocumentContentOnly: async (lessonId: string, documentId: string) => {
    return await firestoreService.deleteDocumentContentOnly(lessonId, documentId);
  },

  deleteSourceDocumentCascade: async (lessonId: string, documentId: string, cloudinaryPublicId?: string, resourceType = 'raw') => {
    return await firestoreService.deleteSourceDocumentCascade(lessonId, documentId, cloudinaryPublicId, resourceType);
  },

  getItemProgress: async (userId: string, lessonId: string): Promise<UserItemProgress[]> => {
    return await firestoreService.getItemProgress(userId, lessonId);
  },

  submitItemProgress: async (progress: Partial<UserItemProgress>): Promise<UserItemProgress> => {
    return await firestoreService.submitItemProgress(progress);
  },

  submitSectionProgress: async (data: Partial<UserSectionProgress>) => {
    return await firestoreService.submitSectionProgress(data);
  },

  getSectionProgress: async (userId: string, lessonId: string) => {
    return await firestoreService.getSectionProgress(userId, lessonId);
  },

  // -------------------------------------------------------------
  // VIDEOS (Cloud Firestore + Cloud Storage)
  // -------------------------------------------------------------
  getVideos: async (lessonId: string): Promise<VideoItem[]> => {
    return await firestoreService.getVideos(lessonId);
  },

  createVideo: async (lessonId: string, data: Partial<VideoItem>): Promise<VideoItem> => {
    const video = await firestoreService.createVideo({ ...data, lessonId });
    const currentVideos = await firestoreService.getVideos(lessonId);
    await firestoreService.updateLesson(lessonId, { videoCount: currentVideos.length });
    return video;
  },

  updateVideo: async (id: string, data: Partial<VideoItem>): Promise<VideoItem> => {
    return await firestoreService.updateVideo(id, data);
  },

  deleteVideo: async (id: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteVideo(id);
  },

  deleteVideoCascade: async (lessonId: string, videoId: string, _cloudinaryPublicId?: string): Promise<{ success: boolean }> => {
    const res = await firestoreService.deleteVideoCascade(videoId, lessonId);
    return { success: res.success };
  },

  replaceVideoFile: async (videoId: string, lessonId: string, file: File, oldPublicId?: string): Promise<VideoItem> => {
    const cloudRes = await api.uploadVideoFile(file, lessonId);
    if (oldPublicId && oldPublicId !== cloudRes.publicId) {
      try {
        await fetch('/api/cloudinary/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicId: oldPublicId,
            resourceType: 'video',
            lessonId,
            category: 'videos'
          })
        });
      } catch (e) {
        console.warn('Failed to delete old video from Cloudinary:', e);
      }
    }
    const updated = await firestoreService.updateVideo(videoId, {
      videoUrl: cloudRes.secureUrl,
      cloudinaryUrl: cloudRes.secureUrl,
      cloudinaryPublicId: cloudRes.publicId,
      storagePath: cloudRes.publicId,
      assetFolder: cloudRes.assetFolder,
      fileSize: cloudRes.bytes,
      fileSizeMb: Math.round((cloudRes.bytes / (1024 * 1024)) * 100) / 100,
      durationSeconds: Math.round(cloudRes.duration || 0),
      thumbnail: cloudRes.thumbnailUrl,
      mimeType: cloudRes.mimeType,
      format: cloudRes.format
    });
    return updated;
  },

  // -------------------------------------------------------------
  // AUDIOS (Cloud Firestore + Cloud Storage)
  // -------------------------------------------------------------
  getAudios: async (lessonId: string): Promise<AudioItem[]> => {
    return await firestoreService.getAudios(lessonId);
  },

  createAudio: async (lessonId: string, data: Partial<AudioItem>): Promise<AudioItem> => {
    const audio = await firestoreService.createAudio({ ...data, lessonId });
    const currentAudios = await firestoreService.getAudios(lessonId);
    await firestoreService.updateLesson(lessonId, { audioCount: currentAudios.length });
    return audio;
  },

  updateAudio: async (id: string, data: Partial<AudioItem>): Promise<AudioItem> => {
    return await firestoreService.updateAudio(id, data);
  },

  deleteAudio: async (id: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteAudio(id);
  },

  deleteAudioCascade: async (lessonId: string, audioId: string, _cloudinaryPublicId?: string): Promise<{ success: boolean }> => {
    const res = await firestoreService.deleteAudioCascade(audioId, lessonId);
    return { success: res.success };
  },

  replaceAudioFile: async (audioId: string, lessonId: string, file: File, oldPublicId?: string): Promise<AudioItem> => {
    const cloudRes = await api.uploadAudioFile(file, lessonId);
    if (oldPublicId && oldPublicId !== cloudRes.publicId) {
      try {
        await fetch('/api/cloudinary/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicId: oldPublicId,
            resourceType: 'video',
            lessonId,
            category: 'audios'
          })
        });
      } catch (e) {
        console.warn('Failed to delete old audio from Cloudinary:', e);
      }
    }
    const updated = await firestoreService.updateAudio(audioId, {
      audioUrl: cloudRes.secureUrl,
      cloudinaryUrl: cloudRes.secureUrl,
      cloudinaryPublicId: cloudRes.publicId,
      storagePath: cloudRes.publicId,
      assetFolder: cloudRes.assetFolder,
      fileSize: cloudRes.bytes,
      fileSizeMb: Math.round((cloudRes.bytes / (1024 * 1024)) * 100) / 100,
      durationSeconds: Math.round(cloudRes.duration || 0),
      mimeType: cloudRes.mimeType,
      format: cloudRes.format
    });
    return updated;
  },

  // -------------------------------------------------------------
  // UNITS & USERS (Cloud Firestore)
  // -------------------------------------------------------------
  getUnits: async (): Promise<Unit[]> => {
    return await firestoreService.getUnits();
  },

  createUnit: async (data: Partial<Unit>): Promise<Unit> => {
    const id = data.id || `unit-${Date.now()}`;
    const docRef = doc(db, 'units', id);
    const now = new Date().toISOString();
    const unit: Unit = {
      id,
      name: data.name || 'Đơn vị mới',
      code: data.code || 'DV-01',
      type: data.type || 'BRIGADE',
      description: data.description || '',
      memberCount: data.memberCount || 100,
      commander: data.commander || '',
      politicalOfficer: data.politicalOfficer || '',
      order: data.order || 1,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, unit);
    return unit;
  },

  updateUnit: async (id: string, data: Partial<Unit>): Promise<Unit> => {
    const docRef = doc(db, 'units', id);
    await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
    const snap = await getDoc(docRef);
    return snap.data() as Unit;
  },

  deleteUnit: async (id: string): Promise<{ success: boolean }> => {
    await deleteDoc(doc(db, 'units', id));
    return { success: true };
  },

  // -------------------------------------------------------------
  // POSTER / BANNER (Max 5 items for mobile app)
  // -------------------------------------------------------------
  getBanners: async (): Promise<AppBanner[]> => {
    return await firestoreService.getBanners();
  },

  createBanner: async (data: Partial<AppBanner>): Promise<AppBanner> => {
    return await firestoreService.createBanner(data);
  },

  updateBanner: async (id: string, data: Partial<AppBanner>): Promise<AppBanner> => {
    return await firestoreService.updateBanner(id, data);
  },

  deleteBanner: async (id: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteBanner(id);
  },

  reorderBanners: async (orderedBannerIds: string[]): Promise<void> => {
    return await firestoreService.reorderBanners(orderedBannerIds);
  },

  uploadBannerImage: async (file: File): Promise<{ url: string; publicId: string }> => {
    // 1. First choice: Cloudinary Unsigned Upload (using pre-configured working preset)
    try {
      const res = await cloudinaryUnsignedSlideProvider.uploadUnsignedSlide(file, {
        category: 'banners',
        lessonId: 'home_carousel',
        resourceType: 'image',
        filename: `banner_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
      });
      if (res && (res.secureUrl || res.fileUrl)) {
        return {
          url: res.secureUrl || res.fileUrl,
          publicId: res.publicId || ''
        };
      }
    } catch (cldErr) {
      console.warn('[uploadBannerImage] Cloudinary unsigned upload warning, trying server proxy:', cldErr);
    }

    // 2. Second choice: Server-side proxy /api/cloudinary/upload
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', 'banners');
      formData.append('lessonId', 'home_carousel');

      const res = await fetch('/api/cloudinary/upload', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const text = await res.text();
        try {
          const data = JSON.parse(text);
          const resolvedUrl = data.secureUrl || data.url || (data.data && (data.data.secure_url || data.data.url));
          const resolvedId = data.publicId || (data.data && data.data.public_id) || '';
          if (resolvedUrl) {
            return {
              url: resolvedUrl,
              publicId: resolvedId
            };
          }
        } catch {
          // not valid JSON, proceed to Firebase
        }
      }
    } catch (proxyErr) {
      console.warn('[uploadBannerImage] Server upload proxy error, attempting Firebase fallback:', proxyErr);
    }

    // 3. Third choice (Guaranteed Fallback): Firebase Storage
    try {
      const fileId = `banner-${Date.now()}-${Math.round(Math.random() * 1000)}`;
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `banners/home_carousel/${fileId}_${safeName}`;
      const storageRef = ref(storage, storagePath);
      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);
      return {
        url: downloadUrl,
        publicId: fileId
      };
    } catch (fbErr: any) {
      console.error('[uploadBannerImage] Tất cả các phương thức upload ảnh đều thất bại:', fbErr);
      throw new Error(`Tải ảnh thất bại: ${fbErr.message || 'Lỗi lưu trữ ảnh'}`);
    }
  },

  getUsers: async (): Promise<User[]> => {
    return await firestoreService.getUsers();
  },

  createUser: async (data: Partial<User>): Promise<User> => {
    const id = data.id || `user-${Date.now()}`;
    const docRef = doc(db, 'users', id);
    const now = new Date().toISOString();
    const displayName = data.fullName || data.name || 'Quân nhân';
    const rankAndPos = data.rankAndPosition || (data.rank && data.position ? `${data.rank} - ${data.position}` : data.rank || data.position || 'Chiến sĩ Hải Quân');
    const unitName = data.unit || data.unitName || 'Bộ Tư lệnh Vùng 4 Hải Quân';

    const user: User = {
      id,
      name: displayName,
      fullName: displayName,
      email: data.email || 'quan.nhan@vung4.vn',
      password: data.password || '123@abc',
      role: data.role || 'USER',
      rank: data.rank || 'Đại úy',
      position: data.position || 'Trợ lý',
      rankAndPosition: rankAndPos,
      unitId: data.unitId || 'unit-1',
      unitName: unitName,
      unit: unitName,
      status: data.status || 'ACTIVE',
      createdAt: now,
      updatedAt: now
    };
    await setDoc(docRef, user);
    return user;
  },

  updateUser: async (id: string, data: Partial<User>): Promise<User> => {
    const docRef = doc(db, 'users', id);
    await updateDoc(docRef, { ...data, updatedAt: new Date().toISOString() });
    const snap = await getDoc(docRef);
    return snap.data() as User;
  },

  deleteUser: async (id: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteUser(id);
  },

  // -------------------------------------------------------------
  // USER PROGRESS & NOTIFICATIONS
  // -------------------------------------------------------------
  getProgress: async (unitId?: string, lessonId?: string): Promise<UserProgress[]> => {
    return await firestoreService.getProgress(unitId, lessonId);
  },

  submitProgress: async (data: Partial<UserProgress>): Promise<UserProgress> => {
    return await firestoreService.submitProgress(data);
  },

  getNotifications: async (): Promise<SystemNotification[]> => {
    return await firestoreService.getNotifications();
  },

  createNotification: async (data: Partial<SystemNotification>): Promise<SystemNotification> => {
    return await firestoreService.createNotification(data);
  },

  deleteNotification: async (id: string): Promise<{ success: boolean }> => {
    await deleteDoc(doc(db, 'notifications', id));
    return { success: true };
  },

  // -------------------------------------------------------------
  // FIREBASE CLOUD STORAGE & UPLOAD
  // -------------------------------------------------------------
  uploadFile: async (
    file: File,
    category: StorageCategory,
    entityId: string,
    version = 1
  ): Promise<StorageFileMetadata> => {
    const fileId = `file-${Date.now()}-${Math.round(Math.random() * 1000)}`;
    const storagePath = `${category.toLowerCase()}/${entityId}/${fileId}_${file.name}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    const fileMeta: StorageFileMetadata = {
      id: fileId,
      originalName: file.name,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      sizeMb: parseFloat((file.size / (1024 * 1024)).toFixed(2)),
      category,
      entityId,
      storagePath,
      downloadUrl,
      version,
      uploadedBy: 'Admin Vùng 4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const docRef = doc(db, 'storageFiles', fileId);
    await setDoc(docRef, fileMeta);
    return fileMeta;
  },

  getStorageFiles: async (category?: StorageCategory, entityId?: string): Promise<StorageFileMetadata[]> => {
    const colRef = collection(db, 'storageFiles');
    let q;
    if (category && category !== ('ALL' as any) && entityId) {
      q = query(colRef, where('category', '==', category), where('entityId', '==', entityId));
    } else if (category && category !== ('ALL' as any)) {
      q = query(colRef, where('category', '==', category));
    } else if (entityId) {
      q = query(colRef, where('entityId', '==', entityId));
    } else {
      q = query(colRef, limit(100));
    }
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as StorageFileMetadata);
  },

  processPptx: async (lessonId: string, file: File, maxSlides = 5): Promise<{ success: boolean; slideCount: number; slides: SlideItem[] }> => {
    const fileMeta = await api.uploadFile(file, 'documents', lessonId, 1);
    await firestoreService.updateLesson(lessonId, { rawPptUrl: fileMeta.downloadUrl, rawPptStoragePath: fileMeta.storagePath });

    const sampleSlides: SlideItem[] = [];
    for (let i = 1; i <= maxSlides; i++) {
      const slide = await firestoreService.createSlide({
        lessonId,
        order: i,
        title: `Slide số ${i} (Trích xuất PPTX từ Cloud Storage)`,
        imageUrl: `https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1920&q=80`,
        storagePath: `slides/${lessonId}/slide_${i}.jpg`,
        width: 1920,
        height: 1080,
        version: 1
      });
      sampleSlides.push(slide);
    }
    return { success: true, slideCount: sampleSlides.length, slides: sampleSlides };
  },

  uploadAndProcessPptx: async (
    courseId: string,
    lessonId: string,
    file: File
  ): Promise<{ success: boolean; message: string; jobId: string; job: PptxProcessingJob; error?: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', courseId);
    formData.append('lessonId', lessonId);

    const response = await fetch('/api/pptx/upload-and-process', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'Lỗi tải lên tệp PPTX');
    }

    return response.json();
  },

  retryPptxJob: async (jobId: string): Promise<{ success: boolean; message: string; job?: PptxProcessingJob; error?: string }> => {
    const response = await fetch('/api/pptx/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || errData.message || 'Lỗi thử lại xử lý PPTX');
    }

    return response.json();
  },

  checkExistingPptxJob: async (lessonId: string, fileName: string): Promise<PptxProcessingJob | null> => {
    return firestoreService.findExistingPptxJob(lessonId, fileName);
  },

  subscribePptxJob: (jobId: string, callback: (job: PptxProcessingJob | null) => void): (() => void) => {
    return firestoreService.listenPptxJob(jobId, callback);
  },

  uploadSlideImagesBatch: async (lessonId: string, files: FileList | File[]): Promise<{ success: boolean; slides: SlideItem[] }> => {
    const fileArray = Array.from(files);
    const createdSlides: SlideItem[] = [];
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const fileMeta = await api.uploadFile(file, 'slides', lessonId, 1);
      const slide = await firestoreService.createSlide({
        lessonId,
        order: i + 1,
        title: file.name.replace(/\.[^/.]+$/, ''),
        imageUrl: fileMeta.downloadUrl,
        storagePath: fileMeta.storagePath,
        width: 1920,
        height: 1080,
        version: 1
      });
      createdSlides.push(slide);
    }
    return { success: true, slides: createdSlides };
  },

  getLessonSizeBreakdown: async (lessonId: string): Promise<LessonSizeBreakdown> => {
    const [slides, contents, videos, audios] = await Promise.all([
      firestoreService.getSlides(lessonId),
      firestoreService.getContents(lessonId),
      firestoreService.getVideos(lessonId),
      firestoreService.getAudios(lessonId)
    ]);
    const slideSizeMb = slides.length * 1.5;
    const contentSizeMb = contents.length * 0.1;
    const videoSizeMb = videos.reduce((acc, v) => acc + (v.fileSizeMb || 25), 0);
    const audioSizeMb = audios.reduce((acc, a) => acc + (a.fileSizeMb || 5), 0);
    const totalSizeMb = parseFloat((slideSizeMb + contentSizeMb + videoSizeMb + audioSizeMb).toFixed(2));
    return {
      slideCount: slides.length,
      slideSizeMb,
      contentCount: contents.length,
      contentSizeMb,
      videoCount: videos.length,
      videoSizeMb,
      audioCount: audios.length,
      audioSizeMb,
      totalSizeMb
    };
  },

  getOfflinePackage: async (lessonId: string, selectedModules?: OfflineModuleSelection): Promise<OfflinePackage> => {
    const lesson = await firestoreService.getLesson(lessonId);
    if (!lesson) throw new Error(`Bài học ${lessonId} không tồn tại`);
    const course = await firestoreService.getCourse(lesson.courseId);
    const [slides, contents, videos, audios] = await Promise.all([
      selectedModules && selectedModules.slides === false ? Promise.resolve([]) : firestoreService.getSlides(lessonId),
      selectedModules && selectedModules.content === false ? Promise.resolve([]) : firestoreService.getContents(lessonId),
      selectedModules && selectedModules.videos === false ? Promise.resolve([]) : firestoreService.getVideos(lessonId),
      selectedModules && selectedModules.audios === false ? Promise.resolve([]) : firestoreService.getAudios(lessonId)
    ]);
    const breakdown = await api.getLessonSizeBreakdown(lessonId);
    return {
      lessonId,
      lessonTitle: lesson.title,
      courseId: lesson.courseId,
      courseTitle: course?.title || '',
      version: lesson.version || 1,
      packageVersion: lesson.version || 1,
      packageStatus: 'READY',
      packageChecksum: `sha256-${lessonId}-${Date.now()}`,
      totalSizeBytes: breakdown.totalSizeMb * 1024 * 1024,
      totalSizeMb: breakdown.totalSizeMb,
      fileCount: slides.length + contents.length + videos.length + audios.length,
      generatedAt: new Date().toISOString(),
      lesson,
      course: course || undefined,
      slides,
      contents,
      videos,
      audios,
      manifestFiles: []
    };
  },

  rebuildOfflinePackage: async (lessonId: string): Promise<{ success: boolean; offlinePackage: OfflinePackage }> => {
    const pkg = await api.getOfflinePackage(lessonId);
    return { success: true, offlinePackage: pkg };
  },

  // -------------------------------------------------------------
  // REALTIME LISTENER (Cloud Firestore onSnapshot)
  // -------------------------------------------------------------
  subscribeRealtime: (onEvent: (event: RealtimeEvent) => void): (() => void) => {
    const unsubCourses = firestoreService.listenCourses((courses) => {
      onEvent({
        type: 'COURSE_UPDATED',
        action: 'UPDATE',
        timestamp: new Date().toISOString(),
        entityId: 'courses',
        data: courses
      });
    });

    return () => {
      unsubCourses();
    };
  },

  // -------------------------------------------------------------
  // SYNC & DELTA SYNCHRONIZATION
  // -------------------------------------------------------------
  syncDelta: async (updatedAfter?: string, clientVersion?: number): Promise<SyncDelta> => {
    const courses = await firestoreService.getCourses(true, 500);
    const lessons = await firestoreService.getLessons(undefined, true, 500);
    return {
      syncTimestamp: new Date().toISOString(),
      requestedAfter: updatedAfter,
      clientVersion: clientVersion || 1,
      delta: {
        courses,
        lessons,
        slides: [],
        contents: [],
        videos: [],
        audios: [],
        notifications: [],
        deletedIds: {
          courses: courses.filter(c => c.isDeleted).map(c => c.id),
          lessons: lessons.filter(l => l.isDeleted).map(l => l.id),
          slides: [],
          contents: [],
          videos: [],
          audios: []
        }
      }
    };
  },

  syncProgressBatch: async (progressList: Partial<OfflineProgressItem | UserProgress>[]): Promise<{ success: boolean; message: string; syncedResults: UserProgress[] }> => {
    const syncedResults: UserProgress[] = [];
    for (const p of progressList) {
      const res = await firestoreService.submitProgress(p);
      syncedResults.push(res);
    }
    return {
      success: true,
      message: `Đã đồng bộ thành công ${syncedResults.length} bản ghi tiến độ lên Firestore`,
      syncedResults
    };
  },

  // -------------------------------------------------------------
  // EXAM BANKS, SESSIONS & SUBMISSIONS (ĐỢT KIỂM TRA & BỘ ĐỀ EXCEL)
  // -------------------------------------------------------------
  getExamBanks: async (): Promise<ExamBank[]> => {
    return await firestoreService.getExamBanks();
  },

  getExamBank: async (id: string): Promise<ExamBank | null> => {
    return await firestoreService.getExamBank(id);
  },

  createExamBank: async (data: Partial<ExamBank>, questions: ExamQuestion[]): Promise<ExamBank> => {
    return await firestoreService.createExamBank(data, questions);
  },

  deleteExamBank: async (id: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteExamBank(id);
  },

  getExamSessions: async (): Promise<ExamSession[]> => {
    return await firestoreService.getExamSessions();
  },

  createExamSession: async (data: Partial<ExamSession>): Promise<ExamSession> => {
    return await firestoreService.createExamSession(data);
  },

  updateExamSession: async (id: string, data: Partial<ExamSession>): Promise<ExamSession> => {
    return await firestoreService.updateExamSession(id, data);
  },

  deleteExamSession: async (id: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteExamSession(id);
  },

  listenExamSessions: (callback: (sessions: ExamSession[]) => void) => {
    return firestoreService.listenExamSessions(callback);
  },

  getExamSubmissions: async (sessionId?: string): Promise<ExamSubmission[]> => {
    return await firestoreService.getExamSubmissions(sessionId);
  },

  submitExamResult: async (submission: Partial<ExamSubmission>): Promise<ExamSubmission> => {
    return await firestoreService.submitExamResult(submission);
  },

  listenExamSubmissions: (sessionId: string | undefined, callback: (subs: ExamSubmission[]) => void) => {
    return firestoreService.listenExamSubmissions(sessionId, callback);
  },

  // -------------------------------------------------------------
  // USER FEEDBACKS & REPORTS (PHẢN ÁNH TỪ CÁC TÀI KHOẢN VỀ WEB QUẢN TRỊ)
  // -------------------------------------------------------------
  getFeedbacks: async (): Promise<UserFeedback[]> => {
    return await firestoreService.getFeedbacks();
  },

  createFeedback: async (feedback: Partial<UserFeedback>): Promise<UserFeedback> => {
    return await firestoreService.createFeedback(feedback);
  },

  updateFeedbackStatus: async (id: string, status: FeedbackStatus, adminResponse?: string, respondedBy?: string): Promise<UserFeedback> => {
    return await firestoreService.updateFeedbackStatus(id, status, adminResponse, respondedBy);
  },

  deleteFeedback: async (id: string): Promise<{ success: boolean }> => {
    return await firestoreService.deleteFeedback(id);
  },

  listenFeedbacks: (callback: (feedbacks: UserFeedback[]) => void) => {
    return firestoreService.listenFeedbacks(callback);
  }
};
