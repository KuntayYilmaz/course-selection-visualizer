import { useEffect, useRef } from "react";
import { z } from "zod";
import type { Action } from "./state/planner";
import { roleSchema, type PlannerInput } from "./domain/types";
type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type ModelContext = {
  registerTool: (
    tool: Tool,
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function useWebMCP(
  input: PlannerInput,
  dispatch: React.Dispatch<Action>,
  generate: () => void,
) {
  const latest = useRef({ input, dispatch, generate });
  latest.current = { input, dispatch, generate };
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext })
      .modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const tools: Tool[] = [
      {
        name: "read_course_plan",
        title: "Read course plan",
        description:
          "Read the catalog, course selections, target, and unavailable periods.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => latest.current.input,
      },
      {
        name: "set_course_selections",
        title: "Set course selections",
        description:
          "Change course selections in the visible planner. Saves locally without generating timetables.",
        inputSchema: {
          type: "object",
          properties: {
            selections: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  courseId: { type: "string" },
                  role: {
                    type: "string",
                    enum: ["none", "must", "willing", "excluded"],
                  },
                },
                required: ["courseId", "role"],
                additionalProperties: false,
              },
            },
          },
          required: ["selections"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: async (raw) => {
          const values = z
            .object({
              selections: z
                .array(z.object({ courseId: z.string(), role: roleSchema }))
                .max(1000),
            })
            .parse(raw);
          for (const s of values.selections) {
            const c = latest.current.input.catalog.find(
              (c) => c.id === s.courseId,
            );
            if (!c) throw new Error(`Unknown course ${s.courseId}`);
            if (s.role === "willing" && c.category !== "technical")
              throw new Error(
                "Only technical electives can be optional candidates.",
              );
          }
          for (const s of values.selections)
            latest.current.dispatch({
              type: "select",
              id: s.courseId,
              value: { role: s.role },
            });
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          return { updated: values.selections.length };
        },
      },
      {
        name: "start_timetable_generation",
        title: "Start timetable generation",
        description:
          "Start background enumeration with the current visible selections and target. Results appear in the planner; this starts rather than completes the search.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: () => {
          latest.current.generate();
          return { started: true };
        },
      },
    ];
    for (const tool of tools) {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {
        /* Optional browser API. */
      }
    }
    return () => lifecycle.abort();
  }, []);
}
