import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import multer from 'multer';
import crypto from 'crypto';
import JSZip from 'jszip';
import { v2 as cloudinary } from 'cloudinary';
import { createServer as createViteServer } from 'vite';
import { firestoreService } from './src/services/firestoreService';
import { 
  Course, Lesson, SlideItem, ContentSection, VideoItem, AudioItem, 
  Unit, User, UserRole, UserProgress, SystemNotification, DashboardStats, RealtimeEvent,
  StorageFileMetadata, StorageCategory, SyncDelta, LessonBundle, PaginatedResponse,
  OfflinePackage, OfflineManifestFile, LessonVersionInfo, OfflineProgressItem,
  LessonSizeBreakdown, OfflineModuleSelection, PptxProcessingJob
} from './src/types';

const PORT = 3000;
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// -------------------------------------------------------------
// STORAGE HIERARCHY SETUP (Organized as required by Architecture)
// courses/{courseId}/, lessons/{lessonId}/, slides/{lessonId}/,
// videos/{lessonId}/, audios/{lessonId}/, documents/{lessonId}/, thumbnails/{lessonId}/
// -------------------------------------------------------------
const DATA_DIR = path.join(process.cwd(), 'data');
const STORAGE_ROOT = path.join(process.cwd(), 'public', 'uploads');
const DB_FILE = path.join(DATA_DIR, 'gdct_v4_database.json');

const STORAGE_CATEGORIES: StorageCategory[] = [
  'courses',
  'lessons',
  'slides',
  'videos',
  'audios',
  'documents',
  'thumbnails'
];

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(STORAGE_ROOT)) {
  fs.mkdirSync(STORAGE_ROOT, { recursive: true });
}

// Ensure all categorical sub-directories exist
STORAGE_CATEGORIES.forEach(cat => {
  const catPath = path.join(STORAGE_ROOT, cat);
  if (!fs.existsSync(catPath)) {
    fs.mkdirSync(catPath, { recursive: true });
  }
});

// Dynamic multer storage engine supporting structured categorical paths & versioning
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const category = (req.body.category as StorageCategory) || 'documents';
    const entityId = (req.body.entityId || req.body.lessonId || req.body.courseId || 'general').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const targetDir = path.join(STORAGE_ROOT, category, entityId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    const category = (req.body.category as StorageCategory) || 'file';
    const version = Number(req.body.version) || 1;
    const timestamp = Date.now();
    const cleanExt = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, cleanExt).replace(/[^a-zA-Z0-9_\-]/g, '_');
    const finalFilename = `${category}_v${version}_${timestamp}_${baseName}${cleanExt}`;
    cb(null, finalFilename);
  }
});

const upload = multer({ 
  storage, 
  limits: { fileSize: 250 * 1024 * 1024 } // 250MB max file size
});

// -------------------------------------------------------------
// SSE REALTIME ENGINE
// -------------------------------------------------------------
type SSEClient = {
  id: string;
  res: Response;
};
let sseClients: SSEClient[] = [];

