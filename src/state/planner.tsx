import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useState,
  type ReactNode,
} from "react";
import { z } from "zod";
import { catalog, CATALOG_VERSION } from "../data/catalog";
import { previousCurriculumCredits } from "../data/curriculum";
import {
  courseSchema,
  selectionSchema,
  targetSchema,
  unavailableSchema,
  meetingSchema,
  EMPTY_SELECTION,
  type Course,
  type CourseSelection,
  type Target,
  type Unavailable,
  type Variant,
  type PlannerInput,
} from "../domain/types";
import { inputKey, makeVariant, timingKey } from "../domain/engine";

const optionSchema = z.object({
  courseId: z.string(),
  sectionIds: z.array(z.string()).min(1),
  meetings: z.array(meetingSchema),
});
const variantSchema = z.object({
  id: z.string(),
  options: z.array(optionSchema),
  metrics: z.object({
    days: z.number(),
    idle: z.number(),
    earliest: z.number(),
    latest: z.number(),
  }),
});
const favoriteSchema = z.object({
  id: z.string(),
  name: z.string().max(200),
  courses: z.array(courseSchema),
  variant: variantSchema,
  inputKey: z.string(),
  savedAt: z.string(),
});
const snapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    catalogVersion: z.string(),
    catalogSnapshot: z.array(courseSchema).max(1000),
    editedCourseIds: z.array(z.string()),
    selections: z.record(selectionSchema),
    target: targetSchema,
    unavailable: z.array(unavailableSchema).max(1000),
    favorites: z.array(favoriteSchema).max(1000),
  })
  .superRefine((p, ctx) => {
    const courses = new Map(p.catalogSnapshot.map((c) => [c.id, c]));
    if (courses.size !== p.catalogSnapshot.length)
      ctx.addIssue({ code: "custom", message: "Duplicate course IDs." });
    if (new Set(p.unavailable.map((b) => b.id)).size !== p.unavailable.length)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate unavailable-period IDs.",
      });
    if (new Set(p.favorites.map((f) => f.id)).size !== p.favorites.length)
      ctx.addIssue({ code: "custom", message: "Duplicate favorite IDs." });
    for (const [id, s] of Object.entries(p.selections)) {
      const c = courses.get(id);
      if (!c) {
        ctx.addIssue({
          code: "custom",
          message: `Selection references missing course ${id}.`,
        });
        continue;
      }
      if (s.role === "willing" && c.category !== "technical")
        ctx.addIssue({
          code: "custom",
          message: `${c.code}: only technical electives can be optional candidates.`,
        });
      if (
        s.allowedSectionIds?.some(
          (id) => !c.sections.some((sec) => sec.id === id),
        )
      )
        ctx.addIssue({
          code: "custom",
          message: `${c.code}: selection references a missing section.`,
        });
    }
    for (const f of p.favorites) {
      if (
        new Set(f.courses.map((c) => c.id)).size !== f.courses.length ||
        new Set(f.variant.options.map((o) => o.courseId)).size !==
          f.variant.options.length
      )
        ctx.addIssue({
          code: "custom",
          message: "Duplicate courses in a saved timetable.",
        });
      if (f.courses.length !== f.variant.options.length)
        ctx.addIssue({
          code: "custom",
          message: "Saved timetable does not match its course snapshot.",
        });
      for (const o of f.variant.options) {
        const c = f.courses.find((c) => c.id === o.courseId);
        if (
          !c ||
          o.sectionIds.some((id) => !c.sections.some((s) => s.id === id))
        )
          ctx.addIssue({
            code: "custom",
            message: "Saved timetable has missing course or section data.",
          });
        else if (
          c.scheduleStatus === "unknown" ||
          o.sectionIds.some(
            (id) =>
              timingKey(c.sections.find((s) => s.id === id)!.meetings) !==
              timingKey(o.meetings),
          )
        )
          ctx.addIssue({
            code: "custom",
            message:
              "Saved meeting times do not match the saved course sections.",
          });
      }
    }
  });
