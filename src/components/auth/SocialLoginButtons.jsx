import React from 'react';
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function SocialLoginButtons() {
  const socialPlatforms = [
    { 
      id: 'google', 
      name: 'Gmail', 
      icon: '📧',
      bgColor: 'bg-white hover:bg-gray-50',
      textColor: 'text-gray-900',
      border: 'border-2 border-gray-300'
    },
    { 
      id: 'facebook', 
      name: 'Facebook', 
      icon: '📘',
      bgColor: 'bg-blue-600 hover:bg-blue-700',
      textColor: 'text-white',
      border: ''
    },
    { 
      id: 'twitter', 
      name: 'Twitter/X', 
      icon: '🐦',
      bgColor: 'bg-black hover:bg-gray-900',
      textColor: 'text-white',
      border: ''
    },
    { 
      id: 'instagram', 
      name: 'Instagram', 
      icon: '📷',
      bgColor: 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600',
      textColor: 'text-white',
      border: ''
    }
  ];

  const handleSocialLogin = (platformId) => {
    // Mark that we should auto-run onboarding after login
    sessionStorage.setItem('auto_onboard_after_login', '1');
    base44.auth.redirectToLogin(window.location.href);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {socialPlatforms.map(platform => (
          <Button
            key={platform.id}
            onClick={() => handleSocialLogin(platform.id)}
            className={`${platform.bgColor} ${platform.textColor} ${platform.border} h-12 font-medium`}
            variant="outline"
          >
            <span className="text-xl mr-2">{platform.icon}</span>
            {platform.name}
          </Button>
        ))}
      </div>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">Or continue with email</span>
        </div>
      </div>
    </div>
  );
}