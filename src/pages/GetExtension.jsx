import React from 'react';
import { useLocation } from 'react-router-dom';
import ExtensionInstallPrompt from '@/components/growth/ExtensionInstallPrompt';

// GetExtension — the post-signup step that offers the browser extension (pre-checked opt-in, opens the Web
// Store). Preserves any ?redirect= target so the user lands where they were headed after choosing.
export default function GetExtension() {
  const params = new URLSearchParams(useLocation().search);
  const redirectTo = params.get('redirect') || '/';
  return <ExtensionInstallPrompt redirectTo={redirectTo} />;
}
