import React, { useState } from 'react';
import { Upload, CheckCircle2, XCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface UnsignedTestResult {
  success: boolean;
  httpStatus: number;
  publicId?: string;
  secureUrl?: string;
  bytes?: number;
  format?: string;
  xCldError?: string;
  rawResponseBody?: string;
  errorMessage?: string;
}

export const CloudinaryUnsignedUploadTest: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<UnsignedTestResult | null>(null);

  const handleTestUnsignedUpload = async () => {
    setLoading(true);
    setResult(null);

    try {
      // 1. Create a tiny test JPEG image blob
      const canvas = document.createElement('canvas');
      canvas.width = 100;
      canvas.height = 100;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#1D4ED8'; // Blue
        ctx.fillRect(0, 0, 100, 100);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('TEST UGC', 15, 55);
      }

      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9)
      );

      // 2. Prepare FormData with file, upload_preset & asset_folder (NO folder, NO api_key)
      const cloudName = 'ieplkoep';
      const uploadPreset = 'ugc-images';
      const assetFolder = 'GDCT_V4/SLIDE/TEST-001';

      console.log("Cloudinary Upload Request", {
        upload_preset: uploadPreset,
        asset_folder: assetFolder,
        fileName: 'test.jpg',
        lessonId: 'TEST-001',
        resourceType: 'image'
      });

      const formData = new FormData();
      formData.append('file', blob, 'test.jpg');
      formData.append('upload_preset', uploadPreset);
      formData.append('asset_folder', assetFolder);

      const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

      // 3. Direct client-side REST call without wrapping in custom backend or timeout proxies
      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      });

      const httpStatus = response.status;
      const xCldError = response.headers.get('x-cld-error') || '';
      const responseText = await response.text();

      let jsonBody: any = null;
      try {
        jsonBody = JSON.parse(responseText);
      } catch {
        // Raw text if not JSON
      }

      if (response.ok && jsonBody && jsonBody.secure_url) {
        setResult({
          success: true,
          httpStatus,
          publicId: jsonBody.public_id,
          secureUrl: jsonBody.secure_url,
          bytes: jsonBody.bytes,
          format: jsonBody.format,
          rawResponseBody: responseText
        });
      } else {
        setResult({
          success: false,
          httpStatus,
          xCldError: xCldError || (jsonBody?.error?.message ? jsonBody.error.message : 'Unknown Error'),
          errorMessage: jsonBody?.error?.message || responseText || `HTTP ${httpStatus}`,
          rawResponseBody: responseText
        });
      }
    } catch (err: any) {
      setResult({
        success: false,
        httpStatus: 0,
        errorMessage: err.message || 'Fetch Network Error',
        rawResponseBody: String(err)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl p-6 border border-slate-700 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="inline-flex items-center space-x-2 bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-500/30 mb-1">
            <Upload className="w-3.5 h-3.5" />
            <span>Direct Client-Side Diagnostic</span>
          </div>
          <h3 className="text-lg font-black text-white uppercase tracking-tight">
            TEST UNSIGNED CLOUDINARY UPLOAD
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cloud Name: <strong className="text-blue-300">ieplkoep</strong> | Preset: <strong className="text-amber-300">ugc-images</strong> (Unsigned)
          </p>
        </div>

        <button
          onClick={handleTestUnsignedUpload}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold px-5 py-3 rounded-xl shadow-lg transition-all transform active:scale-95 flex items-center justify-center space-x-2 text-xs tracking-wider uppercase border border-blue-400 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'ĐANG UPLOAD...' : 'TEST UNSIGNED UPLOAD'}</span>
        </button>
      </div>

      {result && (
        <div className="space-y-4 text-xs font-mono">
          {result.success ? (
            <div className="bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 p-4 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-extrabold text-sm uppercase tracking-wider">
                <CheckCircle2 className="w-5 h-5" />
                <span>CLOUDINARY UNSIGNED UPLOAD HOẠT ĐỘNG</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-emerald-800/50">
                <div>Upload Status: <strong className="text-emerald-300">PASS</strong></div>
                <div>HTTP Status: <strong className="text-emerald-300">{result.httpStatus}</strong></div>
                <div>Public ID: <span className="text-white font-bold">{result.publicId}</span></div>
                <div>Format / Size: <span className="text-white">{result.format} / {result.bytes} bytes</span></div>
              </div>
              <div className="pt-2">
                <div className="text-emerald-400 text-[10px] font-bold uppercase mb-1">Secure URL:</div>
                <a
                  href={result.secureUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-300 hover:underline break-all flex items-center space-x-1"
                >
                  <span>{result.secureUrl}</span>
                  <ExternalLink className="w-3.5 h-3.5 inline-block" />
                </a>
              </div>
            </div>
          ) : (
            <div className="bg-rose-950/80 border border-rose-500/40 text-rose-200 p-4 rounded-xl space-y-3">
              <div className="flex items-center space-x-2 text-rose-400 font-extrabold text-sm uppercase tracking-wider">
                <XCircle className="w-5 h-5" />
                <span>CLOUDINARY UNSIGNED UPLOAD THẤT BẠI</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-rose-800/50">
                <div>Upload Status: <strong className="text-rose-400">FAIL</strong></div>
                <div>HTTP Status: <strong className="text-rose-400">{result.httpStatus}</strong></div>
              </div>
              {result.xCldError && (
                <div>
                  <div className="text-amber-400 font-bold">X-Cld-Error Header:</div>
                  <div className="bg-slate-950 p-2 rounded text-rose-300 mt-1">{result.xCldError}</div>
                </div>
              )}
              <div>
                <div className="text-slate-400 font-bold">Cloudinary Error / Response Body:</div>
                <pre className="bg-slate-950 p-3 rounded text-slate-300 mt-1 overflow-x-auto text-[11px]">
                  {result.rawResponseBody}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
