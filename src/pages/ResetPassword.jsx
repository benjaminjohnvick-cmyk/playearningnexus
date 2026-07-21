import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import GamerGainLogo from '@/components/branding/GamerGainLogo';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const email = params.get('email') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const invalidLink = !token || !email;
  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500";

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await base44.auth.resetPassword(email, token, password);
      setDone(true);
      setTimeout(() => navigate('/', { replace: true }), 1500);
    } catch (err) {
      setError(err?.data?.error || err?.message || 'Reset failed. The link may have expired.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <GamerGainLogo className="w-12 h-12" />
            <span className="text-3xl font-bold bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-transparent">GamerGain</span>
          </div>
          <p className="text-gray-500 text-sm">Choose a new password{email ? ` for ${email}` : ''}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          {invalidLink ? (
            <div className="text-center space-y-3">
              <p className="text-gray-700">This reset link is missing information. Please request a new one.</p>
              <Link to="/forgot-password" className="inline-block text-red-600 font-medium hover:underline">Request a new link</Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-2">
              <div className="text-green-600 text-4xl">✓</div>
              <p className="text-gray-700">Password updated. Signing you in…</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} placeholder="••••••••" autoComplete="new-password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputClass} placeholder="••••••••" autoComplete="new-password" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold py-2.5 shadow-lg hover:from-red-700 hover:to-red-800 disabled:opacity-60 transition">
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
