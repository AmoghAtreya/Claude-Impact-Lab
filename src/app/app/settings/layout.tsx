import Link from "next/link";
import { SettingsNav } from "./settings-nav";

export default function SettingsLayout({ children }: LayoutProps<"/app/settings">) {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/app/requests" className="text-sm text-neutral-600 underline">
        ← Requests
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <SettingsNav />
      {children}
    </main>
  );
}