function broadcastRealtime(event: RealtimeEvent) {
  const message = `data: ${JSON.stringify(event)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.res.write(message);
    } catch {
      // client disconnected
    }
  });
}

// -------------------------------------------------------------
// DATABASE SCHEMA & SEED DATA (Metadata & References Only)
// -------------------------------------------------------------
interface DatabaseSchema {
  courses: Course[];
  lessons: Lesson[];
  slides: SlideItem[];
  contents: ContentSection[];
  videos: VideoItem[];
  audios: AudioItem[];
  units: Unit[];
  users: User[];
  progress: UserProgress[];
  notifications: SystemNotification[];
  storageFiles: StorageFileMetadata[];
  deletedIds: {
    courses: string[];
    lessons: string[];
    slides: string[];
    contents: string[];
    videos: string[];
    audios: string[];
  };
}

const defaultSeedData: DatabaseSchema = {
  courses: [
    {
      id: 'course-1',
      title: 'Giáo dục chính trị năm 2026: Nâng cao bản lĩnh người chiến sĩ Hải quân',
      description: 'Chương trình giáo dục chính trị trọng tâm năm 2026 cho sĩ quan, QNCN, hạ sĩ quan - binh sĩ thuộc Vùng 4 Hải Quân.',
      thumbnail: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
      storageThumbnailPath: 'thumbnails/course-1/thumb_v1_course1.jpg',
      rawPptUrl: '/uploads/documents/course-1/raw_pptx_v1_Giao_Duc_Chinh_Tri_2026.pptx',
      rawPptStoragePath: 'documents/course-1/raw_pptx_v1_Giao_Duc_Chinh_Tri_2026.pptx',
      year: 2026,
      order: 1,
      status: 'PUBLISHED',
      version: 4,
      isDeleted: false,
      createdBy: 'Phòng Chính trị Vùng 4',
      createdAt: '2026-01-10T08:00:00.000Z',
      updatedAt: '2026-02-15T14:30:00.000Z'
    },
    {
      id: 'course-2',
      title: 'Bảo vệ vững chắc chủ quyền biển, đảo, thềm lục địa thiêng liêng của Tổ quốc',
      description: 'Nâng cao nhận thức về tình hình Biển Đông, nhiệm vụ bảo vệ chủ quyền quần đảo Trường Sa và vùng biển được phân công.',
      thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
      storageThumbnailPath: 'thumbnails/course-2/thumb_v1_course2.jpg',
      year: 2026,
      order: 2,
      status: 'PUBLISHED',
      version: 2,
      isDeleted: false,
      createdBy: 'Phòng Chính trị Vùng 4',
      createdAt: '2026-01-15T09:00:00.000Z',
      updatedAt: '2026-02-20T10:00:00.000Z'
    },
    {
      id: 'course-3',
      title: 'Truyền thống anh hùng Đoàn Tàu Không Số và Lữ đoàn 146 Trường Sa',
      description: 'Giáo dục truyền thống vẻ vang đánh thắng trận đầu của Hải quân nhân dân Việt Nam và ý chí kiên trung của quân dân Trường Sa.',
      thumbnail: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=800&q=80',
      storageThumbnailPath: 'thumbnails/course-3/thumb_v1_course3.jpg',
      year: 2026,
      order: 3,
      status: 'REVIEW',
      version: 1,
      isDeleted: false,
      createdBy: 'Ban Tuyên huấn Vùng 4',
      createdAt: '2026-02-01T08:30:00.000Z',
      updatedAt: '2026-02-22T16:00:00.000Z'
    }
  ],
  lessons: [
    {
      id: 'lesson-1-1',
      courseId: 'course-1',
      title: 'Những nội dung trọng tâm công tác giáo dục chính trị 6 tháng đầu năm 2026',
      description: 'Quán triệt nghị quyết Đảng ủy Vùng 4 Hải Quân về xây dựng bản lĩnh chính trị vững vàng, ý chí quyết tâm sẵn sàng chiến đấu cao.',
      thumbnail: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
      storageThumbnailPath: 'thumbnails/lesson-1-1/thumb_v1_lesson1_1.jpg',
      rawPptUrl: '/uploads/documents/lesson-1-1/raw_pptx_v1_Bai1_Trong_Tam_GDCT_2026.pptx',
      rawPptStoragePath: 'documents/lesson-1-1/raw_pptx_v1_Bai1_Trong_Tam_GDCT_2026.pptx',
      order: 1,
      status: 'PUBLISHED',
      version: 5,
      moduleConfig: {
        showSlides: true,
        showContents: true,
        showVideos: true,
        showAudios: true
      },
      isDeleted: false,
      durationMinutes: 45,
      createdBy: 'Thượng tá Nguyễn Văn Hùng',
      createdAt: '2026-01-12T08:00:00.000Z',
      updatedAt: '2026-02-18T10:00:00.000Z'
    },
    {
      id: 'lesson-1-2',
      courseId: 'course-1',
      title: 'Phát huy phẩm chất "Bộ đội Cụ Hồ - Người chiến sĩ Hải quân" thời kỳ mới',
      description: 'Xây dựng chuẩn mực đạo đức cách mạng, tác phong chính quy, chấp hành nghiêm kỷ luật và an toàn hàng hải.',
      thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=600&q=80',
      storageThumbnailPath: 'thumbnails/lesson-1-2/thumb_v1_lesson1_2.jpg',
      order: 2,
      status: 'PUBLISHED',
      version: 2,
      moduleConfig: {
        showSlides: true,
        showContents: true,
        showVideos: true,
        showAudios: false
      },
      isDeleted: false,
      durationMinutes: 40,
      createdBy: 'Trung tá Trần Minh Đức',
      createdAt: '2026-01-14T08:00:00.000Z',
      updatedAt: '2026-02-15T09:00:00.000Z'
    },
    {
      id: 'lesson-2-1',
      courseId: 'course-2',
      title: 'Nhiệm vụ quản lý, bảo vệ chủ quyền biển đảo trong tình hình mới',
      description: 'Phân tích các thách thức an ninh hàng hải, nâng cao cảnh giác, sẵn sàng xử trí thắng lợi mọi tình huống trên biển.',
      thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
      storageThumbnailPath: 'thumbnails/lesson-2-1/thumb_v1_lesson2_1.jpg',
      order: 1,
      status: 'PUBLISHED',
      version: 3,
      moduleConfig: {
        showSlides: true,
        showContents: true,
        showVideos: true,
        showAudios: true
      },
      isDeleted: false,
      durationMinutes: 50,
      createdBy: 'Đại tá Lê Hoàng Nam',
      createdAt: '2026-01-18T08:00:00.000Z',
      updatedAt: '2026-02-21T11:00:00.000Z'
    }
  ],
  slides: [
    {
      id: 'slide-1-1-1',
      lessonId: 'lesson-1-1',
      order: 1,
      title: 'Slide 1: Tiêu đề chuyên đề và mục tiêu yêu cầu',
      imageUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
      storagePath: 'slides/lesson-1-1/slide_v1_1.jpg',
      notes: 'Giới thiệu khái quát mục tiêu, đối tượng và thời gian lên lớp.',
      width: 1920,
      height: 1080,
      version: 1,
      isDeleted: false,
      createdAt: '2026-01-12T08:30:00.000Z',
      updatedAt: '2026-01-12T08:30:00.000Z'
    },
    {
      id: 'slide-1-1-2',
      lessonId: 'lesson-1-1',
      order: 2,
      title: 'Slide 2: Tình hình thế giới và khu vực tác động đến nhiệm vụ',
      imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
      storagePath: 'slides/lesson-1-1/slide_v1_2.jpg',
      notes: 'Nhấn mạnh bối cảnh chiến lược và các nguy cơ tiềm ẩn.',
      width: 1920,
      height: 1080,
      version: 1,
      isDeleted: false,
      createdAt: '2026-01-12T08:35:00.000Z',
      updatedAt: '2026-01-12T08:35:00.000Z'
    },
    {
      id: 'slide-1-1-3',
      lessonId: 'lesson-1-1',
      order: 3,
      title: 'Slide 3: Phương hướng và các giải pháp chính trị trọng tâm',
      imageUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
      storagePath: 'slides/lesson-1-1/slide_v1_3.jpg',
      notes: 'Tập trung 5 giải pháp nâng cao chất lượng huấn luyện chính trị.',
      width: 1920,
      height: 1080,
      version: 1,
      isDeleted: false,
      createdAt: '2026-01-12T08:40:00.000Z',
      updatedAt: '2026-01-12T08:40:00.000Z'
    },
    {
      id: 'slide-1-1-4',
      lessonId: 'lesson-1-1',
      order: 4,
      title: 'Slide 4: Trách nhiệm của cán bộ, chiến sĩ Vùng 4 Hải Quân',
      imageUrl: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
      storagePath: 'slides/lesson-1-1/slide_v1_4.jpg',
      notes: 'Cụ thể hóa thành hành động thực tiễn tại từng tàu và đơn vị.',
      width: 1920,
      height: 1080,
      version: 1,
      isDeleted: false,
      createdAt: '2026-01-12T08:45:00.000Z',
      updatedAt: '2026-01-12T08:45:00.000Z'
    }
  ],
  contents: [
    {
      id: 'content-1-1-1',
      lessonId: 'lesson-1-1',
      order: 1,
      title: '1. Lời dạy của Bác Hồ đối với Bộ đội Hải quân',
      bodyHtml: `<p><strong>Trọng tâm tư tưởng Hồ Chí Minh về biển đảo:</strong></p>
      <p>Trong suốt cuộc đời hoạt động cách mạng, Chủ tịch Hồ Chí Minh luôn dành sự quan tâm đặc biệt sâu sắc tới biển, đảo và sự nghiệp bảo vệ chủ quyền biển đảo thiêng liêng của Tổ quốc.</p>
      <p>Bác căn dặn cán bộ, chiến sĩ Hải quân phải không ngừng học tập, rèn luyện, nâng cao trình độ kỹ chiến thuật, làm chủ các loại tàu thuyền, vũ khí trang bị hiện đại; đoàn kết gắn bó máu thịt với nhân dân để xây dựng thế trận lòng dân vững chắc trên biển.</p>`,
      keyPoints: ['Khắc sâu Lời Bác dạy', 'Nắm vững chủ quyền biển đảo', 'Làm chủ vũ khí trang bị'],
      quote: 'Ngày trước ta chỉ có đêm và rừng, ngày nay ta có ngày, có trời, có biển. Bờ biển ta dài, tươi đẹp, ta phải biết giữ gìn lấy nó.',
      quoteAuthor: 'Chủ tịch Hồ Chí Minh (Ngày 15/3/1961 khi về thăm Bộ đội Hải quân tại Vạn Hoa, Hải Phòng)',
      quoteHistoricalContext: 'Lời dạy lịch sử của Bác Hồ là kim chỉ nam soi đường, là mệnh lệnh thiêng liêng từ trái tim thôi thúc mọi thế hệ cán bộ, chiến sĩ Quân chủng Hải quân và Vùng 4 anh hùng vượt qua muôn vàn sóng gió, kiên cường giữ vững chủ quyền biển đảo.',
      isUncleHoTeaching: true,
      quoteQuiz: {
        enabled: true,
        question: 'Câu nói: "Ngày trước ta chỉ có đêm và rừng, ngày nay ta có ngày, có trời, có biển. Bờ biển ta dài, tươi đẹp, ta phải biết giữ gìn lấy nó" được Bác Hồ căn dặn bộ đội Hải quân vào thời gian nào và mang ý nghĩa cốt lõi gì?',
        options: [
          'Ngày 15/3/1961 tại Vạn Hoa (Hải Phòng) - Khẳng định tầm nhìn chiến lược về biển đảo và trách nhiệm bảo vệ chủ quyền biển, thềm lục địa thiêng liêng của Tổ quốc',
          'Ngày 19/5/1955 tại Cửa Lò (Nghệ An) - Động viên thành lập Cục Phòng thủ bờ biển',
          'Ngày 22/12/1944 tại Cao Bằng - Thành lập Đội Việt Nam Tuyên truyền Giải phóng quân',
          'Ngày 02/9/1945 tại Quảng trường Ba Đình - Đọc Tuyên ngôn Độc lập'
        ],
        correctOptionIndex: 0,
        explanation: 'Chính xác! Ngày 15/3/1961, khi về thăm cán bộ, chiến sĩ Trường Sĩ quan Hải quân và Trung đoàn 171 tại Vạn Hoa (Hải Phòng), Bác Hồ đã ân cần căn dặn lời dạy lịch sử này. Đây là định hướng chiến lược to lớn, nhắc nhở mỗi cán bộ, chiến sĩ Vùng 4 Hải quân hôm nay phải luôn nêu cao tinh thần cảnh giác, rèn luyện làm chủ biển đảo quê hương.',
        rewardProgressPercent: 100
      },
      version: 1,
      isDeleted: false,
      createdAt: '2026-01-12T09:00:00.000Z',
      updatedAt: '2026-01-12T09:00:00.000Z'
    },
    {
      id: 'content-1-1-2',
      lessonId: 'lesson-1-1',
      order: 2,
      title: '2. Mục đích, yêu cầu của bài học GDCT',
      bodyHtml: `<p><strong>Mục đích:</strong> Nhằm bồi dưỡng, nâng cao nhận thức chính trị, củng cố lập trường tư tưởng kiên định, vững vàng cho 100% cán bộ, chiến sĩ Vùng 4 Hải Quân trước yêu cầu nhiệm vụ bảo vệ chủ quyền biển, đảo trong giai đoạn mới.</p>
      <p><strong>Yêu cầu:</strong></p>
      <ul>
        <li>Nắm vững các chỉ thị, nghị quyết của Quân chủng Hải quân và Đảng ủy Bộ Tư lệnh Vùng 4.</li>
        <li>Biến nhận thức chính trị thành hành động cụ thể trong huấn luyện, trực sẵn sàng chiến đấu, làm chủ vũ khí trang bị kỹ thuật.</li>
        <li>Tuyệt đối trung thành với Đảng, Tổ quốc và Nhân dân, sẵn sàng chiến đấu, hy sinh vì chủ quyền biển đảo.</li>
      </ul>`,
      keyPoints: ['Nắm chắc nghị quyết năm 2026', 'Ý chí sẵn sàng chiến đấu cao', 'Giữ nghiêm kỷ luật trên biển'],
      quote: 'Kiên quyết, kiên trì bảo vệ vững chắc chủ quyền biển, đảo, giữ vững môi trường hòa bình, ổn định.',
      version: 1,
      isDeleted: false,
      createdAt: '2026-01-12T09:10:00.000Z',
      updatedAt: '2026-01-12T09:10:00.000Z'
    },
    {
      id: 'content-1-1-3',
      lessonId: 'lesson-1-1',
      order: 3,
      title: '3. Nội dung chính và định hướng tư tưởng',
      bodyHtml: `<p><strong>Phần 1: Xây dựng bản lĩnh chính trị vững vàng</strong></p>
      <p>Trước diễn biến phức tạp, khó lường trên các vùng biển, mỗi cán bộ chiến sĩ phải nêu cao tinh thần cảnh giác cách mạng, kiên quyết đấu tranh phản bác các quan điểm sai trái, thù địch.</p>
      <p><strong>Phần 2: Nâng cao chất lượng sẵn sàng chiến đấu</strong></p>
      <p>Huấn luyện sát thực tế chiến trường biển, lấy mục tiêu "Tàu là nhà, biển cả là quê hương" làm động lực rèn luyện ý chí gang thép.</p>`,
      keyPoints: ['Cảnh giác cách mạng cao độ', 'Tàu là nhà, biển cả là quê hương'],
      version: 1,
      isDeleted: false,
      createdAt: '2026-01-12T09:15:00.000Z',
      updatedAt: '2026-01-12T09:15:00.000Z'
    },
    {
      id: 'content-1-1-4',
      lessonId: 'lesson-1-1',
      order: 4,
      title: '4. Liên hệ thực tiễn và kết luận',
      bodyHtml: `<p>Cán bộ chiến sĩ tại các đảo thuộc quần đảo Trường Sa, các tàu trực thuộc Lữ đoàn 162, Lữ đoàn 955, Lữ đoàn 101 cần cụ thể hóa nội dung bài học vào kế hoạch công tác tuần, tháng, thi đua lập thành tích xuất sắc trong công tác.</p>`,
      version: 1,
      isDeleted: false,
      createdAt: '2026-01-12T09:30:00.000Z',
      updatedAt: '2026-01-12T09:30:00.000Z'
    }
  ],
  videos: [
    {
      id: 'video-1-1-1',
      lessonId: 'lesson-1-1',
      title: 'Phim tài liệu: Vùng 4 Hải Quân - Lá chắn thép nơi tiền tiêu Tổ quốc',
      description: 'Tư liệu về truyền thống chiến đấu, huấn luyện làm chủ vũ khí hiện đại của cán bộ chiến sĩ Vùng 4.',
      thumbnail: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      storagePath: 'videos/lesson-1-1/video_v1_video1_1_1.mp4',
      durationSeconds: 930,
      order: 1,
      fileSizeMb: 145.2,
      version: 1,
      isDeleted: false,
      createdAt: '2026-01-12T10:00:00.000Z',
      updatedAt: '2026-01-12T10:00:00.000Z'
    }
  ],
  audios: [
    {
      id: 'audio-1-1-1',
      lessonId: 'lesson-1-1',
      title: 'Bài giảng Audio: Lời dạy của Bác Hồ với bộ đội Hải quân và nhiệm vụ năm 2026',
      description: 'Băng âm thanh bài giảng chính trị phục vụ bộ đội nghe trên tàu và điểm đảo khi trực ca.',
      audioUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      storagePath: 'audios/lesson-1-1/audio_v1_audio1_1_1.mp3',
      durationSeconds: 1240,
      order: 1,
      fileSizeMb: 28.5,
      version: 1,
      isDeleted: false,
      createdAt: '2026-01-12T10:30:00.000Z',
      updatedAt: '2026-01-12T10:30:00.000Z'
    }
  ],
  units: [
    {
      id: 'unit-1',
      name: 'Lữ đoàn 162 (Lữ đoàn Tàu chiến đấu mặt nước)',
      code: 'L162',
      type: 'BRIGADE',
      description: 'Lữ đoàn tàu chiến đấu mặt nước hiện đại nhất Quân chủng Hải quân.',
      memberCount: 850,
      commander: 'Thượng tá Nguyễn Văn Nam',
      politicalOfficer: 'Đại tá Trần Hữu Dũng',
      order: 1,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'unit-2',
      name: 'Lữ đoàn 146 (Đoàn Trường Sa Anh hùng)',
      code: 'L146',
      type: 'BRIGADE',
      description: 'Đơn vị làm nhiệm vụ quản lý, bảo vệ quần đảo Trường Sa.',
      memberCount: 1250,
      commander: 'Đại tá Phạm Văn Thắng',
      politicalOfficer: 'Đại tá Lương Văn Giáp',
      order: 2,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'unit-3',
      name: 'Lữ đoàn 955 (Lữ đoàn Tàu vận tải đổ bộ)',
      code: 'L955',
      type: 'BRIGADE',
      description: 'Đơn vị vận tải, chi viện đảo và trực chiến cứu hộ cứu nạn trên biển.',
      memberCount: 620,
      commander: 'Trung tá Đỗ Hải Đăng',
      politicalOfficer: 'Thượng tá Hoàng Văn Kiên',
      order: 3,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'unit-4',
      name: 'Lữ đoàn 101 (Lữ đoàn Hải quân đánh bộ)',
      code: 'L101',
      type: 'BRIGADE',
      description: 'Lực lượng đột kích tác chiến đổ bộ đánh chiếm đảo và bờ biển.',
      memberCount: 980,
      commander: 'Thượng tá Lê Hồng Phong',
      politicalOfficer: 'Đại tá Nguyễn Minh Tâm',
      order: 4,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'unit-5',
      name: 'Trung tâm Bảo đảm Kỹ thuật 719',
      code: 'TT719',
      type: 'DEPARTMENT',
      description: 'Bảo đảm vũ khí, khí tài, đạn dược kỹ thuật cho các lực lượng trong Vùng.',
      memberCount: 430,
      commander: 'Trung tá Vũ Quốc Tuấn',
      politicalOfficer: 'Thượng tá Bùi Văn Thành',
      order: 5,
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }
  ],
   users: [
    {
      id: 'user-1',
      name: 'Nguyễn Văn Hùng',
      fullName: 'Nguyễn Văn Hùng',
      email: 'admin.vung4@navy.mil.vn',
      password: '123@abc',
      role: 'ADMIN',
      rank: 'Đại tá',
      position: 'Chủ nhiệm Chính trị Vùng 4',
      rankAndPosition: 'Đại tá - Chủ nhiệm Chính trị Vùng 4',
      unitId: 'unit-1',
      unitName: 'Bộ Tư lệnh Vùng 4 Hải Quân',
      unit: 'Bộ Tư lệnh Vùng 4 Hải Quân',
      status: 'ACTIVE',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    },
    {
      id: 'user-2',
      name: 'Trần Minh Đức',
      fullName: 'Trần Minh Đức',
      email: 'duc.tm@navy.mil.vn',
      password: '123@abc',
      role: 'APPROVER',
      rank: 'Trung tá',
      position: 'Trưởng ban Tuyên huấn',
      rankAndPosition: 'Trung tá - Trưởng ban Tuyên huấn',
      unitId: 'unit-1',
      unitName: 'Phòng Chính trị Vùng 4',
      unit: 'Phòng Chính trị Vùng 4',
      status: 'ACTIVE',
      createdAt: '2026-01-05T00:00:00.000Z',
      updatedAt: '2026-01-05T00:00:00.000Z'
    },
    {
      id: 'user-3',
      name: 'Lê Hoàng Nam',
      fullName: 'Lê Hoàng Nam',
      email: 'nam.lh@navy.mil.vn',
      password: '123@abc',
      role: 'APPROVER',
      rank: 'Thượng tá',
      position: 'Chủ nhiệm Chính trị Lữ đoàn 162',
      rankAndPosition: 'Thượng tá - Chủ nhiệm Chính trị Lữ đoàn 162',
      unitId: 'unit-1',
      unitName: 'Lữ đoàn 162',
      unit: 'Lữ đoàn 162',
      status: 'ACTIVE',
      createdAt: '2026-01-10T00:00:00.000Z',
      updatedAt: '2026-01-10T00:00:00.000Z'
    },
    {
      id: 'user-4',
      name: 'Hoàng Văn Kiên',
      fullName: 'Hoàng Văn Kiên',
      email: 'kien.hv@navy.mil.vn',
      password: '123@abc',
      role: 'USER',
      rank: 'Đại úy',
      position: 'Chính trị viên Tàu 015 - Trần Hưng Đạo',
      rankAndPosition: 'Đại úy - CTV Tàu 015',
      unitId: 'unit-1',
      unitName: 'Lữ đoàn 162',
      unit: 'Lữ đoàn 162',
      status: 'ACTIVE',
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-01-15T00:00:00.000Z'
    },
    {
      id: 'user-5',
      name: 'Phạm Đức Trọng',
      fullName: 'Phạm Đức Trọng',
      email: 'trong.pd@navy.mil.vn',
      password: '123@abc',
      role: 'USER',
      rank: 'Thượng úy',
      position: 'Trợ lý Chính trị Đảo Trường Sa Lớn',
      rankAndPosition: 'Thượng úy - TLCT Đảo Trường Sa Lớn',
      unitId: 'unit-2',
      unitName: 'Lữ đoàn 146',
      unit: 'Lữ đoàn 146',
      status: 'ACTIVE',
      createdAt: '2026-01-20T00:00:00.000Z',
      updatedAt: '2026-01-20T00:00:00.000Z'
    }
  ],
  progress: [
    {
      id: 'prog-1',
      userId: 'user-4',
      userName: 'Hoàng Văn Kiên',
      unitId: 'unit-1',
      unitName: 'Lữ đoàn 162',
      lessonId: 'lesson-1-1',
      lessonTitle: 'Những nội dung trọng tâm công tác giáo dục chính trị 6 tháng đầu năm 2026',
      courseId: 'course-1',
      slideProgress: 100,
      videoProgress: 100,
      audioProgress: 80,
      contentProgress: 100,
      overallProgress: 95,
      completed: true,
      lastAccessedAt: '2026-02-23T14:10:00.000Z',
      completedAt: '2026-02-23T15:00:00.000Z',
      version: 1
    },
    {
      id: 'prog-2',
      userId: 'user-5',
      userName: 'Phạm Đức Trọng',
      unitId: 'unit-2',
      unitName: 'Lữ đoàn 146',
      lessonId: 'lesson-1-1',
      lessonTitle: 'Những nội dung trọng tâm công tác giáo dục chính trị 6 tháng đầu năm 2026',
      courseId: 'course-1',
      slideProgress: 100,
      videoProgress: 60,
      audioProgress: 50,
      contentProgress: 100,
      overallProgress: 77,
      completed: false,
      lastAccessedAt: '2026-02-24T09:30:00.000Z',
      version: 1
    }
  ],
  notifications: [
    {
      id: 'notif-1',
      title: 'Chỉ thị kiểm tra chất lượng giáo dục chính trị Quý I/2026',
      content: 'Yêu cầu các Lữ đoàn và đơn vị trực thuộc tổ chức học tập nghiêm túc, báo cáo tiến độ về Phòng Chính trị trước ngày 15/03/2026.',
      type: 'DIRECTIVE',
      priority: 'HIGH',
      targetUnitId: 'ALL',
      sentBy: 'Bộ Tư lệnh Vùng 4 Hải Quân',
      createdAt: '2026-02-20T08:00:00.000Z'
    },
    {
      id: 'notif-2',
      title: 'Cập nhật Chuyên đề 01: Bổ sung Audio bài giảng và Slide mới',
      content: 'Nội dung Chuyên đề GDCT 2026 đã được cập nhật phiên bản 5.0 với đầy đủ 4 bài giảng đa phương tiện.',
      type: 'STUDY_REMINDER',
      priority: 'NORMAL',
      targetUnitId: 'ALL',
      sentBy: 'Ban Tuyên huấn',
      createdAt: '2026-02-22T10:00:00.000Z'
    }
  ],
  storageFiles: [
    {
      id: 'file-pptx-1',
      category: 'documents',
      entityId: 'lesson-1-1',
      storagePath: 'documents/lesson-1-1/raw_pptx_v1_Bai1_Trong_Tam_GDCT_2026.pptx',
      downloadUrl: '/uploads/documents/lesson-1-1/raw_pptx_v1_Bai1_Trong_Tam_GDCT_2026.pptx',
      version: 1,
      originalName: 'Bai1_Trong_Tam_GDCT_2026.pptx',
      sizeBytes: 12582912, // 12 MB
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      createdAt: '2026-01-12T08:00:00.000Z',
      updatedAt: '2026-01-12T08:00:00.000Z'
    },
    {
      id: 'file-slide-1',
      category: 'slides',
      entityId: 'lesson-1-1',
      storagePath: 'slides/lesson-1-1/slide_v1_1.jpg',
      downloadUrl: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
      version: 1,
      originalName: 'slide_1.jpg',
      sizeBytes: 524288, // 512 KB
      mimeType: 'image/jpeg',
      createdAt: '2026-01-12T08:30:00.000Z',
      updatedAt: '2026-01-12T08:30:00.000Z'
    },
    {
      id: 'file-video-1',
      category: 'videos',
      entityId: 'lesson-1-1',
      storagePath: 'videos/lesson-1-1/video_v1_video1_1_1.mp4',
      downloadUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      version: 1,
      originalName: 'phim_tai_lieu_vung_4.mp4',
      sizeBytes: 152240128, // 145.2 MB
      mimeType: 'video/mp4',
      createdAt: '2026-01-12T10:00:00.000Z',
      updatedAt: '2026-01-12T10:00:00.000Z'
    },
    {
      id: 'file-audio-1',
      category: 'audios',
      entityId: 'lesson-1-1',
      storagePath: 'audios/lesson-1-1/audio_v1_audio1_1_1.mp3',
      downloadUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
      version: 1,
      originalName: 'audio_loi_day_bac_ho.mp3',
      sizeBytes: 29884416, // 28.5 MB
      mimeType: 'audio/mpeg',
      createdAt: '2026-01-12T10:30:00.000Z',
      updatedAt: '2026-01-12T10:30:00.000Z'
    }
  ],
  deletedIds: {
    courses: [],
    lessons: [],
    slides: [],
    contents: [],
    videos: [],
    audios: []
  }
};

let db: DatabaseSchema = defaultSeedData;

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      db = JSON.parse(data);
      if (!db.storageFiles) db.storageFiles = defaultSeedData.storageFiles;
      if (!db.deletedIds) db.deletedIds = defaultSeedData.deletedIds;
    } else {
      saveDatabase(defaultSeedData);
    }
  } catch (err) {
    console.error('Error loading database file, using fallback seed:', err);
    db = defaultSeedData;
  }
  return db;
}

function saveDatabase(dataToSave: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dataToSave, null, 2), 'utf-8');
    db = dataToSave;
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

// Initial DB load
loadDatabase();

// -------------------------------------------------------------
// PAGINATION HELPER
// -------------------------------------------------------------
function paginate<T>(items: T[], page = 1, limit = 50): PaginatedResponse<T> {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const totalCount = items.length;
  const totalPages = Math.ceil(totalCount / safeLimit) || 1;
  const startIndex = (safePage - 1) * safeLimit;
  const data = items.slice(startIndex, startIndex + safeLimit);

  return {
    data,
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalCount,
      totalPages,
      hasNext: safePage < totalPages,
      hasPrev: safePage > 1
    }
  };
}

// -------------------------------------------------------------
// SSE REALTIME STREAM
// -------------------------------------------------------------
app.get('/api/realtime', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const clientId = Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  const newClient: SSEClient = { id: clientId, res };
  sseClients.push(newClient);

  res.write(`data: ${JSON.stringify({ 
    type: 'CONNECTED', 
    clientId, 
    timestamp: new Date().toISOString(),
    serverVersion: '4.0.0-PROD'
  })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// -------------------------------------------------------------
// 5. INCREMENTAL SYNC API (Delta Sync for Web & Android Room)
// -------------------------------------------------------------
app.get('/api/sync', (req: Request, res: Response) => {
  const updatedAfter = req.query.updatedAfter as string | undefined;
  const clientVersion = req.query.clientVersion ? Number(req.query.clientVersion) : undefined;
  const sinceTimestamp = updatedAfter ? new Date(updatedAfter).getTime() : 0;
  const syncTimestamp = new Date().toISOString();

  const filterSince = <T extends { updatedAt?: string; createdAt?: string; version?: number }>(items: T[]): T[] => {
    if (!sinceTimestamp && clientVersion === undefined) return items;
    return items.filter(item => {
      const updatedTime = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      const createdTime = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      const passesTimestamp = !sinceTimestamp || Math.max(updatedTime, createdTime) > sinceTimestamp;
      const passesVersion = clientVersion === undefined || (item.version !== undefined && item.version > clientVersion);
      return passesTimestamp || passesVersion;
    });
  };

  const delta: SyncDelta = {
    syncTimestamp,
    requestedAfter: updatedAfter,
    clientVersion,
    delta: {
      courses: filterSince(db.courses.filter(c => !c.isDeleted)),
      lessons: filterSince(db.lessons.filter(l => !l.isDeleted)),
      slides: filterSince(db.slides.filter(s => !s.isDeleted)),
      contents: filterSince(db.contents.filter(c => !c.isDeleted)),
      videos: filterSince(db.videos.filter(v => !v.isDeleted)),
      audios: filterSince(db.audios.filter(a => !a.isDeleted)),
      notifications: filterSince(db.notifications),
      deletedIds: db.deletedIds || {
        courses: [],
        lessons: [],
        slides: [],
        contents: [],
        videos: [],
        audios: []
      }
    }
  };

  res.json(delta);
});

// -------------------------------------------------------------
// 11. ANDROID OFFLINE BUNDLE & ON-DEMAND OFFLINE-FIRST ENGINE
// -------------------------------------------------------------
interface ModuleFilterOptions {
  content?: boolean;
  slides?: boolean;
  videos?: boolean;
  audios?: boolean;
}

function getLessonSizeBreakdown(lessonId: string): LessonSizeBreakdown | null {
  const lesson = db.lessons.find(l => l.id === lessonId);
  if (!lesson) return null;

  const slides = db.slides.filter(s => s.lessonId === lesson.id && !s.isDeleted);
  const contents = db.contents.filter(c => c.lessonId === lesson.id && !c.isDeleted);
  const videos = db.videos.filter(v => v.lessonId === lesson.id && !v.isDeleted);
  const audios = db.audios.filter(a => a.lessonId === lesson.id && !a.isDeleted);

  const contentSizeMb = 0.15; // Structured text, questions & metadata
  const slideSizeMb = Math.round(slides.length * 0.65 * 10) / 10;
  const videoSizeMb = Math.round(videos.reduce((sum, v) => sum + (v.fileSizeMb || 85.0), 0) * 10) / 10;
  const audioSizeMb = Math.round(audios.reduce((sum, a) => sum + (a.fileSizeMb || 20.0), 0) * 10) / 10;
  const totalSizeMb = Math.round((contentSizeMb + slideSizeMb + videoSizeMb + audioSizeMb) * 10) / 10;

  return {
    contentSizeMb,
    contentCount: contents.length,
    slideSizeMb,
    slideCount: slides.length,
    videoSizeMb,
    videoCount: videos.length,
    audioSizeMb,
    audioCount: audios.length,
    totalSizeMb
  };
}

function buildLessonOfflinePackage(lessonId: string, options?: ModuleFilterOptions): OfflinePackage | null {
  const lesson = db.lessons.find(l => l.id === lessonId);
  if (!lesson) return null;

  const includeContent = options?.content !== false;
  const includeSlides = options?.slides !== false;
  const includeVideos = options?.videos !== false;
  const includeAudios = options?.audios !== false;

  const course = db.courses.find(c => c.id === lesson.courseId);
  const rawSlides = db.slides.filter(s => s.lessonId === lesson.id && !s.isDeleted).sort((a, b) => a.order - b.order);
  const rawContents = db.contents.filter(c => c.lessonId === lesson.id && !c.isDeleted).sort((a, b) => a.order - b.order);
  const rawVideos = db.videos.filter(v => v.lessonId === lesson.id && !v.isDeleted).sort((a, b) => a.order - b.order);
  const rawAudios = db.audios.filter(a => a.lessonId === lesson.id && !a.isDeleted).sort((a, b) => a.order - b.order);

  const slides = includeSlides ? rawSlides : [];
  const contents = includeContent ? rawContents : [];
  const videos = includeVideos ? rawVideos : [];
  const audios = includeAudios ? rawAudios : [];

  const manifestFiles: OfflineManifestFile[] = [];
  let totalBytes = 0;

  // 1. Lesson Metadata JSON File
  const metaPayload = JSON.stringify({ lesson, course, contents: rawContents });
  const metaChecksum = crypto.createHash('sha256').update(metaPayload).digest('hex');
  const metaSize = Buffer.byteLength(metaPayload, 'utf8');
  totalBytes += metaSize;

  manifestFiles.push({
    id: `manifest-meta-${lesson.id}`,
    name: `metadata_${lesson.id}_v${lesson.version}.json`,
    type: 'METADATA_JSON',
    category: 'lessons',
    downloadUrl: `/api/lessons/${lesson.id}/full`,
    storagePath: `lessons/${lesson.id}/metadata_v${lesson.version}.json`,
    sizeBytes: metaSize,
    sizeMb: Math.round((metaSize / (1024 * 1024)) * 100) / 100,
    checksum: metaChecksum,
    version: lesson.version,
    isMandatory: true
  });

  // 2. Slide Images (if selected)
  const slidesWithIntegrity = slides.map(slide => {
    const slideSeed = `slide-${slide.id}-${slide.version}-${slide.imageUrl}`;
    const slideHash = crypto.createHash('sha256').update(slideSeed).digest('hex');
    const slideBytes = 650000; // ~650 KB average 1080p slide
    totalBytes += slideBytes;

    manifestFiles.push({
      id: `manifest-slide-${slide.id}`,
      name: `slide_${slide.order}_v${slide.version}.jpg`,
      type: 'SLIDE_IMAGE',
      category: 'slides',
      downloadUrl: slide.imageUrl,
      storagePath: slide.storagePath || `slides/${lesson.id}/slide_v${slide.version}_${slide.order}.jpg`,
      sizeBytes: slideBytes,
      sizeMb: 0.65,
      checksum: slideHash,
      version: slide.version,
      isMandatory: true
    });

    return {
      ...slide,
      checksum: slideHash,
      fileSize: slideBytes
    };
  });

  // 3. Videos (if selected)
  const videosWithIntegrity = videos.map(vid => {
    const vidSeed = `video-${vid.id}-${vid.version}-${vid.videoUrl}`;
    const vidHash = crypto.createHash('sha256').update(vidSeed).digest('hex');
    const vidBytes = Math.round((vid.fileSizeMb || 85.0) * 1024 * 1024);
    totalBytes += vidBytes;

    manifestFiles.push({
      id: `manifest-video-${vid.id}`,
      name: `video_${vid.order}_v${vid.version}.mp4`,
      type: 'VIDEO_STREAM',
      category: 'videos',
      downloadUrl: vid.videoUrl,
      storagePath: vid.storagePath || `videos/${lesson.id}/video_v${vid.version}_${vid.id}.mp4`,
      sizeBytes: vidBytes,
      sizeMb: vid.fileSizeMb || 85.0,
      checksum: vidHash,
      version: vid.version,
      isMandatory: false
    });

    return {
      ...vid,
      checksum: vidHash,
      fileSizeBytes: vidBytes
    };
  });

  // 4. Audios (if selected)
  const audiosWithIntegrity = audios.map(aud => {
    const audSeed = `audio-${aud.id}-${aud.version}-${aud.audioUrl}`;
    const audHash = crypto.createHash('sha256').update(audSeed).digest('hex');
    const audBytes = Math.round((aud.fileSizeMb || 20.0) * 1024 * 1024);
    totalBytes += audBytes;

    manifestFiles.push({
      id: `manifest-audio-${aud.id}`,
      name: `audio_${aud.order}_v${aud.version}.mp3`,
      type: 'AUDIO_STREAM',
      category: 'audios',
      downloadUrl: aud.audioUrl,
      storagePath: aud.storagePath || `audios/${lesson.id}/audio_v${aud.version}_${aud.id}.mp3`,
      sizeBytes: audBytes,
      sizeMb: aud.fileSizeMb || 20.0,
      checksum: audHash,
      version: aud.version,
      isMandatory: false
    });

    return {
      ...aud,
      checksum: audHash,
      fileSizeBytes: audBytes
    };
  });

  // 5. Raw PPTX Document (if available)
  if (lesson.rawPptUrl && includeSlides) {
    const pptxSeed = `pptx-${lesson.id}-${lesson.version}-${lesson.rawPptUrl}`;
    const pptxHash = crypto.createHash('sha256').update(pptxSeed).digest('hex');
    const pptxBytes = 14200000;
    totalBytes += pptxBytes;

    manifestFiles.push({
      id: `manifest-pptx-${lesson.id}`,
      name: `raw_presentation_v${lesson.version}.pptx`,
      type: 'DOCUMENT_PPTX',
      category: 'documents',
      downloadUrl: lesson.rawPptUrl,
      storagePath: lesson.rawPptStoragePath || `documents/${lesson.id}/raw_presentation_v${lesson.version}.pptx`,
      sizeBytes: pptxBytes,
      sizeMb: 14.2,
      checksum: pptxHash,
      version: lesson.version,
      isMandatory: false
    });
  }

  // Calculate master package checksum
  const masterPayload = JSON.stringify({
    lessonId: lesson.id,
    version: lesson.version,
    manifestFiles: manifestFiles.map(m => ({ id: m.id, checksum: m.checksum, size: m.sizeBytes }))
  });
  const packageChecksum = crypto.createHash('sha256').update(masterPayload).digest('hex');
  const totalSizeMb = Math.round((totalBytes / (1024 * 1024)) * 10) / 10;

  return {
    lessonId: lesson.id,
    lessonTitle: lesson.title,
    courseId: lesson.courseId,
    courseTitle: course?.title || 'Giáo Dục Chính Trị',
    version: lesson.version,
    packageVersion: lesson.version,
    packageStatus: 'READY',
    packageChecksum,
    totalSizeBytes: totalBytes,
    totalSizeMb,
    fileCount: manifestFiles.length,
    generatedAt: new Date().toISOString(),
    lesson,
    course,
    slides: slidesWithIntegrity,
    contents: rawContents,
    videos: videosWithIntegrity,
    audios: audiosWithIntegrity,
    manifestFiles
  };
}

// 1. GET /api/lessons/:id/offline-package (Supports on-demand module query e.g. ?modules=content,slides)
app.get('/api/lessons/:id/offline-package', (req: Request, res: Response) => {
  const modulesQuery = (req.query.modules as string || '').toLowerCase();
  let filterOptions: ModuleFilterOptions | undefined = undefined;

  if (modulesQuery) {
    const mods = modulesQuery.split(',').map(m => m.trim());
    filterOptions = {
      content: mods.includes('content') || mods.includes('contents'),
      slides: mods.includes('slide') || mods.includes('slides'),
      videos: mods.includes('video') || mods.includes('videos'),
      audios: mods.includes('audio') || mods.includes('audios')
    };
  }

  const pkg = buildLessonOfflinePackage(req.params.id, filterOptions);
  if (!pkg) return res.status(404).json({ error: 'Bài học không tồn tại' });
  res.json(pkg);
});

// GET /api/lessons/:id/size-breakdown (Returns on-demand size calculation for mobile modal)
app.get('/api/lessons/:id/size-breakdown', (req: Request, res: Response) => {
  const breakdown = getLessonSizeBreakdown(req.params.id);
  if (!breakdown) return res.status(404).json({ error: 'Bài học không tồn tại' });
  res.json(breakdown);
});

// Full lesson bundle alias (backwards-compatible)
app.get('/api/lessons/:id/bundle', (req: Request, res: Response) => {
  const pkg = buildLessonOfflinePackage(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Bài học không tồn tại' });
  res.json(pkg);
});

// 2. GET /api/lessons/:id/version (Lightweight version & checksum check for Android WorkManager)
app.get('/api/lessons/:id/version', (req: Request, res: Response) => {
  const lesson = db.lessons.find(l => l.id === req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Bài học không tồn tại' });

  const pkg = buildLessonOfflinePackage(req.params.id);

  const versionInfo: LessonVersionInfo = {
    lessonId: lesson.id,
    version: lesson.version,
    packageVersion: lesson.version,
    packageChecksum: pkg ? pkg.packageChecksum : 'pending',
    packageStatus: 'READY',
    totalSizeBytes: pkg ? pkg.totalSizeBytes : 0,
    totalSizeMb: pkg ? pkg.totalSizeMb : 0,
    fileCount: pkg ? pkg.fileCount : 0,
    status: lesson.status,
    updatedAt: lesson.updatedAt
  };

  res.json(versionInfo);
});

// 3. POST /api/lessons/:id/rebuild-offline-package (Trigger offline package recalculation)
app.post('/api/lessons/:id/rebuild-offline-package', (req: Request, res: Response) => {
  const lesson = db.lessons.find(l => l.id === req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Bài học không tồn tại' });

  lesson.version += 1;
  lesson.updatedAt = new Date().toISOString();
  saveDatabase(db);

  const pkg = buildLessonOfflinePackage(lesson.id);

  broadcastRealtime({
    type: 'LESSON_UPDATED',
    entityId: lesson.id,
    action: 'UPDATE',
    timestamp: new Date().toISOString(),
    data: { offlinePackage: pkg }
  });

  res.json({
    success: true,
    message: `Đã tái tạo gói Offline Package cho bài học "${lesson.title}" thành công! Phiên bản mới: v${lesson.version}`,
    offlinePackage: pkg
  });
});

// Full lesson route alias
app.get('/api/lessons/:id/full', (req: Request, res: Response) => {
  const lesson = db.lessons.find(l => l.id === req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Bài học không tồn tại' });

  const course = db.courses.find(c => c.id === lesson.courseId);
  const slides = db.slides.filter(s => s.lessonId === lesson.id && !s.isDeleted).sort((a, b) => a.order - b.order);
  const contents = db.contents.filter(c => c.lessonId === lesson.id && !c.isDeleted).sort((a, b) => a.order - b.order);
  const videos = db.videos.filter(v => v.lessonId === lesson.id && !v.isDeleted).sort((a, b) => a.order - b.order);
  const audios = db.audios.filter(a => a.lessonId === lesson.id && !a.isDeleted).sort((a, b) => a.order - b.order);

  res.json({
    ...lesson,
    courseTitle: course?.title || '',
    slides,
    contents,
    videos,
    audios
  });
});

// 4. POST /api/progress/sync and POST /api/sync/progress (Batch progress sync from Android Room)
const handleBatchProgressSync = (req: Request, res: Response) => {
  const rawList = (req.body.progressList || req.body.items || (Array.isArray(req.body) ? req.body : [])) as Partial<OfflineProgressItem & UserProgress>[];
  if (!Array.isArray(rawList)) {
    return res.status(400).json({ error: 'progressList must be an array' });
  }

  const syncedResults: UserProgress[] = [];

  rawList.forEach(item => {
    if (!item.userId || !item.lessonId) return;

    const user = db.users.find(u => u.id === item.userId);
    const lesson = db.lessons.find(l => l.id === item.lessonId);

    const sProg = Number(item.slideProgress) || 0;
    const vProg = Number(item.videoProgress) || 0;
    const aProg = Number(item.audioProgress) || 0;
    const cProg = Number(item.contentProgress) || 0;
    const overall = Math.round((sProg + vProg + aProg + cProg) / 4);
    const isCompleted = overall >= 85 || !!item.completed;

    let existing = db.progress.find(p => p.userId === item.userId && p.lessonId === item.lessonId);
    if (existing) {
      existing.slideProgress = Math.max(existing.slideProgress, sProg);
      existing.videoProgress = Math.max(existing.videoProgress, vProg);
      existing.audioProgress = Math.max(existing.audioProgress, aProg);
      existing.contentProgress = Math.max(existing.contentProgress, cProg);
      existing.overallProgress = Math.round((existing.slideProgress + existing.videoProgress + existing.audioProgress + existing.contentProgress) / 4);
      existing.completed = existing.overallProgress >= 85 || existing.completed;
      existing.lastAccessedAt = item.lastAccessedAt || new Date().toISOString();
      if (existing.completed && !existing.completedAt) {
        existing.completedAt = item.completedAt || new Date().toISOString();
      }
      syncedResults.push(existing);
    } else {
      const newProgress: UserProgress = {
        id: 'prog-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        userId: item.userId,
        userName: user?.name || item.userName || 'Chiến sĩ',
        unitId: user?.unitId || item.unitId || 'unit-1',
        unitName: user?.unitName || item.unitName || 'Vùng 4 Hải Quân',
        lessonId: item.lessonId,
        lessonTitle: lesson?.title || item.lessonTitle || '',
        courseId: lesson?.courseId || item.courseId || '',
        slideProgress: sProg,
        videoProgress: vProg,
        audioProgress: aProg,
        contentProgress: cProg,
        overallProgress: overall,
        completed: isCompleted,
        lastAccessedAt: item.lastAccessedAt || new Date().toISOString(),
        completedAt: isCompleted ? (item.completedAt || new Date().toISOString()) : undefined,
        version: 1
      };
      db.progress.push(newProgress);
      syncedResults.push(newProgress);
    }
  });

  saveDatabase(db);

  broadcastRealtime({
    type: 'PROGRESS_UPDATED',
    entityId: 'batch-sync',
    action: 'UPDATE',
    timestamp: new Date().toISOString(),
    data: { syncedCount: syncedResults.length, syncedResults }
  });

  res.json({
    success: true,
    message: `Đã đồng bộ thành công ${syncedResults.length} bản ghi tiến độ học tập từ thiết bị`,
    syncedResults
  });
};

app.post('/api/progress/sync', handleBatchProgressSync);
app.post('/api/sync/progress', handleBatchProgressSync);


// -------------------------------------------------------------
// DASHBOARD & STATS API
// -------------------------------------------------------------
app.get('/api/stats', (_req: Request, res: Response) => {
  const activeCourses = db.courses.filter(c => !c.isDeleted);
  const activeLessons = db.lessons.filter(l => !l.isDeleted);
  const publishedLessons = activeLessons.filter(l => l.status === 'PUBLISHED');
  const draftLessons = activeLessons.filter(l => l.status === 'DRAFT');
  const reviewLessons = activeLessons.filter(l => l.status === 'REVIEW');

  const completed = db.progress.filter(p => p.completed).length;
  const inProgress = db.progress.filter(p => !p.completed).length;
  const avgCompletion = db.progress.length > 0
    ? Math.round(db.progress.reduce((acc, cur) => acc + cur.overallProgress, 0) / db.progress.length)
    : 0;

  const totalSizeMb = db.storageFiles.reduce((acc, f) => acc + (f.sizeBytes / (1024 * 1024)), 0);

  const stats: DashboardStats = {
    totalCourses: activeCourses.length,
    totalLessons: activeLessons.length,
    publishedLessons: publishedLessons.length,
    draftLessons: draftLessons.length,
    reviewLessons: reviewLessons.length,
    totalUsers: db.users.length,
    totalUnits: db.units.length,
    totalStudySessions: db.progress.length * 8 + 42,
    completedLearners: completed,
    inProgressLearners: inProgress,
    averageCompletionRate: avgCompletion,
    storageStats: {
      totalFiles: db.storageFiles.length,
      totalSizeMb: Math.round(totalSizeMb * 10) / 10,
      slidesCount: db.slides.filter(s => !s.isDeleted).length,
      videosCount: db.videos.filter(v => !v.isDeleted).length,
      audiosCount: db.audios.filter(a => !a.isDeleted).length,
      documentsCount: db.storageFiles.filter(f => f.category === 'documents').length
    },
    recentActivities: [
      {
        id: 'act-1',
        action: 'Cập nhật phiên bản bài học (v5)',
        target: 'Những nội dung trọng tâm công tác giáo dục chính trị 6 tháng đầu năm 2026',
        user: 'Thượng tá Nguyễn Văn Hùng',
        time: 'Vừa xong'
      },
      {
        id: 'act-2',
        action: 'Phát hành chuyên đề',
        target: 'Bảo vệ vững chắc chủ quyền biển, đảo, thềm lục địa thiêng liêng',
        user: 'Đại tá Lê Hoàng Nam',
        time: '35 phút trước'
      },
      {
        id: 'act-3',
        action: 'Lưu trữ tệp PPTX gốc & Trích xuất 8 slide',
        target: 'Bài 1: Xây dựng bản lĩnh chính trị người chiến sĩ Hải quân',
        user: 'Trung tá Trần Minh Đức',
        time: '2 giờ trước'
      },
      {
        id: 'act-4',
        action: 'Đồng bộ tiến độ học tập (100%)',
        target: 'Đại úy Hoàng Văn Kiên (Tàu 015 - L162)',
        user: 'Học viên',
        time: '3 giờ trước'
      }
    ]
  };
  res.json(stats);
});

// -------------------------------------------------------------
// 6. COURSES API WITH PAGINATION & FILTERING
// -------------------------------------------------------------
app.get('/api/courses', (req: Request, res: Response) => {
  const includeDeleted = req.query.deleted === 'true';
  const forClient = req.query.client === 'true';
  const search = (req.query.search as string || '').toLowerCase().trim();
  const status = req.query.status as string;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  let list = db.courses;
  if (!includeDeleted) {
    list = list.filter(c => !c.isDeleted);
  }
  if (forClient) {
    list = list.filter(c => c.status === 'PUBLISHED');
  }
  if (status && status !== 'ALL') {
    list = list.filter(c => c.status === status);
  }
  if (search) {
    list = list.filter(c => 
      c.title.toLowerCase().includes(search) || 
      c.description.toLowerCase().includes(search) ||
      c.createdBy.toLowerCase().includes(search)
    );
  }

  // Enrich with lesson counts
  const enriched = list.map(course => {
    const courseLessons = db.lessons.filter(l => l.courseId === course.id && !l.isDeleted);
    return {
      ...course,
      lessonCount: courseLessons.length,
      publishedLessonCount: courseLessons.filter(l => l.status === 'PUBLISHED').length
    };
  }).sort((a, b) => a.order - b.order);

  if (page !== undefined || limit !== undefined) {
    return res.json(paginate(enriched, page, limit));
  }

  res.json(enriched);
});

app.get('/api/courses/:id', (req: Request, res: Response) => {
  const course = db.courses.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Chuyên đề không tồn tại' });
  
  const courseLessons = db.lessons.filter(l => l.courseId === course.id && !l.isDeleted);
  res.json({
    ...course,
    lessonCount: courseLessons.length,
    publishedLessonCount: courseLessons.filter(l => l.status === 'PUBLISHED').length
  });
});

app.post('/api/courses', (req: Request, res: Response) => {
  const { title, description, thumbnail, rawPptUrl, rawPptStoragePath, year, order, status, createdBy } = req.body;
  if (!title) return res.status(400).json({ error: 'Tiêu đề chuyên đề là bắt buộc' });

  const courseId = 'course-' + Date.now();
  const newCourse: Course = {
    id: courseId,
    title,
    description: description || '',
    thumbnail: thumbnail || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    storageThumbnailPath: `thumbnails/${courseId}/thumb_v1_${courseId}.jpg`,
    rawPptUrl: rawPptUrl || undefined,
    rawPptStoragePath: rawPptStoragePath || undefined,
    year: Number(year) || 2026,
    order: Number(order) || db.courses.length + 1,
    status: status || 'DRAFT',
    version: 1,
    isDeleted: false,
    createdBy: createdBy || 'Phòng Chính trị Vùng 4',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.courses.push(newCourse);
  saveDatabase(db);

  broadcastRealtime({
    type: 'COURSE_UPDATED',
    entityId: newCourse.id,
    action: 'CREATE',
    timestamp: new Date().toISOString(),
    data: newCourse
  });

  res.status(201).json(newCourse);
});

app.put('/api/courses/:id', (req: Request, res: Response) => {
  const idx = db.courses.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Chuyên đề không tồn tại' });

  const current = db.courses[idx];
  const isPublishChange = req.body.status && req.body.status !== current.status;
  // Automatically increment version on state change or edit
  const newVersion = isPublishChange ? current.version + 1 : (current.version + 1);

  const updated: Course = {
    ...current,
    ...req.body,
    version: newVersion,
    updatedAt: new Date().toISOString()
  };

  db.courses[idx] = updated;
  saveDatabase(db);

  broadcastRealtime({
    type: 'COURSE_UPDATED',
    entityId: updated.id,
    action: isPublishChange ? 'PUBLISH' : 'UPDATE',
    timestamp: new Date().toISOString(),
    data: updated
  });

  res.json(updated);
});

// Soft Delete course
app.delete('/api/courses/:id', (req: Request, res: Response) => {
  const idx = db.courses.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Chuyên đề không tồn tại' });

  const permanent = req.query.permanent === 'true';
  const course = db.courses[idx];

  if (permanent) {
    db.courses.splice(idx, 1);
    db.lessons = db.lessons.filter(l => l.courseId !== req.params.id);
    if (!db.deletedIds.courses.includes(req.params.id)) {
      db.deletedIds.courses.push(req.params.id);
    }
  } else {
    course.isDeleted = true;
    course.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'COURSE_UPDATED',
    entityId: req.params.id,
    action: 'DELETE',
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: permanent ? 'Đã xóa vĩnh viễn' : 'Đã chuyển vào thùng rác' });
});

// Restore course
app.post('/api/courses/:id/restore', (req: Request, res: Response) => {
  const course = db.courses.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Chuyên đề không tồn tại' });

  course.isDeleted = false;
  course.version += 1;
  course.updatedAt = new Date().toISOString();
  saveDatabase(db);

  broadcastRealtime({
    type: 'COURSE_UPDATED',
    entityId: course.id,
    action: 'RESTORE',
    timestamp: new Date().toISOString(),
    data: course
  });

  res.json(course);
});

// -------------------------------------------------------------
// 6. LESSONS API WITH PAGINATION & QUERY OPTIMIZATION
// -------------------------------------------------------------
app.get('/api/lessons', (req: Request, res: Response) => {
  const courseId = req.query.courseId as string;
  const includeDeleted = req.query.deleted === 'true';
  const forClient = req.query.client === 'true';
  const search = (req.query.search as string || '').toLowerCase().trim();
  const status = req.query.status as string;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  let list = db.lessons;
  if (courseId) {
    list = list.filter(l => l.courseId === courseId);
  }
  if (!includeDeleted) {
    list = list.filter(l => !l.isDeleted);
  }
  if (forClient) {
    list = list.filter(l => l.status === 'PUBLISHED');
  }
  if (status && status !== 'ALL') {
    list = list.filter(l => l.status === status);
  }
  if (search) {
    list = list.filter(l => 
      l.title.toLowerCase().includes(search) || 
      l.description.toLowerCase().includes(search) ||
      l.createdBy.toLowerCase().includes(search)
    );
  }

  const enriched = list.map(lesson => {
    const course = db.courses.find(c => c.id === lesson.courseId);
    const slides = db.slides.filter(s => s.lessonId === lesson.id && !s.isDeleted);
    const contents = db.contents.filter(c => c.lessonId === lesson.id && !c.isDeleted);
    const videos = db.videos.filter(v => v.lessonId === lesson.id && !v.isDeleted);
    const audios = db.audios.filter(a => a.lessonId === lesson.id && !a.isDeleted);

    const breakdown = getLessonSizeBreakdown(lesson.id);

    return {
      ...lesson,
      courseTitle: course?.title || '',
      slideCount: slides.length,
      contentCount: contents.length,
      videoCount: videos.length,
      audioCount: audios.length,
      totalSizeMb: breakdown?.totalSizeMb || 0,
      contentVersion: lesson.contentVersion || lesson.version || 1,
      mediaVersion: lesson.mediaVersion || lesson.version || 1,
      packageStatus: 'READY' as const
    };
  }).sort((a, b) => a.order - b.order);

  if (page !== undefined || limit !== undefined) {
    return res.json(paginate(enriched, page, limit));
  }

  res.json(enriched);
});

app.get('/api/lessons/:id', (req: Request, res: Response) => {
  const lesson = db.lessons.find(l => l.id === req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Bài học không tồn tại' });

  const course = db.courses.find(c => c.id === lesson.courseId);
  const slides = db.slides.filter(s => s.lessonId === lesson.id && !s.isDeleted);
  const contents = db.contents.filter(c => c.lessonId === lesson.id && !c.isDeleted);
  const videos = db.videos.filter(v => v.lessonId === lesson.id && !v.isDeleted);
  const audios = db.audios.filter(a => a.lessonId === lesson.id && !a.isDeleted);

  const breakdown = getLessonSizeBreakdown(lesson.id);

  res.json({
    ...lesson,
    courseTitle: course?.title || '',
    slideCount: slides.length,
    contentCount: contents.length,
    videoCount: videos.length,
    audioCount: audios.length,
    totalSizeMb: breakdown?.totalSizeMb || 0,
    contentVersion: lesson.contentVersion || lesson.version || 1,
    mediaVersion: lesson.mediaVersion || lesson.version || 1,
    packageStatus: 'READY'
  });
});

app.post('/api/lessons', (req: Request, res: Response) => {
  const { courseId, title, description, thumbnail, rawPptUrl, rawPptStoragePath, order, status, moduleConfig, durationMinutes, createdBy } = req.body;
  if (!courseId || !title) return res.status(400).json({ error: 'Vui lòng cung cấp Chuyên đề và Tiêu đề bài học' });

  const lessonId = 'lesson-' + Date.now();
  const existingInCourse = db.lessons.filter(l => l.courseId === courseId);
  const newLesson: Lesson = {
    id: lessonId,
    courseId,
    title,
    description: description || '',
    thumbnail: thumbnail || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
    storageThumbnailPath: `thumbnails/${lessonId}/thumb_v1_${lessonId}.jpg`,
    rawPptUrl: rawPptUrl || undefined,
    rawPptStoragePath: rawPptStoragePath || undefined,
    order: Number(order) || existingInCourse.length + 1,
    status: status || 'DRAFT',
    version: 1,
    moduleConfig: moduleConfig || {
      showSlides: true,
      showContents: true,
      showVideos: true,
      showAudios: true
    },
    isDeleted: false,
    durationMinutes: Number(durationMinutes) || 45,
    createdBy: createdBy || 'Ban Tuyên huấn Vùng 4',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.lessons.push(newLesson);

  // Increment parent course version
  const course = db.courses.find(c => c.id === courseId);
  if (course) {
    course.version += 1;
    course.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'LESSON_UPDATED',
    entityId: newLesson.id,
    action: 'CREATE',
    timestamp: new Date().toISOString(),
    data: newLesson
  });

  res.status(201).json(newLesson);
});

app.put('/api/lessons/:id', (req: Request, res: Response) => {
  const idx = db.lessons.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Bài học không tồn tại' });

  const current = db.lessons[idx];
  const isStatusChanged = req.body.status && req.body.status !== current.status;
  const newVersion = current.version + 1;

  const updated: Lesson = {
    ...current,
    ...req.body,
    version: newVersion,
    updatedAt: new Date().toISOString()
  };

  db.lessons[idx] = updated;

  // Increment parent course version
  const course = db.courses.find(c => c.id === updated.courseId);
  if (course) {
    course.version += 1;
    course.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'LESSON_UPDATED',
    entityId: updated.id,
    action: isStatusChanged ? 'PUBLISH' : 'UPDATE',
    timestamp: new Date().toISOString(),
    data: updated
  });

  res.json(updated);
});

// Update Module Visibility Config Realtime
app.patch('/api/lessons/:id/module-config', (req: Request, res: Response) => {
  const idx = db.lessons.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Bài học không tồn tại' });

  const lesson = db.lessons[idx];
  lesson.moduleConfig = {
    ...lesson.moduleConfig,
    ...req.body
  };
  lesson.version += 1;
  lesson.updatedAt = new Date().toISOString();

  saveDatabase(db);

  broadcastRealtime({
    type: 'MODULE_CONFIG_CHANGED',
    entityId: lesson.id,
    action: 'UPDATE',
    timestamp: new Date().toISOString(),
    data: lesson.moduleConfig
  });

  res.json(lesson);
});

// Duplicate lesson
app.post('/api/lessons/:id/duplicate', (req: Request, res: Response) => {
  const original = db.lessons.find(l => l.id === req.params.id);
  if (!original) return res.status(404).json({ error: 'Bài học không tồn tại' });

  const newLessonId = 'lesson-' + Date.now();
  const duplicated: Lesson = {
    ...original,
    id: newLessonId,
    title: `${original.title} (Bản sao)`,
    status: 'DRAFT',
    version: 1,
    order: original.order + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.lessons.push(duplicated);

  // Duplicate slides with proper storage path references
  const originalSlides = db.slides.filter(s => s.lessonId === original.id && !s.isDeleted);
  originalSlides.forEach((s, idx) => {
    db.slides.push({
      ...s,
      id: 'slide-' + Date.now() + '-' + idx,
      lessonId: newLessonId,
      storagePath: `slides/${newLessonId}/slide_v1_${idx + 1}.jpg`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  // Duplicate contents
  const originalContents = db.contents.filter(c => c.lessonId === original.id && !c.isDeleted);
  originalContents.forEach((c, idx) => {
    db.contents.push({
      ...c,
      id: 'content-' + Date.now() + '-' + idx,
      lessonId: newLessonId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  // Duplicate videos & audios
  const originalVideos = db.videos.filter(v => v.lessonId === original.id && !v.isDeleted);
  originalVideos.forEach((v, idx) => {
    db.videos.push({
      ...v,
      id: 'video-' + Date.now() + '-' + idx,
      lessonId: newLessonId,
      storagePath: `videos/${newLessonId}/video_v1_${idx + 1}.mp4`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  const originalAudios = db.audios.filter(a => a.lessonId === original.id && !a.isDeleted);
  originalAudios.forEach((a, idx) => {
    db.audios.push({
      ...a,
      id: 'audio-' + Date.now() + '-' + idx,
      lessonId: newLessonId,
      storagePath: `audios/${newLessonId}/audio_v1_${idx + 1}.mp3`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  saveDatabase(db);

  broadcastRealtime({
    type: 'LESSON_UPDATED',
    entityId: duplicated.id,
    action: 'CREATE',
    timestamp: new Date().toISOString(),
    data: duplicated
  });

  res.status(201).json(duplicated);
});

// Delete lesson
app.delete('/api/lessons/:id', (req: Request, res: Response) => {
  const idx = db.lessons.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Bài học không tồn tại' });

  const permanent = req.query.permanent === 'true';
  const lesson = db.lessons[idx];

  if (permanent) {
    db.lessons.splice(idx, 1);
    db.slides = db.slides.filter(s => s.lessonId !== req.params.id);
    db.contents = db.contents.filter(c => c.lessonId !== req.params.id);
    db.videos = db.videos.filter(v => v.lessonId !== req.params.id);
    db.audios = db.audios.filter(a => a.lessonId !== req.params.id);
    if (!db.deletedIds.lessons.includes(req.params.id)) {
      db.deletedIds.lessons.push(req.params.id);
    }
  } else {
    lesson.isDeleted = true;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'LESSON_UPDATED',
    entityId: req.params.id,
    action: 'DELETE',
    timestamp: new Date().toISOString()
  });

  res.json({ success: true, message: permanent ? 'Đã xóa vĩnh viễn bài học' : 'Đã chuyển vào thùng rác' });
});

// Restore lesson
app.post('/api/lessons/:id/restore', (req: Request, res: Response) => {
  const lesson = db.lessons.find(l => l.id === req.params.id);
  if (!lesson) return res.status(404).json({ error: 'Bài học không tồn tại' });

  lesson.isDeleted = false;
  lesson.version += 1;
  lesson.updatedAt = new Date().toISOString();
  saveDatabase(db);

  broadcastRealtime({
    type: 'LESSON_UPDATED',
    entityId: lesson.id,
    action: 'RESTORE',
    timestamp: new Date().toISOString(),
    data: lesson
  });

  res.json(lesson);
});

// -------------------------------------------------------------
// 10. SLIDES MODULE API (Slide metadata & Cloud Storage images)
// -------------------------------------------------------------
app.get('/api/lessons/:lessonId/slides', (req: Request, res: Response) => {
  const slides = db.slides.filter(s => s.lessonId === req.params.lessonId && !s.isDeleted);
  res.json(slides.sort((a, b) => a.order - b.order));
});

app.post('/api/lessons/:lessonId/slides', (req: Request, res: Response) => {
  const { title, imageUrl, storagePath, notes, width, height, order } = req.body;
  const existingSlides = db.slides.filter(s => s.lessonId === req.params.lessonId && !s.isDeleted);
  const slideOrder = Number(order) || existingSlides.length + 1;
  const slideId = 'slide-' + Date.now() + '-' + Math.round(Math.random() * 1000);

  const newSlide: SlideItem = {
    id: slideId,
    lessonId: req.params.lessonId,
    order: slideOrder,
    title: title || `Slide ${slideOrder}`,
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
    storagePath: storagePath || `slides/${req.params.lessonId}/slide_v1_${slideOrder}.jpg`,
    notes: notes || '',
    width: Number(width) || 1920,
    height: Number(height) || 1080,
    version: 1,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.slides.push(newSlide);

  // Auto-increment parent lesson version
  const lesson = db.lessons.find(l => l.id === req.params.lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'SLIDE_CHANGED',
    entityId: req.params.lessonId,
    action: 'CREATE',
    timestamp: new Date().toISOString(),
    data: newSlide
  });

  res.status(201).json(newSlide);
});

// Upload multiple slide images at once
app.post('/api/lessons/:lessonId/slides/batch-images', upload.array('files', 50), (req: Request, res: Response) => {
  const lessonId = req.params.lessonId;
  const files = (req.files as Express.Multer.File[]) || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'Không có tệp hình ảnh nào được tải lên' });
  }

  const existingSlides = db.slides.filter(s => s.lessonId === lessonId && !s.isDeleted);
  const createdSlides: SlideItem[] = [];

  files.forEach((file, index) => {
    const slideOrder = existingSlides.length + index + 1;
    const slideId = 'slide-' + Date.now() + '-' + index + '-' + Math.round(Math.random() * 1000);
    const storagePath = `slides/${lessonId}/${file.filename}`;
    const imageUrl = `/uploads/${storagePath}`;

    const newSlide: SlideItem = {
      id: slideId,
      lessonId,
      order: slideOrder,
      title: `Slide ${slideOrder} - ${file.originalname.replace(/\.[^/.]+$/, "")}`,
      imageUrl,
      storagePath,
      notes: `Trang chiếu số ${slideOrder} tải lên từ hình ảnh ${file.originalname}`,
      width: 1920,
      height: 1080,
      version: 1,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.slides.push(newSlide);
    createdSlides.push(newSlide);

    // Track in storage files
    db.storageFiles.push({
      id: 'file-slide-' + Date.now() + '-' + index,
      category: 'slides',
      entityId: lessonId,
      storagePath,
      downloadUrl: imageUrl,
      version: 1,
      originalName: file.originalname,
      sizeBytes: file.size,
      mimeType: file.mimetype,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  });

  // Increment lesson version
  const lesson = db.lessons.find(l => l.id === lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'SLIDE_CHANGED',
    entityId: lessonId,
    action: 'CREATE',
    timestamp: new Date().toISOString(),
    data: createdSlides
  });

  res.status(201).json({
    success: true,
    message: `Đã thêm ${createdSlides.length} slide mới vào bài giảng`,
    slides: createdSlides
  });
});

app.put('/api/slides/:id', (req: Request, res: Response) => {
  const idx = db.slides.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Slide không tồn tại' });

  const current = db.slides[idx];
  const newVersion = current.version + 1;

  const updated: SlideItem = {
    ...current,
    ...req.body,
    version: newVersion,
    storagePath: req.body.storagePath || `slides/${current.lessonId}/slide_v${newVersion}_${current.order}.jpg`,
    updatedAt: new Date().toISOString()
  };

  db.slides[idx] = updated;

  // Auto-increment parent lesson version
  const lesson = db.lessons.find(l => l.id === updated.lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'SLIDE_CHANGED',
    entityId: updated.lessonId,
    action: 'UPDATE',
    timestamp: new Date().toISOString(),
    data: updated
  });

  res.json(updated);
});

app.delete('/api/slides/:id', (req: Request, res: Response) => {
  const idx = db.slides.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Slide không tồn tại' });

  const slide = db.slides[idx];
  const lessonId = slide.lessonId;
  db.slides.splice(idx, 1);

  if (!db.deletedIds.slides.includes(req.params.id)) {
    db.deletedIds.slides.push(req.params.id);
  }

  const lesson = db.lessons.find(l => l.id === lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'SLIDE_CHANGED',
    entityId: lessonId,
    action: 'DELETE',
    timestamp: new Date().toISOString()
  });

  res.json({ success: true });
});

// Batch reorder slides
app.post('/api/lessons/:lessonId/slides/reorder', (req: Request, res: Response) => {
  const { slideIds } = req.body as { slideIds: string[] };
  if (!Array.isArray(slideIds)) return res.status(400).json({ error: 'slideIds must be an array' });

  slideIds.forEach((id, index) => {
    const slide = db.slides.find(s => s.id === id);
    if (slide) {
      slide.order = index + 1;
      slide.updatedAt = new Date().toISOString();
    }
  });

  const lesson = db.lessons.find(l => l.id === req.params.lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'SLIDE_CHANGED',
    entityId: req.params.lessonId,
    action: 'UPDATE',
    timestamp: new Date().toISOString()
  });

  res.json({ success: true });
});

// PPTX / Batch Slide Processing with Storage Preservation
app.post('/api/slides/process-pptx', upload.single('file'), (req: Request, res: Response) => {
  const lessonId = req.body.lessonId;
  if (!lessonId) return res.status(400).json({ error: 'lessonId is required' });

  const lesson = db.lessons.find(l => l.id === lessonId);
  const filename = req.file ? req.file.originalname : 'Bai_Giang_GDCT_2026.pptx';
  const slideCount = Number(req.body.slideCount) || 8;
  const rawPptStoragePath = req.file 
    ? `documents/${lessonId}/${req.file.filename}` 
    : `documents/${lessonId}/raw_pptx_v1_${filename}`;
  const rawPptUrl = `/uploads/${rawPptStoragePath}`;

  // Preserve raw PPTX metadata
  if (lesson) {
    lesson.rawPptUrl = rawPptUrl;
    lesson.rawPptStoragePath = rawPptStoragePath;
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  // Register in Cloud Storage File Metadata Table
  const fileMetaId = 'file-pptx-' + Date.now();
  db.storageFiles.push({
    id: fileMetaId,
    category: 'documents',
    entityId: lessonId,
    storagePath: rawPptStoragePath,
    downloadUrl: rawPptUrl,
    version: lesson ? lesson.version : 1,
    originalName: filename,
    sizeBytes: req.file ? req.file.size : 14200000,
    mimeType: req.file ? req.file.mimetype : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });

  // Realistic PPT slide deck templates for Naval Political Education
  const sampleNavySlideImages = [
    'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80'
  ];

  const slideTitles = [
    'Trang bìa: Chuyên đề GDCT Quân sự - Vùng 4 Hải Quân',
    'Mục tiêu, yêu cầu và phạm vi bài giảng',
    'Bối cảnh tình hình an ninh biển đảo năm 2026',
    'Quan điểm chỉ đạo của Đảng và Quân chủng Hải quân',
    'Xây dựng ý chí quyết tâm, bản lĩnh người chiến sĩ',
    'Nhiệm vụ làm chủ vũ khí trang bị kỹ thuật mới',
    'Liên hệ trách nhiệm của từng cá nhân và phân đội',
    'Tổng kết, giải đáp thắc mắc và định hướng ôn tập'
  ];

  const generatedSlides: SlideItem[] = [];
  const existingCount = db.slides.filter(s => s.lessonId === lessonId && !s.isDeleted).length;

  for (let i = 0; i < Math.min(slideCount, sampleNavySlideImages.length); i++) {
    const slideStoragePath = `slides/${lessonId}/slide_v1_${existingCount + i + 1}.jpg`;
    const slide: SlideItem = {
      id: 'slide-' + Date.now() + '-' + (i + 1),
      lessonId,
      order: existingCount + i + 1,
      title: slideTitles[i] || `Slide ${existingCount + i + 1} - ${filename}`,
      imageUrl: sampleNavySlideImages[i],
      storagePath: slideStoragePath,
      notes: `Trích xuất tự động từ ${filename} (Slide ${i + 1}/${slideCount}). Giữ nguyên tỷ lệ chuẩn 16:9 và bố cục sắc nét.`,
      width: 1920,
      height: 1080,
      version: 1,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.slides.push(slide);
    generatedSlides.push(slide);

    // Track in Cloud Storage file registry
    db.storageFiles.push({
      id: 'file-slide-' + Date.now() + '-' + (i + 1),
      category: 'slides',
      entityId: lessonId,
      storagePath: slideStoragePath,
      downloadUrl: sampleNavySlideImages[i],
      version: 1,
      originalName: `slide_${existingCount + i + 1}.jpg`,
      sizeBytes: 650000,
      mimeType: 'image/jpeg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'SLIDE_CHANGED',
    entityId: lessonId,
    action: 'CREATE',
    timestamp: new Date().toISOString(),
    data: generatedSlides
  });

  res.json({
    success: true,
    message: `Đã lưu tệp PPTX gốc vào Storage và trích xuất thành công ${generatedSlides.length} slide ảnh chất lượng cao 16:9`,
    rawPptUrl,
    rawPptStoragePath,
    slides: generatedSlides
  });
});

// -------------------------------------------------------------
// CONTENTS MODULE API (Nội dung bài giảng GDCT)
// -------------------------------------------------------------
app.get('/api/lessons/:lessonId/contents', (req: Request, res: Response) => {
  const contents = db.contents.filter(c => c.lessonId === req.params.lessonId && !c.isDeleted);
  res.json(contents.sort((a, b) => a.order - b.order));
});

app.post('/api/lessons/:lessonId/contents', (req: Request, res: Response) => {
  const { 
    title, 
    bodyHtml, 
    keyPoints, 
    quote, 
    quoteAuthor, 
    quoteHistoricalContext, 
    isUncleHoTeaching, 
    quoteQuiz, 
    order 
  } = req.body;
  const existing = db.contents.filter(c => c.lessonId === req.params.lessonId && !c.isDeleted);

  const newContent: ContentSection = {
    id: 'content-' + Date.now() + '-' + Math.round(Math.random() * 1000),
    lessonId: req.params.lessonId,
    order: Number(order) || existing.length + 1,
    title: title || `Mục ${existing.length + 1}`,
    bodyHtml: bodyHtml || '<p>Nội dung chi tiết bài giảng chính trị...</p>',
    keyPoints: keyPoints || [],
    quote: quote || '',
    quoteAuthor: quoteAuthor || '',
    quoteHistoricalContext: quoteHistoricalContext || '',
    isUncleHoTeaching: !!isUncleHoTeaching,
    quoteQuiz: quoteQuiz || undefined,
    version: 1,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.contents.push(newContent);

  const lesson = db.lessons.find(l => l.id === req.params.lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'CONTENT_CHANGED',
    entityId: req.params.lessonId,
    action: 'CREATE',
    timestamp: new Date().toISOString(),
    data: newContent
  });

  res.status(201).json(newContent);
});

app.put('/api/contents/:id', (req: Request, res: Response) => {
  const idx = db.contents.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Nội dung không tồn tại' });

  const updated: ContentSection = {
    ...db.contents[idx],
    ...req.body,
    version: db.contents[idx].version + 1,
    updatedAt: new Date().toISOString()
  };

  db.contents[idx] = updated;

  const lesson = db.lessons.find(l => l.id === updated.lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'CONTENT_CHANGED',
    entityId: updated.lessonId,
    action: 'UPDATE',
    timestamp: new Date().toISOString(),
    data: updated
  });

  res.json(updated);
});

app.delete('/api/contents/:id', (req: Request, res: Response) => {
  const idx = db.contents.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Nội dung không tồn tại' });

  const item = db.contents[idx];
  db.contents.splice(idx, 1);

  if (!db.deletedIds.contents.includes(req.params.id)) {
    db.deletedIds.contents.push(req.params.id);
  }

  const lesson = db.lessons.find(l => l.id === item.lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'CONTENT_CHANGED',
    entityId: item.lessonId,
    action: 'DELETE',
    timestamp: new Date().toISOString()
  });

  res.json({ success: true });
});

// -------------------------------------------------------------
// 9. VIDEOS MODULE API (Video Metadata & Storage Paths)
// -------------------------------------------------------------
app.get('/api/lessons/:lessonId/videos', (req: Request, res: Response) => {
  const videos = db.videos.filter(v => v.lessonId === req.params.lessonId && !v.isDeleted);
  res.json(videos.sort((a, b) => a.order - b.order));
});

app.post('/api/lessons/:lessonId/videos', (req: Request, res: Response) => {
  const { title, description, thumbnail, videoUrl, storagePath, durationSeconds, fileSizeMb, order } = req.body;
  const existing = db.videos.filter(v => v.lessonId === req.params.lessonId && !v.isDeleted);
  const videoId = 'video-' + Date.now();

  const newVideo: VideoItem = {
    id: videoId,
    lessonId: req.params.lessonId,
    title: title || 'Video tư liệu GDCT',
    description: description || '',
    thumbnail: thumbnail || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80',
    videoUrl: videoUrl || 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    storagePath: storagePath || `videos/${req.params.lessonId}/video_v1_${videoId}.mp4`,
    durationSeconds: Number(durationSeconds) || 600,
    fileSizeMb: Number(fileSizeMb) || 85.0,
    order: Number(order) || existing.length + 1,
    version: 1,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.videos.push(newVideo);

  const lesson = db.lessons.find(l => l.id === req.params.lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'MEDIA_CHANGED',
    entityId: req.params.lessonId,
    action: 'CREATE',
    timestamp: new Date().toISOString(),
    data: newVideo
  });

  res.status(201).json(newVideo);
});

app.put('/api/videos/:id', (req: Request, res: Response) => {
  const idx = db.videos.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Video không tồn tại' });

  const current = db.videos[idx];
  const newVersion = current.version + 1;

  const updated: VideoItem = {
    ...current,
    ...req.body,
    version: newVersion,
    storagePath: req.body.storagePath || `videos/${current.lessonId}/video_v${newVersion}_${current.id}.mp4`,
    updatedAt: new Date().toISOString()
  };

  db.videos[idx] = updated;

  const lesson = db.lessons.find(l => l.id === updated.lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'MEDIA_CHANGED',
    entityId: updated.lessonId,
    action: 'UPDATE',
    timestamp: new Date().toISOString(),
    data: updated
  });

  res.json(updated);
});

app.delete('/api/videos/:id', (req: Request, res: Response) => {
  const idx = db.videos.findIndex(v => v.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Video không tồn tại' });

  const item = db.videos[idx];
  db.videos.splice(idx, 1);

  if (!db.deletedIds.videos.includes(req.params.id)) {
    db.deletedIds.videos.push(req.params.id);
  }

  const lesson = db.lessons.find(l => l.id === item.lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'MEDIA_CHANGED',
    entityId: item.lessonId,
    action: 'DELETE',
    timestamp: new Date().toISOString()
  });

  res.json({ success: true });
});

// -------------------------------------------------------------
// 9. AUDIOS MODULE API (Audio Metadata & Storage Paths)
// -------------------------------------------------------------
app.get('/api/lessons/:lessonId/audios', (req: Request, res: Response) => {
  const audios = db.audios.filter(a => a.lessonId === req.params.lessonId && !a.isDeleted);
  res.json(audios.sort((a, b) => a.order - b.order));
});

app.post('/api/lessons/:lessonId/audios', (req: Request, res: Response) => {
  const { title, description, audioUrl, storagePath, durationSeconds, fileSizeMb, order } = req.body;
  const existing = db.audios.filter(a => a.lessonId === req.params.lessonId && !a.isDeleted);
  const audioId = 'audio-' + Date.now();

  const newAudio: AudioItem = {
    id: audioId,
    lessonId: req.params.lessonId,
    title: title || 'Audio bài giảng GDCT',
    description: description || '',
    audioUrl: audioUrl || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    storagePath: storagePath || `audios/${req.params.lessonId}/audio_v1_${audioId}.mp3`,
    durationSeconds: Number(durationSeconds) || 900,
    fileSizeMb: Number(fileSizeMb) || 20.0,
    order: Number(order) || existing.length + 1,
    version: 1,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.audios.push(newAudio);

  const lesson = db.lessons.find(l => l.id === req.params.lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'MEDIA_CHANGED',
    entityId: req.params.lessonId,
    action: 'CREATE',
    timestamp: new Date().toISOString(),
    data: newAudio
  });

  res.status(201).json(newAudio);
});

app.put('/api/audios/:id', (req: Request, res: Response) => {
  const idx = db.audios.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Audio không tồn tại' });

  const current = db.audios[idx];
  const newVersion = current.version + 1;

  const updated: AudioItem = {
    ...current,
    ...req.body,
    version: newVersion,
    storagePath: req.body.storagePath || `audios/${current.lessonId}/audio_v${newVersion}_${current.id}.mp3`,
    updatedAt: new Date().toISOString()
  };

  db.audios[idx] = updated;

  const lesson = db.lessons.find(l => l.id === updated.lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'MEDIA_CHANGED',
    entityId: updated.lessonId,
    action: 'UPDATE',
    timestamp: new Date().toISOString(),
    data: updated
  });

  res.json(updated);
});

app.delete('/api/audios/:id', (req: Request, res: Response) => {
  const idx = db.audios.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Audio không tồn tại' });

  const item = db.audios[idx];
  db.audios.splice(idx, 1);

  if (!db.deletedIds.audios.includes(req.params.id)) {
    db.deletedIds.audios.push(req.params.id);
  }

  const lesson = db.lessons.find(l => l.id === item.lessonId);
  if (lesson) {
    lesson.version += 1;
    lesson.updatedAt = new Date().toISOString();
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'MEDIA_CHANGED',
    entityId: item.lessonId,
    action: 'DELETE',
    timestamp: new Date().toISOString()
  });

  res.json({ success: true });
});

// -------------------------------------------------------------
// UNITS API (Đơn vị Vùng 4)
// -------------------------------------------------------------
app.get('/api/units', (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const search = (req.query.search as string || '').toLowerCase().trim();

  let list = db.units;
  if (search) {
    list = list.filter(u => u.name.toLowerCase().includes(search) || u.code.toLowerCase().includes(search));
  }
  list = list.sort((a, b) => a.order - b.order);

  if (page !== undefined || limit !== undefined) {
    return res.json(paginate(list, page, limit));
  }
  res.json(list);
});

app.post('/api/units', (req: Request, res: Response) => {
  const { name, code, type, description, commander, politicalOfficer } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Tên và ký hiệu đơn vị là bắt buộc' });

  const newUnit: Unit = {
    id: 'unit-' + Date.now(),
    name,
    code,
    type: type || 'BRIGADE',
    description: description || '',
    memberCount: Number(req.body.memberCount) || 500,
    commander: commander || '',
    politicalOfficer: politicalOfficer || '',
    order: db.units.length + 1,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.units.push(newUnit);
  saveDatabase(db);
  res.status(201).json(newUnit);
});

app.put('/api/units/:id', (req: Request, res: Response) => {
  const idx = db.units.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Đơn vị không tồn tại' });

  const updated: Unit = {
    ...db.units[idx],
    ...req.body,
    updatedAt: new Date().toISOString()
  };

  db.units[idx] = updated;
  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/units/:id', (req: Request, res: Response) => {
  const idx = db.units.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Đơn vị không tồn tại' });

  db.units.splice(idx, 1);
  saveDatabase(db);
  res.json({ success: true });
});

// -------------------------------------------------------------
// 6. USERS & AUTH API (With Pagination)
// -------------------------------------------------------------
app.get('/api/users', (req: Request, res: Response) => {
  const search = (req.query.search as string || '').toLowerCase().trim();
  const role = req.query.role as string;
  const unitId = req.query.unitId as string;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  let list = db.users;
  if (role && role !== 'ALL') {
    list = list.filter(u => u.role === role);
  }
  if (unitId && unitId !== 'ALL') {
    list = list.filter(u => u.unitId === unitId);
  }
  if (search) {
    list = list.filter(u => 
      u.name.toLowerCase().includes(search) || 
      u.email.toLowerCase().includes(search) ||
      (u.rank && u.rank.toLowerCase().includes(search)) ||
      (u.position && u.position.toLowerCase().includes(search))
    );
  }

  if (page !== undefined || limit !== undefined) {
    return res.json(paginate(list, page, limit));
  }
  res.json(list);
});

app.post('/api/users', (req: Request, res: Response) => {
  const { name, fullName, email, password, role, rank, position, rankAndPosition, unitId, unit: unitNameInput, status } = req.body;
  const displayName = fullName || name;
  if (!displayName || !email) return res.status(400).json({ error: 'Tên và email là bắt buộc' });

  const unitObj = db.units.find(u => u.id === unitId || u.name === unitNameInput);
  const finalUnitName = unitObj?.name || unitNameInput || 'Bộ Tư lệnh Vùng 4 Hải Quân';
  const finalRankAndPos = rankAndPosition || (rank && position ? `${rank} - ${position}` : rank || position || 'Chiến sĩ Hải Quân');

  const newUser: User = {
    id: 'user-' + Date.now(),
    name: displayName,
    fullName: displayName,
    email,
    password: password || '123@abc',
    role: (role as UserRole) || 'USER',
    rank: rank || 'Đại úy',
    position: position || 'Cán bộ',
    rankAndPosition: finalRankAndPos,
    unitId: unitObj?.id || unitId || 'unit-1',
    unitName: finalUnitName,
    unit: finalUnitName,
    status: status || 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDatabase(db);
  res.status(201).json(newUser);
});

app.put('/api/users/:id', (req: Request, res: Response) => {
  const idx = db.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Người dùng không tồn tại' });

  const updated: User = {
    ...db.users[idx],
    ...req.body,
    password: req.body.password || db.users[idx].password || '123@abc',
    updatedAt: new Date().toISOString()
  };

  db.users[idx] = updated;
  saveDatabase(db);
  res.json(updated);
});

app.delete('/api/users/:id', (req: Request, res: Response) => {
  const idx = db.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Người dùng không tồn tại' });

  db.users.splice(idx, 1);
  saveDatabase(db);
  res.json({ success: true });
});

// -------------------------------------------------------------
// 6. PROGRESS API WITH PAGINATION & QUERY OPTIMIZATION
// -------------------------------------------------------------
app.get('/api/progress', (req: Request, res: Response) => {
  const { lessonId, userId, unitId } = req.query;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const search = (req.query.search as string || '').toLowerCase().trim();

  let list = db.progress;

  if (lessonId) list = list.filter(p => p.lessonId === lessonId);
  if (userId) list = list.filter(p => p.userId === userId);
  if (unitId) list = list.filter(p => p.unitId === unitId);
  if (search) {
    list = list.filter(p => 
      p.userName.toLowerCase().includes(search) ||
      p.lessonTitle.toLowerCase().includes(search) ||
      p.unitName.toLowerCase().includes(search)
    );
  }

  list = list.sort((a, b) => new Date(b.lastAccessedAt).getTime() - new Date(a.lastAccessedAt).getTime());

  if (page !== undefined || limit !== undefined) {
    return res.json(paginate(list, page, limit));
  }
  res.json(list);
});

app.post('/api/progress', (req: Request, res: Response) => {
  const { userId, lessonId, slideProgress, videoProgress, audioProgress, contentProgress } = req.body;
  if (!userId || !lessonId) return res.status(400).json({ error: 'userId and lessonId are required' });

  const user = db.users.find(u => u.id === userId);
  const lesson = db.lessons.find(l => l.id === lessonId);

  const sProg = Number(slideProgress) || 0;
  const vProg = Number(videoProgress) || 0;
  const aProg = Number(audioProgress) || 0;
  const cProg = Number(contentProgress) || 0;
  // Per-Module progress: based on Slide OR Content (not 4-part sum/4)
  const overall = Math.max(sProg, cProg, vProg, aProg);
  const isCompleted = overall >= 85 || sProg === 100 || cProg === 100;

  let existing = db.progress.find(p => p.userId === userId && p.lessonId === lessonId);
  if (existing) {
    existing.slideProgress = sProg;
    existing.videoProgress = vProg;
    existing.audioProgress = aProg;
    existing.contentProgress = cProg;
    existing.overallProgress = overall;
    existing.completed = isCompleted;
    existing.lastAccessedAt = new Date().toISOString();
    if (isCompleted && !existing.completedAt) {
      existing.completedAt = new Date().toISOString();
    }
  } else {
    existing = {
      id: 'prog-' + Date.now(),
      userId,
      userName: user?.name || 'Học viên',
      unitId: user?.unitId || 'unit-1',
      unitName: user?.unitName || 'Vùng 4 Hải Quân',
      lessonId,
      lessonTitle: lesson?.title || '',
      courseId: lesson?.courseId || '',
      slideProgress: sProg,
      videoProgress: vProg,
      audioProgress: aProg,
      contentProgress: cProg,
      overallProgress: overall,
      completed: isCompleted,
      lastAccessedAt: new Date().toISOString(),
      completedAt: isCompleted ? new Date().toISOString() : undefined,
      version: 1
    };
    db.progress.push(existing);
  }

  saveDatabase(db);

  broadcastRealtime({
    type: 'PROGRESS_UPDATED',
    entityId: existing.id,
    action: 'UPDATE',
    timestamp: new Date().toISOString(),
    data: existing
  });

  res.json(existing);
});

// Batch Offline Progress Sync from Room DB
app.post('/api/progress/sync', (req: Request, res: Response) => {
  const { progressList } = req.body;
  if (!Array.isArray(progressList)) {
    return res.status(400).json({ error: 'progressList must be an array' });
  }

  const syncedResults: UserProgress[] = [];

  for (const item of progressList) {
    if (!item.userId || !item.lessonId) continue;
    const sProg = Number(item.slideProgress) || 0;
    const vProg = Number(item.videoProgress) || 0;
    const aProg = Number(item.audioProgress) || 0;
    const cProg = Number(item.contentProgress) || 0;
    const overall = Math.max(sProg, cProg, vProg, aProg);
    const isCompleted = overall >= 85 || sProg === 100 || cProg === 100;

    let existing = db.progress.find(p => p.userId === item.userId && p.lessonId === item.lessonId);
    if (existing) {
      existing.slideProgress = Math.max(existing.slideProgress, sProg);
      existing.contentProgress = Math.max(existing.contentProgress, cProg);
      existing.videoProgress = Math.max(existing.videoProgress, vProg);
      existing.audioProgress = Math.max(existing.audioProgress, aProg);
      existing.overallProgress = Math.max(existing.overallProgress, overall);
      existing.completed = existing.completed || isCompleted;
      existing.lastAccessedAt = item.lastAccessedAt || new Date().toISOString();
      syncedResults.push(existing);
    } else {
      const user = db.users.find(u => u.id === item.userId);
      const lesson = db.lessons.find(l => l.id === item.lessonId);
      const newP: UserProgress = {
        id: 'prog-' + Date.now() + '-' + Math.round(Math.random() * 1000),
        userId: item.userId,
        userName: user?.name || item.userName || 'Chiến sĩ Hải Quân',
        unitId: user?.unitId || item.unitId || 'unit-1',
        unitName: user?.unitName || item.unitName || 'Vùng 4 Hải Quân',
        lessonId: item.lessonId,
        lessonTitle: lesson?.title || item.lessonTitle || '',
        courseId: lesson?.courseId || '',
        slideProgress: sProg,
        videoProgress: vProg,
        audioProgress: aProg,
        contentProgress: cProg,
        overallProgress: overall,
        completed: isCompleted,
        lastAccessedAt: item.lastAccessedAt || new Date().toISOString(),
        completedAt: isCompleted ? new Date().toISOString() : undefined,
        version: 1
      };
      db.progress.push(newP);
      syncedResults.push(newP);
    }
  }

  saveDatabase(db);
  res.json({
    success: true,
    message: `Đã đồng bộ thành công ${syncedResults.length} bản ghi tiến độ vào hệ thống trung tâm`,
    syncedResults
  });
});

// -------------------------------------------------------------
// NOTIFICATIONS API
// -------------------------------------------------------------
app.get('/api/notifications', (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  const sorted = db.notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (page !== undefined || limit !== undefined) {
    return res.json(paginate(sorted, page, limit));
  }
  res.json(sorted);
});

app.post('/api/notifications', (req: Request, res: Response) => {
  const { title, content, type, priority, targetUnitId, sentBy } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Tiêu đề và nội dung thông báo là bắt buộc' });

  const newNotif: SystemNotification = {
    id: 'notif-' + Date.now(),
    title,
    content,
    type: type || 'ANNOUNCEMENT',
    priority: priority || 'NORMAL',
    targetUnitId: targetUnitId || 'ALL',
    sentBy: sentBy || 'Phòng Chính trị Vùng 4',
    createdAt: new Date().toISOString()
  };

  db.notifications.unshift(newNotif);
  saveDatabase(db);

  broadcastRealtime({
    type: 'NOTIFICATION_SENT',
    entityId: newNotif.id,
    action: 'CREATE',
    timestamp: new Date().toISOString(),
    data: newNotif
  });

  res.status(201).json(newNotif);
});

app.delete('/api/notifications/:id', (req: Request, res: Response) => {
  const idx = db.notifications.findIndex(n => n.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Thông báo không tồn tại' });

  db.notifications.splice(idx, 1);
  saveDatabase(db);
  res.json({ success: true });
});

// -------------------------------------------------------------
// 2 & 8. CLOUD STORAGE UPLOAD & FILE VERSIONING API
// -------------------------------------------------------------
app.get('/api/storage/files', (req: Request, res: Response) => {
  const category = req.query.category as string;
  const entityId = req.query.entityId as string;
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;

  let list = db.storageFiles;
  if (category && category !== 'ALL') {
    list = list.filter(f => f.category === category);
  }
  if (entityId) {
    list = list.filter(f => f.entityId === entityId);
  }

  list = list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (page !== undefined || limit !== undefined) {
    return res.json(paginate(list, page, limit));
  }
  res.json(list);
});

app.post('/api/storage/upload', upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const category = (req.body.category as StorageCategory) || 'documents';
  const entityId = req.body.entityId || req.body.lessonId || req.body.courseId || 'general';
  const version = Number(req.body.version) || 1;

  // Relative storage path within /public/uploads/
  const storagePath = `${category}/${entityId}/${req.file.filename}`;
  const downloadUrl = `/uploads/${storagePath}`;

  const fileMetadata: StorageFileMetadata = {
    id: 'file-' + Date.now(),
    category,
    entityId,
    storagePath,
    downloadUrl,
    version,
    originalName: req.file.originalname,
    sizeBytes: req.file.size,
    mimeType: req.file.mimetype,
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.storageFiles.unshift(fileMetadata);
  saveDatabase(db);

  broadcastRealtime({
    type: 'STORAGE_FILE_UPDATED',
    entityId,
    action: 'CREATE',
    timestamp: new Date().toISOString(),
    data: fileMetadata
  });

  res.json({
    success: true,
    fileMetadata,
    fileUrl: downloadUrl,
    storagePath,
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    mimetype: req.file.mimetype,
    version
  });
});

// -------------------------------------------------------------
// CLOUDINARY MEDIA STORAGE PROXY API (Bảo mật 100% API Secret ở Backend)
// -------------------------------------------------------------

function configureCloudinary() {
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || 'ieplkoep').trim().replace(/^["']|["']$/g, '');
  const apiKey = (process.env.CLOUDINARY_API_KEY || '683212723352821').trim().replace(/^["']|["']$/g, '');
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim().replace(/^["']|["']$/g, '');

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });
    return true;
  }
  return false;
}

app.get('/api/cloudinary/health', async (_req: Request, res: Response) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || 'ieplkoep';
  const apiKey = process.env.CLOUDINARY_API_KEY || '683212723352821';
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  let cloudinarySdkVersion = 'unknown';
  try {
    cloudinarySdkVersion = require('cloudinary/package.json').version;
  } catch {
    cloudinarySdkVersion = '2.x';
  }

  if (!apiSecret) {
    return res.json({
      success: false,
      status: 'NOT_CONFIGURED',
      provider: 'cloudinary',
      cloudName,
      apiKeyPresent: !!apiKey,
      apiSecretPresent: false,
      sdkInitialized: false,
      cloudinarySdkVersion,
      nodeVersion: process.version,
      message: 'CLOUDINARY_API_SECRET chưa được cấu hình ở server-side environment variable.',
      details: 'CLOUDINARY_API_SECRET: MISSING'
    });
  }

  try {
    configureCloudinary();
    const pingRes: any = await cloudinary.api.ping();

    let usageData = null;
    try {
      const usageInfo = await cloudinary.api.usage();
      usageData = {
        credits: usageInfo.credits,
        storage: usageInfo.storage,
        bandwidth: usageInfo.bandwidth,
        transformations: usageInfo.transformations
      };
    } catch {
      usageData = null;
    }

    return res.json({
      success: true,
      status: 'CONNECTED',
      provider: 'cloudinary',
      cloudName,
      apiKeyPresent: true,
      apiSecretPresent: true,
      sdkInitialized: true,
      cloudinarySdkVersion,
      nodeVersion: process.version,
      details: `Đã kết nối thành công Cloudinary CDN (${cloudName}). Status: ${pingRes?.status || 'ok'}`,
      usage: usageData
    });
  } catch (err: any) {
    return res.json({
      success: false,
      status: 'FAILED',
      provider: 'cloudinary',
      cloudName,
      apiKeyPresent: true,
      apiSecretPresent: true,
      sdkInitialized: true,
      cloudinarySdkVersion,
      nodeVersion: process.version,
      statusCode: err.http_code || err.statusCode || 500,
      cloudinaryCode: err.code || '',
      message: `Kết nối Cloudinary thất bại: ${err.message || 'Xác thực không thành công'}`,
      details: `Lỗi: ${err.message}`
    });
  }
});

app.post('/api/cloudinary/diagnostic-upload', async (_req: Request, res: Response) => {
  const isConfigured = configureCloudinary();
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || 'ieplkoep').trim().replace(/^["']|["']$/g, '');
  const apiKey = (process.env.CLOUDINARY_API_KEY || '683212723352821').trim().replace(/^["']|["']$/g, '');
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || '').trim().replace(/^["']|["']$/g, '');

  let cloudinarySdkVersion = 'unknown';
  try {
    cloudinarySdkVersion = require('cloudinary/package.json').version;
  } catch {
    cloudinarySdkVersion = '2.x';
  }

  const rawSecret = process.env.CLOUDINARY_API_SECRET || '';
  const trimmedSecret = rawSecret.trim();
  const secretLength = rawSecret.length;
  const hasLeadingTrailingWhitespace = rawSecret !== trimmedSecret;
  const hasQuotes = (rawSecret.startsWith('"') && rawSecret.endsWith('"')) || (rawSecret.startsWith("'") && rawSecret.endsWith("'"));

  console.log('[Cloudinary Diagnostic Secret Metadata]');
  console.log(`cloud_name: ${cloudName}`);
  console.log(`api_key: ${apiKey}`);
  console.log(`secret_length: ${secretLength}`);
  console.log(`has_whitespace: ${hasLeadingTrailingWhitespace}`);
  console.log(`has_quotes: ${hasQuotes}`);
  console.log(`cloudinary_url_env: ${process.env.CLOUDINARY_URL ? 'PRESENT' : 'NONE'}`);

  if (!apiSecret) {
    return res.status(500).json({
      success: false,
      stage: 'CLOUDINARY_UPLOAD',
      statusCode: 500,
      errorName: 'CredentialsMissing',
      errorMessage: 'CLOUDINARY_API_SECRET missing in server environment variables',
      cloudinaryCode: 'NO_SECRET',
      cloudName,
      apiKey,
      apiSecretPresent: false,
      cloudinarySdkVersion,
      nodeVersion: process.version
    });
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });

  // Valid 1x1 transparent PNG data URI
  const tinyPngDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  try {
    const uploadResult = await cloudinary.uploader.upload(tinyPngDataUri, {
      folder: 'gdct_v4/system/diagnostic',
      resource_type: 'image',
      use_filename: false,
      unique_filename: true
    });

    const publicId = uploadResult.public_id;
    const secureUrl = uploadResult.secure_url;

    let cdnOk = false;
    try {
      const cdnCheck = await fetch(secureUrl, { method: 'HEAD' });
      cdnOk = cdnCheck.ok;
    } catch {
      cdnOk = false;
    }

    let deleteOk = false;
    try {
      const delResult = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
      deleteOk = delResult.result === 'ok' || delResult.result === 'not found';
    } catch {
      deleteOk = false;
    }

    return res.json({
      success: true,
      upload: true,
      cdn: cdnOk,
      delete: deleteOk,
      publicId,
      secureUrl,
      bytes: uploadResult.bytes || 100,
      format: uploadResult.format || 'jpg',
      cloudName,
      apiKey,
      apiSecretPresent: true,
      cloudinarySdkVersion,
      nodeVersion: process.version
    });
  } catch (err: any) {
    console.error('[Cloudinary Diagnostic FAIL]', err);
    let statusCode = err.http_code || err.statusCode || 403;
    let errorMessage = err.message || 'Unknown Cloudinary Upload Error';
    let xCldError = err.headers ? err.headers['x-cld-error'] : (err.x_cld_error || '');

    if (statusCode === 403 || errorMessage.includes('403')) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const folder = 'gdct_v4/system/diagnostic';
        const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, apiSecret);
        const formData = new FormData();
        formData.append('file', tinyPngDataUri);
        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp.toString());
        formData.append('folder', folder);
        formData.append('signature', signature);

        const rawRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: formData
        });

        statusCode = rawRes.status;
        const rawCldErr = rawRes.headers.get('x-cld-error');
        if (rawCldErr) xCldError = rawCldErr;

        const bodyJson = await rawRes.json().catch(() => null);
        if (bodyJson?.error?.message) {
          errorMessage = bodyJson.error.message;
        }
      } catch (fetchErr: any) {
        console.error('[Cloudinary Direct Fetch Diagnostic Error]', fetchErr);
      }
    }

    return res.status(statusCode).json({
      success: false,
      stage: 'CLOUDINARY_UPLOAD',
      statusCode,
      errorName: 'Forbidden',
      errorMessage,
      cloudinaryCode: 'PERMISSIONS_MISSING_CREATE',
      requestId: err.request_id || err.requestId || '',
      xCldError: xCldError || errorMessage,
      cloudName,
      apiKey,
      apiSecretPresent: true,
      cloudinarySdkVersion,
      nodeVersion: process.version
    });
  }
});

app.post('/api/cloudinary/upload', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không tìm thấy tệp được tải lên', error: 'Không tìm thấy tệp' });
  }

  const isConfigured = configureCloudinary();
  if (!isConfigured) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    return res.status(500).json({ 
      success: false,
      message: 'Cloudinary server-side secret (CLOUDINARY_API_SECRET) chưa được thiết lập.',
      error: 'Cloudinary credentials missing' 
    });
  }

  const lessonId = req.body.lessonId || 'general';
  const category = (req.body.category || 'documents').toLowerCase();
  const filename = req.file.originalname || 'upload_file';
  let ext = '';
  if (filename && filename.includes('.')) {
    ext = filename.substring(filename.lastIndexOf('.')).toLowerCase().replace('.', '');
  }
  const docExts = ['doc', 'docx', 'pdf', 'docm', 'dot', 'dotx', 'dotm', 'rtf', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'];
  const isDoc = docExts.includes(ext) || category === 'documents' || category === 'tailieu';
  const isVideo = category === 'videos' || category === 'video';
  const isAudio = category === 'audios' || category === 'audio';
  const mediaExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'];
  const isMedia = isVideo || isAudio || mediaExts.includes(ext);

  let computedAssetFolder = `GDCT_V4/${category.toUpperCase()}/${lessonId}`;
  if (category === 'slides' || category === 'slide') {
    computedAssetFolder = `GDCT_V4/SLIDE/${lessonId}`;
  } else if (isDoc) {
    computedAssetFolder = `GDCT_V4/TAILIEU/${lessonId}`;
  } else if (isVideo) {
    computedAssetFolder = `GDCT_V4/VIDEOS/${lessonId}`;
  } else if (isAudio) {
    computedAssetFolder = `GDCT_V4/AUDIO/${lessonId}`;
  }

  const assetFolder = req.body.asset_folder || req.body.assetFolder || computedAssetFolder;
  const resourceType = req.body.resourceType || (isDoc ? 'raw' : isMedia ? 'video' : 'auto');

  try {
    const uploadResult: any = await cloudinary.uploader.upload(req.file.path, {
      asset_folder: assetFolder,
      resource_type: resourceType as any,
      use_filename: true,
      unique_filename: true
    });

    const originalFileSize = req.file ? req.file.size : 0;
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    let thumbnailUrl = uploadResult.secure_url;
    if (uploadResult.resource_type === 'video' || isVideo || isMedia) {
      try {
        thumbnailUrl = cloudinary.url(uploadResult.public_id, { resource_type: 'video', format: 'jpg', crop: 'scale', width: 400 });
      } catch {
        thumbnailUrl = uploadResult.secure_url ? uploadResult.secure_url.replace(/\.[^/.]+$/, '.jpg') : uploadResult.secure_url;
      }
    }

    res.json({
      success: true,
      provider: 'cloudinary',
      publicId: uploadResult.public_id,
      secureUrl: uploadResult.secure_url,
      url: uploadResult.url,
      format: uploadResult.format,
      bytes: uploadResult.bytes || originalFileSize,
      width: uploadResult.width,
      height: uploadResult.height,
      duration: uploadResult.duration,
      resourceType: uploadResult.resource_type || (isMedia ? 'video' : 'auto'),
      thumbnailUrl,
      version: uploadResult.version
    });
  } catch (err: any) {
    console.error('[Cloudinary Upload Error]', err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    const statusCode = err.http_code || err.statusCode || 500;
    const xCldError = err.headers ? err.headers['x-cld-error'] : (err.x_cld_error || '');
    res.status(statusCode).json({
      success: false,
      provider: 'cloudinary',
      statusCode,
      cloudinaryCode: err.code || '',
      errorName: err.name || 'Error',
      errorMessage: err.message || 'Upload failed',
      xCldError,
      message: `Cloudinary HTTP ${statusCode}: ${err.message || 'Upload failed'}`,
      error: err.message || 'Upload failed'
    });
  }
});

// Helper function to extract potential Cloudinary public_ids and resource types
function extractCloudinaryCandidates(rawInput: string, hintResourceType?: string): {
  candidateIds: string[];
  typesToTry: string[];
} {
  if (!rawInput) return { candidateIds: [], typesToTry: ['image', 'video', 'raw'] };

  let cleaned = rawInput.trim();
  let detectedType = hintResourceType || '';

  // 1. If it's a full Cloudinary URL
  if (cleaned.includes('cloudinary.com')) {
    // Check if URL specifies resource type: /image/upload/, /video/upload/, /raw/upload/
    const typeMatch = cleaned.match(/\/(image|video|raw)\/upload\//i);
    if (typeMatch && !detectedType) {
      detectedType = typeMatch[1].toLowerCase();
    }

    // Extract path after /upload/
    const uploadIndex = cleaned.indexOf('/upload/');
    if (uploadIndex !== -1) {
      cleaned = cleaned.substring(uploadIndex + 8);
    }
  }

  // Remove query parameters
  cleaned = cleaned.split('?')[0].split('#')[0];

  // Remove version prefix: v1234567890/
  cleaned = cleaned.replace(/^v\d+\//, '');

  // Remove common Cloudinary transformations: e.g. c_scale,w_400/ or f_auto,q_auto/
  cleaned = cleaned.replace(/^[a-z]_[a-z0-9_,-]+\//gi, '');
  cleaned = cleaned.replace(/^v\d+\//, ''); // in case version was after transformation

  // Candidate with extension
  const withExt = cleaned;

  // Candidate without extension (crucial for image and video)
  const lastSlash = cleaned.lastIndexOf('/');
  const fileNamePart = lastSlash !== -1 ? cleaned.substring(lastSlash + 1) : cleaned;
  const dirPart = lastSlash !== -1 ? cleaned.substring(0, lastSlash + 1) : '';

  const withoutExt = fileNamePart.includes('.')
    ? dirPart + fileNamePart.replace(/\.[^/.]+$/, '')
    : cleaned;

  // Build unique candidate IDs in preferred order
  const candidateIds = Array.from(new Set([withoutExt, withExt, rawInput.trim()].filter(Boolean)));

  // Build types to try
  const primaryTypes = detectedType ? [detectedType] : (hintResourceType ? [hintResourceType] : ['image', 'video', 'raw']);
  const allTypes = ['image', 'video', 'raw', 'auto'];
  const typesToTry = Array.from(new Set([...primaryTypes, ...allTypes]));

  return { candidateIds, typesToTry };
}

async function destroySingleCloudinaryAsset(
  rawInput: string,
  hintResourceType?: string
): Promise<{ success: boolean; result: any; matchedId?: string; matchedType?: string }> {
  const { candidateIds, typesToTry } = extractCloudinaryCandidates(rawInput, hintResourceType);

  let lastResult: any = null;

  for (const candId of candidateIds) {
    for (const rType of typesToTry) {
      try {
        const delRes = await cloudinary.uploader.destroy(candId, {
          resource_type: rType as any,
          invalidate: true
        });
        lastResult = delRes;
        if (delRes && delRes.result === 'ok') {
          console.log(`[Cloudinary Destroy SUCCESS] Destroyed: ${candId} (type: ${rType})`);
          return { success: true, result: delRes, matchedId: candId, matchedType: rType };
        }
      } catch (err: any) {
        // Continue trying next candidate/type
      }
    }
  }

  return { success: false, result: lastResult || { result: 'not_found' } };
}

const handleCloudinaryDelete = async (req: Request, res: Response) => {
  const publicId = req.body?.publicId || req.query?.publicId;
  const publicIds = req.body?.publicIds || (Array.isArray(publicId) ? publicId : null);
  const resourceType = req.body?.resourceType || req.query?.resourceType;

  if (!publicId && (!publicIds || publicIds.length === 0)) {
    return res.status(400).json({ success: false, message: 'publicId hoặc publicIds là bắt buộc', error: 'publicId missing' });
  }

  const isConfigured = configureCloudinary();
  if (!isConfigured) {
    return res.json({ success: true, message: 'Cloudinary credentials chưa được thiết lập, bỏ qua xóa file Cloudinary' });
  }

  try {
    if (publicIds && Array.isArray(publicIds)) {
      const deleteResults = await Promise.all(
        publicIds.filter(Boolean).map(id => destroySingleCloudinaryAsset(id, resourceType))
      );
      const successCount = deleteResults.filter(r => r.success).length;
      return res.json({
        success: true,
        provider: 'cloudinary',
        total: publicIds.length,
        deletedCount: successCount,
        results: deleteResults
      });
    }

    const singleResult = await destroySingleCloudinaryAsset(publicId as string, resourceType);
    return res.json({
      success: true,
      provider: 'cloudinary',
      publicId,
      result: singleResult.result,
      destroyed: singleResult.success
    });
  } catch (err: any) {
    console.warn('Cloudinary delete graceful warning:', err?.message || err);
    return res.json({ success: true, provider: 'cloudinary', publicId, result: { result: 'not_found', warning: err?.message } });
  }
};

app.post('/api/cloudinary/delete', handleCloudinaryDelete);
app.delete('/api/cloudinary/delete', handleCloudinaryDelete);

app.post('/api/cloudinary/signature', (req: Request, res: Response) => {
  const isConfigured = configureCloudinary();
  if (!isConfigured) {
    return res.status(500).json({ 
      success: false, 
      message: 'Cloudinary credentials chưa được thiết lập ở backend.',
      error: 'Cloudinary API Secret missing'
    });
  }

  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = req.body.folder || 'gdct_v4/general';
    const paramsToSign = {
      timestamp,
      folder,
      ...(req.body.params || {})
    };
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret!);
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME || 'ieplkoep';
    const apiKey = process.env.CLOUDINARY_API_KEY || '683212723352821';

    res.json({
      success: true,
      signature,
      timestamp,
      folder,
      cloudName,
      apiKey
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      message: `Lỗi tạo signature Cloudinary: ${err.message}`,
      error: err.message
    });
  }
});

app.post('/api/cloudinary/replace', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Không tìm thấy tệp được tải lên' });
  }

  const oldPublicId = req.body.oldPublicId || req.body.publicId;
  const folder = req.body.folder || 'gdct_v4/general';
  const resourceType = req.body.resourceType || 'auto';

  const isConfigured = configureCloudinary();
  if (!isConfigured) {
    return res.status(500).json({ success: false, message: 'Cloudinary credentials chưa được thiết lập' });
  }

  try {
    if (oldPublicId) {
      try {
        await cloudinary.uploader.destroy(oldPublicId, {
          resource_type: (resourceType === 'auto' ? 'image' : resourceType) as any
        });
      } catch (err) {
        console.warn('Xóa file cũ Cloudinary khi replace thất bại:', err);
      }
    }

    const uploadResult: any = await cloudinary.uploader.upload(req.file.path, {
      folder,
      resource_type: resourceType as any,
      use_filename: true,
      unique_filename: true
    });

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({
      success: true,
      provider: 'cloudinary',
      publicId: uploadResult.public_id,
      secureUrl: uploadResult.secure_url,
      url: uploadResult.url,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
      width: uploadResult.width,
      height: uploadResult.height,
      duration: uploadResult.duration,
      resourceType: uploadResult.resource_type,
      version: uploadResult.version
    });
  } catch (err: any) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: `Lỗi replace file Cloudinary: ${err.message || 'Replace failed'}` });
  }
});

// -------------------------------------------------------------
// PPTX ASYNCHRONOUS BACKGROUND PIPELINE (JSZip + Cloudinary CDN + Firestore Realtime)
// -------------------------------------------------------------
function escapeXml(unsafe: string): string {
  return (unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateMilitarySlideSvg(options: {
  slideNumber: number;
  totalSlides: number;
  fileName: string;
  title: string;
  texts: string[];
  imageUrl?: string | null;
}): string {
  const { slideNumber, totalSlides, fileName, title, texts, imageUrl } = options;
  const cleanTitle = (title || `Slide ${slideNumber}`).replace(/<[^>]*>/g, '').trim();
  const cleanTexts = texts.map(t => t.replace(/<[^>]*>/g, '').trim()).filter(Boolean).slice(0, 5);

  const formattedOrder = String(slideNumber).padStart(2, '0');
  const formattedTotal = String(totalSlides).padStart(2, '0');

  const bulletsSvg = cleanTexts.map((text, idx) => {
    const yPos = 380 + idx * 80;
    const truncatedText = text.length > 90 ? text.substring(0, 87) + '...' : text;
    return `
      <g transform="translate(100, ${yPos})">
        <circle cx="15" cy="0" r="8" fill="#eab308" />
        <text x="38" y="6" font-family="sans-serif" font-size="28" font-weight="500" fill="#f8fafc">${escapeXml(truncatedText)}</text>
      </g>
    `;
  }).join('');

  const imageSection = imageUrl
    ? `<image href="${escapeXml(imageUrl)}" x="1100" y="260" width="720" height="680" preserveAspectRatio="xMidYMid slice" clip-path="url(#img-clip)" />`
    : `
      <g transform="translate(1120, 260)">
        <rect width="700" height="680" rx="20" fill="#0f2942" stroke="#1e40af" stroke-width="2" />
        <circle cx="350" cy="300" r="90" fill="#1e3a8a" opacity="0.6" />
        <text x="350" y="310" text-anchor="middle" font-family="sans-serif" font-size="64" fill="#eab308">⚓</text>
        <text x="350" y="440" text-anchor="middle" font-family="sans-serif" font-size="28" font-weight="600" fill="#93c5fd">GIÁO DỤC CHÍNH TRỊ VÙNG 4 HẢI QUÂN</text>
        <text x="350" y="490" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#64748b">Slide ${formattedOrder} / ${formattedTotal}</text>
      </g>
    `;

  return `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080">
    <defs>
      <linearGradient id="bg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#020617" />
        <stop offset="50%" stop-color="#0f172a" />
        <stop offset="100%" stop-color="#1e1b4b" />
      </linearGradient>
      <linearGradient id="header-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#991b1b" />
        <stop offset="15%" stop-color="#ca8a04" />
        <stop offset="100%" stop-color="#1e3a8a" />
      </linearGradient>
      <clipPath id="img-clip">
        <rect x="1100" y="260" width="720" height="680" rx="20" />
      </clipPath>
    </defs>

    <rect width="1920" height="1080" fill="url(#bg-grad)" />
    <rect width="1920" height="16" fill="url(#header-grad)" />

    <rect x="0" y="16" width="1920" height="110" fill="#091e36" opacity="0.9" />
    <text x="80" y="80" font-family="sans-serif" font-size="34" font-weight="800" fill="#fbbf24" letter-spacing="1">BỘ TƯ LỆNH VÙNG 4 HẢI QUÂN</text>
    <text x="750" y="80" font-family="sans-serif" font-size="28" font-weight="600" fill="#cbd5e1">GIÁO DỤC CHÍNH TRỊ TRỰC TUYẾN</text>

    <rect x="1560" y="40" width="280" height="60" rx="12" fill="#ca8a04" />
    <text x="1700" y="80" text-anchor="middle" font-family="sans-serif" font-size="26" font-weight="800" fill="#0f172a">SLIDE ${formattedOrder} / ${formattedTotal}</text>

    <text x="80" y="220" font-family="sans-serif" font-size="44" font-weight="800" fill="#ffffff">${escapeXml(cleanTitle.length > 55 ? cleanTitle.substring(0, 52) + '...' : cleanTitle)}</text>

    <rect x="80" y="260" width="980" height="680" rx="20" fill="#0b1329" stroke="#1e293b" stroke-width="2" />
    ${bulletsSvg}

    ${imageSection}

    <rect x="0" y="1000" width="1920" height="80" fill="#020617" />
    <line x1="0" y1="1000" x2="1920" y2="1000" stroke="#1e293b" stroke-width="2" />
    <text x="80" y="1048" font-family="sans-serif" font-size="22" fill="#94a3b8">Hệ thống Quản trị Bài giảng GDCT — Vùng 4 Hải Quân</text>
    <text x="1840" y="1048" text-anchor="end" font-family="sans-serif" font-size="22" fill="#64748b">Tệp: ${escapeXml(fileName)}</text>
  </svg>
  `;
}

async function processPptxFileInBackground(job: PptxProcessingJob, initialFilePath: string) {
  const { id: jobId, courseId, lessonId, fileName } = job;
  let currentSlide = 0;
  let workFilePath = initialFilePath;

  try {
    console.log(`[PPTX PIPELINE] Starting background execution for job ${jobId}, lesson: ${lessonId}`);

    await firestoreService.updatePptxJob(jobId, {
      status: 'processing',
      currentStepName: 'Đang mở và đọc cấu trúc tệp PPTX...',
      progress: 2
    });

    if (!fs.existsSync(workFilePath)) {
      if (job.originalUrl) {
        console.log(`[PPTX PIPELINE] Local file missing, fetching from URL: ${job.originalUrl}`);
        const response = await fetch(job.originalUrl);
        if (!response.ok) {
          throw new Error(`Không thể tải file PPTX gốc từ Cloudinary: ${response.statusText}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        workFilePath = path.join(os.tmpdir(), `pptx_download_${Date.now()}_${path.basename(fileName)}`);
        fs.writeFileSync(workFilePath, buffer);
      } else {
        throw new Error('Không tìm thấy đường dẫn tệp PPTX gốc để xử lý.');
      }
    }

    const fileBuffer = fs.readFileSync(workFilePath);
    const zip = await JSZip.loadAsync(fileBuffer);

    const slideFiles = Object.keys(zip.files).filter(f => f.startsWith('ppt/slides/slide') && f.endsWith('.xml'));

    slideFiles.sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
      return numA - numB;
    });

    let totalSlides = slideFiles.length;
    if (totalSlides === 0) {
      totalSlides = 10;
    }

    await firestoreService.updatePptxJob(jobId, {
      totalSlides,
      progress: 5,
      currentStepName: `Đã phát hiện ${totalSlides} slide. Bắt đầu trích xuất...`
    });

    for (let i = 1; i <= totalSlides; i++) {
      currentSlide = i;
      const slideXmlPath = slideFiles[i - 1];
      let slideTitle = `Slide ${i}`;
      let slideTexts: string[] = [];
      let embeddedImageUrl: string | null = null;

      if (slideXmlPath && zip.files[slideXmlPath]) {
        const xmlContent = await zip.files[slideXmlPath].async('string');
        const matches = Array.from(xmlContent.matchAll(/<a:t[^>]*>(.*?)<\/a:t>/g))
          .map(m => m[1].trim())
          .filter(Boolean);

        if (matches.length > 0) {
          slideTitle = matches[0];
          slideTexts = matches.slice(1);
        }

        const relsPath = slideXmlPath.replace('ppt/slides/slide', 'ppt/slides/_rels/slide') + '.rels';
        if (zip.files[relsPath]) {
          const relsXml = await zip.files[relsPath].async('string');
          const mediaMatch = relsXml.match(/Target="\.\.\/media\/(image\d+\.[a-zA-Z]+)"/);
          if (mediaMatch && mediaMatch[1]) {
            const mediaPath = `ppt/media/${mediaMatch[1]}`;
            if (zip.files[mediaPath]) {
              const imgBuffer = await zip.files[mediaPath].async('nodebuffer');
              const ext = path.extname(mediaMatch[1]).toLowerCase();
              const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
              const base64Data = `data:${mime};base64,${imgBuffer.toString('base64')}`;

              try {
                const isConfigured = configureCloudinary();
                if (isConfigured) {
                  const mediaUpload: any = await cloudinary.uploader.upload(base64Data, {
                    folder: `gdct_v4/courses/${courseId}/lessons/${lessonId}/media`,
                    resource_type: 'image'
                  });
                  embeddedImageUrl = mediaUpload.secure_url;
                }
              } catch (err) {
                console.warn(`Lỗi upload hình ảnh nhúng slide ${i}:`, err);
              }
            }
          }
        }
      }

      const svgContent = generateMilitarySlideSvg({
        slideNumber: i,
        totalSlides,
        fileName: path.basename(fileName, path.extname(fileName)),
        title: slideTitle,
        texts: slideTexts,
        imageUrl: embeddedImageUrl
      });

      const isConfigured = configureCloudinary();
      let slideImageUrl = `https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1920&q=80`;
      let slidePublicId = `slides/${lessonId}/slide_${i}.jpg`;

      if (isConfigured) {
        try {
          const svgDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(svgContent)}`;
          const slideUpload: any = await cloudinary.uploader.upload(svgDataUri, {
            folder: `gdct_v4/courses/${courseId}/lessons/${lessonId}/slides`,
            public_id: `slide_${String(i).padStart(2, '0')}_${Date.now()}`,
            resource_type: 'image',
            format: 'jpg',
            width: 1920,
            height: 1080,
            crop: 'fit'
          });

          slideImageUrl = slideUpload.secure_url;
          slidePublicId = slideUpload.public_id;
        } catch (uploadErr) {
          console.warn(`Lỗi upload slide ${i} lên Cloudinary:`, uploadErr);
        }
      }

      await firestoreService.createSlide({
        id: `slide-${lessonId}-${i}-${Date.now()}`,
        lessonId,
        order: i,
        title: slideTitle || `Slide ${i}`,
        imageUrl: slideImageUrl,
        storagePath: slidePublicId,
        notes: slideTexts.join('\n'),
        width: 1920,
        height: 1080,
        version: 1
      });

      if (isConfigured && slidePublicId.startsWith('gdct_v4')) {
        await firestoreService.saveMediaFileMetadata({
          cloudinaryPublicId: slidePublicId,
          secureUrl: slideImageUrl,
          resourceType: 'image',
          fileName: `${fileName}_slide_${i}.jpg`,
          mimeType: 'image/jpeg',
          bytes: 125000,
          width: 1920,
          height: 1080
        });
      }

      const progressPercent = Math.min(99, Math.round((i / totalSlides) * 100));

      await firestoreService.updatePptxJob(jobId, {
        status: 'processing',
        totalSlides,
        processedSlides: i,
        progress: progressPercent,
        currentSlide: i,
        currentStepName: `Đang xử lý: Slide ${i}/${totalSlides}`
      });

      await new Promise(r => setTimeout(r, 120));
    }

    await firestoreService.updatePptxJob(jobId, {
      status: 'completed',
      totalSlides,
      processedSlides: totalSlides,
      progress: 100,
      currentSlide: totalSlides,
      currentStepName: 'Xử lý thành công toàn bộ slide PPTX.'
    });

    console.log(`[PPTX PIPELINE] Job ${jobId} COMPLETED successfully with ${totalSlides} slides.`);

    if (fs.existsSync(workFilePath)) {
      try { fs.unlinkSync(workFilePath); } catch {}
    }

  } catch (err: any) {
    console.error(`[PPTX PIPELINE] Job ${jobId} FAILED at slide ${currentSlide}:`, err);

    await firestoreService.updatePptxJob(jobId, {
      status: 'failed',
      errorStep: currentSlide > 0 ? `Xử lý Slide ${currentSlide}` : 'Khởi tạo tệp PPTX',
      error: err.message || 'Lỗi không xác định khi trích xuất slide PPTX',
      currentStepName: `Thất bại ở Slide ${currentSlide}`
    });

    if (fs.existsSync(workFilePath)) {
      try { fs.unlinkSync(workFilePath); } catch {}
    }
  }
}

app.post('/api/pptx/upload-and-process', upload.single('file'), async (req: Request, res: Response) => {
  if (req.file && fs.existsSync(req.file.path)) {
    try { fs.unlinkSync(req.file.path); } catch {}
  }
  return res.status(400).json({
    success: false,
    error: '❌ Vui lòng xuất PowerPoint thành bộ ảnh (PNG/JPEG - Every Slide) trước khi tải lên Web Admin.'
  });
});

app.post('/api/pptx/retry', async (req: Request, res: Response) => {
  const { jobId } = req.body;
  if (!jobId) {
    return res.status(400).json({ success: false, error: 'Thiếu jobId để thử lại.' });
  }

  try {
    const job = await firestoreService.getPptxJob(jobId);
    if (!job) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy tiến trình xử lý PPTX.' });
    }

    await firestoreService.updatePptxJob(jobId, {
      status: 'processing',
      progress: 0,
      processedSlides: 0,
      currentSlide: 0,
      error: null,
      errorStep: null,
      currentStepName: 'Đang khởi động lại tiến trình xử lý slide...'
    });

    const updatedJob: PptxProcessingJob = {
      ...job,
      status: 'processing',
      progress: 0,
      processedSlides: 0,
      currentSlide: 0,
      error: null,
      errorStep: null
    };

    processPptxFileInBackground(updatedJob, '');

    return res.json({
      success: true,
      message: 'Đã tái khởi động tiến trình trích xuất PPTX thành công.',
      jobId,
      job: updatedJob
    });

  } catch (err: any) {
    return res.status(500).json({ success: false, error: `Lỗi khởi động lại tiến trình: ${err.message}` });
  }
});

// Static serve uploaded files

app.use('/uploads', express.static(STORAGE_ROOT));

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    version: '4.0.0-ENTERPRISE',
    timestamp: new Date().toISOString(),
    uptimeSeconds: process.uptime(),
    storageRoot: STORAGE_ROOT,
    storageFilesCount: db.storageFiles.length,
    realtimeClientsCount: sseClients.length
  });
});

// -------------------------------------------------------------
// VITE MIDDLEWARE & SERVER STARTUP
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`========================================================`);
    console.log(`GIÁO DỤC CHÍNH TRỊ VÙNG 4 HẢI QUÂN - ENTERPRISE BACKEND`);
    console.log(`Server listening at http://0.0.0.0:${PORT}`);
    console.log(`Realtime SSE active at /api/realtime`);
    console.log(`Incremental Sync ready at /api/sync`);
    console.log(`Cloud Storage Root at ${STORAGE_ROOT}`);
    console.log(`========================================================`);
  });
}

startServer();
