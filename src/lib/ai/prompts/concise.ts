import "server-only";

// Brevity rules shared by every AI call. Kept in one place so the intake
// analysis and the service brief stay equally short. Each prompt appends
// this to its system prompt; bump both prompt versions when it changes.

const CONCISE_CORE = `Keep it short and concise:
- Every text field is one short phrase or sentence. Write like field notes, not prose: "Water pooling under indoor unit", not "The photos appear to show that there is some water…".
- No filler, hedging preambles, or restating the question. Never repeat a fact in another field.
- Include only what changes what the technician brings, checks, or asks. Empty lists are fine.`;

export const CONCISE_INTAKE_ANALYSIS = `${CONCISE_CORE}
- Keep each text field under about 15 words.
- At most one observation per photo. At most 3 possible_explanations and 3 missing_information items.
- Fewer, better questions beat many. Skip any question whose answer wouldn't change the visit.`;

export const CONCISE_SERVICE_BRIEF = `${CONCISE_CORE}
- The technician scans this in seconds. Keep each list item under about 12 words.
- At most 4 customer_reported, 4 visual_observations, 3 possible_explanations, 3 unresolved_questions.
- basis is a few words citing the evidence (for example "P2 + Q3"), not a sentence.`;
