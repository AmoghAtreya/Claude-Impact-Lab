import Image from "next/image";
import { Suspense } from "react";
import { logout } from "@/app/auth/actions";
import { getAvatarUrl } from "@/lib/avatar";
import { tradeLabel } from "@/lib/trades";
import { requireWorkspace } from "@/lib/workspace";

export default function LoggedInPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-6 py-16">
      <Suspense
        fallback={<p className="text-base leading-7 text-neutral-500">Loading…</p>}
      >
        <WorkspaceSummary />
      </Suspense>
      <p className="text-base leading-7 text-neutral-700">
        This is a placeholder for the contractor workspace.
      </p>
      <form action={logout}>
        <button type="submit" className="text-sm underline">
          Log out
        </button>
      </form>
    </main>
  );
}

async function WorkspaceSummary() {
  const { user, workspace } = await requireWorkspace();
  const avatarUrl = await getAvatarUrl(user.id);
  const trade = tradeLabel(workspace.trade, workspace.tradeOther);
  return (
    <>
      {avatarUrl ? (
        // Signed URLs expire, so skip the image optimizer's caching.
        <Image
          src={avatarUrl}
          alt=""
          width={64}
          height={64}
          unoptimized
          className="size-16 rounded-full border border-neutral-200 object-cover"
        />
      ) : null}
      <h1 className="text-3xl font-semibold tracking-tight">
        {workspace.name}
      </h1>
      <p className="text-base leading-7 text-neutral-700">
        {trade} · {workspace.timezone.replaceAll("_", " ")}
        <br />
        Signed in as <span className="font-medium">{user.email}</span>
      </p>
    </>
  );
}
