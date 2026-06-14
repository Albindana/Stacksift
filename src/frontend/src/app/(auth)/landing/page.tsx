import Image from 'next/image';
import Link from 'next/link';

export const metadata = {
  title: 'Welcome to StackSift',
};

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-6 rounded-xl border border-line bg-surface p-8 shadow-xl">
      <div className="flex flex-col gap-1">
        {/* Brand logo — mirrors the app sidebar: icon + theme-aware wordmark.
            Two wordmarks are rendered; the `dark:` variant shows exactly one
            (the hidden copy is display:none, so screen readers read "StackSift"
            once via the visible wordmark's alt). */}
        <h1 className="flex items-center gap-2">
          <Image
            src="/stacksifticon.png"
            alt=""
            width={40}
            height={40}
            className="h-10 w-auto shrink-0 rounded"
          />
          <Image
            src="/namestacksifticon.png"
            alt="StackSift"
            width={120}
            height={28}
            className="h-5 w-auto shrink-0 dark:hidden"
          />
          <Image
            src="/namestacksiftwhiteicon.png"
            alt="StackSift"
            width={120}
            height={28}
            className="hidden h-5 w-auto shrink-0 dark:block"
          />
        </h1>
        <p className="text-sm text-muted">
          AI-powered SRE &amp; log-analysis platform.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/register"
          className="flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          Create an account
        </Link>
        <Link
          href="/login"
          className="flex w-full items-center justify-center rounded-lg border border-line bg-elevated px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-line focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          Sign in
        </Link>
      </div>

      <p className="text-center text-xs text-muted">
        By continuing you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}
