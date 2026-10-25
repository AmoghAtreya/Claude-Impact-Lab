"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  fieldErrorClassName,
  inputClassName,
  labelClassName,
  primaryButtonClassName,
} from "@/app/ui/form-styles";
import { TRADE_OTHER_MAX_LENGTH, TRADES } from "@/lib/trades";
import {
  createWorkspace,
  type OnboardingField,
  type OnboardingFormState,
} from "./actions";

type OnboardingFormProps = {
  defaultEmail: string;
  timeZones: string[];
};

export function OnboardingForm({ defaultEmail, timeZones }: OnboardingFormProps) {
  const [state, formAction, pending] = useActionState<
    OnboardingFormState,
    FormData
  >(createWorkspace, {});
  const timeZoneRef = useRef<HTMLSelectElement>(null);
  const [trade, setTrade] = useState(state.values?.trade ?? TRADES[0].value);

  // Preselect the browser's timezone. Done after hydration because the
  // server can't know it.
  useEffect(() => {
    const select = timeZoneRef.current;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (select && !select.value && timeZones.includes(detected)) {
      select.value = detected;
    }
  }, [timeZones]);

  const values = state.values ?? {};
  const fieldError = (field: OnboardingField) =>
    state.fieldErrors?.[field] ? (
      <p id={`${field}-error`} className={fieldErrorClassName}>
        {state.fieldErrors[field]}
      </p>
    ) : null;
  const describedBy = (field: OnboardingField) =>
    state.fieldErrors?.[field] ? `${field}-error` : undefined;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className={labelClassName}>
          Business name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          autoComplete="organization"
          required
          maxLength={120}
          defaultValue={values.name}
          aria-invalid={Boolean(state.fieldErrors?.name)}
          aria-describedby={describedBy("name")}
          className={inputClassName}
        />
        {fieldError("name")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="trade" className={labelClassName}>
          Trade
        </label>
        <select
          id="trade"
          name="trade"
          required
          defaultValue={values.trade ?? TRADES[0].value}
          onChange={(event) => setTrade(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors?.trade)}
          aria-describedby={describedBy("trade")}
          className={inputClassName}
        >
          {TRADES.map((trade) => (
            <option key={trade.value} value={trade.value}>
              {trade.label}
            </option>
          ))}
        </select>
        {fieldError("trade")}
      </div>

      {trade === "other" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tradeOther" className={labelClassName}>
            Your trade
          </label>
          <input
            id="tradeOther"
            name="tradeOther"
            type="text"
            required
            maxLength={TRADE_OTHER_MAX_LENGTH}
            placeholder="e.g. Chimney sweeping"
            defaultValue={values.tradeOther}
            aria-invalid={Boolean(state.fieldErrors?.tradeOther)}
            aria-describedby={describedBy("tradeOther")}
            className={inputClassName}
          />
          {fieldError("tradeOther")}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contactEmail" className={labelClassName}>
          Business email
        </label>
        <input
          id="contactEmail"
          name="contactEmail"
          type="email"
          autoComplete="email"
          required
          defaultValue={values.contactEmail ?? defaultEmail}
          aria-invalid={Boolean(state.fieldErrors?.contactEmail)}
          aria-describedby={describedBy("contactEmail")}
          className={inputClassName}
        />
        {fieldError("contactEmail")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="contactPhone" className={labelClassName}>
          Business phone <span className="font-normal text-neutral-500">(optional)</span>
        </label>
        <input
          id="contactPhone"
          name="contactPhone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          defaultValue={values.contactPhone}
          aria-invalid={Boolean(state.fieldErrors?.contactPhone)}
          aria-describedby={describedBy("contactPhone")}
          className={inputClassName}
        />
        {fieldError("contactPhone")}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="timezone" className={labelClassName}>
          Timezone
        </label>
        <select
          ref={timeZoneRef}
          id="timezone"
          name="timezone"
          required
          defaultValue={values.timezone ?? ""}
          aria-invalid={Boolean(state.fieldErrors?.timezone)}
          aria-describedby={describedBy("timezone")}
          className={inputClassName}
        >
          <option value="" disabled>
            Choose a timezone
          </option>
          {timeZones.map((timeZone) => (
            <option key={timeZone} value={timeZone}>
              {timeZone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        {fieldError("timezone")}
      </div>

      {state.error ? (
        <p role="alert" className={fieldErrorClassName}>
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={primaryButtonClassName}
      >
        {pending ? "Creating workspace…" : "Create workspace"}
      </button>
    </form>
  );
}
