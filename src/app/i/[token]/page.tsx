import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { hashIntakeToken, isIntakeToken } from "@/lib/intake-links";
import { getIntakePhotos } from "@/lib/intake-photos";
import { createClient } from "@/lib/supabase/server";
import { IntakeWelcome } from "../intake-welcome";
import { PhotoIntake } from "../photo-intake";

// Keep the token out of Referer headers and search engines.
export const metadata: Metadata = {
  title: "Service intake",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

type LinkRow = {
  status: "active" | "expired" | "revoked" | "submitted";
  business_name: string;
  business_email: string | null;
  business_phone: string | null;
  customer_name: string;
  customer_description: string | null;
};

export default function IntakePage({ params }: PageProps<"/i/[token]">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <Suspense fallback={<p className="text-sm text-neutral-500">Loading…</p>}>
        <Intake params={params} />
      </Suspense>
    </main>
  );
}

async function Intake({ params }: Pick<PageProps<"/i/[token]">, "params">) {
  const { token } = await params;
  const link = isIntakeToken(token) ? await lookUpLink(token) : null;

  if (!link) {
    return (
      <Unavailable title="This link isn't valid">
        Check that you opened the full link you were sent, or ask the business
        to send it again.
      </Unavailable>
    );
  }

  // Viewing never changes the link, so message previews and prefetching
  // can't use it up.
  switch (link.status) {
    case "active":
      return (
        <IntakeWelcome
          businessName={link.business_name}
          customerName={link.customer_name}
        >
          <PhotoIntake
            mode={{ kind: "live", token }}
            businessName={link.business_name}
            initialPhotos={await getIntakePhotos(token)}
            initialDescription={link.customer_description ?? ""}
          />
        </IntakeWelcome>
      );
    case "submitted":
      return (
        <Unavailable title="Thanks, your details were sent">
          {link.business_name} has your photos and answers. They&apos;ll be in
          touch about next steps.
        </Unavailable>
      );
    case "expired":
    case "revoked":
      return (
        <Unavailable
          title={
            link.status === "expired"
              ? "This link has expired"
              : "This link is no longer active"
          }
        >
          Ask {link.business_name} for a new link.
          <BusinessContact link={link} />
        </Unavailable>
      );
  }
}

async function lookUpLink(token: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_intake_link", { p_token_hash: hashIntakeToken(token) })
    .maybeSingle<LinkRow>();
  if (error) {
    throw new Error(`Failed to look up intake link: ${error.message}`);
  }
  return data;
}

function Unavailable({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="space-y-3 text-base leading-7 text-neutral-700">
        {children}
      </div>
    </div>
  );
}

function BusinessContact({ link }: { link: LinkRow }) {
  if (!link.business_phone && !link.business_email) {
    return null;
  }
  return (
    <p className="text-sm">
      {link.business_phone ? (
        <a href={`tel:${link.business_phone}`} className="block underline">
          {link.business_phone}
        </a>
      ) : null}
      {link.business_email ? (
        <a href={`mailto:${link.business_email}`} className="block underline">
          {link.business_email}
        </a>
      ) : null}
    </p>
  );
}
