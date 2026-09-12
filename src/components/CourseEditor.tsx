import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import {
  courseSchema,
  DAYS,
  categoryLabels,
  roleLabels,
  minutes,
  time,
  type Course,
  type Role,
  type Meeting,
} from "../domain/types";
export function CourseEditor({
  course,
  initialRole,
  onSave,
  onClose,
}: {
  course?: Course;
  initialRole?: Role;
  onSave: (c: Course, role: Role) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Course>(() =>
    course
      ? structuredClone(course)
      : {
          id: crypto.randomUUID(),
          code: "",
          title: "",
          department: "Other",
          category: "nontechnical",
          ects: null,
          scheduleStatus: "scheduled",
          source: "custom",
          sourceNote: "",
          sections: [
            {
              id: crypto.randomUUID(),
              label: "01",
              instructor: "",
              meetings: [
                { day: 0, start: 580, end: 630, room: "", kind: "lecture" },
              ],
            },
          ],
        },
  );
  const [role, setRole] = useState<Role>(initialRole || "must");
  const [error, setError] = useState("");
  const patch = (p: Partial<Course>) => setDraft((d) => ({ ...d, ...p }));
  const updateMeeting = (si: number, mi: number, p: Partial<Meeting>) =>
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s, i) =>
        i === si
          ? {
              ...s,
              meetings: s.meetings.map((m, j) =>
                j === mi ? { ...m, ...p } : m,
              ),
            }
          : s,
      ),
    }));
  function save(e: React.FormEvent) {
    e.preventDefault();
    const normalized = {
      ...draft,
      code: draft.code.trim(),
      title: draft.title.trim(),
      department: draft.department.trim(),
    };
    const parsed = courseSchema.safeParse(normalized);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(" "));
      return;
    }
    onSave(parsed.data, role);
  }
  return (
    <Modal
      title={course ? `Edit ${course.code || course.title}` : "Add a course"}
      onClose={onClose}
    >
      <form onSubmit={save} className="editor-form">
        <div className="form-grid">
          <label className="span-2">
            Course name
            <input
              required
              value={draft.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. Introduction to Photography"
            />
          </label>
          <label>
            Course code
            <input
              value={draft.code}
              onChange={(e) => patch({ code: e.target.value })}
              placeholder="Optional"
            />
          </label>
          <label>
            Department
            <input
              required
              value={draft.department}
              onChange={(e) => patch({ department: e.target.value })}
            />
          </label>
          <label>
            Category
            <select
              value={draft.category}
              onChange={(e) => {
                const category = e.target.value as Course["category"];
                patch({
                  category,
                  ects:
                    category === "technical" && draft.ects === null
                      ? 6
                      : draft.ects,
                });
                if (category !== "technical" && role === "willing")
                  setRole("must");
              }}
            >
              {Object.entries(categoryLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            ECTS
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              placeholder="Unknown"
              value={draft.ects ?? ""}
              onChange={(e) =>
                patch({
                  ects: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
          <label>
            Selection
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {Object.entries(roleLabels)
                .filter(
                  ([r]) => r !== "willing" || draft.category === "technical",
                )
                .map(([r, l]) => (
                  <option key={r} value={r}>
                    {l}
                  </option>
                ))}
            </select>
          </label>
          <label className="span-2">
            Weekly schedule
            <select
              value={draft.scheduleStatus}
              onChange={(e) => {
                const status = e.target.value as Course["scheduleStatus"];
                patch({
                  scheduleStatus: status,
                  sections: draft.sections.map((s) => ({
                    ...s,
                    meetings:
                      status === "scheduled"
                        ? [
                            {
                              day: 0,
                              start: 580,
                              end: 630,
                              room: "",
                              kind: "lecture",
                            },
                          ]
                        : [],
                  })),
                });
              }}
            >
              <option value="scheduled">Has weekly meeting times</option>
              <option value="unscheduled">No fixed weekly meeting</option>
              <option value="unknown">Meeting time is unknown</option>
            </select>
          </label>
        </div>
        {draft.sections.map((section, si) => (
          <fieldset className="section-editor" key={section.id}>
            <legend>Section {section.label || si + 1}</legend>
            <div className="section-title-fields">
              <label>
                Section label
                <input
                  required
                  value={section.label}
                  onChange={(e) =>
                    patch({
                      sections: draft.sections.map((s, i) =>
                        i === si ? { ...s, label: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Instructor
                <input
                  value={section.instructor}
                  placeholder="Not supplied"
                  onChange={(e) =>
                    patch({
                      sections: draft.sections.map((s, i) =>
                        i === si ? { ...s, instructor: e.target.value } : s,
                      ),
                    })
                  }
                />
              </label>
              <button
                type="button"
                className="icon-button danger"
                disabled={draft.sections.length === 1}
                aria-label={`Remove section ${section.label}`}
                onClick={() =>
                  patch({ sections: draft.sections.filter((_, i) => i !== si) })
                }
              >
                <Trash2 size={17} />
              </button>
            </div>
            {section.meetings.map((m, mi) => (
              <div className="meeting-editor" key={mi}>
                <label>
                  Day
                  <select
                    value={m.day}
                    onChange={(e) =>
                      updateMeeting(si, mi, { day: Number(e.target.value) })
                    }
                  >
                    {DAYS.map((d, i) => (
                      <option value={i} key={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start
                  <input
                    aria-label={`Section ${section.label} meeting ${mi + 1} start`}
                    required
                    type="time"
                    value={time(m.start)}
                    onInput={(e) =>
                      updateMeeting(si, mi, {
                        start: minutes(e.currentTarget.value),
                      })
                    }
                    onChange={(e) =>
                      updateMeeting(si, mi, { start: minutes(e.target.value) })
                    }
                  />
                </label>
                <label>
                  End
                  <input
                    aria-label={`Section ${section.label} meeting ${mi + 1} end`}
                    required
                    type="time"
                    value={time(m.end)}
                    onInput={(e) =>
                      updateMeeting(si, mi, {
                        end: minutes(e.currentTarget.value),
                      })
                    }
                    onChange={(e) =>
                      updateMeeting(si, mi, { end: minutes(e.target.value) })
                    }
                  />
                </label>
                <label>
                  Room
                  <input
                    value={m.room}
                    onChange={(e) =>
                      updateMeeting(si, mi, { room: e.target.value })
                    }
                  />
                </label>
                <label>
                  Type
                  <select
                    value={m.kind}
                    onChange={(e) =>
                      updateMeeting(si, mi, {
                        kind: e.target.value as Meeting["kind"],
                      })
                    }
                  >
                    {["lecture", "lab", "project", "other"].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="icon-button danger"
                  aria-label={`Remove meeting ${mi + 1} from section ${section.label}`}
                  onClick={() =>
                    patch({
                      sections: draft.sections.map((s, i) =>
                        i === si
                          ? {
                              ...s,
                              meetings: s.meetings.filter((_, j) => j !== mi),
                            }
                          : s,
                      ),
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            {draft.scheduleStatus === "scheduled" && (
              <button
                type="button"
                onClick={() =>
                  patch({
                    sections: draft.sections.map((s, i) =>
                      i === si
                        ? {
                            ...s,
                            meetings: [
                              ...s.meetings,
                              {
                                day: 0,
                                start: 580,
                                end: 630,
                                room: "",
                                kind: "lecture",
                              },
                            ],
                          }
                        : s,
                    ),
                  })
                }
              >
                <Plus size={15} /> Add meeting
              </button>
            )}
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() =>
            patch({
              sections: [
                ...draft.sections,
                {
                  id: crypto.randomUUID(),
                  label: String(draft.sections.length + 1).padStart(2, "0"),
                  instructor: "",
                  meetings:
                    draft.scheduleStatus === "scheduled"
                      ? [
                          {
                            day: 0,
                            start: 580,
                            end: 630,
                            room: "",
                            kind: "lecture",
                          },
                        ]
                      : [],
                },
              ],
            })
          }
        >
          <Plus size={16} /> Add alternative section
        </button>
        {draft.sourceNote && (
          <p className="source-note">Source note: {draft.sourceNote}</p>
        )}
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save course
          </button>
        </div>
      </form>
    </Modal>
  );
}
