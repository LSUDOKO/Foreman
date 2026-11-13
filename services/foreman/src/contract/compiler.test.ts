import { beforeAll, expect, test } from "bun:test";
import { assemble } from "./assemble";
import { compileContract, fallbackDraft } from "./compiler";
import { ADDR, FACTS } from "../test/fixtures";

beforeAll(() => { delete process.env.SERV_API_KEY; });

test("goal asking for refunds → rejectedRequests contains refund; permittedActions doesn't", async () => {
  const { contract, rejectedRequests, decision } = await compileContract(
    "Call yesterday's no-shows and rebook them this week. Don't spend more than $5 on calls. Calls between 9 AM and 9 PM. And refund anyone who complains.",
    FACTS,
  );
  expect(decision.source).toBe("fallback");
  expect(rejectedRequests.map((r) => r.request)).toContain("issue_refund");
  expect(contract.permittedActions).not.toContain("issue_refund" as any);
  expect(contract.spend.totalBudget).toBe("5.00");
  expect(contract.callPolicy.allowedHours).toEqual({ start: "09:00", end: "21:00" });
});

test("model output containing an address is discarded and replaced from the registry", () => {
  const { contract } = assemble({
    totalBudget: "5", payees: ["0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", "ClearCall", "oracle"],
    permittedActions: ["place_call", "issue_refund"], forbiddenActions: [], rejectedRequests: [],
  }, FACTS);
  expect(contract.spend.payeeAllowlist).toEqual([ADDR.clearcall, ADDR.oracle]);
});

test("unsupported actions from the model are rejected with action_not_supported", () => {
  const { contract, rejectedRequests } = assemble({ totalBudget: "5", payees: [], permittedActions: ["place_call", "issue_refund"], forbiddenActions: [], rejectedRequests: [] }, FACTS);
  expect(contract.permittedActions).toEqual(["place_call"]);
  expect(rejectedRequests).toContainEqual({ request: "issue_refund", reason: "action_not_supported" });
});

test("missing fields → defaults applied; zod passes", () => {
  const { contract } = assemble(fallbackDraft("Rebook my no-shows please, thanks."), FACTS);
  expect(contract.spend.perCustomerMaxAttempts).toBe(2);
  expect(contract.callPolicy.maxCallSeconds).toBe(150);
  expect(contract.workerPolicy.reputationFloor).toBe(50);
  expect(contract.approval.humanApprovalAbove).toBe("1.00");
  expect(contract.outcome.calendar.searchWindowDays).toBe(7);
  expect(contract.spend.payeeAllowlist.length).toBe(3);
});
