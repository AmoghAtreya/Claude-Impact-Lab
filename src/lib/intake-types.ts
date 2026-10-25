// Shapes shared by the customer intake wizard and (later) the AI pipeline.
// The wizard only depends on these types, so swapping the demo analysis in
// intake-demo.ts for real server actions doesn't change the UI.

export type PhotoPrompt = {
  id: string;
  title: string;
  hint: string;
};

export type PhotoReading = {
  /** One short line confirming what was read, e.g. "Carrier 24ACC636 · 3-ton". */
  summary: string;
};

export type IntakeQuestion = {
  id: string;
  /** Short label for the review screen and the service brief. */
  short: string;
  /** Why we're asking, tied to what the photos showed. Plain language. */
  because: string;
  prompt: string;
  help?: string;
  options: string[];
  /** Answer that triggers emergency guidance (smoke, sparks, gas). */
  dangerAnswer?: string;
  /** Only ask when an earlier answer matches. */
  showIf?: { questionId: string; notAnswer: string };
};

export type IntakeAnalysis = {
  steps: { label: string; result: string }[];
  questions: IntakeQuestion[];
};

export type IntakeAnswers = Record<string, string>;
