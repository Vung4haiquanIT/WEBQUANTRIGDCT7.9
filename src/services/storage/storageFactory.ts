import { MediaStorageProvider } from './MediaStorageProvider';
import { CloudinaryStorageProvider } from './CloudinaryStorageProvider';
import { FirebaseStorageProvider } from './FirebaseStorageProvider';
import { CloudinaryUnsignedSlideProvider, cloudinaryUnsignedSlideProvider } from './CloudinaryUnsignedSlideProvider';

class StorageFactory {
  private instance: MediaStorageProvider | null = null;
  private currentProviderName: string = '';

  public getProvider(): MediaStorageProvider {
    const configuredProvider = (import.meta.env.VITE_MEDIA_STORAGE_PROVIDER || 'cloudinary').toLowerCase();

    if (!this.instance || this.currentProviderName !== configuredProvider) {
      this.currentProviderName = configuredProvider;
      if (configuredProvider === 'firebase') {
        this.instance = new FirebaseStorageProvider();
      } else {
        this.instance = new CloudinaryStorageProvider();
      }
    }

    return this.instance;
  }

  public getSlideStorageProvider(): MediaStorageProvider {
    return cloudinaryUnsignedSlideProvider;
  }

  public getProviderName(): 'cloudinary' | 'firebase' {
    return (import.meta.env.VITE_MEDIA_STORAGE_PROVIDER || 'cloudinary').toLowerCase() === 'firebase'
      ? 'firebase'
      : 'cloudinary';
  }
}

export const storageFactory = new StorageFactory();
export const getActiveStorageProvider = (): MediaStorageProvider => storageFactory.getProvider();
export const getSlideStorageProvider = (): MediaStorageProvider => storageFactory.getSlideStorageProvider();