export const scenarioSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(60),
  updatedAt: z.string().max(40),
  snapshot: snapshotSchema,
});
export const planningSchema = snapshotSchema
  .and(
    z.object({
      scenarios: z.array(scenarioSchema).max(50).default([]),
      activeScenarioId: z.string().nullable().default(null),
    }),
  )
  .superRefine((p, ctx) => {
    if (new Set(p.scenarios.map((s) => s.id)).size !== p.scenarios.length)
      ctx.addIssue({ code: "custom", message: "Duplicate scenario IDs." });
    if (
      new Set(p.scenarios.map((s) => s.name.toLocaleLowerCase())).size !==
      p.scenarios.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Scenario names must be unique.",
      });
    if (
      p.activeScenarioId &&
      !p.scenarios.some((s) => s.id === p.activeScenarioId)
    )
      ctx.addIssue({
        code: "custom",
        message: "The active scenario is missing.",
      });
  });
export type Scenario = z.infer<typeof scenarioSchema>;
export type PlanningFile = z.infer<typeof planningSchema>;
export function scenarioSnapshot(p: PlanningFile): Scenario["snapshot"] {
  return snapshotSchema.parse(structuredClone(p));
}
export type Favorite = PlanningFile["favorites"][number];
export function freshPlan(): PlanningFile {
  return {
    schemaVersion: 1,
    catalogVersion: CATALOG_VERSION,
    catalogSnapshot: structuredClone(catalog),
    editedCourseIds: [],
    selections: {},
    target: { mode: "exact", min: 3, max: 3 },
    unavailable: [],
    favorites: [],
    scenarios: [],
    activeScenarioId: null,
  };
}
export function parsePlanningFile(raw: string): PlanningFile {
  if (raw.length > 20_000_000)
    throw new Error("This planning file exceeds the 20 MB import limit.");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      "This file is not valid JSON. Choose a planning file exported by this app.",
    );
  }
  if (
    !data ||
    typeof data !== "object" ||
    !("schemaVersion" in data) ||
    data.schemaVersion !== 1
  )
    throw new Error(
      "This is not a supported planning backup. Choose a JSON file exported by this app.",
    );
  const parsed = planningSchema.safeParse(data);
  if (!parsed.success) {
    const detail = parsed.error.issues.find(
      (i) => i.code === "custom",
    )?.message;
    throw new Error(
      detail
        ? `Invalid planner data: ${detail}`
        : "Some required course, target, or saved-timetable data is missing or invalid.",
    );
  }
  const p = parsed.data;
  p.favorites = p.favorites.map((f) => ({
    ...f,
    variant: makeVariant(f.variant.options),
  }));
  p.scenarios = p.scenarios.map((s) => ({
    ...s,
    snapshot: {
      ...s.snapshot,
      favorites: s.snapshot.favorites.map((f) => ({
        ...f,
        variant: makeVariant(f.variant.options),
      })),
    },
  }));
  return p;
}
export function toInput(p: PlanningFile): PlannerInput {
  return {
    catalog: p.catalogSnapshot,
    selections: p.selections,
    target: p.target,
    unavailable: p.unavailable,
  };
}
export const STORAGE_KEY = "course-selection-visualizer.plan.v1";
export function migrateCatalog(p: PlanningFile): PlanningFile {
  if (p.catalogVersion === CATALOG_VERSION) return p;
  const edited = new Set(p.editedCourseIds),
    currentIds = new Set(catalog.map((c) => c.id));
  const merged = catalog.map((c) => {
    const old = p.catalogSnapshot.find((old) => old.id === c.id);
    if (!edited.has(c.id) || !old) return c;
    const initialCatalog = p.catalogVersion === "2026-2027-fall-v1";
    const newCurriculumCatalog = [
      "2026-2027-fall-v2-curriculum",
      "2026-2027-fall-v3-no-years",
    ].includes(p.catalogVersion);
    if (!initialCatalog && !newCurriculumCatalog) return old;
    // v1 tracked edits per course, not per field. Fill unknown credits and
    // preserve edited meeting times and explicit personal credits.
    // Never mutate saved favorite snapshots.
    return {
      ...old,
      ects:
        old.ects === null ||
        (newCurriculumCatalog && old.ects === previousCurriculumCredits[c.id])
          ? c.ects
          : old.ects,
      title:
        old.title === "Name not supplied in schedule" ? c.title : old.title,
      curriculum: c.curriculum,
    };
  });
  merged.push(
    ...p.catalogSnapshot.filter(
      (c) =>
        !currentIds.has(c.id) &&
        (c.source === "custom" ||
          edited.has(c.id) ||
          (p.selections[c.id]?.role !== "none" && !!p.selections[c.id])),
    ),
  );
  const selections = Object.fromEntries(
    Object.entries(p.selections)
      .filter(([id]) => merged.some((c) => c.id === id))
      .map(([id, s]) => [
        id,
        {
          ...s,
          allowedSectionIds:
            s.allowedSectionIds?.filter((sid) =>
              merged
                .find((c) => c.id === id)!
                .sections.some((s) => s.id === sid),
            ) ?? null,
        },
      ]),
  );
  return {
    ...p,
    catalogVersion: CATALOG_VERSION,
    catalogSnapshot: merged,
    selections,
  };
}
export type Action =
  | { type: "save-scenario"; id: string; name: string }
  | { type: "load-scenario"; id: string; fallbackId: string }
  | { type: "rename-scenario"; id: string; name: string }
  | { type: "delete-scenario"; id: string }
  | { type: "clear-selections"; role: "must" | "willing" | "both" }
  | { type: "select"; id: string; value: Partial<CourseSelection> }
  | { type: "target"; value: Target }
  | { type: "course"; course: Course; role?: CourseSelection["role"] }
  | { type: "restore-course"; id: string }
  | { type: "delete-course"; id: string }
  | { type: "block"; block: Unavailable }
  | { type: "delete-block"; id: string }
  | { type: "favorite"; favorite: Favorite }
  | { type: "remove-favorite"; id: string }
  | { type: "import"; plan: PlanningFile }
  | { type: "reset" };
