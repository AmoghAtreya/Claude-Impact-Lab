import type { IntakePhoto } from "@/lib/intake-photo-rules";
import { IntakeWizard } from "./intake-wizard";

// The customer experience. Shared by /i/[token] and the contractor preview
// so they always match.
export function IntakeWelcome({
  businessName,
  customerName,
  businessPhone,
  embedded,
  live,
}: {
  businessName: string;
  customerName: string;
  businessPhone?: string | null;
  embedded?: boolean;
  /** A real intake link: photos are uploaded and saved. Omit for previews. */
  live?: { token: string; photos: IntakePhoto[]; description: string };
}) {
  return (
    <IntakeWizard
      businessName={businessName}
      customerName={customerName}
      businessPhone={businessPhone}
      embedded={embedded}
      live={live}
    />
  );
}
