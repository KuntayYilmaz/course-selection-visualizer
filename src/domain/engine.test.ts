import { describe, it, expect } from "vitest";
import { catalog } from "../data/catalog";
import {
  generate,
  overlaps,
  credits,
  metrics,
  provisional,
  search,
  validateVariant,
  makeVariant,
  sortGroups,
} from "./engine";
import {
  courseSchema,
  EMPTY_SELECTION,
  type Course,
  type Meeting,
  type PlannerInput,
  type Role,
} from "./types";
const meeting = (day = 0, start = 580, end = 630): Meeting => ({
  day,
  start,
  end,
  room: "",
  kind: "lecture",
});
function course(
  id: string,
  meetings: Meeting[],
  category: Course["category"] = "technical",
): Course {
  return {
    id,
    code: id,
    title: id,
    department: "CMP",

    category,
    ects: category === "technical" ? 6 : 3,
    scheduleStatus: meetings.length ? "scheduled" : "unscheduled",
    sections: [{ id: "01", label: "01", instructor: "", meetings }],
    source: "custom",
    sourceNote: "",
  };
}
function input(
  cs: Course[],
  roles: Record<string, Role> = {},
  min = 0,
  max = min,
): PlannerInput {
  return {
    catalog: cs,
    selections: Object.fromEntries(
      cs.map((c) => [
        c.id,
        { ...EMPTY_SELECTION, role: roles[c.id] || "willing" },
      ]),
    ),
    target: { mode: min === max ? "exact" : "count", min, max },
    unavailable: [],
  };
}
const real = (...ids: string[]) =>
  ids.map((id) => structuredClone(catalog.find((c) => c.id === id)!));
