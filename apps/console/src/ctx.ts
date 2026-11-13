import { createContext, useContext } from "react";
import type { Source } from "./lib";
import type { FeedEvent, State } from "./state";

export interface Ctx {
  state: State;
  src: Source;
  now: number;
  live: boolean;
  open: (e: FeedEvent) => void;
  /** Run a console action; errors become toasts. Disabled (no-op) in replay. */
  act: (label: string, fn: () => Promise<unknown>) => Promise<void>;
  go: (page: string) => void;
}

export const AppCtx = createContext<Ctx>(null as never);
export const useApp = () => useContext(AppCtx);
