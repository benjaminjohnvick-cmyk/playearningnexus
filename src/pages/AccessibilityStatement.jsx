import React from 'react';

// AccessibilityStatement — a published accessibility statement (WCAG 2.1/2.2 AA target). Having a statement +
// a contact route is part of an ADA/EN 301 549 conformance posture; the automated + manual audit is tracked
// separately (see the compliance gap analysis).
export default function AccessibilityStatement() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-12 prose prose-sm">
        <h1 className="text-2xl font-bold text-gray-900">Accessibility Statement</h1>
        <p className="text-gray-600">Last updated: {new Date().getFullYear()}</p>

        <p className="text-gray-700 mt-4">
          Get Goods Gratis (Free) is committed to making our website and apps accessible to everyone, including
          people with disabilities. We aim to conform to the Web Content Accessibility Guidelines (WCAG) 2.1/2.2
          Level AA and to relevant standards including the Americans with Disabilities Act (ADA) and the EU
          EN&nbsp;301&nbsp;549 standard.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">What we do</h2>
        <ul className="text-gray-700">
          <li>Design for keyboard navigation, visible focus, and screen-reader compatibility.</li>
          <li>Provide text alternatives for meaningful images and respect reduced-motion preferences.</li>
          <li>Include a skip-to-content link and semantic structure on our pages.</li>
          <li>Review new features for accessibility as part of our ongoing conformance work.</li>
        </ul>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Ongoing work</h2>
        <p className="text-gray-700">
          Accessibility is an ongoing effort. We are conducting automated and manual audits against WCAG&nbsp;AA
          and remediating issues as we find them. Some third-party or AI-generated content may not yet fully
          conform; we are actively working on it.
        </p>

        <h2 className="text-lg font-bold text-gray-900 mt-6">Need help or found a problem?</h2>
        <p className="text-gray-700">
          If you encounter an accessibility barrier, or need information in an alternative format, please contact
          us via our <a href="/ContactUs" className="text-blue-600 underline">Contact page</a>. Tell us the page
          and the issue, and we'll work to provide the information or fix the barrier promptly.
        </p>
      </div>
    </div>
  );
}
