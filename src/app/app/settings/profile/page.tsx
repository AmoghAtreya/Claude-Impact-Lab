import { Suspense } from "react";
import { logout } from "@/app/auth/actions";
import { getAvatarUrl } from "@/lib/avatar";
import { requireWorkspace } from "@/lib/workspace";
import { PasswordForm } from "./password-form";
import { ProfilePictureForm } from "./profile-picture-form";

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  technician: "Technician",
} as const;

export default function ProfileSettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
      <ProfileSettings />
    </Suspense>
  );
}

async function ProfileSettings() {
  const { user, workspace } = await requireWorkspace();
  const avatarUrl = await getAvatarUrl(user.id);

  return (
    <>
      <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold">Account</h2>
        <dl className="grid gap-4 sm:grid-cols-[10rem_1fr]">
          <dt className="text-sm text-neutral-600">Email</dt>
          <dd className="text-sm text-neutral-900">{user.email}</dd>
          <dt className="text-sm text-neutral-600">Role</dt>
          <dd className="text-sm text-neutral-900">
            {ROLE_LABELS[workspace.role]} of {workspace.name}
          </dd>
        </dl>
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold">Profile picture</h2>
        <ProfilePictureForm avatarUrl={avatarUrl} />
      </section>

      <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold">Change password</h2>
        <PasswordForm />
      </section>

      <form action={logout}>
        <button type="submit" className="text-sm underline">
          Log out
        </button>
      </form>
    </>
  );
}
