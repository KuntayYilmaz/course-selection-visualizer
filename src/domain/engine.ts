import {
  DAYS,
  meetingText,
  targetSchema,
  time,
  type Course,
  type Meeting,
  type Metrics,
  type Option,
  type PlannerInput,
  type ResultGroup,
  type SearchEvent,
  type Solution,
  type SortMode,
  type Variant,
} from "./types";

export function overlaps(
  a: Pick<Meeting, "day" | "start" | "end">,
  b: Pick<Meeting, "day" | "start" | "end">,
) {
  return a.day === b.day && a.start < b.end && b.start < a.end;
}
export function timingKey(meetings: Meeting[]) {
  return JSON.stringify(
    meetings
      .map((m) => [m.day, m.start, m.end])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]),
  );
}
export function courseOptions(course: Course, input: PlannerInput): Option[] {
  const allowed = input.selections[course.id]?.allowedSectionIds;
  const grouped = new Map<string, Option>();
  if (course.scheduleStatus === "unknown") return [];
  for (const section of course.sections) {
    if (
      allowed !== null &&
      allowed !== undefined &&
      !allowed.includes(section.id)
    )
      continue;
    if (
      section.meetings.some((m) =>
        input.unavailable.some((b) => b.enabled && overlaps(m, b)),
      )
    )
      continue;
    const key = timingKey(section.meetings),
      old = grouped.get(key);
    if (old) {
      old.sectionIds.push(section.id);
      old.meetings = old.meetings.map((m) => {
        const other = section.meetings.find(
          (n) => n.day === m.day && n.start === m.start && n.end === m.end,
        );
        return {
          ...m,
          room: [
            ...new Set(
              [m.room, other?.room || ""]
                .flatMap((r) => r.split(" / "))
                .filter(Boolean),
            ),
          ].join(" / "),
        };
      });
    } else
      grouped.set(key, {
        courseId: course.id,
        sectionIds: [section.id],
        meetings: section.meetings,
      });
  }
  return [...grouped.values()];
}
export function optionsConflict(a: Option, b: Option) {
  return a.meetings.some((x) => b.meetings.some((y) => overlaps(x, y)));
}
export function metrics(options: Option[]): Metrics {
  const meetings = options.flatMap((o) => o.meetings);
  let idle = 0;
  for (let day = 0; day < 5; day++) {
    const daily = meetings
      .filter((m) => m.day === day)
      .sort((a, b) => a.start - b.start);
    let end = daily[0]?.end || 0;
    for (const next of daily.slice(1)) {
      idle += Math.max(0, next.start - end - 10);
      end = Math.max(end, next.end);
    }
  }
  return {
    days: new Set(meetings.map((m) => m.day)).size,
    idle,
    earliest: meetings.length
      ? Math.min(...meetings.map((m) => m.start))
      : 1440,
    latest: meetings.length ? Math.max(...meetings.map((m) => m.end)) : 0,
  };
}
export function makeVariant(options: Option[]): Variant {
  const sorted = options
    .map((o) => ({
      ...o,
      sectionIds: [...o.sectionIds],
      meetings: o.meetings.map((m) => ({ ...m })),
    }))
    .sort((a, b) => a.courseId.localeCompare(b.courseId));
  return {
    id: JSON.stringify(sorted.map((o) => [o.courseId, timingKey(o.meetings)])),
    options: sorted,
    metrics: metrics(sorted),
  };
}
export function credits(courses: Course[]) {
  const technical = courses.filter((c) => c.category === "technical");
  const sum = (cs: Course[]) => cs.reduce((n, c) => n + (c.ects ?? 0), 0);
  return {
    technicalCount: technical.length,
    technical: sum(technical),
    other: sum(courses.filter((c) => c.category !== "technical")),
    total: sum(courses),
    missing: courses
      .filter((c) => c.ects === null)
      .map((c) => c.code || c.title),
  };
}
export function compareVariants(a: Variant, b: Variant, sort: SortMode) {
  const x = a.metrics,
    y = b.metrics;
  const primary =
    sort === "idle"
      ? x.idle - y.idle
      : sort === "late"
        ? y.earliest - x.earliest
        : sort === "early"
          ? x.latest - y.latest
          : x.days - y.days;
  return (
    primary || x.days - y.days || x.idle - y.idle || a.id.localeCompare(b.id)
  );
}
export function bestVariant(group: ResultGroup, sort: SortMode) {
  return group.variants.reduce((a, b) =>
    compareVariants(a, b, sort) <= 0 ? a : b,
  );
}
export function sortGroups(
  groups: ResultGroup[],
  sort: SortMode,
  catalog: Course[],
): ResultGroup[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const ectsSort = sort === "ects-asc" || sort === "ects-desc";
  return groups
    .map((group) => {
      const courses = group.courseIds.map((id) => byId.get(id));
      return {
        group,
        best: bestVariant(group, sort),
        total: courses.reduce((n, c) => n + (c?.ects ?? 0), 0),
        unknown: courses.some((c) => !c || c.ects === null),
      };
    })
    .sort((a, b) => {
      if (ectsSort) {
        // Partial subtotals must not masquerade as complete course loads.
        const primary =
          Number(a.unknown) - Number(b.unknown) ||
          (sort === "ects-asc" ? a.total - b.total : b.total - a.total);
        if (primary) return primary;
      }
      return (
        compareVariants(a.best, b.best, sort) ||
        a.group.id.localeCompare(b.group.id)
      );
    })
    .map(({ group }) => group);
}
export function mergeSolutions(
  groups: Map<string, ResultGroup>,
  solutions: Solution[],
) {
  for (const s of solutions) {
    const group = groups.get(s.groupId);
    if (group) {
      if (!group.variants.some((v) => v.id === s.variant.id))
        group.variants.push(s.variant);
    } else
      groups.set(s.groupId, {
        id: s.groupId,
        courseIds: s.courseIds,
        variants: [s.variant],
      });
  }
}
function targetValue(c: Course, input: PlannerInput) {
  return c.category !== "technical"
    ? 0
    : input.target.mode === "ects"
      ? (c.ects ?? 0)
      : 1;
}
function unavailableExplanation(c: Course, input: PlannerInput) {
  const details = c.sections.flatMap((s) =>
    s.meetings.flatMap((m) =>
      input.unavailable
        .filter((b) => b.enabled && overlaps(m, b))
        .map(
          (b) =>
            `${c.code || c.title} (${meetingText(m)}) overlaps “${b.label}” (${time(b.start)}–${time(b.end)}).`,
        ),
    ),
  );
  return [...new Set(details)];
}

