// The first screen a customer sees. Shared by /i/[token] and the
// contractor preview so they always match.
export function IntakeWelcome({
  businessName,
  customerName,
}: {
  businessName: string;
  customerName: string;
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
      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled
          className="inline-flex h-12 items-center justify-center rounded-md bg-neutral-900 px-4 text-base font-medium text-white disabled:opacity-50"
        >
          Take a photo
        </button>
        <button
          type="button"
          disabled
          className="inline-flex h-12 items-center justify-center rounded-md border border-neutral-300 px-4 text-base font-medium disabled:opacity-50"
        >
          Upload a photo
        </button>
        <p className="text-sm text-neutral-500">
          Photo intake is coming soon.
        </p>
      </div>
      <p className="text-xs leading-5 text-neutral-500">
        Your photos and answers are shared with {businessName} and processed
        with AI to prepare for your visit. Submitting doesn&apos;t book an
        appointment.
      </p>
    </div>
  );
}
