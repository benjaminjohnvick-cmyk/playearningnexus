import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { base44 } from '@/api/base44Client';
import { Upload, X, CheckCircle2, Image, Film, FileArchive, Smartphone } from "lucide-react";
import { toast } from "sonner";

export default function AppUploadForm({ onSuccess, onCancel, businessClient }) {
  const [step, setStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [gameData, setGameData] = useState({
    title: '',
    description: '',
    category: 'casual',
    platform: ['android'],
    icon_url: '',
    screenshots: [],
    video_url: '',
    app_file_url: '',
    download_url: ''
  });

  const uploadFile = async (file, type) => {
    try {
      setUploading(true);
      const result = await base44.integrations.Core.UploadFile({ file });
      
      if (type === 'icon') {
        setGameData({ ...gameData, icon_url: result.file_url });
      } else if (type === 'screenshot') {
        setGameData({ ...gameData, screenshots: [...gameData.screenshots, result.file_url] });
      } else if (type === 'video') {
        setGameData({ ...gameData, video_url: result.file_url });
      } else if (type === 'app') {
        setGameData({ ...gameData, app_file_url: result.file_url, download_url: result.file_url });
      }
      
      toast.success(`${type} uploaded successfully!`);
      setUploading(false);
      return result.file_url;
    } catch (error) {
      toast.error(`Failed to upload ${type}`);
      setUploading(false);
      throw error;
    }
  };

  const removeScreenshot = (index) => {
    const newScreenshots = [...gameData.screenshots];
    newScreenshots.splice(index, 1);
    setGameData({ ...gameData, screenshots: newScreenshots });
  };

  const handleSubmit = async () => {
    if (!gameData.title || !gameData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (!gameData.icon_url) {
      toast.error('Please upload an app icon');
      return;
    }

    if (!gameData.download_url && !gameData.app_file_url) {
      toast.error('Please provide a download URL or upload an app file');
      return;
    }

    try {
      setUploading(true);
      await base44.entities.Game.create({
        ...gameData,
        developer_id: businessClient.id,
        status: 'pending',
        download_url: gameData.download_url || gameData.app_file_url
      });
      
      toast.success('App submitted successfully! Pending review.');
      onSuccess();
    } catch (error) {
      toast.error('Failed to submit app');
    } finally {
      setUploading(false);
    }
  };

  const togglePlatform = (platform) => {
    if (gameData.platform.includes(platform)) {
      setGameData({ 
        ...gameData, 
        platform: gameData.platform.filter(p => p !== platform) 
      });
    } else {
      setGameData({ 
        ...gameData, 
        platform: [...gameData.platform, platform] 
      });
    }
  };

  return (
    <Card className="p-6 border-0 shadow-xl">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center flex-1">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                step >= s ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {step > s ? <CheckCircle2 className="w-5 h-5" /> : s}
              </div>
              {s < 3 && (
                <div className={`h-1 flex-1 mx-2 ${
                  step > s ? 'bg-blue-600' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm text-gray-600">
          <span>Basic Info</span>
          <span>Media Assets</span>
          <span>Review & Submit</span>
        </div>
      </div>

      {/* Step 1: Basic Information */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">App Details</h2>
          
          <div>
            <Label>App Title *</Label>
            <Input
              value={gameData.title}
              onChange={(e) => setGameData({ ...gameData, title: e.target.value })}
              placeholder="My Awesome Game"
              required
            />
          </div>

          <div>
            <Label>Description *</Label>
            <Textarea
              value={gameData.description}
              onChange={(e) => setGameData({ ...gameData, description: e.target.value })}
              placeholder="Describe your game in detail..."
              rows={5}
              required
            />
          </div>

          <div>
            <Label>Category *</Label>
            <Select value={gameData.category} onValueChange={(val) => setGameData({ ...gameData, category: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="casual">Casual</SelectItem>
                <SelectItem value="puzzle">Puzzle</SelectItem>
                <SelectItem value="action">Action</SelectItem>
                <SelectItem value="strategy">Strategy</SelectItem>
                <SelectItem value="rpg">RPG</SelectItem>
                <SelectItem value="simulation">Simulation</SelectItem>
                <SelectItem value="sports">Sports</SelectItem>
                <SelectItem value="racing">Racing</SelectItem>
                <SelectItem value="adventure">Adventure</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Supported Platforms *</Label>
            <div className="flex gap-3 mt-2">
              {['android', 'ios', 'web'].map((platform) => (
                <Button
                  key={platform}
                  type="button"
                  variant={gameData.platform.includes(platform) ? "default" : "outline"}
                  onClick={() => togglePlatform(platform)}
                  className="capitalize"
                >
                  {platform}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button onClick={() => setStep(2)} className="bg-gradient-to-r from-blue-600 to-blue-700">
              Next: Upload Media
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Media Assets */}
      {step === 2 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Upload Media</h2>

          {/* App Icon */}
          <div>
            <Label>App Icon * (Required)</Label>
            <p className="text-xs text-gray-500 mb-2">512x512 PNG or JPG, max 2MB</p>
            <div className="flex gap-4 items-center">
              <div className="relative">
                <input
                  type="file"
                  id="icon-upload"
                  accept="image/*"
                  onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0], 'icon')}
                  className="hidden"
                  disabled={uploading}
                />
                <label htmlFor="icon-upload">
                  <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                    {gameData.icon_url ? (
                      <img src={gameData.icon_url} alt="Icon" className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <div className="text-center">
                        <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <span className="text-xs text-gray-500">Upload Icon</span>
                      </div>
                    )}
                  </div>
                </label>
              </div>
              {gameData.icon_url && (
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              )}
            </div>
          </div>

          {/* Screenshots */}
          <div>
            <Label>Screenshots (Up to 8)</Label>
            <p className="text-xs text-gray-500 mb-2">1080x1920 or 1920x1080, PNG or JPG</p>
            <div className="grid grid-cols-4 gap-4">
              {gameData.screenshots.map((screenshot, index) => (
                <div key={index} className="relative group">
                  <img src={screenshot} alt={`Screenshot ${index + 1}`} className="w-full h-32 object-cover rounded-lg" />
                  <button
                    onClick={() => removeScreenshot(index)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {gameData.screenshots.length < 8 && (
                <div>
                  <input
                    type="file"
                    id="screenshot-upload"
                    accept="image/*"
                    onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0], 'screenshot')}
                    className="hidden"
                    disabled={uploading}
                  />
                  <label htmlFor="screenshot-upload">
                    <div className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all">
                      <Upload className="w-6 h-6 text-gray-400" />
                    </div>
                  </label>
                </div>
              )}
            </div>
          </div>

          {/* Gameplay Video */}
          <div>
            <Label>Gameplay Video (Optional)</Label>
            <p className="text-xs text-gray-500 mb-2">MP4, max 50MB</p>
            <div className="flex gap-4 items-center">
              <div>
                <input
                  type="file"
                  id="video-upload"
                  accept="video/*"
                  onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0], 'video')}
                  className="hidden"
                  disabled={uploading}
                />
                <label htmlFor="video-upload">
                  <Button type="button" variant="outline" disabled={uploading}>
                    <Film className="w-4 h-4 mr-2" />
                    {gameData.video_url ? 'Change Video' : 'Upload Video'}
                  </Button>
                </label>
              </div>
              {gameData.video_url && (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-600">Video uploaded</span>
                </div>
              )}
            </div>
          </div>

          {/* App File or URL */}
          <div>
            <Label>App Download</Label>
            <p className="text-xs text-gray-500 mb-2">Upload APK/IPA file OR provide download URL</p>
            
            <div className="space-y-3">
              <div>
                <input
                  type="file"
                  id="app-upload"
                  accept=".apk,.ipa,.zip"
                  onChange={(e) => e.target.files[0] && uploadFile(e.target.files[0], 'app')}
                  className="hidden"
                  disabled={uploading}
                />
                <label htmlFor="app-upload">
                  <Button type="button" variant="outline" disabled={uploading} className="w-full">
                    <FileArchive className="w-4 h-4 mr-2" />
                    {gameData.app_file_url ? 'App File Uploaded' : 'Upload App File (APK/IPA)'}
                  </Button>
                </label>
              </div>
              
              <div className="text-center text-sm text-gray-500">OR</div>
              
              <div>
                <Input
                  value={gameData.download_url}
                  onChange={(e) => setGameData({ ...gameData, download_url: e.target.value })}
                  placeholder="https://play.google.com/store/apps/..."
                />
              </div>
            </div>
          </div>

          {uploading && (
            <div className="space-y-2">
              <Progress value={uploadProgress} />
              <p className="text-sm text-gray-600 text-center">Uploading...</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button onClick={() => setStep(1)} variant="outline">
              Back
            </Button>
            <Button onClick={() => setStep(3)} className="bg-gradient-to-r from-blue-600 to-blue-700">
              Next: Review
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Review Your Submission</h2>

          <Card className="p-4 border">
            <div className="flex gap-4">
              {gameData.icon_url && (
                <img src={gameData.icon_url} alt="Icon" className="w-24 h-24 rounded-xl object-cover" />
              )}
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900">{gameData.title}</h3>
                <p className="text-sm text-gray-600 mt-1">{gameData.description}</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Badge>{gameData.category}</Badge>
                  {gameData.platform.map(p => (
                    <Badge key={p} variant="outline" className="capitalize">{p}</Badge>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-700">Icon</Label>
              <p className="text-sm">{gameData.icon_url ? 'Uploaded' : 'Missing'}</p>
            </div>
            <div>
              <Label className="text-gray-700">Screenshots</Label>
              <p className="text-sm">{gameData.screenshots.length} uploaded</p>
            </div>
            <div>
              <Label className="text-gray-700">Video</Label>
              <p className="text-sm">{gameData.video_url ? 'Uploaded' : 'Not provided'}</p>
            </div>
            <div>
              <Label className="text-gray-700">Download</Label>
              <p className="text-sm">{gameData.download_url || gameData.app_file_url ? 'Provided' : 'Missing'}</p>
            </div>
          </div>

          <Card className="p-4 bg-blue-50 border-blue-200">
            <h4 className="font-bold text-gray-900 mb-2">Review Process</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Apps are reviewed within 24-48 hours</li>
              <li>• You'll be notified via email about approval status</li>
              <li>• Approved apps appear in the marketplace immediately</li>
              <li>• Revenue share starts after first install</li>
            </ul>
          </Card>

          <div className="flex gap-3 pt-4">
            <Button onClick={() => setStep(2)} variant="outline">
              Back
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={uploading}
              className="bg-gradient-to-r from-green-600 to-emerald-600"
            >
              Submit for Review
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}