/** Exhaustive section-aware enumeration. Yields bounded batches so the worker can report progress. */
export function* search(input: PlannerInput): Generator<SearchEvent> {
  let visited = 0,
    found = 0,
    batch: Solution[] = [];
  const issues: string[] = [];
  const parsed = targetSchema.safeParse(input.target);
  if (!parsed.success) {
    yield {
      type: "done",
      visited,
      solutions: [],
      issues: parsed.error.issues.map((x) => x.message),
    };
    return;
  }
  const selected = input.catalog.filter((c) =>
    ["must", "willing"].includes(input.selections[c.id]?.role),
  );
  const must = selected.filter((c) => input.selections[c.id].role === "must");
  const willing = selected.filter(
    (c) => input.selections[c.id].role === "willing",
  );
  for (const c of selected) {
    if (c.scheduleStatus === "unknown")
      issues.push(
        `${c.code || c.title}: meeting times are unknown. Edit the course before generating.`,
      );
    if (input.selections[c.id].role === "willing" && c.category !== "technical")
      issues.push(
        `${c.code || c.title}: only technical electives can be in the willing-to-take pool.`,
      );
    if (
      c.category === "technical" &&
      c.ects === null &&
      input.target.mode === "ects"
    )
      issues.push(`${c.code || c.title}: enter ECTS to use an ECTS target.`);
  }
  if (issues.length) {
    yield { type: "done", visited, solutions: [], issues };
    return;
  }
  const available = new Map(
    selected.map((c) => [c.id, courseOptions(c, input)]),
  );
  for (const c of must)
    if (!available.get(c.id)!.length) {
      issues.push(
        `${c.code || c.title} has no usable allowed section. Review its section restrictions and unavailable times.`,
        ...unavailableExplanation(c, input),
      );
    }
  for (let i = 0; i < must.length; i++)
    for (let j = i + 1; j < must.length; j++) {
      const a = available.get(must[i].id)!,
        b = available.get(must[j].id)!;
      if (
        a.length &&
        b.length &&
        a.every((x) => b.every((y) => optionsConflict(x, y)))
      ) {
        const x = a[0].meetings.find((m) =>
          b[0].meetings.some((n) => overlaps(m, n)),
        );
        issues.push(
          `${must[i].code || must[i].title} and ${must[j].code || must[j].title} overlap in every allowed section${x ? ` (including ${meetingText(x)})` : ""}. Both are must take.`,
        );
      }
    }
  const fixedValue = must.reduce((n, c) => n + targetValue(c, input), 0);
  if (fixedValue > input.target.max)
    issues.push(
      `Locked technical electives already contribute ${fixedValue} ${input.target.mode === "ects" ? "ECTS" : "courses"}, above the target maximum of ${input.target.max}.`,
    );
  const candidates = willing.filter((c) =>
    available
      .get(c.id)!
      .some((o) =>
        must.every((m) =>
          available.get(m.id)!.some((a) => !optionsConflict(o, a)),
        ),
      ),
  );
  const maxPossible =
    fixedValue + candidates.reduce((n, c) => n + targetValue(c, input), 0);
  if (maxPossible < input.target.min)
    issues.push(
      `Too few compatible candidates: at most ${maxPossible} ${input.target.mode === "ects" ? "technical ECTS" : "technical electives"} remain for a minimum target of ${input.target.min}. Add candidates, reduce the target, or review restrictions.`,
    );
  if (issues.length) {
    yield { type: "done", visited, solutions: [], issues };
    return;
  }
  const entries = [
    ...must.map((c) => ({ c, required: true })),
    ...candidates.map((c) => ({ c, required: false })),
  ];
  const suffix = new Array(entries.length + 1).fill(0);
  for (let i = entries.length - 1; i >= 0; i--)
    suffix[i] = suffix[i + 1] + targetValue(entries[i].c, input);
  // Precompute once; the recursion only looks up option-pair conflicts.
  const allOptions = entries.flatMap((e) => available.get(e.c.id)!);
  const conflict = new Map<Option, Set<Option>>(
    allOptions.map((o) => [o, new Set<Option>()]),
  );
  for (let i = 0; i < allOptions.length; i++)
    for (let j = i + 1; j < allOptions.length; j++)
      if (optionsConflict(allOptions[i], allOptions[j])) {
        conflict.get(allOptions[i])!.add(allOptions[j]);
        conflict.get(allOptions[j])!.add(allOptions[i]);
      }
  function* walk(
    index: number,
    chosen: Option[],
    value: number,
  ): Generator<SearchEvent> {
    visited++;
    if (visited % 2048 === 0 || batch.length >= 128) {
      yield { type: "progress", visited, solutions: batch };
      batch = [];
    }
    if (value > input.target.max || value + suffix[index] < input.target.min)
      return;
    if (index === entries.length) {
      if (value >= input.target.min) {
        const variant = makeVariant(chosen);
        const ids = variant.options.map((o) => o.courseId);
        batch.push({ groupId: JSON.stringify(ids), courseIds: ids, variant });
        found++;
      }
      return;
    }
    const { c, required } = entries[index];
    for (const option of available.get(c.id)!)
      if (chosen.every((o) => !conflict.get(option)!.has(o)))
        yield* walk(
          index + 1,
          [...chosen, option],
          value + targetValue(c, input),
        );
    if (!required) yield* walk(index + 1, chosen, value);
  }
  yield* walk(0, [], 0);
  if (!found) {
    issues.push(
      "No combination meets all course, section, availability, and target constraints together. Try a smaller target, allow more sections, or review your must-take courses.",
    );
    for (const c of willing.filter((c) => !available.get(c.id)!.length))
      issues.push(
        `${c.code || c.title}: no usable allowed section.`,
        ...unavailableExplanation(c, input),
      );
  }
  yield { type: "done", visited, solutions: batch, issues };
}
export function generate(input: PlannerInput) {
  const groups = new Map<string, ResultGroup>();
  let issues: string[] = [];
  for (const event of search(input)) {
    mergeSolutions(groups, event.solutions);
    if (event.type === "done") issues = event.issues;
  }
  return { groups: [...groups.values()], issues };
}

