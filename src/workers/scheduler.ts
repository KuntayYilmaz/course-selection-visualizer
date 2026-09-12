/// <reference lib="webworker" />
import { search } from "../domain/engine";
import type { PlannerInput } from "../domain/types";
self.onmessage = (event: MessageEvent<PlannerInput>) => {
  try {
    for (const update of search(event.data)) self.postMessage(update);
  } catch (error) {
    self.postMessage({
      type: "error",
      message:
        error instanceof Error ? error.message : "The search could not finish.",
    });
  }
};
