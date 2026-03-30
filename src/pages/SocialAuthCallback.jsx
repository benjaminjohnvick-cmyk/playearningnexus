import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

export default function SocialAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const errorParam = searchParams.get('error');

        if (errorParam) {
          setError(`Authorization denied: ${errorParam}`);
          setStatus('error');
          return;
        }

        if (!code) {
          setError('No authorization code received');
          setStatus('error');
          return;
        }

        // Determine platform from state or window history
        const platform = state || 'facebook'; // Default to facebook, can be improved with state param

        // Call backend to exchange code for token
        const response = await base44.functions.invoke('socialMediaOAuthHandler', {
          platform,
          code,
          state
        });

        if (response.data.success) {
          setStatus('success');
          setTimeout(() => {
            navigate('/UserProfile');
          }, 2000);
        } else {
          setError(response.data.error || 'Failed to connect account');
          setStatus('error');
        }
      } catch (err) {
        setError(err.message || 'An error occurred during authentication');
        setStatus('error');
      }
    };

    handleCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connecting Social Account</CardTitle>
          <CardDescription>Setting up your social media connection</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          {status === 'processing' && (
            <>
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <p className="text-sm text-gray-600">Authenticating with your account...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div className="text-center">
                <p className="font-medium">Account connected successfully!</p>
                <p className="text-sm text-gray-600">Redirecting to your profile...</p>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <AlertCircle className="w-8 h-8 text-red-600" />
              <div className="text-center">
                <p className="font-medium text-red-700">Connection failed</p>
                <p className="text-sm text-gray-600">{error}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}