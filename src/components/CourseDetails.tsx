import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { usePlanner } from "../state/planner";
import {
  categoryLabels,
  roleLabels,
  EMPTY_SELECTION,
  meetingText,
  type Course,
  type Role,
} from "../domain/types";
export function CourseDetails({
  course,
  onClose,
  onEdit,
  onConfirm,
}: {
  course: Course;
  onClose: () => void;
  onEdit: () => void;
  onConfirm: (title: string, body: string, action: () => void) => void;
}) {
  const { plan, dispatch } = usePlanner();
  const selection = plan.selections[course.id] || EMPTY_SELECTION;
  return (
    <Modal title={course.code || "Course details"} onClose={onClose}>
      <div className="detail-body">
        <h3>{course.title}</h3>
        <p>
          {course.department} · {categoryLabels[course.category]} ·{" "}
          {course.ects === null ? "ECTS not supplied" : `${course.ects} ECTS`}
        </p>
        <label className="field">
          Selection
          <select
            value={selection.role}
            onChange={(e) =>
              dispatch({
                type: "select",
                id: course.id,
                value: { role: e.target.value as Role },
              })
            }
          >
            {Object.entries(roleLabels)
              .filter(
                ([v]) => v !== "willing" || course.category === "technical",
              )
              .map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
          </select>
        </label>
        {selection.role === "excluded" && (
          <label className="field">
            Reason
            <input
              value={selection.reason}
              onChange={(e) =>
                dispatch({
                  type: "select",
                  id: course.id,
                  value: { reason: e.target.value },
                })
              }
              placeholder="Already completed"
            />
          </label>
        )}
        <div className="detail-sections">
          <h4>Allowed sections</h4>
          <p>
            Automatic selection tries every checked section. Sections with
            identical times share one timetable option.
          </p>
          <label className="check-label">
            <input
              type="checkbox"
              checked={selection.allowedSectionIds === null}
              onChange={(e) =>
                dispatch({
                  type: "select",
                  id: course.id,
                  value: { allowedSectionIds: e.target.checked ? null : [] },
                })
              }
            />{" "}
            Allow all sections
          </label>
          {course.sections.map((s) => (
            <div className="section-detail" key={s.id}>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={
                    selection.allowedSectionIds === null ||
                    selection.allowedSectionIds.includes(s.id)
                  }
                  onChange={(e) => {
                    const current =
                      selection.allowedSectionIds ||
                      course.sections.map((s) => s.id);
                    dispatch({
                      type: "select",
                      id: course.id,
                      value: {
                        allowedSectionIds: e.target.checked
                          ? [...new Set([...current, s.id])]
                          : current.filter((id) => id !== s.id),
                      },
                    });
                  }}
                />
                <strong>Section {s.label}</strong>
                <span>{s.instructor || "Instructor not supplied"}</span>
              </label>
              {s.meetings.map((m, i) => (
                <p className="meeting-detail" key={i}>
                  {meetingText(m)} · {m.kind}
                  {m.room ? ` · ${m.room}` : ""}
                </p>
              ))}
              {!s.meetings.length && (
                <p>
                  {course.scheduleStatus === "unscheduled"
                    ? "No fixed weekly meeting."
                    : "Meeting times unknown; edit before generating."}
                </p>
              )}
            </div>
          ))}
        </div>
        {course.sourceNote && (
          <p className="source-note">{course.sourceNote}</p>
        )}
        {course.curriculum && (
          <div className="source-note">
            {course.curriculum.label && (
              <p>
                <strong>{course.curriculum.label}</strong>
                {course.curriculum.matchedCode
                  ? ` · ${course.curriculum.matchedCode}`
                  : ""}
              </p>
            )}
            {course.curriculum.matchNote && (
              <p>{course.curriculum.matchNote}</p>
            )}
            <p>
              Curriculum checked {course.curriculum.checkedAt}.
              {course.curriculum.sources.map((url) => (
                <span key={url}>
                  {" "}
                  <a href={url} target="_blank" rel="noreferrer">
                    Official curriculum
                  </a>
                </span>
              ))}
            </p>
            {plan.editedCourseIds.includes(course.id) && (
              <p>
                This course has local corrections. The source values may differ
                from your edits.
              </p>
            )}
          </div>
        )}
        <div className="modal-footer">
          <button onClick={onEdit}>
            <Pencil size={15} /> Edit course
          </button>
          {course.source === "pdf" &&
            plan.editedCourseIds.includes(course.id) && (
              <button
                onClick={() =>
                  onConfirm(
                    "Restore original course?",
                    "Your local corrections and section restrictions for this course will be reset.",
                    () => {
                      dispatch({ type: "restore-course", id: course.id });
                      onClose();
                    },
                  )
                }
              >
                <RotateCcw size={15} /> Restore
              </button>
            )}
          {course.source === "custom" && (
            <button
              className="danger"
              onClick={() =>
                onConfirm(
                  "Delete custom course?",
                  "It will be removed from your current plan. Saved favorites will retain their snapshot and be marked outdated.",
                  () => {
                    dispatch({ type: "delete-course", id: course.id });
                    onClose();
                  },
                )
              }
            >
              <Trash2 size={15} /> Delete
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
