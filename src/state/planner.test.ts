import { it, expect } from "vitest";
import {
  freshPlan,
  parsePlanningFile,
  reducer,
  toInput,
  createFavorite,
  migrateCatalog,
} from "./planner";
import { generate, credits } from "../domain/engine";
it("clears selection groups while preserving exclusions, restrictions and plan settings", () => {
  let p = freshPlan();
  p = reducer(p, {
    type: "select",
    id: "CMP406",
    value: { role: "must", allowedSectionIds: ["01"] },
  });
  p = reducer(p, { type: "select", id: "CMP413", value: { role: "willing" } });
  p = reducer(p, {
    type: "select",
    id: "CMP474",
    value: { role: "excluded", reason: "Completed" },
  });
  const cleared = reducer(p, { type: "clear-selections", role: "must" });
  expect(cleared.selections.CMP406.role).toBe("none");
  expect(cleared.selections.CMP406.allowedSectionIds).toEqual(["01"]);
  expect(cleared.selections.CMP413.role).toBe("willing");
  expect(
    reducer(p, { type: "clear-selections", role: "willing" }).selections.CMP406
      .role,
  ).toBe("must");
  const both = reducer(p, { type: "clear-selections", role: "both" });
  expect(both.selections.CMP413.role).toBe("none");
  expect(both.selections.CMP406.role).toBe("none");
  expect(both.selections.CMP474).toEqual(p.selections.CMP474);
  expect(both.catalogSnapshot).toBe(p.catalogSnapshot);
  expect(both.target).toBe(p.target);
  expect(both.unavailable).toBe(p.unavailable);
  expect(both.favorites).toBe(p.favorites);
});
it("uses old AIN lecture/lab credits and migrates time corrections without replacing credit overrides", () => {
  let p = freshPlan();
  for (const id of ["AID201", "AID203", "AID202", "AID204", "AID491"])
    p = reducer(p, { type: "select", id, value: { role: "must" } });
  p.target = { mode: "exact", min: 0, max: 0 };
  const result = generate(toInput(p));
  expect(result.groups).toHaveLength(1);
  expect(
    credits(
      p.catalogSnapshot.filter((c) =>
        result.groups[0].courseIds.includes(c.id),
      ),
    ).total,
  ).toBe(24);
  const lab = structuredClone(
    p.catalogSnapshot.find((c) => c.id === "AID203")!,
  );
  lab.ects = 2;
  lab.sections[0].meetings[0].room = "Corrected room";
  p = reducer(p, { type: "course", course: lab });
  p = reducer(p, {
    type: "course",
    course: { ...p.catalogSnapshot.find((c) => c.id === "AID204")!, ects: 5 },
  });
  p.catalogVersion = "2026-2027-fall-v3-no-years";
  const migrated = migrateCatalog(parsePlanningFile(JSON.stringify(p)));
  expect(migrated.catalogSnapshot.find((c) => c.id === "AID203")!.ects).toBe(4);
  expect(
    migrated.catalogSnapshot.find((c) => c.id === "AID203")!.sections[0]
      .meetings[0].room,
  ).toBe("Corrected room");
  expect(migrated.catalogSnapshot.find((c) => c.id === "AID204")!.ects).toBe(5);
  expect(migrated.selections).toEqual(p.selections);
});
it("upgrades old credits without losing personal schedules or choices", () => {
  let p = freshPlan();
  const original = p.catalogSnapshot.find((c) => c.id === "AIT203")!;
  const old = {
    ...original,
    ects: null,
    year: 2,
    curriculum: undefined,
    title: "Name not supplied in schedule",
  };
  old.sections = structuredClone(old.sections);
  old.sections[0].meetings[0].room = "My corrected room";
  p = reducer(p, { type: "course", course: old, role: "must" });
  p = reducer(p, {
    type: "course",
    course: { ...p.catalogSnapshot.find((c) => c.id === "CMP491")!, ects: 9 },
  });
  p = reducer(p, {
    type: "select",
    id: "CMP474",
    value: { role: "excluded", reason: "Completed" },
  });
  p.catalogVersion = "2026-2027-fall-v1";
  const migrated = migrateCatalog(parsePlanningFile(JSON.stringify(p)));
  const updated = migrated.catalogSnapshot.find((c) => c.id === "AIT203")!;
  expect(updated.ects).toBe(2);
  expect(updated).not.toHaveProperty("year");
  expect(updated.sections[0].meetings[0].room).toBe("My corrected room");
  expect(migrated.catalogSnapshot.find((c) => c.id === "CMP491")!.ects).toBe(9);
  expect(migrated.selections.AIT203.role).toBe("must");
  expect(migrated.selections.CMP474.reason).toBe("Completed");
  expect(parsePlanningFile(JSON.stringify(migrated))).toEqual(migrated);
});
it("round-trips a complete plan and saved timetable", () => {
  let p = freshPlan();
  p = reducer(p, { type: "select", id: "CMP406", value: { role: "must" } });
  p.target = { mode: "exact", min: 1, max: 1 };
  p.unavailable = [
    { id: "work", label: "Work", day: 4, start: 900, end: 950, enabled: true },
  ];
  const v = generate(toInput(p)).groups[0].variants[0];
  p.favorites = [
    createFavorite(
      p.catalogSnapshot.filter((c) => c.id === "CMP406"),
      v,
      toInput(p),
      "Favorite",
    ),
  ];
  expect(parsePlanningFile(JSON.stringify(p))).toEqual(p);
});
it("rejects corrupt JSON, invalid versions, duplicate IDs, missing references and invalid times", () => {
  expect(() => parsePlanningFile("{")).toThrow();
  for (const mutate of [
    (p: any) => (p.schemaVersion = 2),
    (p: any) => p.catalogSnapshot.push(p.catalogSnapshot[0]),
    (p: any) => (p.selections.bad = { role: "must" }),
    (p: any) => (p.catalogSnapshot[0].sections[0].meetings[0].end = 1),
  ]) {
    const p = freshPlan();
    mutate(p);
    expect(() => parsePlanningFile(JSON.stringify(p))).toThrow();
  }
});
it("keeps category and selection independent, correcting invalid candidate roles on edit", () => {
  let p = freshPlan();
  p = reducer(p, { type: "select", id: "CMP406", value: { role: "willing" } });
  const c = {
    ...p.catalogSnapshot.find((c) => c.id === "CMP406")!,
    category: "nontechnical" as const,
  };
  p = reducer(p, { type: "course", course: c });
  expect(p.selections.CMP406.role).toBe("must");
  expect(p.editedCourseIds).toContain("CMP406");
  p = reducer(p, { type: "restore-course", id: "CMP406" });
  expect(p.catalogSnapshot.find((c) => c.id === "CMP406")!.category).toBe(
    "technical",
  );
  expect(p.editedCourseIds).not.toContain("CMP406");
});
it("preserves local edits and custom courses across bundled catalog revisions", () => {
  let p = freshPlan();
  const c = { ...p.catalogSnapshot[0], ects: 7 };
  p = reducer(p, { type: "course", course: c });
  p = reducer(p, {
    type: "course",
    course: { ...c, id: "outside", code: "OUT", source: "custom" },
  });
  p.catalogVersion = "older";
  const result = migrateCatalog(p);
  expect(result.catalogSnapshot.find((x) => x.id === c.id)!.ects).toBe(7);
  expect(result.catalogSnapshot.find((x) => x.id === "outside")).toBeDefined();
  expect(parsePlanningFile(JSON.stringify(result))).toEqual(result);
});
it("deleting a custom course cleans live selections but retains saved snapshots", () => {
  let p = freshPlan();
  const c = {
    ...p.catalogSnapshot[0],
    id: "outside",
    source: "custom" as const,
  };
  p = reducer(p, { type: "course", course: c, role: "must" });
  p = reducer(p, { type: "delete-course", id: c.id });
  expect(p.selections[c.id]).toBeUndefined();
  expect(p.catalogSnapshot.some((x) => x.id === c.id)).toBe(false);
});
