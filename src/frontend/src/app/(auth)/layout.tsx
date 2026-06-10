/**
 * Auth group layout.
 *
 * Applies to /login and /callback.
 * Centres content vertically and horizontally — no sidebar, no topbar.
 * Width is constrained to keep auth forms readable on large screens.
 *
 * This layout sits inside RootLayout (gets the Providers + ToastContainer)
 * but outside the dashboard group (no nav shell).
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4">
      <main id="main-content" tabIndex={-1} className="w-full max-w-md focus:outline-none">
        {children}
      </main>
    </div>
  );
}
