import React from 'react';
import { base44 } from '@/api/base44Client';
import { useEffect } from 'react';
import GrowthEngineMonitor from '@/components/growth/GrowthEngineMonitor';

export default function GrowthEngineHub() {
  useEffect(() => {
    // Redirect if not admin
    base44.auth.me().then(user => {
      if (!user || user.role !== 'admin') {
        window.location.href = '/';
      }
    });
  }, []);

  return <GrowthEngineMonitor />;
}