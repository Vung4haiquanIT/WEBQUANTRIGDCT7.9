import { Course, PublishStatus } from '../types';

export type FixedCategoryKey = 'GDCT' | 'GDPL' | 'LICH_SU' | 'BIEN_DAO';

export interface FixedCourseDefinition {
  id: string;
  code: string;
  categoryKey: FixedCategoryKey;
  title: string;
  shortTitle: string;
  badgeLabel: string;
  description: string;
  thumbnail: string;
  storageThumbnailPath: string;
  year: number;
  order: number;
  status: PublishStatus;
  createdBy: string;
}

export const FIXED_COURSES_DEFINITIONS: FixedCourseDefinition[] = [
  {
    id: 'course-1',
    code: 'GDCT',
    categoryKey: 'GDCT',
    title: 'Giáo dục chính trị (GDCT)',
    shortTitle: 'GDCT',
    badgeLabel: 'GDCT',
    description: 'Chương trình giáo dục chính trị trọng tâm năm 2026 cho sĩ quan, QNCN, hạ sĩ quan - binh sĩ thuộc Vùng 4 Hải Quân.',
    thumbnail: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=800&q=80',
    storageThumbnailPath: 'thumbnails/course-1/thumb_v1_course1.jpg',
    year: 2026,
    order: 1,
    status: 'PUBLISHED',
    createdBy: 'Phòng Chính trị Vùng 4'
  },
  {
    id: 'course-gdpl',
    code: 'GDPL',
    categoryKey: 'GDPL',
    title: 'Giáo dục pháp luật (GDPL)',
    shortTitle: 'GDPL',
    badgeLabel: 'GDPL',
    description: 'Tuyên truyền, phổ biến và giáo dục pháp luật Nhà nước, kỷ luật Quân đội nhân dân Việt Nam, xây dựng đơn vị chính quy, mẫu mực.',
    thumbnail: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=800&q=80',
    storageThumbnailPath: 'thumbnails/course-gdpl/thumb_v1_course_gdpl.jpg',
    year: 2026,
    order: 2,
    status: 'PUBLISHED',
    createdBy: 'Phòng Chính trị Vùng 4'
  },
  {
    id: 'course-3',
    code: 'LSTT',
    categoryKey: 'LICH_SU',
    title: 'Lịch sử truyền thống',
    shortTitle: 'LỊCH SỬ TRUYỀN THỐNG',
    badgeLabel: 'LỊCH SỬ TRUYỀN THỐNG',
    description: 'Giáo dục truyền thống vẻ vang đánh thắng trận đầu của Hải quân nhân dân Việt Nam và ý chí kiên trung của quân dân Trường Sa.',
    thumbnail: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=800&q=80',
    storageThumbnailPath: 'thumbnails/course-3/thumb_v1_course3.jpg',
    year: 2026,
    order: 3,
    status: 'PUBLISHED',
    createdBy: 'Ban Tuyên huấn Vùng 4'
  },
  {
    id: 'course-2',
    code: 'BDVN',
    categoryKey: 'BIEN_DAO',
    title: 'Biển đảo Việt Nam',
    shortTitle: 'BIỂN ĐẢO VIỆT NAM',
    badgeLabel: 'BIỂN ĐẢO VIỆT NAM',
    description: 'Nâng cao nhận thức về tình hình Biển Đông, nhiệm vụ bảo vệ vững chắc chủ quyền quần đảo Trường Sa và vùng biển được phân công.',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    storageThumbnailPath: 'thumbnails/course-2/thumb_v1_course2.jpg',
    year: 2026,
    order: 4,
    status: 'PUBLISHED',
    createdBy: 'Phòng Chính trị Vùng 4'
  }
];

/**
 * Kiểm tra một chuyên đề có thuộc 4 chuyên đề cố định đồng bộ với tiện ích App hay không
 */
