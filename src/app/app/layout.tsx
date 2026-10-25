import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/auth/actions";
import { getAvatarUrl } from "@/lib/avatar";
import { requireWorkspace } from "@/lib/workspace";

// Pages under /app still call requireWorkspace() themselves; layouts don't
// re-run on every navigation, so this header isn't an access check.
export default function PortalLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="min-h-dvh bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Suspense fallback={<span className="h-5" />}>
            <WorkspaceName />
          </Suspense>
          <form action={logout}>
            <button type="submit" className="text-sm text-neutral-700 underline">
              Log out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}

async function WorkspaceName() {
  const { user, workspace } = await requireWorkspace();
  const avatarUrl = await getAvatarUrl(user.id);
  return (
    <Link href="/app/requests" className="flex min-w-0 items-center gap-2.5">
      {avatarUrl ? (
        // Signed URLs expire, so skip the image optimizer's caching.
        <Image
          src={avatarUrl}
          alt=""
          width={32}
          height={32}
          unoptimized
          className="size-8 rounded-full border border-neutral-200 object-cover"
        />
      ) : null}
      <span className="truncate font-semibold">{workspace.name}</span>
    </Link>
  );
}
