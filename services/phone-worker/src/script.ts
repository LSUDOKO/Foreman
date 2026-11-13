// Every sentence the agent can say. Risky intents always use these fixed lines — the model never improvises.
export const lines = (business: string, offers: string[]) => ({
  disclosure: `Hi, this is an AI assistant calling on behalf of ${business}.`,
  offer: `We missed you at your recent appointment. Would you like to rebook? I have ${offers[0]}${offers[1] ? `, or ${offers[1]}` : ""}.`,
  keypad: `Press 1 for ${offers[0]}${offers[1] ? `, press 2 for ${offers[1]}` : ""}, or press 9 if you don't want to rebook.`,
  accepted: (slot: string) => `Great, ${slot}. You'll get an email to confirm it. Thank you!`,
  declined: "No problem. Have a good day.",
  otherTime: `I only have those two times right now. ${business} will email you other options. Goodbye.`,
  optOut: "Understood, we won't call again. Goodbye.",
  wrongPerson: "Sorry for the trouble. Goodbye.",
  outOfScope: `I can only help reschedule your own appointment. For anything else, please contact ${business} directly.`,
  reask: "Sorry, could you say which time works for you?",
  noInput: "I didn't catch that. We'll send you an email instead. Goodbye.",
  oneMoment: "One moment.",
});
