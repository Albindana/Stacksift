import { redirect } from 'next/navigation';

// The "Your data" (GDPR export) section is disabled — the export flow isn't
// functional yet. The nav tab is removed in SettingsTabs; this route bounces
// direct/bookmarked navigations back to settings. Re-enable by restoring the
// tab and rendering <AccountDataPanel /> here.
export default function AccountDataPage() {
  redirect('/settings');
}
