import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import GoogleSignInButton from '@/components/auth/GoogleSignInButton';
import GamerGainLogo from '@/components/branding/GamerGainLogo';

// Self-hosted login/signup form, styled to match the GamerGain app design system
// (green logo/wordmark, red CTA, red-50/white background). Replaces Base44's hosted screen.
// mode: 'login' | 'signup'. On success, stores the JWT and navigates to ?redirect= (or home).
export default function AuthForm({ mode = 'login' }) {
  const isSignup = mode === 'signup';
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const auth = (() => { try { return useAuth(); } catch { return null; } })();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const redirectTo = params.get('redirect') || '/';

  const finishAuth = async () => {
    try { await auth?.checkAppState?.(); } catch { /* non-fatal */ }
    if (redirectTo.startsWith('http')) window.location.href = redirectTo;
    else navigate(redirectTo, { replace: true });
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Email and password are required.'); return; }
    if (isSignup && password !== confirm) { setError('Passwords do not match.'); return; }
    if (isSignup && password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      if (isSignup) await base44.auth.signup(email, password, fullName);
      else await base44.auth.login(email, password);
      await finishAuth();
    } catch (err) {
      setError(err?.data?.error || err?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
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
          <p className="text-gray-500 text-sm">{isSignup ? 'Create your account' : 'Sign in to your account'}</p>
        </div>

        <form onSubmit={submit} className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>
          )}

          {isSignup && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Your name" autoComplete="name" />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="you@example.com" autoComplete="email" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} placeholder="••••••••" autoComplete={isSignup ? 'new-password' : 'current-password'} />
          </div>

          {isSignup && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required className={inputClass} placeholder="••••••••" autoComplete="new-password" />
            </div>
          )}

          {!isSignup && (
            <div className="text-right -mt-1">
              <Link to="/forgot-password" className="text-xs text-red-600 hover:underline">Forgot password?</Link>
            </div>
          )}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-red-600 to-red-700 text-white font-semibold py-2.5 shadow-lg hover:from-red-700 hover:to-red-800 disabled:opacity-60 transition">
            {loading ? 'Please wait…' : (isSignup ? 'Create account' : 'Sign in')}
          </button>

          {/* Sign in with Google (renders only when VITE_GOOGLE_CLIENT_ID is set) */}
          <div className="pt-1">
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-xs"><span className="bg-white px-2 text-gray-400">or</span></div>
            </div>
            <GoogleSignInButton onSuccess={finishAuth} onError={(m) => setError(m)} />
          </div>

          <div className="text-center text-sm text-gray-500 pt-1">
            {isSignup ? (
              <>Already have an account? <Link to="/login" className="text-red-600 font-medium hover:underline">Sign in</Link></>
            ) : (
              <>New here? <Link to="/signup" className="text-red-600 font-medium hover:underline">Create an account</Link></>
            )}
          </div>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          The premium game discovery platform. By continuing you agree to our{' '}
          <Link to="/TermsOfService" className="hover:underline">Terms</Link> and{' '}
          <Link to="/PrivacyPolicy" className="hover:underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
