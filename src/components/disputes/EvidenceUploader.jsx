import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Upload, Loader2, CheckCircle, Image, FileText, X } from 'lucide-react';
import { toast } from 'sonner';

export default function EvidenceUploader({ onUpload, existingUrl }) {
  const [uploading, setUploading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [uploadedUrl, setUploadedUrl] = useState(existingUrl || null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setUploadedUrl(file_url);
      onUpload?.({ screenshot_url: file_url, session_id_input: sessionId });
      toast.success('Evidence uploaded successfully');
    } catch {
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSessionIdChange = (val) => {
    setSessionId(val);
    onUpload?.({ screenshot_url: uploadedUrl, session_id_input: val });
  };

  return (
    <div className="space-y-3">
      {/* Screenshot upload */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1.5">Screenshot / Completion Proof</p>
        {uploadedUrl ? (
          <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
            <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
            <span className="text-xs text-green-700 truncate flex-1">Screenshot uploaded</span>
            <a href={uploadedUrl} target="_blank" rel="noreferrer">
              <Badge className="bg-green-100 text-green-700 text-xs cursor-pointer">View</Badge>
            </a>
            <button onClick={() => { setUploadedUrl(null); onUpload?.({ screenshot_url: null, session_id_input: sessionId }); }}>
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        ) : (
          <label className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-indigo-300 hover:bg-indigo-50 transition-all">
            {uploading
              ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
              : <Upload className="w-4 h-4 text-gray-400" />}
            <span className="text-xs text-gray-500">{uploading ? 'Uploading...' : 'Click to upload screenshot (PNG, JPG, PDF)'}</span>
            <input type="file" accept="image/*,.pdf" className="hidden" onChange={handleFile} disabled={uploading} />
          </label>
        )}
      </div>

      {/* Session ID */}
      <div>
        <p className="text-xs font-semibold text-gray-600 mb-1.5">Session / Transaction ID (optional)</p>
        <Input
          placeholder="e.g. sess_abc123 or TX-98765"
          value={sessionId}
          onChange={e => handleSessionIdChange(e.target.value)}
          className="text-xs h-8"
        />
      </div>
    </div>
  );
}