import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// NOTE: This is a TEMPLATE Terms of Service tailored to PlayEarning Nexus.
// Replace the [BRACKETED] placeholders and have it reviewed by a lawyer before launch.
const EFFECTIVE = '[EFFECTIVE DATE]';
const COMPANY = '[COMPANY LEGAL NAME]';
const CONTACT_EMAIL = '[support@yourdomain.com]';
const GOVERNING_LAW = '[STATE/COUNTRY]';

const SECTIONS = [
  { h: '1. Acceptance of terms', b: [
    `These Terms of Service ("Terms") are a contract between you and ${COMPANY} ("PlayEarning", "we"). By creating an account or using the app, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the service.`,
  ]},
  { h: '2. Eligibility', b: [
    'You must be at least 18 years old (or the age of majority where you live) and able to form a binding contract. The service is void where prohibited.',
  ]},
  { h: '3. The service', b: [
    'PlayEarning lets users take surveys, play games, refer others, participate in skill-based contests, and earn rewards. Features and reward rates may change over time.',
  ]},
  { h: '4. Accounts', b: [
    'You are responsible for your account and keeping your credentials secure. One account per person. You must provide accurate information.',
  ]},
  { h: '5. Earnings, rewards & payouts', b: [
    'Earnings accrue from eligible, verified activity (e.g., completed surveys, qualifying referrals). We may withhold or reverse rewards obtained through fraud, error, or violation of these Terms.',
    'Payouts are subject to minimum thresholds, identity/fraud verification, and processing by third parties (Stripe, PayPal, and other supported methods). We do not guarantee any level of earnings.',
    'You are responsible for taxes on your earnings. We may issue tax forms (e.g., 1099) and request tax information where required by law.',
    'Certain in-app balances are closed-loop platform credits and may only be redeemable as described in the app.',
  ]},
  { h: '6. Referral program', b: [
    'You may earn commissions and rewards for referrals that meet our criteria. When you post referral or affiliate links on social media, you must clearly disclose the paid/affiliate relationship (e.g., "#ad") as required by the FTC and applicable law. Fake, incentivized-without-disclosure, or fraudulent referrals are prohibited.',
  ]},
  { h: '7. Contests & prize pools', b: [
    'Contests and prize pools on the platform are determined by skill and performance, not chance. Where an entry fee applies, it is disclosed, and contests are void where prohibited by law. Official rules, eligibility, and any regional restrictions apply and are incorporated by reference.',
  ]},
  { h: '8. Shared wallet groups', b: [
    'Group features let members pool closed-loop platform credits toward shared goals and transfer to group members, subject to owner approval and pool balance. These features are not a bank account, money-transmission, or investment service.',
  ]},
  { h: '9. Prohibited conduct', b: [
    'No fraud, bots, scripts, multi-accounting, self-referral, fake survey responses, manipulation of rewards, or circumvention of security. No illegal, harmful, or infringing content. We may suspend or terminate accounts that violate these Terms.',
  ]},
  { h: '10. Payments & third parties', b: [
    'Payments and payouts are handled by third-party processors under their own terms. We are not responsible for processor outages or decisions. Social platform integrations are subject to those platforms’ terms.',
  ]},
  { h: '11. Intellectual property & user content', b: [
    'The platform, its software, and content are owned by us or our licensors. You retain rights to content you submit but grant us a license to operate the service. AI-generated content and features are provided as-is.',
  ]},
  { h: '12. Disclaimers', b: [
    'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND. We do not warrant uninterrupted or error-free operation, or any specific earnings.',
  ]},
  { h: '13. Limitation of liability', b: [
    'TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES, AND OUR TOTAL LIABILITY IS LIMITED TO THE AMOUNTS YOU PAID US (IF ANY) IN THE 12 MONTHS BEFORE THE CLAIM.',
  ]},
  { h: '14. Indemnification', b: [
    'You agree to indemnify and hold us harmless from claims arising out of your use of the service or violation of these Terms.',
  ]},
  { h: '15. Termination', b: [
    'You may stop using the service at any time. We may suspend or terminate access for violations or to comply with law. Certain provisions survive termination.',
  ]},
  { h: '16. Governing law & disputes', b: [
    `These Terms are governed by the laws of ${GOVERNING_LAW}. [Insert dispute-resolution / arbitration / class-action-waiver clause as advised by counsel.]`,
  ]},
  { h: '17. Changes', b: [
    'We may update these Terms. Continued use after changes means you accept the updated Terms.',
  ]},
  { h: '18. Contact', b: [
    `Questions? Contact ${COMPANY} at ${CONTACT_EMAIL}.`,
  ]},
];

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-5 py-10">
        <h1 className="text-3xl font-black text-gray-900">Terms of Service</h1>
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
          See also our <Link to={createPageUrl('PrivacyPolicy')} className="text-indigo-600 underline">Privacy Policy</Link>.
        </div>
      </div>
    </div>
  );
}
