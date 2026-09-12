import { expect, it } from "vitest";
import {
  freshPlan,
  reducer,
  parsePlanningFile,
  scenarioSnapshot,
  createFavorite,
  toInput,
} from "./planner";
import { generate } from "../domain/engine";

it("switches independent complete setups and autosaves the active scenario", () => {
  let p = freshPlan();
  p = reducer(p, {
    type: "select",
    id: "CMP406",
    value: { role: "must", allowedSectionIds: ["01"] },
  });
  p = reducer(p, { type: "target", value: { mode: "exact", min: 1, max: 1 } });
  p = reducer(p, {
    type: "course",
    role: "must",
    course: {
      ...p.catalogSnapshot[0],
      id: "custom",
      code: "ART",
      title: "Art",
      source: "custom",
      category: "nontechnical",
      ects: 3,
      scheduleStatus: "unscheduled",
      sections: [{ id: "01", label: "01", instructor: "", meetings: [] }],
    },
  });
  p = reducer(p, {
    type: "block",
    block: {
      id: "work",
      day: 3,
      start: 1000,
      end: 1050,
      label: "Work",
      enabled: true,
    },
  });
  const variant = generate(toInput(p)).groups[0].variants[0];
  p = reducer(p, {
    type: "favorite",
    favorite: createFavorite(
      p.catalogSnapshot.filter((c) => ["CMP406", "custom"].includes(c.id)),
      variant,
      toInput(p),
      "Saved week",
    ),
  });
  const original = scenarioSnapshot(p);
  p = reducer(p, { type: "save-scenario", id: "a", name: "With retake" });
  p = reducer(p, { type: "save-scenario", id: "b", name: "Without retake" });
  p = reducer(p, { type: "clear-selections", role: "both" });
  p = reducer(p, { type: "target", value: { mode: "exact", min: 0, max: 0 } });
  p = reducer(p, { type: "delete-course", id: "custom" });
  p = reducer(p, { type: "remove-favorite", id: variant.id });
  const alternative = scenarioSnapshot(p);
  expect(p.scenarios.find((s) => s.id === "a")!.snapshot).toEqual(original);
  p = reducer(p, { type: "load-scenario", id: "a", fallbackId: "unused" });
  expect(scenarioSnapshot(p)).toEqual(original);
  expect(p.scenarios.find((s) => s.id === "b")!.snapshot).toEqual(alternative);
  expect(p.scenarios).toHaveLength(2);
  expect(generate(toInput(p)).groups).toHaveLength(1);
  const backup = JSON.stringify(p);
  p = reducer(p, { type: "reset" });
  expect(p.scenarios).toHaveLength(0);
  p = reducer(p, { type: "import", plan: parsePlanningFile(backup) });
  expect(p.activeScenarioId).toBe("a");
  expect(scenarioSnapshot(p)).toEqual(original);
  expect(p.scenarios[0].snapshot).not.toHaveProperty("scenarios");
});

it("preserves unnamed working input automatically when loading a saved setup", () => {
  let p = reducer(freshPlan(), {
    type: "save-scenario",
    id: "a",
    name: "Saved",
  });
  p = reducer(p, { type: "save-scenario", id: "b", name: "Temporary" });
  p = reducer(p, { type: "delete-scenario", id: "b" });
  p = reducer(p, {
    type: "select",
    id: "CMP474",
    value: { role: "excluded", reason: "Completed" },
  });
  const working = scenarioSnapshot(p);
  p = reducer(p, { type: "load-scenario", id: "a", fallbackId: "recovery" });
  expect(p.scenarios.find((s) => s.id === "recovery")!.snapshot).toEqual(
    working,
  );
  p = reducer(p, {
    type: "load-scenario",
    id: "recovery",
    fallbackId: "unused",
  });
  expect(scenarioSnapshot(p)).toEqual(working);
});

it("validates scenario snapshots and rejects duplicate or missing references", () => {
  const p = reducer(freshPlan(), {
    type: "save-scenario",
    id: "a",
    name: "Saved",
  });
  for (const mutate of [
    (x: any) => x.scenarios.push(x.scenarios[0]),
    (x: any) => (x.activeScenarioId = "missing"),
    (x: any) => (x.scenarios[0].snapshot.selections.bad = { role: "must" }),
    (x: any) => (x.scenarios[0].snapshot.target.min = -1),
  ]) {
    const data = structuredClone(p);
    mutate(data);
    expect(() => parsePlanningFile(JSON.stringify(data))).toThrow();
  }
  expect(reducer(p, { type: "save-scenario", id: "b", name: "saved" })).toBe(p);
  const renamed = reducer(p, {
    type: "rename-scenario",
    id: "a",
    name: "New name",
  });
  expect(renamed.scenarios[0].name).toBe("New name");
  const deleted = reducer(renamed, { type: "delete-scenario", id: "a" });
  expect(deleted.activeScenarioId).toBeNull();
  expect(scenarioSnapshot(deleted)).toEqual(scenarioSnapshot(p));
});

it("loads pre-scenario backups and preserves saved valid inputs during incomplete drafts", () => {
  const old: any = freshPlan();
  delete old.scenarios;
  delete old.activeScenarioId;
  expect(parsePlanningFile(JSON.stringify(old)).scenarios).toEqual([]);
  const p = reducer(freshPlan(), {
    type: "save-scenario",
    id: "a",
    name: "Saved",
  });
  const draft = reducer(p, {
    type: "target",
    value: { mode: "count", min: 4, max: 2 },
  });
  expect(draft.scenarios[0].snapshot.target).toEqual(p.target);
  expect(
    reducer(draft, { type: "load-scenario", id: "a", fallbackId: "unused" }),
  ).toBe(draft);
});
