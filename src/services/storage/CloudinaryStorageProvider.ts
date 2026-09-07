import { 
  MediaStorageProvider, 
  MediaUploadOptions, 
  MediaUploadResult 
} from './MediaStorageProvider';

export class CloudinaryStorageProvider implements MediaStorageProvider {
  private getAssetFolder(options: MediaUploadOptions, filename: string): string {
    if (options.assetFolder) return options.assetFolder;
    const lessonId = options.lessonId || 'general';
    const cat = (options.category || '').toLowerCase();

    let ext = '';
    if (filename && filename.includes('.')) {
      ext = filename.substring(filename.lastIndexOf('.')).toLowerCase().replace('.', '');
    }

    const docExts = ['doc', 'docx', 'pdf', 'docm', 'dot', 'dotx', 'dotm', 'rtf', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'];
    const isDoc = docExts.includes(ext) || cat === 'documents' || cat === 'tailieu' || cat === 'document';

    if (cat === 'slides' || cat === 'slide') {
      return `GDCT_V4/SLIDE/${lessonId}`;
    } else if (isDoc) {
      return `GDCT_V4/TAILIEU/${lessonId}`;
    } else if (cat === 'videos' || cat === 'video') {
      return `GDCT_V4/VIDEO/${lessonId}`;
    } else if (cat === 'audios' || cat === 'audio') {
      return `GDCT_V4/AUDIO/${lessonId}`;
    } else {
      return `GDCT_V4/${(cat || 'GENERAL').toUpperCase()}/${lessonId}`;
    }
  }

  async uploadFile(file: File | Blob, options: MediaUploadOptions): Promise<MediaUploadResult> {
    const formData = new FormData();
    const filename = options.filename || (file instanceof File ? file.name : 'upload_file');
    const assetFolder = this.getAssetFolder(options, filename);

    console.log("Cloudinary Upload Request", {
      upload_preset: 'ugc-images',
      asset_folder: assetFolder,
      fileName: filename,
      lessonId: options.lessonId || '',
      resourceType: options.resourceType || 'auto'
    });

    formData.append('file', file, filename);
    formData.append('asset_folder', assetFolder);
    formData.append('category', options.category);
    if (options.courseId) formData.append('courseId', options.courseId);
    if (options.lessonId) formData.append('lessonId', options.lessonId);
    if (options.resourceType) formData.append('resourceType', options.resourceType);

    const response = await fetch('/api/cloudinary/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errJson.message || `Lỗi upload Cloudinary: HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      id: data.publicId || data.id,
      storageProvider: 'cloudinary',
      publicId: data.publicId,
      secureUrl: data.secureUrl || data.url,
      fileUrl: data.secureUrl || data.url,
      fileName: filename,
      mimeType: data.mimeType || file.type || 'application/octet-stream',
      size: data.bytes || file.size || 0,
      width: data.width,
      height: data.height,
      duration: data.duration,
      thumbnailUrl: data.thumbnailUrl || (data.resourceType === 'video' ? data.secureUrl?.replace(/\.[^/.]+$/, '.jpg') : undefined),
      version: data.version || 1,
      format: data.format,
      resourceType: data.resourceType || 'auto',
      createdAt: new Date().toISOString()
    };
  }

  async deleteFile(publicIdOrPath: string, resourceType: string = 'image'): Promise<boolean> {
    if (!publicIdOrPath) return false;
    const response = await fetch('/api/cloudinary/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publicId: publicIdOrPath, resourceType }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errJson.message || `Lỗi xóa file Cloudinary: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.success === true;
  }

  async replaceFile(publicIdOrPath: string, newFile: File | Blob, options: MediaUploadOptions): Promise<MediaUploadResult> {
    if (publicIdOrPath) {
      try {
        await this.deleteFile(publicIdOrPath, options.resourceType || 'image');
      } catch (err) {
        console.warn('Xóa file cũ Cloudinary không thành công khi replace:', err);
      }
    }
    return this.uploadFile(newFile, options);
  }

  getFileUrl(publicIdOrPath: string, options?: { transformation?: string }): string {
    if (!publicIdOrPath) return '';
    if (publicIdOrPath.startsWith('http://') || publicIdOrPath.startsWith('https://')) {
      return publicIdOrPath;
    }
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'gdctv4';
    const transform = options?.transformation ? `${options.transformation}/` : '';
    return `https://res.cloudinary.com/${cloudName}/image/upload/${transform}${publicIdOrPath}`;
  }

  async checkHealth(): Promise<{ status: 'CONNECTED' | 'FAILED' | 'NOT_CONFIGURED'; details: string; usage?: any }> {
    try {
      const res = await fetch('/api/cloudinary/health');
      if (!res.ok) {
        return {
          status: 'FAILED',
          details: `Lỗi API Cloudinary Health Check: HTTP ${res.status}`
        };
      }
      const data = await res.json();
      return {
        status: data.status || 'NOT_CONFIGURED',
        details: data.details || 'Chưa kiểm tra được cấu hình',
        usage: data.usage
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        details: `Lỗi kết nối API Cloudinary backend: ${err.message || 'Không thể kết nối'}`
      };
    }
  }
}
