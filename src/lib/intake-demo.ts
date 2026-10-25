import type { IntakeAnalysis, PhotoPrompt, PhotoReading } from "@/lib/intake-types";

// Demo data for the HVAC "AC not cooling" scenario (docs/design).
// TODO(ai): replace readPhoto/analyzeIntake with server actions that call Claude.

export const HVAC_PHOTO_PROMPTS: PhotoPrompt[] = [
  {
    id: "outdoor-unit",
    title: "The outdoor unit",
    hint: "Stand back so the whole unit fits, with the label on its side in focus. Keep people out of the photo.",
  },
  {
    id: "thermostat",
    title: "Your thermostat screen",
    hint: "Just the screen, so we can see the setting and the room temperature.",
  },
];

const DEMO_READINGS: Record<string, PhotoReading> = {
  "outdoor-unit": { summary: "Carrier outdoor unit · label found" },
  thermostat: { summary: "Cool mode · set 72° · room 81°" },
};

const DEMO_ANALYSIS: IntakeAnalysis = {
  steps: [
    { label: "Outdoor unit", result: "Carrier AC, label read" },
    { label: "Thermostat", result: "Set to cool, room is 81°" },
    { label: "Your questions", result: "Written for your AC" },
  ],
  questions: [
    {
      id: "fan",
      short: "Outdoor fan spinning?",
      because: "Your outdoor unit photo shows a Carrier AC.",
      prompt: "With the AC on, is the big fan on the outdoor unit spinning?",
      help: "Look from a few feet away. Don’t touch it.",
      options: ["Yes, it’s spinning", "No, it’s still", "Not sure"],
    },
    {
      id: "hum",
      short: "Humming sound?",
      because: "A still fan can mean a weak part we can bring with us.",
      prompt: "Do you hear a hum or buzz from the outdoor unit?",
      help: "Stand next to it for a few seconds.",
      options: ["Yes, humming", "No sound", "Not sure"],
      showIf: { questionId: "fan", notAnswer: "Yes, it’s spinning" },
    },
    {
      id: "vents",
      short: "Vent air warm?",
      because: "Your thermostat is set to Cool at 72°, but the room is 81°.",
      prompt: "Is the air coming out of your vents warm?",
      help: "Hold your hand near a vent.",
      options: ["Yes, it’s warm", "No, it feels cool", "Not sure"],
    },
    {
      id: "smell",
      short: "Burning smell?",
      because: "This keeps you safe.",
      prompt: "Any burning smell, smoke, or sparks near the unit?",
      options: ["No", "Yes", "Not sure"],
      dangerAnswer: "Yes",
    },
  ],
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function readPhoto(promptId: string): Promise<PhotoReading> {
  await wait(900);
  return DEMO_READINGS[promptId] ?? { summary: "Photo received" };
}

export async function analyzeIntake(): Promise<IntakeAnalysis> {
  await wait(300);
  return DEMO_ANALYSIS;
}
