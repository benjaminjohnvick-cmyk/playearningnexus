import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

export default function SocialLoginButtons() {
  const [selectedPlatform, setSelectedPlatform] = useState('');

  const platforms = [
    { id: 'google', name: 'Google', color: 'bg-white border-2 border-gray-300 hover:bg-gray-50 text-gray-900' },
    { id: 'twitter', name: 'X / Twitter', color: 'bg-black hover:bg-gray-900 text-white' },
    { id: 'facebook', name: 'Facebook', color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { id: 'instagram', name: 'Instagram', color: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white' },
    { id: 'tiktok', name: 'TikTok', color: 'bg-black hover:bg-gray-900 text-white' },
    { id: 'snapchat', name: 'Snapchat', color: 'bg-yellow-400 hover:bg-yellow-500 text-black' }
  ];

  const handleSocialLogin = (platformId) => {
    toast.info(`${platforms.find(p => p.id === platformId)?.name} login - OAuth integration required at platform level`);
    // This would normally redirect to OAuth flow
    // window.location.href = `/auth/${platformId}`;
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Select value={selectedPlatform} onValueChange={(val) => {
          setSelectedPlatform(val);
          handleSocialLogin(val);
        }}>
          <SelectTrigger className="w-full h-12 bg-white border-2 border-red-300">
            <div className="flex items-center gap-2">
              <ChevronDown className="w-4 h-4" />
              <span>{selectedPlatform ? `Sign up with ${platforms.find(p => p.id === selectedPlatform)?.name}` : 'One-Click Sign Up'}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {platforms.map(platform => (
              <SelectItem key={platform.id} value={platform.id}>
                <span className="font-medium">{platform.name}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-center text-sm text-gray-500">
        Or sign up with email below
      </div>
    </div>
  );
}