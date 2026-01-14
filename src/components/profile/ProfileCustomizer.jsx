import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, Save, Image as ImageIcon, Palette } from 'lucide-react';

export default function ProfileCustomizer({ user }) {
  const queryClient = useQueryClient();
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '');
  const [bannerUrl, setBannerUrl] = useState(user.banner_url || '');
  const [uploading, setUploading] = useState(false);

  const { data: equippedItems = [] } = useQuery({
    queryKey: ['userInventory', user.id],
    queryFn: () => base44.entities.UserInventory.filter({ user_id: user.id, is_equipped: true }),
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data) => base44.auth.updateMe(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('Profile updated successfully!');
    },
  });

  const handleFileUpload = async (file, type) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (type === 'avatar') {
        setAvatarUrl(file_url);
      } else {
        setBannerUrl(file_url);
      }
      toast.success(`${type === 'avatar' ? 'Avatar' : 'Banner'} uploaded!`);
    } catch (error) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    updateProfileMutation.mutate({
      avatar_url: avatarUrl,
      banner_url: bannerUrl
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5" />
            Profile Images
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Avatar</label>
            <div className="flex items-center gap-4">
              {avatarUrl && (
                <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-4 border-red-200" />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e.target.files[0], 'avatar')}
                disabled={uploading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Banner</label>
            <div className="space-y-2">
              {bannerUrl && (
                <img src={bannerUrl} alt="Banner" className="w-full h-32 rounded-lg object-cover border-2 border-red-200" />
              )}
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => handleFileUpload(e.target.files[0], 'banner')}
                disabled={uploading}
              />
            </div>
          </div>

          <Button
            onClick={handleSave}
            disabled={uploading || updateProfileMutation.isPending}
            className="w-full bg-gradient-to-r from-red-600 to-red-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Profile
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Equipped Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {equippedItems.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No items equipped. Visit the store to unlock cosmetics!</p>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {equippedItems.map((item) => (
                <div key={item.id} className="p-4 border-2 border-red-200 rounded-lg text-center">
                  <p className="font-medium">Equipped Item</p>
                  <p className="text-sm text-gray-600">{item.cosmetic_item_id}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}