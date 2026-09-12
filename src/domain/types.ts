import { z } from "zod";

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
] as const;
export const categorySchema = z.enum([
  "technical",
  "required",
  "project",
  "nontechnical",
  "lab",
]);
export const roleSchema = z.enum(["none", "must", "willing", "excluded"]);
const id = z.string().min(1).max(200);
export const meetingSchema = z
  .object({
    day: z.number().int().min(0).max(4),
    start: z.number().int().min(0).max(1439),
    end: z.number().int().min(1).max(1440),
    kind: z.enum(["lecture", "lab", "project", "other"]),
    room: z.string().max(200).default(""),
  })
  .refine((m) => m.end > m.start, "Meeting end must be after its start.");
export const sectionSchema = z.object({
  id,
  label: z.string().min(1).max(100),
  instructor: z.string().max(300).default(""),
  meetings: z.array(meetingSchema).max(100),
});
export const courseSchema = z
  .object({
    id,
    code: z.string().max(80),
    title: z.string().min(1).max(300),
    department: z.string().min(1).max(80),
    curriculum: z
      .object({
        sources: z
          .array(
            z
              .string()
              .url()
              .refine((url) => url.startsWith("https://")),
          )
          .max(3),
        checkedAt: z.string().max(30),
        label: z.string().max(200).optional(),
        matchedCode: z.string().max(100).optional(),
        basis: z.enum(["matched", "default"]).optional(),
        matchNote: z.string().max(1000).optional(),
      })
      .optional(),
    category: categorySchema,
    ects: z.number().finite().min(0).max(100).nullable(),
    scheduleStatus: z.enum(["scheduled", "unscheduled", "unknown"]),
    sections: z.array(sectionSchema).min(1).max(100),
    source: z.enum(["pdf", "custom"]),
    sourceNote: z.string().max(1000).default(""),
  })
  .superRefine((c, ctx) => {
    if (new Set(c.sections.map((s) => s.id)).size !== c.sections.length)
      ctx.addIssue({ code: "custom", message: "Section IDs must be unique." });
    for (const s of c.sections) {
      if (c.scheduleStatus === "scheduled" && !s.meetings.length)
        ctx.addIssue({
          code: "custom",
          message: "Every scheduled section needs a meeting.",
        });
      if (c.scheduleStatus !== "scheduled" && s.meetings.length)
        ctx.addIssue({
          code: "custom",
          message:
            "Unscheduled or unknown courses cannot contain meeting blocks.",
        });
      for (let i = 0; i < s.meetings.length; i++)
        for (let j = i + 1; j < s.meetings.length; j++) {
          const a = s.meetings[i],
            b = s.meetings[j];
          if (a.day === b.day && a.start < b.end && b.start < a.end)
            ctx.addIssue({
              code: "custom",
              message: `Section ${s.label} contains overlapping meetings.`,
            });
        }
    }
  });
export const selectionSchema = z.object({
  role: roleSchema,
  reason: z.string().max(500).default(""),
  allowedSectionIds: z.array(id).nullable().default(null),
});
export const targetSchema = z
  .object({
    mode: z.enum(["exact", "count", "ects"]),
    min: z.number().finite().min(0).max(10000),
    max: z.number().finite().min(0).max(10000),
  })
  .superRefine((t, ctx) => {
    if (t.max < t.min)
      ctx.addIssue({
        code: "custom",
        message: "Maximum must be at least the minimum.",
      });
    if (
      t.mode !== "ects" &&
      (!Number.isInteger(t.min) || !Number.isInteger(t.max))
    )
      ctx.addIssue({
        code: "custom",
        message: "Course counts must be whole numbers.",
      });
    if (t.mode === "exact" && t.min !== t.max)
      ctx.addIssue({
        code: "custom",
        message: "Exact target requires matching bounds.",
      });
  });
export const unavailableSchema = z
  .object({
    id,
    label: z.string().min(1).max(200),
    day: z.number().int().min(0).max(4),
    start: z.number().int().min(0).max(1439),
    end: z.number().int().min(1).max(1440),
    enabled: z.boolean(),
  })
  .refine((b) => b.end > b.start, "End must be after start.");
export type Course = z.infer<typeof courseSchema>;
export type Section = z.infer<typeof sectionSchema>;
export type Meeting = z.infer<typeof meetingSchema>;
export type CourseSelection = z.infer<typeof selectionSchema>;
export type Target = z.infer<typeof targetSchema>;
export type Unavailable = z.infer<typeof unavailableSchema>;
export type Category = Course["category"];
export type Role = CourseSelection["role"];
export type PlannerInput = {
  catalog: Course[];
  selections: Record<string, CourseSelection>;
  target: Target;
  unavailable: Unavailable[];
};
export type Option = {
  courseId: string;
  sectionIds: string[];
  meetings: Meeting[];
};
export type Metrics = {
  days: number;
  idle: number;
  earliest: number;
  latest: number;
};
export type Variant = { id: string; options: Option[]; metrics: Metrics };
export type ResultGroup = {
  id: string;
  courseIds: string[];
  variants: Variant[];
};
export type Solution = {
  groupId: string;
  courseIds: string[];
  variant: Variant;
};
export type SearchEvent =
  | { type: "progress"; visited: number; solutions: Solution[] }
  | { type: "done"; visited: number; solutions: Solution[]; issues: string[] };
export type SortMode =
  | "days"
  | "idle"
  | "late"
  | "early"
  | "ects-desc"
  | "ects-asc";
export const EMPTY_SELECTION: CourseSelection = {
  role: "none",
  reason: "",
  allowedSectionIds: null,
};
export const categoryLabels: Record<Category, string> = {
  technical: "Technical elective",
  required: "Required course",
  project: "Design project",
  nontechnical: "Nontechnical elective",
  lab: "Laboratory",
};
export const roleLabels: Record<Role, string> = {
  none: "Not selected",
  must: "Must take",
  willing: "Willing to take",
  excluded: "Excluded / completed",
};
export function time(n: number) {
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
export function minutes(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function meetingText(m: Meeting) {
  return `${DAYS[m.day].slice(0, 3)} ${time(m.start)}–${time(m.end)}`;
}
