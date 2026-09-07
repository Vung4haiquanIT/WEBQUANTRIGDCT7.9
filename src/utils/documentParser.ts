import mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { LessonQuestion, QuestionType } from '../types';
import { sanitizeFirestoreData } from './firestoreUtils';

// Configure pdfjs worker for browser environment safely
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version || '4.10.38'}/build/pdf.worker.min.mjs`;
} catch (e) {
  console.warn('Unable to set pdfjs workerSrc:', e);
}

export interface ProposedItem {
  title: string;
  bodyHtml: string;
  paragraphs: string[];
  questions?: Partial<LessonQuestion>[];
}

export interface ProposedSection {
  title: string;
  items: ProposedItem[];
}

export interface ParsedDocumentResult {
  fileName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  pageCount?: number;
  title?: string;
  rawText: string;
  bodyHtml: string;
  proposedSections?: ProposedSection[];
  sections?: ProposedSection[];
  isScannedPdf?: boolean;
  docParserUnavailable?: boolean;
}

/**
 * Extracts full text and page count from a PDF file using pdfjs-dist
 */
async function parsePdfFile(file: File): Promise<{ text: string; pageCount?: number; isScanned?: boolean }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      stopAtErrors: false
    });
    const pdfDoc = await loadingTask.promise;
    const totalPages = pdfDoc.numPages;

    let fullText = '';
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      try {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageItems = textContent.items
          .map((item: any) => item.str || '')
          .filter(Boolean);
        const pageText = pageItems.join(' ');
        if (pageText.trim()) {
          fullText += pageText + '\n\n';
        }
      } catch (pageErr) {
        console.warn(`Warning reading PDF page ${pageNum}:`, pageErr);
      }
    }

    const trimmed = fullText.trim();
    if (!trimmed || trimmed.length < 30) {
      return {
        text: 'Tài liệu PDF dạng hình ảnh, cần OCR để trích xuất nội dung.',
        pageCount: totalPages > 0 ? totalPages : undefined,
        isScanned: true
      };
    }

    return {
      text: trimmed,
      pageCount: totalPages > 0 ? totalPages : undefined,
      isScanned: false
    };
  } catch (err) {
    console.error('Error parsing PDF file with pdfjs-dist:', err);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      const raw = textDecoder.decode(arrayBuffer);
      const textMatches = raw.match(/\(([^()]{4,})\)\s*T[jJ]/g) || [];
      const extracted = textMatches.map(m => m.replace(/[()]/g, '').trim()).filter(Boolean).join(' ');

      if (extracted && extracted.length > 30) {
        return { text: extracted, pageCount: undefined, isScanned: false };
      }
    } catch (fallbackErr) {
      console.warn('PDF fallback extraction failed:', fallbackErr);
    }

    return {
      text: 'Tài liệu PDF dạng hình ảnh, cần OCR để trích xuất nội dung.',
      pageCount: undefined,
      isScanned: true
    };
  }
}

/**
 * Extracts readable Vietnamese / Unicode text from binary Word 97-2003 (.doc / .dot) files
 */
async function parseBinaryDocFile(file: File): Promise<{ text: string; docParserUnavailable?: boolean }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    
    const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
    const utf16Decoder = new TextDecoder('utf-16le', { fatal: false });
    
    const rawUtf8 = utf8Decoder.decode(bytes);
    const rawUtf16 = utf16Decoder.decode(bytes);
    
    const vietnameseRegex = /[a-zA-Zàáảãạâầấẩẫậăằắẳẵặeèéẻẽẹêềếểễệiìíỉĩịoòóỏõọôồốổỗộơờớởỡợuùúủũụưừứửữựyỳýỷỹđ]/i;

    const lines8 = rawUtf8.split(/[\r\n]+/)
      .map(l => l.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F\u0180-\u024F\u1EA0-\u1EF9]/g, ' ').trim())
      .filter(l => l.length > 8 && vietnameseRegex.test(l));

    const lines16 = rawUtf16.split(/[\r\n]+/)
      .map(l => l.replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F\u0180-\u024F\u1EA0-\u1EF9]/g, ' ').trim())
      .filter(l => l.length > 8 && vietnameseRegex.test(l));

    const combinedText = lines8.length >= lines16.length ? lines8.join('\n\n') : lines16.join('\n\n');

    if (combinedText.trim().length > 30) {
      return { text: combinedText.trim(), docParserUnavailable: false };
    }

    return {
      text: `Tài liệu Word binary (.doc) thế hệ cũ: ${file.name}.\nHệ thống đã lưu thông tin tệp. Bạn có thể tải tệp về mở xem trực tiếp bằng Microsoft Word.`,
      docParserUnavailable: true
    };
  } catch (e) {
    return {
      text: `Tài liệu Word (.doc): ${file.name}.\nHệ thống đã lưu thông tin tệp. Bạn có thể tải tệp về xem bằng Microsoft Word.`,
      docParserUnavailable: true
    };
  }
}

/**
 * Extracts plain text from RTF files
 */
async function parseRtfFile(file: File): Promise<string> {
  try {
    const rawText = await file.text();
    const clean = rawText
      .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
        try { return String.fromCharCode(parseInt(hex, 16)); } catch { return ''; }
      })
      .replace(/\\u(\d+)\??/g, (_, dec) => {
        try { return String.fromCharCode(parseInt(dec, 10)); } catch { return ''; }
      })
      .replace(/\\par\b/g, '\n')
      .replace(/\\line\b/g, '\n')
      .replace(/\\tab\b/g, '\t')
      .replace(/\\[a-zA-Z]+\d*\s?/g, '')
      .replace(/[{}]/g, '');

    const lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    return lines.join('\n\n');
  } catch (err) {
    console.error('Error reading RTF file:', err);
    return `Nội dung tài liệu RTF: ${file.name}`;
  }
}

/**
 * Parses uploaded DOCX, DOC, DOCM, DOT, DOTX, DOTM, RTF, or PDF files
 */
export async function parseDocumentFile(file: File, onProgress?: (stage: string) => void): Promise<ParsedDocumentResult> {
  if (onProgress) onProgress('Đang đọc...');
  const fileName = file.name;
  const fileSize = file.size;
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  let rawText = '';
  let bodyHtml = '';
  let detectedPageCount: number | undefined = undefined;
  let isScannedPdf = false;
  let docParserUnavailable = false;

  const openXmlFormats = ['docx', 'docm', 'dotx', 'dotm'];
  const legacyWordFormats = ['doc', 'dot'];

  if (openXmlFormats.includes(ext)) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
      bodyHtml = htmlResult.value;

      const rawResult = await mammoth.extractRawText({ arrayBuffer });
      rawText = rawResult.value;
    } catch (err) {
      console.warn(`Mammoth parsing failed for .${ext}, falling back to plain text reader:`, err);
      rawText = await readAsPlainText(file);
      bodyHtml = textToSimpleHtml(rawText);
    }
  } else if (legacyWordFormats.includes(ext)) {
    const legacyRes = await parseBinaryDocFile(file);
    rawText = legacyRes.text;
    docParserUnavailable = !!legacyRes.docParserUnavailable;
    bodyHtml = textToSimpleHtml(rawText);
  } else if (ext === 'rtf') {
    rawText = await parseRtfFile(file);
    bodyHtml = textToSimpleHtml(rawText);
  } else if (ext === 'pdf') {
    const pdfRes = await parsePdfFile(file);
    rawText = pdfRes.text;
    detectedPageCount = pdfRes.pageCount;
    isScannedPdf = !!pdfRes.isScanned;
    bodyHtml = textToSimpleHtml(rawText);
  } else {
    rawText = await readAsPlainText(file);
    bodyHtml = textToSimpleHtml(rawText);
  }

  if (!rawText || rawText.trim().length === 0) {
    throw new Error('Không trích xuất được nội dung từ tài liệu.');
  }

  const proposedSections = parseSectionsFromText(rawText);

  const parsedObj: ParsedDocumentResult = {
    fileName,
    fileSize,
    fileType: ext || 'docx',
    mimeType: file.type || getMimeTypeFromExt(ext),
    title: fileName.replace(/\.[^/.]+$/, ''),
    rawText,
    bodyHtml
  };

  if (detectedPageCount && detectedPageCount > 0) {
    parsedObj.pageCount = detectedPageCount;
  }

  const safeSections = proposedSections || [];
  parsedObj.proposedSections = safeSections;
  parsedObj.sections = safeSections;

  if (isScannedPdf) {
    parsedObj.isScannedPdf = true;
  }

  if (docParserUnavailable) {
    parsedObj.docParserUnavailable = true;
  }

  return sanitizeFirestoreData(parsedObj);
}

function getMimeTypeFromExt(ext: string): string {
  switch (ext) {
    case 'pdf': return 'application/pdf';
    case 'doc': return 'application/msword';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'docm': return 'application/vnd.ms-word.document.macroEnabled.12';
    case 'dotx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.template';
    case 'dotm': return 'application/vnd.ms-word.template.macroEnabled.12';
    case 'rtf': return 'application/rtf';
    default: return 'application/octet-stream';
  }
}

/**
 * Heuristic structure extractor for military political education documents.
 * Guarantees that every document produces a clean hierarchy of Sections -> Items -> Questions.
 */
export function parseSectionsFromText(text: string): ProposedSection[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const sections: ProposedSection[] = [];

  const sectionRegex = /^(PHẦN|CHƯƠNG|BÀI|CHUYÊN ĐỀ|CHỦ ĐỀ|PART|SECTION)\s+([0-9IVXLCDM]+|THỨ\s+[A-ZÀ-Ỹ]+|[0-9]+)\b(.*)/i;
  const uppercaseHeadingRegex = /^[A-Z0-9I-V]+\.\s+[A-ZÀ-Ỹ0-9\s,\.-]{5,100}$/;

  let currentSectionTitle = 'PHẦN I: NỘI DUNG GIÁO DỤC CHÍNH TRỊ';
  let currentParagraphs: string[] = [];

  const flushSection = () => {
    if (currentParagraphs.length > 0 || sections.length === 0) {
      const bodyHtml = currentParagraphs
        .map(p => {
          if (sectionRegex.test(p) || uppercaseHeadingRegex.test(p)) {
            return `<h4>${escapeHtml(p)}</h4>`;
          }
          return `<p>${escapeHtml(p)}</p>`;
        })
        .join('\n');

      sections.push({
        title: currentSectionTitle,
        items: [
          {
            title: `Nội dung chi tiết - ${currentSectionTitle}`,
            bodyHtml: bodyHtml || '<p>Nội dung đang cập nhật...</p>',
            paragraphs: currentParagraphs,
            questions: generateQuestionsForContent(currentSectionTitle, currentParagraphs.join(' '))
          }
        ]
      });
    }
  };

  for (const line of lines) {
    if (sectionRegex.test(line) || uppercaseHeadingRegex.test(line)) {
      if (currentParagraphs.length > 0) {
        flushSection();
        currentParagraphs = [];
      }
      currentSectionTitle = line;
    } else {
      currentParagraphs.push(line);
    }
  }

  flushSection();

  // Fallback: If sections array is still empty, create default section from text
  if (sections.length === 0) {
    const fallbackTitle = 'PHẦN I: NỘI DUNG CHÍNH BÀI HỌC';
    const sampleItem: ProposedItem = {
      title: 'Nội dung trọng tâm bài giảng',
      bodyHtml: textToSimpleHtml(text) || '<p>Nội dung đang cập nhật...</p>',
      paragraphs: lines.slice(0, 10),
      questions: generateQuestionsForContent('Nội dung trọng tâm bài giảng', text)
    };
    sections.push({
      title: fallbackTitle,
      items: [sampleItem]
    });
  }

  return sections;
}

export function autoStructureContent(rawText: string, bodyHtml: string) {
  const sections = parseSectionsFromText(rawText);
  return sections;
}

function textToSimpleHtml(text: string): string {
  if (!text) return '';
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('\n');
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function readAsPlainText(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve((e.target?.result as string) || '');
    reader.onerror = () => resolve('');
    reader.readAsText(file);
  });
}

/**
 * Automatically suggests comprehension questions for an item
 */
export function generateQuestionsForContent(itemTitle: string, contentText?: string): Partial<LessonQuestion>[] {
  const cleanTitle = itemTitle.replace(/^[0-9.]+\s*/, '');
  return [
    {
      type: 'single_choice',
      question: `Nhận định nào sau đây là ĐÚNG NHẤT về nội dung "${cleanTitle}"?`,
      options: [
        `Nội dung phản ánh đúng quan điểm chỉ đạo và yêu cầu nhiệm vụ của ${cleanTitle}`,
        `Chỉ áp dụng trong điều kiện huấn luyện thông thường tại đơn vị`,
        `Chưa phù hợp với thực tiễn chiến đấu của lực lượng Hải quân`,
        `Cần phải điều chỉnh thay thế bằng hướng dẫn mới`
      ],
      correctAnswer: 0,
      explanation: `Dựa vào tài liệu bài giảng GDCT: Nội dung "${cleanTitle}" thể hiện đúng tinh thần chỉ đạo của cấp trên.`,
      points: 10
    },
    {
      type: 'single_choice',
      question: `Trách nhiệm của cán bộ, chiến sĩ trong thực hiện nội dung "${cleanTitle}" là gì?`,
      options: [
        `Quán triệt sâu sắc, chấp hành nghiêm túc và vận dụng linh hoạt vào nhiệm vụ`,
        `Chỉ cần nắm lý thuyết, không cần áp dụng thực hành`,
        `Giao toàn bộ trách nhiệm cho chỉ huy đơn vị`,
        `Thực hiện khi có kiểm tra đột xuất của cấp trên`
      ],
      correctAnswer: 0,
      explanation: `Mỗi chiến sĩ Hải quân cần nắm vững và vận dụng sáng tạo vào thực tiễn công tác.`,
      points: 10
    }
  ];
}

