"use client";

import { useActionState } from "react";
import type { AuthFormState } from "./actions";

type AuthFormProps = {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  submitLabel: string;
  pendingLabel: string;
  passwordAutoComplete: "current-password" | "new-password";
  initialError?: string;
};

export function AuthForm({
  action,
  submitLabel,
  pendingLabel,
  passwordAutoComplete,
  initialError,
}: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    error: initialError,
  });

  if (state.message) {
    return (
      <p
        role="status"
        className="rounded-md border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-800"
      >
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.email}
          className="h-10 rounded-md border border-neutral-300 px-3 text-base focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={passwordAutoComplete}
          required
          className="h-10 rounded-md border border-neutral-300 px-3 text-base focus:border-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900/10"
        />
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center justify-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
