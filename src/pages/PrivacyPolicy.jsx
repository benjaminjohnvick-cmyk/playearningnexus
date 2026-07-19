import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// NOTE: This is a TEMPLATE privacy policy tailored to PlayEarning Nexus.
// Replace the [BRACKETED] placeholders and have it reviewed by a lawyer before launch.
const EFFECTIVE = '[EFFECTIVE DATE]';
const COMPANY = '[COMPANY LEGAL NAME]';
const CONTACT_EMAIL = '[privacy@yourdomain.com]';

const SECTIONS = [
  { h: '1. Who we are', b: [
    `PlayEarning Nexus ("PlayEarning", "we", "us") is operated by ${COMPANY}. This Privacy Policy explains what we collect, how we use it, and your choices. By using the app you agree to this policy.`,
  ]},
  { h: '2. Information we collect', b: [
    'Account & profile: name, email, password/credentials (via our auth provider), profile details, and demographic information you provide (e.g., age, interests, country) used to match you with surveys.',
    'Activity: surveys you take and responses, games played, referrals, votes, contributions to groups, earnings and payout history.',
    'Payments: processed by Stripe and PayPal. We do not store full card numbers; the processors handle card data. We store transaction records and payout details.',
    'Device & usage: IP address, device/browser type, app interactions, and approximate location/currency (from your browser/IP) used for localization and fraud prevention.',
    'Social connections: if you connect Facebook, Instagram, X/Twitter, or Snapchat, we access the permissions you grant (e.g., to post on your behalf when you opt in).',
    'Notifications: push subscription tokens if you enable web/app notifications.',
  ]},
  { h: '3. How we use your information', b: [
    'To provide and operate the service (surveys, games, referrals, rewards, groups).',
    'To process payments and payouts and calculate earnings and commissions.',
    'To match you with relevant surveys and personalize content (including AI-assisted recommendations).',
    'To detect and prevent fraud, abuse, and multi-accounting.',
    'To send you service messages, notifications, and (with consent) marketing.',
    'To comply with legal, tax, and regulatory obligations.',
  ]},
  { h: '4. How we share information', b: [
    'Payment processors (Stripe, PayPal) to process transactions and payouts.',
    'Survey providers (e.g., BitLabs) to deliver surveys and confirm completions.',
    'Social platforms you choose to connect, per the permissions you grant.',
    'Service providers (hosting/backend via Base44, messaging via Twilio, infrastructure) under contract.',
    'Legal and safety: to comply with law, enforce our Terms, or protect rights and safety.',
    'We do not sell your personal information for money.',
  ]},
  { h: '5. Cookies, tracking & notifications', b: [
    'We use local storage and similar technologies for sign-in, preferences (language/currency), and analytics. You can enable or disable push notifications at any time in your device/browser settings.',
  ]},
  { h: '6. Data retention', b: [
    'We keep your information while your account is active and as needed for legal, tax, accounting, and fraud-prevention purposes, then delete or anonymize it.',
  ]},
  { h: '7. Your rights & choices', b: [
    'Depending on where you live (e.g., EEA/UK under GDPR, California under CCPA/CPRA), you may have rights to access, correct, delete, port, or restrict your data, to opt out of certain processing, and to withdraw consent. To exercise these, contact us at ' + CONTACT_EMAIL + '.',
    'You can opt out of marketing messages and disable notifications at any time.',
  ]},
  { h: '8. Children', b: [
    'The service involves earning money and payments and is intended for users 18 years and older (or the age of majority in your jurisdiction). We do not knowingly collect data from children under 18.',
  ]},
  { h: '9. Security', b: [
    'We use technical and organizational measures to protect your data. No method of transmission or storage is 100% secure; we cannot guarantee absolute security.',
  ]},
  { h: '10. International transfers', b: [
    'Your information may be processed in countries other than yours. Where required, we use appropriate safeguards for such transfers.',
  ]},
  { h: '11. Changes to this policy', b: [
    'We may update this policy. Material changes will be posted here with a new effective date.',
  ]},
  { h: '12. Contact us', b: [
    `Questions? Contact ${COMPANY} at ${CONTACT_EMAIL}.`,
  ]},
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-3xl font-black text-gray-900">Privacy Policy</h1>
        <p className="text-sm text-gray-500 mt-1">Effective date: {EFFECTIVE}</p>
        <div className="mt-3 mb-8 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2">
          Template for review — replace bracketed placeholders and have a lawyer review before launch.
        </div>
        {SECTIONS.map((s) => (
          <section key={s.h} className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">{s.h}</h2>
            {s.b.map((p, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed mb-2">{p}</p>
            ))}
          </section>
        ))}
        <div className="mt-8 pt-6 border-t text-sm text-gray-500">
          See also our <Link to={createPageUrl('TermsOfService')} className="text-indigo-600 underline">Terms of Service</Link>.
        </div>
      </div>
    </div>
  );
}
