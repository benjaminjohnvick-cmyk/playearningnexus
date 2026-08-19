import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';

// One-time 18+ verification prompt. Shown when the current user has `needs_age_verification` (Google/
// social signups start this way). Soft gate: it overlays the app until the user confirms their date
// of birth, which the server validates against MIN_AGE and records. The age flag is server-set only
// (see /auth/complete-age-verification) so it can't be spoofed from the client.
export default function AgeVerificationModal({ onVerified }) {
  const [dob, setDob] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e?.preventDefault?.();
    setError('');
    if (!dob) { setError('Please enter your date of birth.'); return; }
    setSubmitting(true);
    try {
      await base44.auth.completeAgeVerification({ date_of_birth: dob });
      if (onVerified) onVerified();
      else if (typeof window !== 'undefined') window.location.reload();
    } catch (err) {
      setError(err?.data?.error || err?.message || 'Verification failed. You must be 18 or older to use Get Goods Gratis (Free).');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-xl font-bold text-zinc-900">Confirm your age</h2>
        <p className="mb-4 text-sm text-zinc-600">
          Get Goods Gratis (Free) is for adults 18 and older. Please confirm your date of birth to continue —
          you only need to do this once.
        </p>
        <form onSubmit={submit}>
          <label htmlFor="age-dob" className="mb-1 block text-sm font-medium text-zinc-700">Date of birth</label>
          <input
            id="age-dob"
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            required
          />
          {error && <div className="mb-3 text-sm text-red-600">{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {submitting ? 'Verifying…' : 'Confirm and continue'}
          </button>
        </form>
        <p className="mt-3 text-[11px] leading-tight text-zinc-400">
          We use your date of birth only to verify eligibility. You must be at least 18.
        </p>
      </div>
    </div>
  );
}
