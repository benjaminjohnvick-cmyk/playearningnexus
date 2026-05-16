import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

export default function DisputeSubmissionForm() {
  const [disputeType, setDisputeType] = useState('');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      return file_url;
    },
  });

  const disputeMutation = useMutation({
    mutationFn: async (fileUrls) => {
      const result = await base44.functions.invoke('aiDisputeAnalyzer', {
        dispute_type: disputeType,
        description,
        file_urls: fileUrls,
      });
      return result.data;
    },
    onSuccess: (data) => {
      toast.success('Dispute submitted! AI analysis complete.');
      setDisputeType('');
      setDescription('');
      setFiles([]);
    },
    onError: () => {
      toast.error('Failed to submit dispute');
    },
  });

  const handleFileSelect = (e) => {
    setFiles([...files, ...Array.from(e.target.files)]);
  };

  const handleRemoveFile = (idx) => {
    setFiles(files.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const fileUrls = await Promise.all(
        files.map(file => uploadMutation.mutateAsync(file))
      );
      await disputeMutation.mutateAsync(fileUrls);
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Submit a Dispute
          </CardTitle>
          <CardDescription>
            Upload evidence for failed payouts or missing referral credit. AI will analyze your claim.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dispute Type */}
            <div>
              <label className="text-sm font-medium">Dispute Type</label>
              <select
                value={disputeType}
                onChange={(e) => setDisputeType(e.target.value)}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
                required
              >
                <option value="">Select a dispute type</option>
                <option value="failed_payout">Failed Payout</option>
                <option value="missing_referral_credit">Missing Referral Credit</option>
                <option value="incorrect_earnings">Incorrect Earnings Calculation</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="text-sm font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain what happened and what you expect..."
                className="w-full mt-1 px-3 py-2 border rounded-lg h-24"
                required
              />
            </div>

            {/* File Upload */}
            <div>
              <label className="text-sm font-medium">Upload Evidence</label>
              <div className="mt-2 border-2 border-dashed rounded-lg p-4 text-center">
                <Upload className="w-6 h-6 mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-600">Screenshots, receipts, transaction details</p>
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  id="evidence-upload"
                  accept="image/*,.pdf"
                />
                <label htmlFor="evidence-upload" className="cursor-pointer">
                  <Button type="button" variant="outline" className="mt-2">
                    Choose Files
                  </Button>
                </label>
              </div>

              {/* File List */}
              {files.length > 0 && (
                <div className="mt-3 space-y-2">
                  {files.map((file, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span className="text-sm">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(idx)}
                        className="text-red-500 hover:text-red-700"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={!disputeType || !description || loading}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              {loading ? 'Analyzing...' : 'Submit Dispute for AI Review'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </motion.div>
  );
}