export function isFixedCourse(course: { id?: string; code?: string; title?: string; isFixed?: boolean; categoryKey?: string } | null | undefined): boolean {
  if (!course) return false;
  if (course.isFixed === false) return false;
  if (course.isFixed === true) return true;

  const id = (course.id || '').trim().toLowerCase();
  const code = (course.code || '').trim().toUpperCase();
  const title = (course.title || '').trim().toLowerCase();
  const catKey = (course.categoryKey || '').trim().toUpperCase();

  // Explicit category keys
  if (['GDCT', 'GDPL', 'LICH_SU', 'BIEN_DAO', 'LSTT', 'BDVN', 'LICHSU', 'BIENDAO'].includes(catKey)) {
    return true;
  }

  // Explicit IDs
  if (['course-1', 'course-2', 'course-3', 'course-gdct', 'course-gdpl', 'course-lich-su', 'course-bien-dao'].includes(id)) {
    return true;
  }

  // Explicit Codes
  if (['GDCT', 'GDPL', 'LSTT', 'BDVN', 'LICHSU', 'BIENDAO'].includes(code)) {
    return true;
  }

  // Title matching
  // 1. GDCT
  if (
    title.includes('giáo dục chính trị') || 
    title.includes('giao duc chinh tri') ||
    title.startsWith('gdct') || 
    title.includes('(gdct)')
  ) {
    return true;
  }

  // 2. GDPL / Tủ sách pháp luật
  if (
    title.includes('giáo dục pháp luật') || 
    title.includes('giao duc phap luat') ||
    title.startsWith('gdpl') || 
    title.includes('(gdpl)') ||
    title.includes('tủ sách pháp luật') ||
    title.includes('tu sach phap luat') ||
    catKey === 'TSPL'
  ) {
    return true;
  }

  // 3. Lịch sử truyền thống
  if (
    title.includes('lịch sử truyền thống') || 
    title.includes('lich su truyen thong') ||
    title.includes('đoàn tàu không số') ||
    title.includes('truyền thống anh hùng')
  ) {
    return true;
  }

  // 4. Biển đảo Việt Nam
  if (
    title.includes('biển đảo việt nam') || 
    title.includes('bien dao viet nam') ||
    title.includes('chủ quyền biển, đảo') ||
    title.includes('quần đảo trường sa') ||
    title.includes('biển, đảo, thềm lục địa')
  ) {
    return true;
  }

  return false;
}

/**
 * Trả về thông tin danh mục cố định tương ứng của chuyên đề
 */
export function getFixedCourseCategory(course: { id?: string; code?: string; title?: string; isFixed?: boolean; categoryKey?: string } | null | undefined): FixedCourseDefinition | null {
  if (!course) return null;

  const id = (course.id || '').trim().toLowerCase();
  const code = (course.code || '').trim().toUpperCase();
  const title = (course.title || '').trim().toLowerCase();
  const catKey = (course.categoryKey || '').trim().toUpperCase();

  if (catKey === 'GDCT' || code === 'GDCT' || id === 'course-1' || id === 'course-gdct' || title.includes('chính trị') || title.includes('gdct')) {
    return FIXED_COURSES_DEFINITIONS[0]; // GDCT
  }

  if (catKey === 'GDPL' || code === 'GDPL' || id === 'course-gdpl' || title.includes('pháp luật') || title.includes('gdpl')) {
    return FIXED_COURSES_DEFINITIONS[1]; // GDPL
  }

  if (catKey === 'LICH_SU' || code === 'LSTT' || id === 'course-3' || id === 'course-lich-su' || title.includes('lịch sử') || title.includes('truyền thống')) {
    return FIXED_COURSES_DEFINITIONS[2]; // LỊCH SỬ TRUYỀN THỐNG
  }

  if (catKey === 'BIEN_DAO' || code === 'BDVN' || id === 'course-2' || id === 'course-bien-dao' || title.includes('biển đảo') || title.includes('biển, đảo')) {
    return FIXED_COURSES_DEFINITIONS[3]; // BIỂN ĐẢO VIỆT NAM
  }

  return null;
}
