import { 
  MediaStorageProvider, 
  MediaUploadOptions, 
  MediaUploadResult 
} from './MediaStorageProvider';

export class CloudinaryUnsignedSlideProvider implements MediaStorageProvider {
  private cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'ieplkoep';
  private uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ugc-images';

  computeAssetFolder(category?: string, lessonId?: string, filename?: string): string {
    const safeLessonId = lessonId || 'general';
    const cat = (category || '').toLowerCase();

    let ext = '';
    if (filename && filename.includes('.')) {
      ext = filename.substring(filename.lastIndexOf('.')).toLowerCase().replace('.', '');
    }

    const docExts = ['doc', 'docx', 'pdf', 'docm', 'dot', 'dotx', 'dotm', 'rtf', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'];
    const isDoc = docExts.includes(ext) || cat === 'documents' || cat === 'tailieu' || cat === 'document';

    if (cat === 'slides' || cat === 'slide') {
      return `GDCT_V4/SLIDE/${safeLessonId}`;
    } else if (isDoc) {
      return `GDCT_V4/TAILIEU/${safeLessonId}`;
    } else if (cat === 'videos' || cat === 'video') {
      return `GDCT_V4/VIDEOS/${safeLessonId}`;
    } else if (cat === 'audios' || cat === 'audio') {
      return `GDCT_V4/AUDIO/${safeLessonId}`;
    } else {
      return `GDCT_V4/${(cat || 'GENERAL').toUpperCase()}/${safeLessonId}`;
    }
  }

  computeResourceType(filename: string, category?: string): 'image' | 'video' | 'raw' | 'auto' {
    let ext = '';
    if (filename && filename.includes('.')) {
      ext = filename.substring(filename.lastIndexOf('.')).toLowerCase().replace('.', '');
    }

    const docExts = ['doc', 'docx', 'pdf', 'docm', 'dot', 'dotx', 'dotm', 'rtf', 'txt', 'xls', 'xlsx', 'ppt', 'pptx'];
    if (docExts.includes(ext) || category === 'documents' || category === 'tailieu') {
      return 'raw';
    }

    const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    if (imageExts.includes(ext) || category === 'slides' || category === 'slide') {
      return 'image';
    }

    const mediaExts = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'm4a', 'ogg', 'aac', 'flac'];
    if (mediaExts.includes(ext) || category === 'videos' || category === 'audios' || category === 'video' || category === 'audio') {
      return 'video';
    }

    return 'auto';
  }

  async uploadFile(file: File | Blob, options: MediaUploadOptions): Promise<MediaUploadResult> {
    return this.uploadUnsignedSlide(file, options);
  }

