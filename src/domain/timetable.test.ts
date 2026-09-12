import { expect, it } from "vitest";
import { catalog } from "../data/catalog";
import { buildTimetable } from "./timetable";
import { makeVariant } from "./engine";

it("shares CMP422 lecture and lab geometry between screen and PDF", () => {
  const course = catalog.find((c) => c.id === "CMP422")!;
  const section = course.sections[0];
  const variant = makeVariant([
    {
      courseId: course.id,
      sectionIds: [section.id],
      meetings: section.meetings,
    },
  ]);
  const result = buildTimetable([course], variant);
  expect(result.events).toHaveLength(2);
  expect(result.events.map((e) => [e.day, e.start, e.end, e.kind])).toEqual([
    [2, 580, 750, "lecture"],
    [2, 1000, 1110, "lab"],
  ]);
  expect(result.events.flatMap((e) => e.meetings)).toEqual(section.meetings);
});

it("keeps overlapping unavailable periods in separate lanes and expands the range", () => {
  const course = catalog.find((c) => c.id === "CMP422")!;
  const section = course.sections[0];
  const variant = makeVariant([
    {
      courseId: course.id,
      sectionIds: [section.id],
      meetings: section.meetings,
    },
  ]);
  const blocks = [
    { id: "work", label: "Work", day: 2, start: 990, end: 1140, enabled: true },
    {
      id: "early",
      label: "Early",
      day: 0,
      start: 420,
      end: 450,
      enabled: true,
    },
    {
      id: "late",
      label: "Late",
      day: 4,
      start: 1300,
      end: 1380,
      enabled: true,
    },
    {
      id: "disabled",
      label: "Disabled",
      day: 0,
      start: 0,
      end: 30,
      enabled: false,
    },
  ];
  const result = buildTimetable([course], variant, blocks);
  expect([result.first, result.last]).toEqual([420, 1380]);
  expect(result.placed.some((e) => e.block?.id === "disabled")).toBe(false);
  const lab = result.placed.find((e) => e.kind === "lab")!;
  const work = result.placed.find((e) => e.block?.id === "work")!;
  expect(lab.lanes).toBe(2);
  expect(work.lanes).toBe(2);
  expect(lab.lane).not.toBe(work.lane);
});
