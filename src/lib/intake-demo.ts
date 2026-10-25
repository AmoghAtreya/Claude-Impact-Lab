import type { IntakeAnalysis } from "@/lib/intake-types";

// Demo data for the HVAC "AC not cooling" scenario (docs/design).
// TODO(ai): replace analyzeIntake with a server action that calls Claude.

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

export async function analyzeIntake(): Promise<IntakeAnalysis> {
  await wait(300);
  return DEMO_ANALYSIS;
}
