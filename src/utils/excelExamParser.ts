import * as XLSX from 'xlsx';
import { ExamQuestion } from '../types';

export interface ParsedExamExcelResult {
  success: boolean;
  message: string;
  questions: ExamQuestion[];
  totalParsed: number;
  warnings: string[];
}

/**
 * Normalizes correct answer key into zero-based option index (0, 1, 2, 3)
 */
export function parseCorrectOptionIndex(rawKey: any, options: string[]): number {
  if (rawKey === undefined || rawKey === null) return 0;
  const str = String(rawKey).trim().toUpperCase();

  if (['A', '1', 'Á', 'ĐÁP ÁN A', 'CÂU A'].includes(str)) return 0;
  if (['B', '2', 'ĐÁP ÁN B', 'CÂU B'].includes(str)) return 1;
  if (['C', '3', 'ĐÁP ÁN C', 'CÂU C'].includes(str)) return 2;
  if (['D', '4', 'ĐÁP ÁN D', 'CÂU D'].includes(str)) return 3;

  // Check if rawKey matches option text
  const cleanedStr = String(rawKey).trim().toLowerCase();
  for (let i = 0; i < options.length; i++) {
    if (options[i].trim().toLowerCase() === cleanedStr) {
      return i;
    }
  }

  return 0; // default to first option if ambiguous
}

/**
 * Parses Excel / CSV File into structured ExamQuestions
 * Columns expected:
 * Col 1: STT
 * Col 2: Nội dung câu hỏi
 * Col 3: Đáp án A
 * Col 4: Đáp án B
 * Col 5: Đáp án C
 * Col 6: Đáp án D (Có thể trống nếu chỉ có 3 đáp án)
 * Col 7: Đáp án đúng (A, B, C, D hoặc 1, 2, 3, 4)
 */
export async function parseExamQuestionsFromExcel(file: File): Promise<ParsedExamExcelResult> {
  const warnings: string[] = [];
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return {
        success: false,
        message: 'File Excel không có dữ liệu hoặc trang tính trống.',
        questions: [],
        totalParsed: 0,
        warnings: ['Không tìm thấy trang tính']
      };
    }

    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });

    if (rows.length < 2) {
      return {
        success: false,
        message: 'File Excel chưa có dòng dữ liệu câu hỏi (dòng header ở dòng 1, câu hỏi bắt đầu từ dòng 2).',
        questions: [],
        totalParsed: 0,
        warnings: ['Dữ liệu quá ngắn']
      };
    }

    const questions: ExamQuestion[] = [];
    let sttCounter = 1;

    // Detect header row or start from row index 1 (row 2 in Excel)
    const startIndex = (rows[0] && String(rows[0][1]).toLowerCase().includes('câu hỏi')) ? 1 : 1;

    for (let r = startIndex; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.length < 2) continue;

      const rawStt = row[0];
      const rawQuestion = String(row[1] || '').trim();

      if (!rawQuestion) continue; // Skip empty row

      const optA = String(row[2] || '').trim();
      const optB = String(row[3] || '').trim();
      const optC = String(row[4] || '').trim();
      const optD = String(row[5] || '').trim();
      const rawCorrect = row[6] ?? row[5]; // Col 7 (index 6) or fallback to index 5 if 3 options

      const options: string[] = [];
      if (optA) options.push(optA);
      if (optB) options.push(optB);
      if (optC) options.push(optC);
      if (optD) options.push(optD);

      if (options.length < 2) {
        warnings.push(`Dòng ${r + 1}: Câu hỏi "${rawQuestion.substring(0, 30)}..." có ít hơn 2 lựa chọn đáp án.`);
        continue;
      }

      const correctIndex = parseCorrectOptionIndex(rawCorrect, options);

      const q: ExamQuestion = {
        id: `q-excel-${Date.now()}-${r}`,
        bankId: '',
        stt: typeof rawStt === 'number' ? rawStt : sttCounter++,
        question: rawQuestion,
        options,
        correctOptionIndex: correctIndex,
        correctAnswerText: options[correctIndex] || ''
      };

      questions.push(q);
    }

    if (questions.length === 0) {
      return {
        success: false,
        message: 'Không đọc được câu hỏi hợp lệ nào từ file Excel. Vui lòng kiểm tra đúng cấu trúc 7 cột.',
        questions: [],
        totalParsed: 0,
        warnings
      };
    }

    return {
      success: true,
      message: `Đã đọc thành công ${questions.length} câu hỏi từ file Excel.`,
      questions,
      totalParsed: questions.length,
      warnings
    };
  } catch (err: any) {
    console.error('[Excel Exam Parse Error]:', err);
    return {
      success: false,
      message: `Lỗi đọc file Excel: ${err.message || 'File không đúng định dạng'}`,
      questions: [],
      totalParsed: 0,
      warnings: [err.message]
    };
  }
}

/**
 * Downloads a sample standard Excel file template for Question Bank
 */
export function downloadSampleExamExcelTemplate() {
  const sampleData = [
    [
      'STT (Cột 1)', 
      'Nội dung câu hỏi (Cột 2)', 
      'Đáp án A (Cột 3)', 
      'Đáp án B (Cột 4)', 
      'Đáp án C (Cột 5)', 
      'Đáp án D (Cột 6)', 
      'Đáp án đúng (Cột 7: Điền A, B, C hoặc D)'
    ],
    [
      1, 
      'Vùng 4 Hải quân thành lập vào ngày tháng năm nào?', 
      '26/10/1975', 
      '05/08/1964', 
      '23/10/1961', 
      '15/03/1978', 
      'A'
    ],
    [
      2, 
      'Chủ đề thi đua trọng tâm năm 2026 của Vùng 4 Hải quân là gì?', 
      'Dân chủ, đoàn kết, kỷ cương, sáng tạo, an toàn, quyết thắng', 
      'Đoàn kết, kỷ luật, huấn luyện giỏi, sẵn sàng chiến đấu cao', 
      'Chủ động, sáng tạo, khắc phục khó khăn, hoàn thành xuất sắc nhiệm vụ', 
      'Tuyệt đối trung thành, tinh thông nghiệp vụ, làm chủ vũ khí trang bị', 
      'A'
    ],
    [
      3, 
      'Tập thể được phong tặng danh hiệu Anh hùng LLVT nhân dân của Vùng 4 Hải quân?', 
      'Lữ đoàn 146 (Đoàn Trường Sa)', 
      'Tàu 011 Đinh Tiên Hoàng', 
      'Tiểu đoàn 452', 
      'Tất cả các phương án trên', 
      'D'
    ],
    [
      4, 
      'Hành vi nào bị nghiêm cấm trong Luật Quốc phòng năm 2018?', 
      'Thành lập lực lượng vũ trang trái pháp luật', 
      'Chống đối, cản trở thực hiện nhiệm vụ quốc phòng', 
      'Lợi dụng hoạt động quốc phòng để xâm phạm lợi ích Nhà nước', 
      'Cả 3 phương án A, B, C đều đúng', 
      'D'
    ]
  ];

  const ws = XLSX.utils.aoa_to_sheet(sampleData);
  
  // Set column widths
  ws['!cols'] = [
    { wch: 10 },
    { wch: 50 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 25 },
    { wch: 20 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mau_Bo_De_Kiem_Tra');

  XLSX.writeFile(wb, 'MAU_NHAP_BO_DE_KIEM_TRA_GDCT.xlsx');
}