  async uploadUnsignedSlide(
    file: File | Blob, 
    options: MediaUploadOptions, 
    maxRetries = 3
  ): Promise<MediaUploadResult> {
    const filename = options.filename || (file instanceof File ? file.name : 'upload_media');
    const assetFolder = options.assetFolder || this.computeAssetFolder(options.category, options.lessonId, filename);
    const resourceType = options.resourceType || this.computeResourceType(filename, options.category);
    const endpoint = `https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/upload`;

    // REQUIRED DEBUG LOG
    console.log("Cloudinary Upload Request", {
      upload_preset: this.uploadPreset,
      asset_folder: assetFolder,
      fileName: filename,
      lessonId: options.lessonId || '',
      resourceType: resourceType
    });

    let attempt = 0;
    let lastError: any = null;

    while (attempt < maxRetries) {
      try {
        const formData = new FormData();
        formData.append('file', file, filename);
        formData.append('upload_preset', this.uploadPreset);
        formData.append('asset_folder', assetFolder);

        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData
        });

        const status = response.status;
        const xCldError = response.headers.get('x-cld-error') || '';
        const responseText = await response.text();

        let jsonBody: any = null;
        try {
          jsonBody = JSON.parse(responseText);
        } catch {
          // ignore JSON parse error
        }

        if (!response.ok) {
          const message = jsonBody?.error?.message || xCldError || responseText || `HTTP ${status}`;

          // Try server-side upload proxy as fallback
          try {
            const serverFormData = new FormData();
            serverFormData.append('file', file, filename);
            serverFormData.append('lessonId', options.lessonId || 'general');
            serverFormData.append('category', options.category || 'media');
            serverFormData.append('resourceType', resourceType);
            serverFormData.append('assetFolder', assetFolder);

            const serverRes = await fetch('/api/cloudinary/upload', {
              method: 'POST',
              body: serverFormData
            });

            if (serverRes.ok) {
              const serverJson = await serverRes.json();
              if (serverJson && serverJson.secureUrl) {
                return {
                  id: serverJson.publicId,
                  storageProvider: 'cloudinary',
                  publicId: serverJson.publicId,
                  secureUrl: serverJson.secureUrl,
                  fileUrl: serverJson.secureUrl,
                  fileName: filename,
                  assetFolder: assetFolder,
                  mimeType: file.type || `${resourceType}/${serverJson.format || 'mp4'}`,
                  size: serverJson.bytes || (file instanceof File ? file.size : 0),
                  width: serverJson.width,
                  height: serverJson.height,
                  duration: serverJson.duration,
                  thumbnailUrl: serverJson.thumbnailUrl || serverJson.secureUrl,
                  version: serverJson.version || 1,
                  format: serverJson.format,
                  resourceType: serverJson.resourceType || resourceType,
                  createdAt: new Date().toISOString()
                };
              }
            }
          } catch (serverErr) {
            console.warn('[Cloudinary Backend Proxy Fallback Failed]:', serverErr);
          }

          // Do NOT retry for client / auth errors (400, 401, 403)
          if (status === 400 || status === 401 || status === 403) {
            throw new Error(`[HTTP ${status}] Cloudinary: ${message}`);
          }

          attempt++;
          if (attempt >= maxRetries) {
            throw new Error(`[HTTP ${status}] Cloudinary: ${message} (Thử lại ${maxRetries} lần thất bại)`);
          }

          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          await new Promise(r => setTimeout(r, backoffMs));
          continue;
        }

        if (!jsonBody || !jsonBody.secure_url) {
          throw new Error('Cloudinary trả về kết quả thành công nhưng thiếu thông tin secure_url.');
        }

        const isVideoRes = (jsonBody.resource_type === 'video') || (resourceType === 'video');
        let computedThumb = jsonBody.secure_url;
        if (isVideoRes) {
          computedThumb = jsonBody.secure_url.replace(/\.[^/.]+$/, '.jpg').replace('/upload/', '/upload/c_scale,w_400,f_auto,q_auto,so_auto/');
        } else if (jsonBody.resource_type === 'image' || resourceType === 'image') {
          computedThumb = jsonBody.secure_url.replace('/upload/', '/upload/c_scale,w_400,f_auto,q_auto/');
        }

        const calculatedSize = jsonBody.bytes || (file instanceof File ? file.size : 0);

        return {
          id: jsonBody.public_id,
          storageProvider: 'cloudinary',
          publicId: jsonBody.public_id,
          secureUrl: jsonBody.secure_url,
          fileUrl: jsonBody.secure_url,
          fileName: filename,
          assetFolder: jsonBody.asset_folder || assetFolder,
          mimeType: file.type || (jsonBody.format ? `${jsonBody.resource_type || 'image'}/${jsonBody.format}` : 'application/octet-stream'),
          size: calculatedSize,
          bytes: calculatedSize,
          width: jsonBody.width,
          height: jsonBody.height,
          duration: jsonBody.duration,
          thumbnailUrl: computedThumb,
          version: jsonBody.version || 1,
          format: jsonBody.format,
          resourceType: jsonBody.resource_type || resourceType,
          createdAt: jsonBody.created_at || new Date().toISOString()
        };
      } catch (err: any) {
        lastError = err;
        if (err.message?.includes('400') || err.message?.includes('401') || err.message?.includes('403')) {
          throw err;
        }
        attempt++;
        if (attempt >= maxRetries) {
          throw err;
        }
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise(r => setTimeout(r, backoffMs));
      }
    }

    throw lastError || new Error('Upload Unsigned Slide thất bại sau nhiều lần thử lại');
  }

  async deleteFile(publicIdOrPath: string, resourceType: string = 'image'): Promise<boolean> {
    if (!publicIdOrPath) return false;
    // Backend API delete endpoint handles API secret securely
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
        console.warn('Xóa slide cũ Cloudinary không thành công khi replace:', err);
      }
    }
    return this.uploadFile(newFile, options);
  }

  getFileUrl(publicIdOrPath: string, options?: { transformation?: string }): string {
    if (!publicIdOrPath) return '';
    if (publicIdOrPath.startsWith('http://') || publicIdOrPath.startsWith('https://')) {
      return publicIdOrPath;
    }
    const transform = options?.transformation ? `${options.transformation}/` : '';
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/${transform}${publicIdOrPath}`;
  }

  async checkHealth(): Promise<{ status: 'CONNECTED' | 'FAILED' | 'NOT_CONFIGURED'; details: string; usage?: any }> {
    return {
      status: 'CONNECTED',
      details: `Cloudinary Unsigned Slide Upload Sẵn sàng (Cloud: ${this.cloudName}, Preset: ${this.uploadPreset})`
    };
  }
}

export const cloudinaryUnsignedSlideProvider = new CloudinaryUnsignedSlideProvider();
