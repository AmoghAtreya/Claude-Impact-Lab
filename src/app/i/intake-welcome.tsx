import type { ReactNode } from "react";

// The first screen a customer sees. Shared by /i/[token] and the
// contractor preview so they always match.
export function IntakeWelcome({
  businessName,
  customerName,
  children,
}: {
  businessName: string;
  customerName: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-600">{businessName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Hi {customerName}, show us the problem
        </h1>
        <p className="text-base leading-7 text-neutral-700">
          {businessName} asked for a few details before your visit. Start with
          a photo of the problem, then answer a few short questions. No app or
          account needed.
        </p>
      </div>
      {children}
      <p className="text-xs leading-5 text-neutral-500">
        Your photos and answers are shared with {businessName} and processed
        with AI to prepare for your visit. Location data is removed from
        photos. Anyone with this link can see and change what you add, so
        don&apos;t forward it. Submitting doesn&apos;t book an appointment.
      </p>
    </div>
  );
}
