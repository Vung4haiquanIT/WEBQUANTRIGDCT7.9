import { 
  MediaStorageProvider, 
  MediaUploadOptions, 
  MediaUploadResult 
} from './MediaStorageProvider';
import { storage, ref, uploadBytes, getDownloadURL, deleteObject } from '../firebase';

export class FirebaseStorageProvider implements MediaStorageProvider {
  private getStoragePath(options: MediaUploadOptions, filename: string): string {
    const courseId = options.courseId || 'general_course';
    const lessonId = options.lessonId || 'general_lesson';
    const category = options.category || 'documents';
    return `gdct_v4/courses/${courseId}/lessons/${lessonId}/${category}/${Date.now()}_${filename}`;
  }

  async uploadFile(file: File | Blob, options: MediaUploadOptions): Promise<MediaUploadResult> {
    const filename = options.filename || (file instanceof File ? file.name : 'upload_file');
    const storagePath = this.getStoragePath(options, filename);
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(storageRef);

    return {
      id: storagePath,
      storageProvider: 'firebase',
      publicId: storagePath,
      secureUrl: downloadUrl,
      fileUrl: downloadUrl,
      fileName: filename,
      mimeType: file.type || 'application/octet-stream',
      size: file.size || 0,
      version: 1,
      createdAt: new Date().toISOString()
    };
  }

  async deleteFile(publicIdOrPath: string): Promise<boolean> {
    if (!publicIdOrPath) return false;
    try {
      const storageRef = ref(storage, publicIdOrPath);
      await deleteObject(storageRef);
      return true;
    } catch (err) {
      console.error('Lỗi xóa file trên Firebase Storage:', err);
      return false;
    }
  }

  async replaceFile(publicIdOrPath: string, newFile: File | Blob, options: MediaUploadOptions): Promise<MediaUploadResult> {
    if (publicIdOrPath) {
      await this.deleteFile(publicIdOrPath);
    }
    return this.uploadFile(newFile, options);
  }

  getFileUrl(publicIdOrPath: string): string {
    return publicIdOrPath;
  }

  async checkHealth(): Promise<{ status: 'CONNECTED' | 'FAILED' | 'NOT_CONFIGURED'; details: string; usage?: any }> {
    try {
      const testRef = ref(storage, 'system/storage_provider_health.txt');
      const testBlob = new Blob(['Firebase Storage Health Check'], { type: 'text/plain' });
      await uploadBytes(testRef, testBlob);
      const url = await getDownloadURL(testRef);
      await deleteObject(testRef);
      return {
        status: 'CONNECTED',
        details: `Firebase Storage kết nối bình thường. URL: ${url.substring(0, 30)}...`
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        details: `Firebase Storage chưa thể truy cập: ${err.message || 'Lỗi kết nối'}`
      };
    }
  }
}
