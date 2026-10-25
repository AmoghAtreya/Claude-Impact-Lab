import { IntakeWizard } from "./intake-wizard";

// The customer experience. Shared by /i/[token] and the contractor preview
// so they always match.
export function IntakeWelcome({
  businessName,
  customerName,
  businessPhone,
  embedded,
}: {
  businessName: string;
  customerName: string;
  businessPhone?: string | null;
  embedded?: boolean;
}) {
  return (
    <IntakeWizard
      businessName={businessName}
      customerName={customerName}
      businessPhone={businessPhone}
      embedded={embedded}
    />
  );
}
