import { Suspense } from "react";
import { canManageWorkspace, requireWorkspace } from "@/lib/workspace";
import { TIME_ZONES } from "@/lib/workspace-schema";
import { BusinessForm } from "./business-form";
import { RevokeAllLinks } from "./revoke-all-links";

export default function BusinessSettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
      <BusinessSettings />
    </Suspense>
  );
}

async function BusinessSettings() {
  const { workspace } = await requireWorkspace();
  const canManage = canManageWorkspace(workspace);

  return (
    <>
      <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
        <h2 className="mb-1 text-base font-semibold">Business details</h2>
        <p className="mb-5 text-sm text-neutral-600">
          Customers see your business name and contact details when they open
          an intake link.
          {canManage ? null : " Only owners and admins can change these."}
        </p>
        <BusinessForm
          canManage={canManage}
          timeZones={TIME_ZONES}
          initial={{
            name: workspace.name,
            trade: workspace.trade,
            tradeOther: workspace.tradeOther ?? "",
            contactEmail: workspace.contactEmail ?? "",
            contactPhone: workspace.contactPhone ?? "",
            timezone: workspace.timezone,
            linkExpiryDays: String(workspace.intakeLinkExpiryDays),
            photoRetentionDays: String(workspace.photoRetentionDays),
          }}
        />
      </section>

      {canManage ? (
        <section className="rounded-lg border border-neutral-200 bg-white p-5 sm:p-6">
          <h2 className="mb-1 text-base font-semibold">Revoke all intake links</h2>
          <p className="mb-4 text-sm leading-6 text-neutral-600">
            Stops every active customer link from working, for example if
            links were sent to the wrong people. Photos and answers already
            sent are kept. You can create a new link on any request
            afterwards.
          </p>
          <RevokeAllLinks />
        </section>
      ) : null}
    </>
  );
}
