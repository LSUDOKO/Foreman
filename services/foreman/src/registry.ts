import { addr, str, urls } from "@foreman/shared/env";
import type { Store } from "./store";

/**
 * The worker registry. Prices and payTo addresses come from configuration, never from a model.
 * Seed reputations follow docs/04: ClearCall has a track record (90), QuickDial is new (80, one probation call).
 * Reputation is only seeded on first insert; later runs keep what the workers earned.
 */
export function seedWorkers(store: Store) {
  const U = urls();
  store.upsertWorker({
    name: "ClearCall", payTo: addr("CLEARCALL_PAYTO"), callUrl: `${U.clearcall}/v1/call`, bonusUrl: `${U.clearcall}/v1/bonus/:attemptId`,
    price: str("CLEARCALL_PRICE", "0.50"), bonus: str("BONUS_PRICE", "0.20"), reputation: 90, probationLeft: 0, isNew: false, badge: null,
  });
  store.upsertWorker({
    name: "QuickDial", payTo: addr("QUICKDIAL_PAYTO"), callUrl: `${U.quickdial}/v1/call`, bonusUrl: `${U.quickdial}/v1/bonus/:attemptId`,
    price: str("QUICKDIAL_PRICE", "0.30"), bonus: str("BONUS_PRICE", "0.20"), reputation: 80, probationLeft: 1, isNew: true,
    badge: "test worker — scripted to fail",
  });
}