export function provisional(input: PlannerInput): {
  variant: Variant;
  issues: string[];
  hasAlternatives: boolean;
} {
  const base = {
    ...input,
    selections: Object.fromEntries(
      Object.entries(input.selections).filter(([, s]) => s.role === "must"),
    ),
    target: { mode: "count" as const, min: 0, max: 10000 },
  };
  const stream = search(base);
  let issues: string[] = [];
  for (const event of stream) {
    if (event.solutions.length) {
      stream.return(undefined);
      return {
        variant: event.solutions[0].variant,
        issues: [],
        hasAlternatives: event.solutions[0].variant.options.some(
          (o) =>
            courseOptions(
              input.catalog.find((c) => c.id === o.courseId)!,
              input,
            ).length > 1,
        ),
      };
    }
    if (event.type === "done") issues = event.issues;
  }
  const options = input.catalog
    .filter((c) => input.selections[c.id]?.role === "must")
    .map((c) => {
      const allowed = input.selections[c.id]?.allowedSectionIds;
      const s =
        c.sections.find((s) => allowed == null || allowed.includes(s.id)) ||
        c.sections[0];
      return { courseId: c.id, sectionIds: [s.id], meetings: s.meetings };
    });
  return { variant: makeVariant(options), issues, hasAlternatives: false };
}