it("sorts by total ECTS in both directions with incomplete totals last", () => {
  const a = { ...course("a", []), ects: 4 };
  const b = { ...course("b", []), ects: 8 };
  const u = { ...course("u", []), ects: null };
  const required = course("required", [], "nontechnical");
  const p = input([a, b, u, required], { required: "must" }, 1, 2);
  const { groups } = generate(p);
  const desc = sortGroups(groups, "ects-desc", p.catalog);
  const asc = sortGroups(groups, "ects-asc", p.catalog);
  const totals = (gs: typeof groups) =>
    gs.map(
      (g) => credits(p.catalog.filter((c) => g.courseIds.includes(c.id))).total,
    );
  expect(totals(desc.slice(0, 3))).toEqual([15, 11, 7]);
  expect(totals(asc.slice(0, 3))).toEqual([7, 11, 15]);
  expect(desc.slice(3).every((g) => g.courseIds.includes("u"))).toBe(true);
  expect(asc.slice(3).every((g) => g.courseIds.includes("u"))).toBe(true);
  expect(sortGroups(groups, "ects-desc", p.catalog)).toEqual(desc);
});
describe("interval and calendar semantics", () => {
  it("allows exact boundaries and other weekdays, rejects partial overlap", () => {
    expect(overlaps(meeting(), meeting(0, 630, 680))).toBe(false);
    expect(overlaps(meeting(), meeting(1))).toBe(false);
    expect(overlaps(meeting(), meeting(0, 629, 680))).toBe(true);
  });
  it("subtracts normal ten-minute breaks from idle time", () => {
    expect(
      metrics([
        {
          courseId: "a",
          sectionIds: ["01"],
          meetings: [meeting(), meeting(0, 640, 690), meeting(0, 760, 810)],
        },
      ]),
    ).toEqual({ days: 1, idle: 60, earliest: 580, latest: 810 });
  });
  it("counts unknown credits separately and excludes nontechnical credits from elective total", () => {
    const a = course("a", []),
      b = course("b", [], "nontechnical"),
      c = course("c", [], "project");
    c.ects = null;
    expect(credits([a, b, c])).toEqual({
      technicalCount: 1,
      technical: 6,
      other: 3,
      total: 9,
      missing: ["c"],
    });
  });
});
describe("verified source catalog", () => {
  it("contains 49 valid unique courses and 20 six-credit technical electives", () => {
    expect(catalog.length).toBe(49);
    expect(new Set(catalog.map((c) => c.id)).size).toBe(49);
    for (const c of catalog)
      expect(courseSchema.safeParse(c).success, c.code).toBe(true);
    expect(catalog.filter((c) => c.category === "technical")).toHaveLength(20);
    expect(
      catalog
        .filter((c) => c.category === "technical")
        .every((c) => c.ects === 6),
    ).toBe(true);
  });
  it("retains BBM341 and separates capstone projects from electives", () => {
    expect(real("BBM341")[0].title).toBe("Systems Programming");
    for (const c of real("CMP491", "AID491", "AID492"))
      expect(c.category).toBe("project");
  });
  it("preserves the CMP422 Wednesday lab without extra credits", () => {
    const c = real("CMP422")[0];
    expect(c.sections[0].meetings).toHaveLength(4);
    expect(c.sections[0].meetings[3]).toMatchObject({
      day: 2,
      start: 1000,
      end: 1110,
      kind: "lab",
    });
    expect(c.ects).toBe(6);
  });
  it("keeps genuinely different lab section times", () => {
    expect(real("CMP103")[0].sections.map((s) => s.meetings[0].start)).toEqual([
      760, 820, 880, 940,
    ]);
    expect(real("CMP203")[0].sections.map((s) => s.meetings[0].start)).toEqual([
      820, 880, 940, 1000,
    ]);
    expect(real("CMP213")[0].sections.map((s) => s.meetings[0].start)).toEqual([
      520, 640,
    ]);
  });
  it("retains repeated MAT123 meetings and the last evening class", () => {
    expect(real("MAT123")[0].sections[0].meetings.map((m) => m.day)).toEqual([
      0, 0, 3, 3, 4, 4,
    ]);
    expect(real("MÜH104")[0].sections[0].meetings[0]).toMatchObject({
      day: 2,
      start: 1180,
      end: 1230,
    });
  });
});
describe("course combinations", () => {
  it("includes one locked elective in a three-elective goal", () => {
    const cs = ["a", "b", "c", "d"].map((id, i) => course(id, [meeting(i)]));
    const result = generate(input(cs, { a: "must" }, 3));
    expect(result.groups).toHaveLength(3);
    for (const g of result.groups) {
      expect(g.courseIds).toContain("a");
      expect(g.courseIds).toHaveLength(3);
    }
  });
  it("never reintroduces excluded Computer Vision or unselected courses", () => {
    const p = input(
      real("CMP474", "CMP406", "CMP413"),
      { CMP474: "excluded", CMP413: "none" },
      1,
    );
    expect(generate(p).groups.map((g) => g.courseIds)).toEqual([["CMP406"]]);
  });
  it("counts all subsets across a range, not only maximal schedules", () => {
    const cs = ["a", "b", "c"].map((id, i) => course(id, [meeting(i)]));
    expect(generate(input(cs, {}, 1, 2)).groups).toHaveLength(6);
    expect(generate(input(cs, {}, 0, 3)).groups).toHaveLength(8);
  });
  it("returns the fixed base alone when zero electives are requested", () => {
    const p = input(
      [course("retake", [meeting()], "required")],
      { retake: "must" },
      0,
    );
    expect(generate(p).groups[0].courseIds).toEqual(["retake"]);
  });
  it("blocks a custom nontechnical course but counts its credits separately", () => {
    const p = input(
      [
        course("outside", [meeting()], "nontechnical"),
        course("a", [meeting()]),
        course("b", [meeting(1)]),
      ],
      { outside: "must" },
      1,
    );
    const r = generate(p);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].courseIds).toEqual(["b", "outside"]);
    expect(
      credits(p.catalog.filter((c) => r.groups[0].courseIds.includes(c.id)))
        .total,
    ).toBe(9);
  });
  it("checks every meeting of a multi-session course", () => {
    const p = input(
      [
        course("a", [meeting(0), meeting(4, 900, 950)]),
        course("b", [meeting(4, 940, 990)]),
      ],
      {},
      2,
    );
    expect(generate(p).groups).toHaveLength(0);
  });
  it("uses an ECTS range with nonuniform edited credits", () => {
    const cs = ["a", "b", "c"].map((id, i) => course(id, [meeting(i)]));
    cs[2].ects = 4;
    const p = input(cs);
    p.target = { mode: "ects", min: 10, max: 10 };
    expect(generate(p).groups.map((g) => g.courseIds)).toEqual([
      ["a", "c"],
      ["b", "c"],
    ]);
  });
  it("rejects unknown meeting times, while explicit unscheduled courses work", () => {
    const c = course("a", []);
    c.scheduleStatus = "unknown";
    expect(generate(input([c], {}, 1)).issues.join(" ")).toContain("unknown");
    c.scheduleStatus = "unscheduled";
    expect(generate(input([c], {}, 1)).groups).toHaveLength(1);
  });
  it("requires known technical credits only for ECTS targeting", () => {
    const c = course("a", []);
    c.ects = null;
    const p = input([c], {}, 1);
    expect(generate(p).groups).toHaveLength(1);
    p.target = { mode: "ects", min: 0, max: 6 };
    expect(generate(p).issues.join(" ")).toContain("enter ECTS");
  });
  it("explains locked courses that exceed the target", () => {
    const p = input([course("a", [])], { a: "must" }, 0);
    expect(generate(p).issues.join(" ")).toContain("above the target");
  });
  it("explains the exact unavoidable course pair and time", () => {
    const p = input(
      real("CMP422", "CMP432"),
      { CMP422: "must", CMP432: "must" },
      2,
    );
    expect(generate(p).issues.join(" ")).toContain("CMP422 and CMP432");
    expect(generate(p).issues.join(" ")).toContain("Wed 09:40");
  });
  it("explains a blocked lab and honors the enable switch", () => {
    const p = input(real("CMP422"), { CMP422: "must" }, 1);
    p.unavailable = [
      {
        id: "work",
        label: "Work",
        day: 2,
        start: 1020,
        end: 1100,
        enabled: true,
      },
    ];
    expect(generate(p).issues.join(" ")).toContain("Work");
    p.unavailable[0].enabled = false;
    expect(generate(p).groups).toHaveLength(1);
  });
  it("rejects invalid target bounds and fractional course counts", () => {
    const p = input([]);
    p.target = { mode: "count", min: 3, max: 1 };
    expect(generate(p).issues.length).toBeGreaterThan(0);
    p.target = { mode: "exact", min: 1.5, max: 1.5 };
    expect(generate(p).issues.length).toBeGreaterThan(0);
  });
});
describe("section grouping and saved variants", () => {
  it("collapses identical section times", () => {
    const p = input(real("CMP301"), { CMP301: "must" }, 0),
      r = generate(p);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].variants).toHaveLength(1);
    expect(r.groups[0].variants[0].options[0].sectionIds).toEqual(["01", "02"]);
  });
  it("groups different section times under one course set", () => {
    const r = generate(input(real("CMP213"), { CMP213: "must" }, 0));
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].variants).toHaveLength(2);
  });
  it("respects section overrides including an empty allowed list", () => {
    const p = input(real("CMP213"), { CMP213: "must" }, 0);
    p.selections.CMP213.allowedSectionIds = ["02"];
    expect(generate(p).groups[0].variants[0].options[0].sectionIds).toEqual([
      "02",
    ]);
    p.selections.CMP213.allowedSectionIds = [];
    expect(generate(p).issues.join(" ")).toContain("no usable allowed section");
  });
  it("finds a compatible provisional lab section", () => {
    const p = input(
      [
        ...real("CMP213"),
        course("outside", [meeting(4, 520, 630)], "nontechnical"),
      ],
      { CMP213: "must", outside: "must" },
      0,
    );
    const r = provisional(p);
    expect(r.issues).toEqual([]);
    expect(
      r.variant.options.find((o) => o.courseId === "CMP213")!.sectionIds,
    ).toEqual(["02"]);
  });
  it("marks a saved variant invalid when times, eligibility, or targets change", () => {
    const p = input([course("a", [meeting()])], {}, 1);
    const v = generate(p).groups[0].variants[0];
    expect(validateVariant(v, p)).toEqual([]);
    p.selections.a.role = "excluded";
    expect(validateVariant(v, p).join(" ")).toContain("no longer selected");
    p.selections.a.role = "willing";
    p.catalog[0].sections[0].meetings[0].start += 10;
    expect(validateVariant(v, p).join(" ")).toContain("no longer usable");
  });
  it("streams partial progress before completion without truncating enumeration", () => {
    const cs = Array.from({ length: 14 }, (_, i) => course(String(i), []));
    let sawProgress = false,
      found = 0;
    for (const e of search(input(cs, {}, 0, 14))) {
      if (e.type === "progress") sawProgress = true;
      found += e.solutions.length;
    }
    expect(sawProgress).toBe(true);
    expect(found).toBe(16384);
  });
});

