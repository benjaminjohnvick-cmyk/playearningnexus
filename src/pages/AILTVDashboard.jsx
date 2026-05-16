import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LTVAnalyticsDashboard from '@/components/analytics/LTVAnalyticsDashboard';

export default function AILTVDashboard() {
  useEffect(() => {
    // Redirect if not admin
    base44.auth.me().then(user => {
      if (!user || user.role !== 'admin') {
        window.location.href = '/';
      }
    });
  }, []);

  return <LTVAnalyticsDashboard />;
}