export function validateVariant(
  variant: Variant,
  input: PlannerInput,
): string[] {
  const issues: string[] = [];
  const ids = variant.options.map((o) => o.courseId);
  for (const c of input.catalog.filter(
    (c) => input.selections[c.id]?.role === "must",
  ))
    if (!ids.includes(c.id))
      issues.push(`Missing must-take ${c.code || c.title}.`);
  for (const option of variant.options) {
    const c = input.catalog.find((c) => c.id === option.courseId);
    if (!c) {
      issues.push("A saved course was removed.");
      continue;
    }
    if (!["must", "willing"].includes(input.selections[c.id]?.role))
      issues.push(`${c.code || c.title} is no longer selected.`);
    if (
      !courseOptions(c, input).some(
        (o) =>
          timingKey(o.meetings) === timingKey(option.meetings) &&
          o.sectionIds.some((s) => option.sectionIds.includes(s)),
      )
    )
      issues.push(
        `${c.code || c.title}: saved times or allowed sections are no longer usable.`,
      );
  }
  for (let i = 0; i < variant.options.length; i++)
    for (let j = i + 1; j < variant.options.length; j++)
      if (optionsConflict(variant.options[i], variant.options[j]))
        issues.push("Saved courses overlap.");
  const value = input.catalog
    .filter((c) => ids.includes(c.id))
    .reduce((n, c) => n + targetValue(c, input), 0);
  if (value < input.target.min || value > input.target.max)
    issues.push("This timetable no longer meets the elective target.");
  return [...new Set(issues)];
}

export function inputKey(input: PlannerInput) {
  return JSON.stringify(input);
}
export function describeMetrics(m: Metrics) {
  return `${m.days} days · ${m.idle} min gaps · ${m.earliest === 1440 ? "—" : time(m.earliest)}–${m.latest === 0 ? "—" : time(m.latest)}`;
}
export function blockDescription(day: number, start: number, end: number) {
  return `${DAYS[day]} ${time(start)}–${time(end)}`;
}