/** Independent reference: powerset × raw section cartesian products, no engine pruning. */
function reference(p: PlannerInput) {
  const must = p.catalog.filter((c) => p.selections[c.id]?.role === "must"),
    optional = p.catalog.filter((c) => p.selections[c.id]?.role === "willing");
  const found = new Set<string>();
  for (let mask = 0; mask < 2 ** optional.length; mask++) {
    const chosen = [...must, ...optional.filter((_, i) => mask & (1 << i))];
    const value = chosen.reduce(
      (n, c) =>
        n +
        (c.category === "technical"
          ? p.target.mode === "ects"
            ? c.ects!
            : 1
          : 0),
      0,
    );
    if (value < p.target.min || value > p.target.max) continue;
    let assignments: { c: Course; meetings: Meeting[] }[][] = [[]];
    for (const c of chosen) {
      const allowed = p.selections[c.id]?.allowedSectionIds;
      assignments = assignments.flatMap((a) =>
        c.sections
          .filter((s) => allowed == null || allowed.includes(s.id))
          .map((s) => [...a, { c, meetings: s.meetings }]),
      );
    }
    for (const a of assignments) {
      const meetings = a.flatMap((x) => x.meetings);
      let valid = true;
      for (let i = 0; i < meetings.length; i++) {
        const x = meetings[i];
        for (const y of [
          ...meetings.slice(i + 1),
          ...p.unavailable.filter((b) => b.enabled),
        ])
          if (
            x.day === y.day &&
            Math.max(x.start, y.start) < Math.min(x.end, y.end)
          )
            valid = false;
      }
      if (valid)
        found.add(
          JSON.stringify(
            a
              .sort((x, y) => x.c.id.localeCompare(y.c.id))
              .map((x) => [
                x.c.id,
                JSON.stringify(
                  x.meetings
                    .map((m) => [m.day, m.start, m.end])
                    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]),
                ),
              ]),
          ),
        );
    }
  }
  return [...found].sort();
}
it("matches the independent reference across 80 seeded small catalogs", () => {
  let seed = 2319;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let iteration = 0; iteration < 80; iteration++) {
    const cs = Array.from({ length: 6 }, (_, i) => {
      const day = Math.floor(random() * 3),
        start = 520 + Math.floor(random() * 5) * 60;
      const c = course(
        `c${i}`,
        [meeting(day, start, start + 50)],
        i === 0 ? "required" : "technical",
      );
      if (random() > 0.45)
        c.sections.push({
          id: "02",
          label: "02",
          instructor: "",
          meetings: [meeting(Math.floor(random() * 3), 640, 690)],
        });
      return c;
    });
    const p = input(
      cs,
      {
        c0: "must",
        c1: iteration % 3 ? "willing" : "must",
        c5: iteration % 4 ? "willing" : "excluded",
      },
      iteration % 3,
      2 + (iteration % 3),
    );
    if (iteration % 2)
      p.unavailable = [
        { id: "x", label: "Work", day: 1, start: 600, end: 665, enabled: true },
      ];
    const actual = generate(p)
      .groups.flatMap((g) => g.variants.map((v) => v.id))
      .sort();
    expect(actual, `case ${iteration}`).toEqual(reference(p));
  }
});
