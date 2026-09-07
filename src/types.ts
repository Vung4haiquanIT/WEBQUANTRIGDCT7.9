export interface PptxProcessingJob {
  id: string;
  fileName: string;
  fileSize?: number;
  originalUrl: string;
  originalPublicId?: string;
  courseId: string;
  lessonId: string;
  status: 'processing' | 'completed' | 'failed' | 'cancelled';
  totalSlides: number;
  processedSlides: number;
  progress: number;
  currentSlide: number;
  currentStepName?: string;
  error?: string | null;
  errorStep?: string | null;
  fingerprint?: string;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'ADMIN' | 'APPROVER' | 'USER';

export interface UserProfile {
  id: string;
  fullName: string;
  rankAndPosition: string; // Ví dụ: Thượng úy - TLTH
  unit: string;            // Ví dụ: Lữ đoàn 162
  email: string;
  password?: string;       // Mật khẩu đăng nhập (mặc định 123@abc)
  role: UserRole;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export type PublishStatus = 'DRAFT' | 'REVIEW' | 'PUBLISHED' | 'ARCHIVED' | 'INTERNAL';

export interface User {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  password?: string;       // Mật khẩu đăng nhập (mặc định 123@abc)
  role: UserRole;
  rank?: string; // Cấp bậc (Đại úy, Trung tá, Thượng tá...)
  position?: string; // Chức vụ (Chính trị viên, Trợ lý Tuyên huấn...)
  rankAndPosition?: string; // Ví dụ: Thượng úy - TLTH
  unitId?: string;
  unitName?: string;
  unit?: string; // Ví dụ: Lữ đoàn 162
  avatar?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface Unit {
  id: string;
  name: string;
  code: string;
  type: 'BRIGADE' | 'BATTALION' | 'SHIP' | 'DEPARTMENT' | 'ISLAND'; // Lữ đoàn, Tiểu đoàn, Tàu chiến, Phòng ban, Đảo Trường Sa
  description?: string;
  memberCount: number;
  commander?: string;
  politicalOfficer?: string; // Chính ủy / Chính trị viên
  order: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface Course {
  id: string;
  code?: string; // Mã khóa chuyên đề
  title: string;
  description: string;
  thumbnail: string;
  storageThumbnailPath?: string;
  rawPptUrl?: string;
  rawPptStoragePath?: string;
  year: number;
  order: number;
  status: PublishStatus;
  version: number;
  isDeleted?: boolean;
  lessonCount?: number;
  publishedLessonCount?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface LessonModuleConfig {
  showSlides: boolean;
  showContents: boolean;
  showVideos: boolean;
  showAudios: boolean;
}

export interface Lesson {
  id: string;
  lessonCode?: string; // Mã khóa bài học
  courseId: string;
  courseTitle?: string;
  title: string;
  subtitle?: string;
  description: string;
  thumbnail: string;
  storageThumbnailPath?: string;
  rawPptUrl?: string;
  rawPptStoragePath?: string;
  order: number;
  status: PublishStatus;
  version: number;
  contentVersion?: number;
  mediaVersion?: number;
  totalSizeMb?: number;
  packageStatus?: 'READY' | 'PROCESSING' | 'ERROR';
  publishedAt?: string;
  moduleConfig: LessonModuleConfig;
  isDeleted?: boolean;
  slideCount?: number;
  contentCount?: number;
  sectionCount?: number;
  itemCount?: number;
  videoCount?: number;
  audioCount?: number;
  sourceDocument?: SourceDocument;
  durationMinutes?: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type SlideSetStatus = 'DRAFT' | 'PROCESSING' | 'READY' | 'PUBLISHED' | 'ARCHIVED';

export interface SlideSet {
  id: string;
  courseId: string;
  lessonId: string;
  name: string;
  totalSlides: number;
  status: SlideSetStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SlideItem {
  id: string;
  courseId?: string;
  lessonId: string;
  slideSetId?: string;
  order: number;
  slideOrder?: number;
  title?: string;
  fileName?: string;
  imageUrl: string;
  secureUrl?: string;
  storagePath?: string;
  cloudinaryPublicId?: string;
  cloudinaryUrl?: string;
  assetFolder?: string;
  storageProvider?: StorageProviderType;
  mimeType?: string;
  bytes?: number;
  notes?: string;
  width: number;
  height: number;
  version: number;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SourceDocument {
  id: string;
  documentCode?: string; // Mã khóa tài liệu đính kèm
  lessonId: string;
  name: string;
  fileName?: string;
  originalName?: string;
  type: 'doc' | 'docx' | 'pdf';
  mimeType?: string;
  size: number; // bytes
  fileSize?: number;
  sizeMb?: number;
  pageCount?: number;
  url: string;
  cloudinaryUrl?: string;
  secureUrl?: string;
  cloudinaryPublicId?: string;
  assetFolder?: string;
  cloudinaryFolder?: string;
  resourceType?: string;
  format?: string;
  storagePath?: string;
  storageProvider?: StorageProviderType;
  status: 'uploaded' | 'parsed' | 'published' | 'PROCESSING' | 'READY' | 'ERROR';
  publishedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface LessonSection {
  id: string;
  lessonId: string;
  title: string; // e.g., "PHẦN I: NHẬN THỨC VỀ NHIỆM VỤ GDCT VÀ XÂY DỰNG ĐƠN VỊ"
  order: number;
  description?: string;
  sourceDocumentId?: string;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LessonItem {
  id: string;
  lessonId: string;
  sectionId: string; // Refers to LessonSection.id
  title: string; // e.g., "Mục 1.1. Vị trí, vai trò của công tác Giáo dục chính trị"
  content?: string;
  bodyHtml: string;
  order: number;
  sourceDocumentId?: string;
  sourcePageStart?: number;
  sourcePageEnd?: number;
  paragraphs?: string[];
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type QuestionType = 'single_choice' | 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';

export interface LessonQuestion {
  id: string;
  lessonId: string;
  sectionId?: string;
  itemId?: string; // Refers to LessonItem.id
  type: QuestionType;
  question: string;
  options?: string[]; // Select options for single/multiple choice
  correctAnswer?: number | number[] | boolean | string; // Index, Array of Indices, Boolean, or String
  explanation?: string;
  points?: number;
  maxScore?: number;
  required?: boolean;
  sourceDocumentId?: string;
  order: number;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserItemProgress {
  id?: string;
  userId: string;
  userName?: string;
  unitId?: string;
  unitName?: string;
  courseId: string;
  lessonId: string;
  sectionId: string;
  itemId: string;
  completed: boolean;
  score?: number;
  attempts: number;
  lastAccessedAt: string;
  completedAt?: string;
}

export interface UserSectionProgress {
  id?: string;
  userId: string;
  userName?: string;
  unitId?: string;
  unitName?: string;
  courseId?: string;
  lessonId: string;
  sectionId: string;
  contentCompleted: boolean;
  essaySubmitted: boolean;
  essayAnswer?: string;
  answerStatus?: 'submitted' | 'graded' | 'pending_review';
  score?: number;
  completed: boolean;
  startedAt: string;
  submittedAt?: string;
  completedAt?: string;
  updatedAt: string;
}

export interface QuoteQuiz {
  enabled: boolean;
  question: string; // Câu hỏi trắc nghiệm liên hệ / khắc sâu lời dạy Bác Hồ
  options: string[]; // Các phương án lựa chọn (A, B, C, D)
  correctOptionIndex: number; // Chỉ số phương án đúng (0, 1, 2, 3)
  explanation: string; // Giải thích ý nghĩa, định hướng nhận thức và bài học hành động thực tiễn
  quoteHistoricalContext?: string; // Bối cảnh lịch sử ra đời lời dạy của Bác
  rewardProgressPercent?: number; // % Tiến độ hoàn thành phần học khi chọn đúng
}

export interface ContentSection {
  id: string;
  lessonId: string;
  order: number;
  title: string; // ví dụ: "1. Lời Bác Hồ dạy cán bộ, chiến sĩ Hải quân", "2. Mục đích, yêu cầu"
  bodyHtml: string;
  keyPoints?: string[];
  quote?: string; // Nội dung trích dẫn / Lời dạy của Bác Hồ
  quoteAuthor?: string; // "Chủ tịch Hồ Chí Minh", "Lời Bác căn dặn Quân chủng Hải quân"
  quoteHistoricalContext?: string; // Hoàn cảnh lịch sử / Bối cảnh Bác Hồ căn dặn
  isUncleHoTeaching?: boolean; // Đánh dấu Lời dạy của Bác Hồ là nội dung trọng tâm của phần này
  quoteQuiz?: QuoteQuiz; // Câu hỏi trắc nghiệm tương tác để chọn lựa và tính tiến độ học tập từng phần
  version: number;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VideoItem {
  id: string;
  lessonId: string;
  title: string;
  description?: string;
  thumbnail?: string;
  videoUrl: string;
  storagePath?: string;
  cloudinaryPublicId?: string;
  cloudinaryUrl?: string;
  assetFolder?: string;
  mimeType?: string;
  format?: string;
  fileSize?: number;
  resourceType?: string;
  durationSeconds: number;
  order: number;
  fileSizeMb?: number;
  version: number;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AudioItem {
  id: string;
  lessonId: string;
  title: string;
  description?: string;
  audioUrl: string;
  storagePath?: string;
  cloudinaryPublicId?: string;
  cloudinaryUrl?: string;
  assetFolder?: string;
  mimeType?: string;
  format?: string;
  fileSize?: number;
  resourceType?: string;
  durationSeconds: number;
  order: number;
  fileSizeMb?: number;
  version: number;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProgress {
  id: string;
  userId: string;
  userName: string;
  unitId: string;
  unitName: string;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  slideProgress: number; // 0 - 100%
  videoProgress: number; // 0 - 100%
  audioProgress: number; // 0 - 100%
  contentProgress: number; // 0 - 100%
  overallProgress: number; // 0 - 100%
  completed: boolean;
  lastAccessedAt: string;
  completedAt?: string;
  version?: number;
}

export interface SystemNotification {
  id: string;
  title: string;
  content: string;
  type: 'DIRECTIVE' | 'ANNOUNCEMENT' | 'STUDY_REMINDER' | 'SYSTEM';
  priority: 'HIGH' | 'NORMAL' | 'URGENT';
  targetUnitId?: string; // 'ALL' or specific unitId
  sentBy: string;
  createdAt: string;
}

export type StorageCategory = 
  | 'courses' 
  | 'lessons' 
  | 'slides' 
  | 'videos' 
  | 'audios' 
  | 'documents' 
  | 'thumbnails';

export type StorageProviderType = 'cloudinary' | 'firebase';

export interface MediaUploadOptions {
  category: StorageCategory;
  courseId?: string;
  lessonId?: string;
  filename?: string;
  title?: string;
  resourceType?: 'image' | 'video' | 'raw' | 'auto';
  folderPath?: string;
  assetFolder?: string;
  uploadedBy?: string;
}

export interface MediaUploadResult {
  id: string;
  storageProvider: StorageProviderType;
  publicId: string;
  secureUrl: string;
  fileUrl: string;
  fileName: string;
  assetFolder?: string;
  mimeType: string;
  size: number;
  bytes?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  version: number;
  format?: string;
  resourceType?: string;
  checksum?: string;
  createdAt: string;
}

export interface FirestoreMediaMetadata {
  id: string;
  courseId?: string;
  lessonId?: string;
  type: 'image' | 'slide' | 'video' | 'audio' | 'document' | 'thumbnail';
  title: string;
  storageProvider: StorageProviderType;
  cloudinaryPublicId?: string;
  cloudinaryResourceType?: 'image' | 'video' | 'raw' | 'auto';
  cloudinaryFormat?: string;
  assetFolder?: string;
  fileUrl: string;
  secureUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbnailUrl?: string;
  version: number;
  checksum?: string;
  createdAt: string;
  updatedAt: string;
  uploadedBy?: string;
  status: 'published' | 'draft' | 'archived';
}

export interface MediaStorageProvider {
  uploadFile(file: File | Blob, options: MediaUploadOptions): Promise<MediaUploadResult>;
  deleteFile(publicIdOrPath: string, resourceType?: string): Promise<boolean>;
  replaceFile(publicIdOrPath: string, newFile: File | Blob, options: MediaUploadOptions): Promise<MediaUploadResult>;
  getFileUrl(publicIdOrPath: string, options?: any): string;
  getFileMetadata?(publicIdOrPath: string): Promise<any>;
  fileExists?(publicIdOrPath: string): Promise<boolean>;
  checkHealth(): Promise<{ status: 'CONNECTED' | 'FAILED' | 'NOT_CONFIGURED'; details: string; usage?: any }>;
}

export interface StorageFileMetadata {
  id: string;
  category: StorageCategory;
  entityId: string;
  storagePath: string; // e.g. "slides/lesson-1-1/slide_v1_1.jpg"
  downloadUrl: string;
  secureUrl?: string;
  cloudinaryPublicId?: string;
  storageProvider?: StorageProviderType;
  version: number;
  originalName: string;
  filename?: string;
  sizeBytes: number;
  sizeMb?: number;
  mimeType: string;
  uploadedBy?: string;
  isDeleted?: boolean;
  createdAt: string;
  updatedAt: string;
}


export interface RealtimeEvent {
  type: 
    | 'COURSE_UPDATED' 
    | 'LESSON_UPDATED' 
    | 'SLIDE_CHANGED' 
    | 'CONTENT_CHANGED' 
    | 'MEDIA_CHANGED' 
    | 'PROGRESS_UPDATED' 
    | 'NOTIFICATION_SENT' 
    | 'MODULE_CONFIG_CHANGED'
    | 'STORAGE_FILE_UPDATED'
    | 'SYNC_EVENT';
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'PUBLISH' | 'RESTORE';
  timestamp: string;
  data?: any;
}

export interface DashboardStats {
  totalCourses: number;
  totalLessons: number;
  publishedLessons: number;
  draftLessons: number;
  reviewLessons: number;
  totalUsers: number;
  totalUnits: number;
  totalStudySessions: number;
  completedLearners: number;
  inProgressLearners: number;
  averageCompletionRate: number;
  storageStats: {
    totalFiles: number;
    totalSizeMb: number;
    slidesCount: number;
    videosCount: number;
    audiosCount: number;
    documentsCount: number;
  };
  recentActivities: {
    id: string;
    action: string;
    target: string;
    user: string;
    time: string;
  }[];
}

// Pagination & Query Interfaces
export interface PaginationMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

// Incremental Synchronization (Android Room & Web Delta Sync)
export interface SyncDelta {
  syncTimestamp: string;
  requestedAfter?: string;
  clientVersion?: number;
  delta: {
    courses: Course[];
    lessons: Lesson[];
    slides: SlideItem[];
    contents: ContentSection[];
    videos: VideoItem[];
    audios: AudioItem[];
    notifications: SystemNotification[];
    deletedIds: {
      courses: string[];
      lessons: string[];
      slides: string[];
      contents: string[];
      videos: string[];
      audios: string[];
    };
  };
}

// Offline Manifest File definition for Android WorkManager download & SHA-256 verification
export interface OfflineManifestFile {
  id: string;
  name: string;
  type: 'SLIDE_IMAGE' | 'VIDEO_STREAM' | 'AUDIO_STREAM' | 'DOCUMENT_PPTX' | 'METADATA_JSON';
  category: StorageCategory;
  downloadUrl: string;
  storagePath: string;
  sizeBytes: number;
  sizeMb: number;
  checksum: string; // SHA-256 Checksum
  version: number;
  isMandatory: boolean;
}

// Complete Offline Android Lesson Package
export interface OfflinePackage {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  version: number;
  packageVersion: number;
  packageStatus: 'READY' | 'PROCESSING' | 'ERROR';
  packageChecksum: string;
  totalSizeBytes: number;
  totalSizeMb: number;
  fileCount: number;
  generatedAt: string;
  lesson: Lesson;
  course?: Course;
  slides: (SlideItem & { checksum?: string; fileSize?: number })[];
  contents: ContentSection[];
  videos: (VideoItem & { checksum?: string; fileSizeBytes?: number })[];
  audios: (AudioItem & { checksum?: string; fileSizeBytes?: number })[];
  manifestFiles: OfflineManifestFile[];
}

export interface LessonVersionInfo {
  lessonId: string;
  version: number;
  packageVersion: number;
  packageChecksum: string;
  packageStatus: 'READY' | 'PROCESSING' | 'ERROR';
  totalSizeBytes: number;
  totalSizeMb: number;
  fileCount: number;
  status: PublishStatus;
  updatedAt: string;
}

// Complete Offline Android Lesson Bundle (backwards-compatible alias)
export interface LessonBundle extends OfflinePackage {}

// Offline Progress Item for local Room database simulation & sync queue
export interface OfflineProgressItem {
  id?: string;
  userId: string;
  userName?: string;
  unitId?: string;
  unitName?: string;
  lessonId: string;
  lessonTitle?: string;
  courseId?: string;
  slideProgress: number; // 0 - 100%
  videoProgress: number; // 0 - 100%
  audioProgress: number; // 0 - 100%
  contentProgress: number; // 0 - 100%
  overallProgress: number; // 0 - 100%
  videoPositionSeconds?: number;
  audioPositionSeconds?: number;
  completed: boolean;
  lastAccessedAt: string;
  completedAt?: string;
  version?: number;
  isDirty?: boolean; // Pending sync
  syncStatus?: 'SYNCED' | 'PENDING' | 'SYNCING' | 'ERROR';
}

// Offline Cached Lesson in Android Device storage simulation
export interface AndroidCachedLesson {
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  version: number;
  packageChecksum: string;
  totalSizeBytes: number;
  totalSizeMb: number;
  downloadStatus: 'NOT_DOWNLOADED' | 'DOWNLOADING' | 'AVAILABLE_OFFLINE' | 'UPDATE_AVAILABLE' | 'ERROR';
  downloadProgress: number; // 0 - 100%
  downloadStep?: string;
  keepOffline: boolean; // Protect from auto-cache eviction
  downloadedAt?: string;
  lastUsedAt: string;
  offlineProgress: OfflineProgressItem;
  offlinePackage?: OfflinePackage;
}

// On-Demand Offline Module Selection options
export interface OfflineModuleSelection {
  content: boolean;
  slides: boolean;
  videos: boolean;
  audios: boolean;
}

// Detailed Size Breakdown per Lesson
export interface LessonSizeBreakdown {
  contentSizeMb: number;
  contentCount: number;
  slideSizeMb: number;
  slideCount: number;
  videoSizeMb: number;
  videoCount: number;
  audioSizeMb: number;
  audioCount: number;
  totalSizeMb: number;
}

// Dedicated Record for Android Room Persistent Storage (OFFLINE STORAGE vs TEMP CACHE)
export interface AndroidOfflinePackageRecord {
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  courseTitle: string;
  localVersion: number;
  serverVersion: number;
  contentVersion: number;
  mediaVersion: number;
  status: 'ONLINE_ONLY' | 'DOWNLOADING' | 'OFFLINE_READY' | 'UPDATE_AVAILABLE' | 'ERROR';
  downloadProgress: number; // 0 - 100%
  downloadStep?: string;
  downloadedAt?: string;
  lastUsedAt: string;
  selectedModules: OfflineModuleSelection;
  sizeBreakdown: {
    contentSizeMb: number;
    slideSizeMb: number;
    videoSizeMb: number;
    audioSizeMb: number;
    totalSizeMb: number;
  };
  packageChecksum: string;
  offlinePackage?: OfflinePackage;
  stagingPackage?: OfflinePackage; // Safe staging for atomic version updates
  errorMessage?: string;
}


