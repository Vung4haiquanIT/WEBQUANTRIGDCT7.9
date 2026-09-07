import { 
  db, 
  auth,
  storage,
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from './firebase';

export interface FirebaseTestResult {
  step: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED';
  details: string;
  timestamp: string;
}

export async function runFirebaseLiveDiagnostics(
  onProgress?: (stepIndex: number, totalSteps: number, currentStepName: string, resultsSoFar: FirebaseTestResult[]) => void
): Promise<{
  allPassed: boolean;
  projectId: string;
  databaseId: string;
  results: FirebaseTestResult[];
}> {
  const results: FirebaseTestResult[] = [];
  const projectId = db.app.options.projectId;
  const databaseId = '(default)';
  const totalSteps = 8;

  const helperTimeout = <T>(promise: Promise<T>, timeoutMs = 10000, timeoutMessage = 'Timeout sau 10 giây'): Promise<T> => {
    let timer: any;
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
      })
    ]).finally(() => clearTimeout(timer));
  };

  const notifyProgress = (idx: number, name: string) => {
    if (onProgress) {
      onProgress(idx, totalSteps, name, [...results]);
    }
  };

  // 1. Firebase Project & Config
  notifyProgress(1, 'Firebase Project & Config');
  try {
    if (!projectId || projectId !== 'gdctv4-4e1f3') {
      throw new Error(`Project ID không hợp lệ hoặc không khớp. Mong đợi: 'gdctv4-4e1f3', Thực tế: '${projectId || 'undefined'}'`);
    }
    results.push({
      step: '1. Firebase Project & Config',
      status: 'SUCCESS',
      details: `Đã xác thực Project ID: ${projectId}, Database: ${databaseId}`,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    results.push({
      step: '1. Firebase Project & Config',
      status: 'FAILED',
      details: err.message || 'Lỗi cấu hình Project ID',
      timestamp: new Date().toISOString()
    });
    return { allPassed: false, projectId: projectId || 'unknown', databaseId, results };
  }

  const testDocRef = doc(db, 'system', 'production_test');
  const storageRef = ref(storage, 'system/production_test.txt');
  let storageUploaded = false;

  try {
    // 2. Firestore WRITE
    notifyProgress(2, 'Firestore WRITE');
    try {
      const testData = {
        application: 'GDCT Vùng 4',
        projectId: 'gdctv4-4e1f3',
        database: '(default)',
        test: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await helperTimeout(setDoc(testDocRef, testData), 10000, 'Timeout ghi Firestore sau 10 giây');
      results.push({
        step: '2. Firestore WRITE',
        status: 'SUCCESS',
        details: 'Ghi thành công document system/production_test vào Firestore',
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      results.push({
        step: '2. Firestore WRITE',
        status: 'FAILED',
        details: err.message || 'Lỗi khi ghi document vào Firestore',
        timestamp: new Date().toISOString()
      });
      throw err; // Dừng lại ở bước write nếu không ghi được
    }

    // 3. Firestore READ
    notifyProgress(3, 'Firestore READ');
    try {
      const snap = await helperTimeout(getDoc(testDocRef), 10000, 'Timeout đọc Firestore sau 10 giây');
      if (snap.exists() && snap.data().projectId === 'gdctv4-4e1f3') {
        results.push({
          step: '3. Firestore READ',
          status: 'SUCCESS',
          details: `Đọc thành công dữ liệu từ Firestore: "${snap.data().application}"`,
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error('Document không tồn tại hoặc dữ liệu không khớp');
      }
    } catch (err: any) {
      results.push({
        step: '3. Firestore READ',
        status: 'FAILED',
        details: err.message || 'Lỗi khi đọc document từ Firestore',
        timestamp: new Date().toISOString()
      });
    }

    // 4. Firestore UPDATE
    notifyProgress(4, 'Firestore UPDATE');
    try {
      await helperTimeout(
        updateDoc(testDocRef, { version: 2, updatedAt: new Date().toISOString() }),
        10000,
        'Timeout cập nhật Firestore sau 10 giây'
      );
      const updatedSnap = await helperTimeout(getDoc(testDocRef), 10000, 'Timeout đọc lại Firestore sau cập nhật');
      if (updatedSnap.data()?.version === 2) {
        results.push({
          step: '4. Firestore UPDATE',
          status: 'SUCCESS',
          details: 'Cập nhật thành công version = 2 trên Firestore',
          timestamp: new Date().toISOString()
        });
      } else {
        throw new Error('Giá trị cập nhật không khớp');
      }
    } catch (err: any) {
      results.push({
        step: '4. Firestore UPDATE',
        status: 'FAILED',
        details: err.message || 'Lỗi khi cập nhật document trong Firestore',
        timestamp: new Date().toISOString()
      });
    }

    // 5. Realtime Listener
    notifyProgress(5, 'Realtime Listener');
    try {
      await helperTimeout(
        new Promise<void>((resolve, reject) => {
          let isFirstSnapshot = true;
          let hasResolved = false;

          const unsub = onSnapshot(testDocRef, (snap) => {
            if (hasResolved) return;
            if (!snap.exists()) return;
            const data = snap.data();

            if (isFirstSnapshot) {
              isFirstSnapshot = false;
              // Thực hiện update document để test realtime snapshot tiếp theo
              updateDoc(testDocRef, { version: 99, updatedAt: new Date().toISOString() }).catch((updateErr) => {
                if (!hasResolved) {
                  hasResolved = true;
                  unsub();
                  reject(new Error(`Lỗi cập nhật realtime: ${updateErr.message}`));
                }
              });
              return;
            }

            if (data && data.version === 99) {
              hasResolved = true;
              unsub();
              resolve();
            }
          }, (err) => {
            if (!hasResolved) {
              hasResolved = true;
              unsub();
              reject(err);
            }
          });
        }),
        10000,
        'Timeout sau 10 giây'
      );

      results.push({
        step: '5. Realtime Listener',
        status: 'SUCCESS',
        details: 'Lắng nghe thay đổi thời gian thực onSnapshot thành công (nhận bản cập nhật version = 99)',
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      results.push({
        step: '5. Realtime Listener',
        status: 'FAILED',
        details: err.message || 'Timeout sau 10 giây hoặc lỗi onSnapshot',
        timestamp: new Date().toISOString()
      });
    }

    // 6. Firebase Storage
    notifyProgress(6, 'Firebase Storage');
    try {
      const testBlob = new Blob(['GDCT Vùng 4 Cloud Storage Production Test'], { type: 'text/plain' });
      await helperTimeout(uploadBytes(storageRef, testBlob), 10000, 'Timeout tải lên Cloud Storage sau 10 giây');
      storageUploaded = true;

      const downloadUrl = await helperTimeout(getDownloadURL(storageRef), 10000, 'Timeout lấy download URL sau 10 giây');
      results.push({
        step: '6. Firebase Storage',
        status: 'SUCCESS',
        details: `Tải lên và lấy URL thành công. URL: ${downloadUrl.substring(0, 45)}...`,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      results.push({
        step: '6. Firebase Storage',
        status: 'FAILED',
        details: err.message || 'Lỗi tải lên hoặc lấy URL từ Cloud Storage',
        timestamp: new Date().toISOString()
      });
    }

    // 7. Firebase Authentication SDK
    notifyProgress(7, 'Firebase Authentication SDK');
    try {
      const currentUser = auth.currentUser;
      if (currentUser) {
        results.push({
          step: '7. Firebase Authentication SDK',
          status: 'SUCCESS',
          details: `Đã đăng nhập: email: ${currentUser.email || 'Không có email'}, uid: ${currentUser.uid}`,
          timestamp: new Date().toISOString()
        });
      } else {
        results.push({
          step: '7. Firebase Authentication SDK',
          status: 'SUCCESS',
          details: 'Firebase Authentication SDK đã khởi tạo, hiện chưa có user đăng nhập.',
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      results.push({
        step: '7. Firebase Authentication SDK',
        status: 'FAILED',
        details: err.message || 'Lỗi kiểm tra Firebase Authentication SDK',
        timestamp: new Date().toISOString()
      });
    }

  } catch (outerErr: any) {
    // Catch-all cho các lỗi dừng chuỗi quan trọng
    console.warn('Diagnostics sequence caught outer error:', outerErr.message);
  } finally {
    // 8. Firestore DELETE / Cleanup
    notifyProgress(8, 'Firestore DELETE / Cleanup');
    try {
      const cleanupPromises: Promise<any>[] = [];
      cleanupPromises.push(deleteDoc(testDocRef));
      if (storageUploaded) {
        cleanupPromises.push(deleteObject(storageRef));
      }

      await helperTimeout(Promise.all(cleanupPromises), 10000, 'Timeout dọn dẹp tài nguyên sau 10 giây');
      results.push({
        step: '8. Firestore DELETE / Cleanup',
        status: 'SUCCESS',
        details: 'Đã dọn dẹp và xóa sạch document Firestore & file Storage kiểm thử thành công',
        timestamp: new Date().toISOString()
      });
    } catch (cleanupErr: any) {
      results.push({
        step: '8. Firestore DELETE / Cleanup',
        status: 'FAILED',
        details: `Lỗi dọn dẹp tài nguyên: ${cleanupErr.message || 'Timeout hoặc không thể xóa tài nguyên'}`,
        timestamp: new Date().toISOString()
      });
    }
  }

  const allPassed = results.length === totalSteps && results.every(r => r.status === 'SUCCESS');

  return {
    allPassed,
    projectId,
    databaseId,
    results
  };
}

import { firestoreService } from './firestoreService';

export interface CloudinaryTestResult {
  step: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'NOT_CONFIGURED';
  details: string;
  timestamp: string;
}

export async function runCloudinaryDiagnostics(
  onProgress?: (stepIndex: number, totalSteps: number, currentName: string, resultsSoFar: CloudinaryTestResult[]) => void
): Promise<{
  allPassed: boolean;
  cloudName: string;
  status: string;
  results: CloudinaryTestResult[];
}> {
  const results: CloudinaryTestResult[] = [];
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'ieplkoep';
  const totalSteps = 5;

  const notifyProgress = (stepIndex: number, currentName: string) => {
    if (onProgress) {
      onProgress(stepIndex, totalSteps, currentName, [...results]);
    }
  };

  // -------------------------------------------------------------
  // Step 1: ① Cloudinary Connection Check
  // -------------------------------------------------------------
  notifyProgress(1, '① Cloudinary Connection');
  try {
    const healthRes = await fetch('/api/cloudinary/health');
    const healthData = await healthRes.json();

    if (!healthRes.ok || healthData.success === false) {
      const isNotConfigured = healthData.status === 'NOT_CONFIGURED';
      results.push({
        step: '① Cloudinary Connection',
        status: isNotConfigured ? 'NOT_CONFIGURED' : 'FAILED',
        details: healthData.message || healthData.details || 'Không thể kết nối Cloudinary CDN',
        timestamp: new Date().toISOString()
      });
      return { allPassed: false, cloudName, status: isNotConfigured ? 'NOT_CONFIGURED' : 'FAILED', results };
    }

    results.push({
      step: '① Cloudinary Connection',
      status: 'SUCCESS',
      details: `Đã kết nối thành công Cloudinary CDN (Cloud Name: ${healthData.cloudName || cloudName}, SDK: v${healthData.cloudinarySdkVersion || '2.x'}, Node: ${healthData.nodeVersion || ''}). API Secret: PRESENT`,
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    results.push({
      step: '① Cloudinary Connection',
      status: 'FAILED',
      details: `Lỗi kết nối API Cloudinary Health: ${err.message}`,
      timestamp: new Date().toISOString()
    });
    return { allPassed: false, cloudName, status: 'FAILED', results };
  }

  // -------------------------------------------------------------
  // Step 2, 3, 4: Backend Diagnostic Upload, CDN check, Delete Test
  // -------------------------------------------------------------
  notifyProgress(2, '② Upload Test (Backend SDK)');
  try {
    const diagRes = await fetch('/api/cloudinary/diagnostic-upload', {
      method: 'POST'
    });

    const diagData = await diagRes.json();

    if (!diagRes.ok || !diagData.success) {
      const status = diagData.statusCode || diagRes.status;
      const errMsg = diagData.errorMessage || diagData.message || 'Unknown Cloudinary Error';
      const errCode = diagData.cloudinaryCode || '';
      const xCldError = diagData.xCldError || '';

      results.push({
        step: '② Upload Test',
        status: 'FAILED',
        details: `Cloudinary HTTP ${status} [${diagData.errorName || 'Error'}]: ${errMsg}${errCode ? ` (Code: ${errCode})` : ''}${xCldError ? ` | X-Cld-Error: ${xCldError}` : ''}`,
        timestamp: new Date().toISOString()
      });
      return { allPassed: false, cloudName, status: 'FAILED', results };
    }

    results.push({
      step: '② Upload Test',
      status: 'SUCCESS',
      details: `Upload thành công tệp ảnh thử nghiệm ("cloudinary-test.jpg") qua Cloudinary Node SDK. Public ID: ${diagData.publicId}`,
      timestamp: new Date().toISOString()
    });

    // Step 3: CDN URL
    notifyProgress(3, '③ CDN URL');
    if (diagData.cdn) {
      results.push({
        step: '③ CDN URL',
        status: 'SUCCESS',
        details: `Truy cập CDN URL thành công. URL: ${diagData.secureUrl}`,
        timestamp: new Date().toISOString()
      });
    } else {
      results.push({
        step: '③ CDN URL',
        status: 'FAILED',
        details: `Không thể kết nối đến CDN URL: ${diagData.secureUrl}`,
        timestamp: new Date().toISOString()
      });
    }

    // Step 4: Delete Test
    notifyProgress(4, '④ Delete Test');
    if (diagData.delete) {
      results.push({
        step: '④ Delete Test',
        status: 'SUCCESS',
        details: `Đã dọn dẹp và xóa tệp thử nghiệm (${diagData.publicId}) khỏi Cloudinary CDN`,
        timestamp: new Date().toISOString()
      });
    } else {
      results.push({
        step: '④ Delete Test',
        status: 'FAILED',
        details: `Xóa tệp thử nghiệm không thành công (${diagData.publicId})`,
        timestamp: new Date().toISOString()
      });
    }

    // Step 5: Unsigned Upload Test (Slide Images)
    notifyProgress(5, '⑤ Unsigned Slide Upload (ugc-images)');
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#10B981';
        ctx.fillRect(0, 0, 100, 100);
      }
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));

      if (!blob) throw new Error('Không tạo được canvas blob thử nghiệm');

      const formData = new FormData();
      formData.append('file', blob, 'unsigned_test.jpg');
      formData.append('upload_preset', 'ugc-images');

      const unRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });

      const unJson = await unRes.json();
      if (unRes.ok && unJson.secure_url) {
        results.push({
          step: '⑤ Unsigned Slide Upload (ugc-images)',
          status: 'SUCCESS',
          details: `Unsigned Upload slide thành công! Cloud Name: ${cloudName}, Preset: ugc-images, Public ID: ${unJson.public_id}, HTTP 200 OK`,
          timestamp: new Date().toISOString()
        });
      } else {
        results.push({
          step: '⑤ Unsigned Slide Upload (ugc-images)',
          status: 'FAILED',
          details: `Unsigned Upload thất bại: HTTP ${unRes.status} - ${unJson.error?.message || 'Lỗi không xác định'}`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (unErr: any) {
      results.push({
        step: '⑤ Unsigned Slide Upload (ugc-images)',
        status: 'FAILED',
        details: `Lỗi kết nối Unsigned Upload: ${unErr.message}`,
        timestamp: new Date().toISOString()
      });
    }

  } catch (err: any) {
    results.push({
      step: '② Upload Test',
      status: 'FAILED',
      details: `Lỗi gọi Diagnostic Upload API: ${err.message}`,
      timestamp: new Date().toISOString()
    });
    return { allPassed: false, cloudName, status: 'FAILED', results };
  }

  const allPassed = results.length === totalSteps && results.every(r => r.status === 'SUCCESS');
  return {
    allPassed,
    cloudName,
    status: allPassed ? 'CONNECTED' : 'FAILED',
    results
  };
}

