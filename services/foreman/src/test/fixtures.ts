import { assemble } from "../contract/assemble";
import type { Hex } from "@foreman/shared/types";

export const ADDR = {
  clearcall: "0x1111111111111111111111111111111111111111" as Hex,
  quickdial: "0x2222222222222222222222222222222222222222" as Hex,
  oracle: "0x3333333333333333333333333333333333333333" as Hex,
  business: "0x4444444444444444444444444444444444444444" as Hex,
};

export const FACTS = {
  id: "ctr_test", businessName: "Smile Dental", timeZone: "Asia/Kolkata", payerWallet: ADDR.business, eventTypeId: 1,
  pricing: { onConfirmed: "4.00", onAttended: "2.00" }, bonusOnProvenCall: "0.20",
  registry: { ClearCall: ADDR.clearcall, QuickDial: ADDR.quickdial, Oracle: ADDR.oracle },
  now: new Date("2026-11-15T04:30:00Z"), ttlHours: 24,
};

export const contract = () =>
  assemble({ totalBudget: "5.00", permittedActions: [], forbiddenActions: [], payees: [], rejectedRequests: [] }, FACTS).contract;
