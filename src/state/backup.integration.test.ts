import { it, expect } from "vitest";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import {
  freshPlan,
  reducer,
  toInput,
  createFavorite,
  parsePlanningFile,
} from "./planner";
import { generate } from "../domain/engine";
import type { Course } from "../domain/types";

it("restores a full disk backup with outside meetings and three reproducible favorites", () => {
  let p = freshPlan();
  for (const id of ["CMP301", "CMP491", "CMP406"])
    p = reducer(p, { type: "select", id, value: { role: "must" } });
  for (const id of ["CMP422", "CMP413", "CMP424", "CMP453", "CMP461"])
    p = reducer(p, { type: "select", id, value: { role: "willing" } });
  p = reducer(p, {
    type: "select",
    id: "CMP474",
    value: { role: "excluded", reason: "Already completed" },
  });
  const outside: Course = {
    id: "qa-outside",
    code: "ART-QA",
    title: "Photography (QA)",
    department: "Other",

    category: "nontechnical",
    ects: 3,
    scheduleStatus: "scheduled",
    source: "custom",
    sourceNote: "Test fixture",
    sections: [
      {
        id: "01",
        label: "01",
        instructor: "",
        meetings: [
          { day: 1, start: 1120, end: 1170, kind: "lecture", room: "" },
          { day: 4, start: 760, end: 810, kind: "lecture", room: "" },
        ],
      },
    ],
  };
  p = reducer(p, { type: "course", course: outside, role: "must" });
  const input = toInput(p),
    result = generate(input);
  expect(result.groups).toHaveLength(10);
  p.favorites = result.groups.slice(0, 3).map((g, i) =>
    createFavorite(
      p.catalogSnapshot.filter((c) => g.courseIds.includes(c.id)),
      g.variants[0],
      input,
      `Plan ${i + 1}`,
    ),
  );
  mkdirSync("tmp", { recursive: true });
  writeFileSync("tmp/qa-backup.json", JSON.stringify(p, null, 2));
  writeFileSync("tmp/qa-invalid.json", '{"schemaVersion":999}');
  const restored = parsePlanningFile(
    readFileSync("tmp/qa-backup.json", "utf8"),
  );
  expect(restored).toEqual(p);
  expect(generate(toInput(restored)).groups).toHaveLength(10);
  expect(restored.favorites).toHaveLength(3);
  const damaged = structuredClone(restored);
  damaged.favorites[0].variant.options[0].meetings[0].start += 5;
  expect(() => parsePlanningFile(JSON.stringify(damaged))).toThrow(
    "Saved meeting times",
  );
});