function reducePlan(p: PlanningFile, a: Action): PlanningFile {
  switch (a.type) {
    case "save-scenario": {
      const name = a.name.trim();
      if (
        !name ||
        name.length > 60 ||
        p.scenarios.length >= 50 ||
        p.scenarios.some(
          (s) =>
            s.id === a.id ||
            s.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
        ) ||
        !snapshotSchema.safeParse(p).success
      )
        return p;
      return {
        ...p,
        activeScenarioId: a.id,
        scenarios: [
          ...p.scenarios,
          {
            id: a.id,
            name,
            updatedAt: new Date().toISOString(),
            snapshot: scenarioSnapshot(p),
          },
        ],
      };
    }
    case "load-scenario": {
      const selected = p.scenarios.find((s) => s.id === a.id);
      if (!selected || !snapshotSchema.safeParse(p).success) return p;
      let scenarios = p.scenarios;
      if (
        !p.activeScenarioId &&
        JSON.stringify(scenarioSnapshot(p)) !==
          JSON.stringify(selected.snapshot)
      ) {
        if (
          scenarios.length >= 50 ||
          scenarios.some((s) => s.id === a.fallbackId)
        )
          return p;
        let name = "Previous setup",
          suffix = 2;
        while (
          scenarios.some(
            (s) => s.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
          )
        )
          name = `Previous setup ${suffix++}`;
        scenarios = [
          ...scenarios,
          {
            id: a.fallbackId,
            name,
            updatedAt: new Date().toISOString(),
            snapshot: scenarioSnapshot(p),
          },
        ];
      }
      return migrateCatalog({
        ...structuredClone(selected.snapshot),
        scenarios,
        activeScenarioId: selected.id,
      });
    }
    case "rename-scenario": {
      const name = a.name.trim();
      if (
        !name ||
        name.length > 60 ||
        p.scenarios.some(
          (s) =>
            s.id !== a.id &&
            s.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
      )
        return p;
      return {
        ...p,
        scenarios: p.scenarios.map((s) => (s.id === a.id ? { ...s, name } : s)),
      };
    }
    case "delete-scenario":
      return {
        ...p,
        activeScenarioId:
          p.activeScenarioId === a.id ? null : p.activeScenarioId,
        scenarios: p.scenarios.filter((s) => s.id !== a.id),
      };
    case "clear-selections":
      return {
        ...p,
        selections: Object.fromEntries(
          Object.entries(p.selections).map(([id, s]) => [
            id,
            (s.role === "must" || s.role === "willing") &&
            (a.role === "both" || s.role === a.role)
              ? { ...s, role: "none" as const }
              : s,
          ]),
        ),
      };
    case "select":
      return {
        ...p,
        selections: {
          ...p.selections,
          [a.id]: { ...(p.selections[a.id] || EMPTY_SELECTION), ...a.value },
        },
      };
    case "target":
      return { ...p, target: a.value };
    case "course": {
      const exists = p.catalogSnapshot.some((c) => c.id === a.course.id),
        old = p.selections[a.course.id] || EMPTY_SELECTION;
      const role =
        a.role ??
        (a.course.category !== "technical" && old.role === "willing"
          ? "must"
          : old.role);
      return {
        ...p,
        catalogSnapshot: exists
          ? p.catalogSnapshot.map((c) => (c.id === a.course.id ? a.course : c))
          : [...p.catalogSnapshot, a.course],
        editedCourseIds: [...new Set([...p.editedCourseIds, a.course.id])],
        selections: {
          ...p.selections,
          [a.course.id]: {
            ...old,
            role,
            allowedSectionIds:
              old.allowedSectionIds?.filter((id) =>
                a.course.sections.some((s) => s.id === id),
              ) ?? null,
          },
        },
      };
    }
    case "restore-course": {
      const original = catalog.find((c) => c.id === a.id);
      if (!original) return p;
      const next = reducer(p, {
        type: "course",
        course: structuredClone(original),
      });
      return {
        ...next,
        editedCourseIds: next.editedCourseIds.filter((id) => id !== a.id),
        selections: {
          ...next.selections,
          [a.id]: { ...next.selections[a.id], allowedSectionIds: null },
        },
      };
    }
    case "delete-course": {
      const selections = { ...p.selections };
      delete selections[a.id];
      return {
        ...p,
        catalogSnapshot: p.catalogSnapshot.filter((c) => c.id !== a.id),
        editedCourseIds: p.editedCourseIds.filter((id) => id !== a.id),
        selections,
      };
    }
    case "block":
      return {
        ...p,
        unavailable: p.unavailable.some((b) => b.id === a.block.id)
          ? p.unavailable.map((b) => (b.id === a.block.id ? a.block : b))
          : [...p.unavailable, a.block],
      };
    case "delete-block":
      return { ...p, unavailable: p.unavailable.filter((b) => b.id !== a.id) };
    case "favorite":
      return {
        ...p,
        favorites: [
          ...p.favorites.filter((f) => f.id !== a.favorite.id),
          a.favorite,
        ],
      };
    case "remove-favorite":
      return { ...p, favorites: p.favorites.filter((f) => f.id !== a.id) };
    case "import":
      return a.plan;
    case "reset":
      return freshPlan();
  }
}
export function reducer(p: PlanningFile, a: Action): PlanningFile {
  const next = reducePlan(p, a);
  if (next === p || !next.activeScenarioId) return next;
  // Invalid form drafts must not overwrite the last valid saved scenario.
  const parsed = snapshotSchema.safeParse(next);
  if (!parsed.success) return next;
  return {
    ...next,
    scenarios: next.scenarios.map((s) =>
      s.id === next.activeScenarioId
        ? {
            ...s,
            updatedAt: new Date().toISOString(),
            snapshot: structuredClone(parsed.data),
          }
        : s,
    ),
  };
}
type Context = {
  plan: PlanningFile;
  dispatch: React.Dispatch<Action>;
  storageError: string;
};
const PlannerContext = createContext<Context | null>(null);
export function PlannerProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return {
        plan: raw ? migrateCatalog(parsePlanningFile(raw)) : freshPlan(),
        error: "",
      };
    } catch {
      return {
        plan: freshPlan(),
        error:
          "The saved plan could not be loaded. Import a backup if you have one; autosave is paused to preserve the original.",
      };
    }
  });
  const [plan, dispatch] = useReducer(reducer, initial.plan);
  const [storageError, setStorageError] = useState(initial.error);
  useEffect(() => {
    if (initial.error && plan === initial.plan) return;
    const timeout = setTimeout(() => {
      if (!planningSchema.safeParse(plan).success) {
        setStorageError(
          "Some inputs are incomplete or invalid. Correct them to resume autosaving; the last valid plan is preserved.",
        );
        return;
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
        setStorageError("");
      } catch {
        setStorageError(
          "Browser saving is unavailable or full. Your current session still works; export a backup before closing.",
        );
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [plan, initial]);
  return (
    <PlannerContext.Provider value={{ plan, dispatch, storageError }}>
      {children}
    </PlannerContext.Provider>
  );
}
export function usePlanner() {
  const context = useContext(PlannerContext);
  if (!context) throw new Error("PlannerProvider is missing");
  return context;
}
export function createFavorite(
  courses: Course[],
  variant: Variant,
  input: PlannerInput,
  name: string,
): Favorite {
  return {
    id: variant.id,
    name,
    courses: structuredClone(courses),
    variant: structuredClone(variant),
    inputKey: inputKey(input),
    savedAt: new Date().toISOString(),
  };
}
