import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import GamerGainLogo from '@/components/branding/GamerGainLogo';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await base44.auth.requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Something went wrong.');
    } finally { setLoading(false); }
  };

  const inputClass = "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500";

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-red-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <GamerGainLogo className="w-12 h-12" />
            <span className="text-3xl font-bold bg-gradient-to-r from-green-700 to-green-900 bg-clip-text text-transparent">GamerGain</span>
          </div>
          <p className="text-gray-500 text-sm">Reset your password — we'll email you a link.</p>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          {sent ? (
            <div className="text-center space-y-3">
              <div className="text-green-600 text-4xl">✓</div>
              <p className="text-gray-700">If an account exists for <strong>{email}</strong>, a reset link is on its way. Check your inbox.</p>
              <Link to="/login" className="inline-block text-red-600 font-medium hover:underline">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="you@example.com" autoComplete="email" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold py-2.5 shadow-lg hover:from-red-700 hover:to-red-800 disabled:opacity-60 transition">
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
              <div className="text-center text-sm text-gray-500">
                <Link to="/login" className="text-red-600 font-medium hover:underline">Back to sign in</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
