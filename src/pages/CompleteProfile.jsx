import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { User, CheckCircle } from 'lucide-react';

export default function CompleteProfile() {
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.full_name) setFullName(u.full_name);
    }).catch(() => base44.auth.redirectToLogin());
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = fullName.trim();
    if (!trimmed) return setError('Please enter your full name.');
    if (trimmed.split(' ').filter(Boolean).length < 2) return setError('Please enter both first and last name.');

    setSaving(true);
    setError('');
    try {
      await base44.auth.updateMe({ full_name: trimmed });
      sessionStorage.removeItem('needs_profile_completion');
      // Redirect to home
      window.location.replace('/');
    } catch {
      setError('Failed to save. Please try again.');
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-white px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border-2 border-red-100 p-8">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-3">
            <User className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Complete Your Profile</h1>
          <p className="text-sm text-gray-500 text-center mt-1">
            {user?.email ? `Signed in as ${user.email}` : 'One last step before you get started'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email (read-only, informational) */}
          {user?.email && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Email Address</label>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-gray-600">{user.email}</span>
              </div>
            </div>
          )}

          {/* Full Name */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Full Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={fullName}
              onChange={e => { setFullName(e.target.value); setError(''); }}
              placeholder="First and last name"
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:border-red-400 focus:outline-none transition-colors"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold py-3 rounded-lg transition-all disabled:opacity-60 mt-2"
          >
            {saving ? 'Saving...' : 'Continue to GamerGain →'}
          </button>
        </form>
      </div>
    </div>
  );
}