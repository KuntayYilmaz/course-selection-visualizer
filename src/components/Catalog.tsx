import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  SlidersHorizontal,
  LockKeyhole,
  Check,
  ChevronDown,
} from "lucide-react";
import { usePlanner } from "../state/planner";
import {
  categoryLabels,
  roleLabels,
  EMPTY_SELECTION,
  meetingText,
  type Course,
  type Role,
} from "../domain/types";
import { courseColor } from "./Timetable";
export function Catalog({
  onAdd,
  onDetail,
}: {
  onAdd: () => void;
  onDetail: (c: Course) => void;
}) {
  const { plan, dispatch } = usePlanner();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [filters, setFilters] = useState(false);
  const courses = useMemo(
    () =>
      plan.catalogSnapshot.filter(
        (c) =>
          (!query ||
            `${c.code} ${c.title}`
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase())) &&
          (department === "all" || c.department === department) &&
          (category === "all" || c.category === category) &&
          (status === "all" ||
            (plan.selections[c.id]?.role || "none") === status),
      ),
    [plan, query, department, category, status],
  );
  const must = Object.values(plan.selections).filter(
      (s) => s.role === "must",
    ).length,
    willing = Object.values(plan.selections).filter(
      (s) => s.role === "willing",
    ).length;
  function choose(c: Course, role: Role) {
    dispatch({
      type: "select",
      id: c.id,
      value: {
        role: (plan.selections[c.id]?.role || "none") === role ? "none" : role,
      },
    });
  }
  return (
    <aside className="panel catalog-panel">
      <div className="panel-heading">
        <h3>Your courses</h3>
        <button onClick={onAdd}>
          <Plus size={15} /> Add course
        </button>
      </div>
      <div className="selection-summary">
        <span>
          <LockKeyhole size={13} />
          <b>{must}</b> must take
        </span>
        <span>
          <Check size={13} />
          <b>{willing}</b> willing to take
        </span>
      </div>
      <div
        className="selection-reset"
        role="group"
        aria-label="Clear course selections"
      >
        <button
          disabled={!must}
          title="Clear every must-take selection, including filtered-out courses"
          onClick={() => dispatch({ type: "clear-selections", role: "must" })}
        >
          Clear must take
        </button>
        <button
          disabled={!willing}
          title="Clear every willing-to-take selection, including filtered-out courses"
          onClick={() =>
            dispatch({ type: "clear-selections", role: "willing" })
          }
        >
          Clear willing
        </button>
        <button
          disabled={!must && !willing}
          title="Clear all must-take and willing-to-take selections"
          onClick={() => dispatch({ type: "clear-selections", role: "both" })}
        >
          Clear both
        </button>
      </div>
      <div className="search">
        <Search size={17} />
        <input
          aria-label="Search courses"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search courses or codes…"
        />
      </div>
      <div className="catalog-filter-row">
        <div className="department-tabs">
          <button
            aria-pressed={department === "all"}
            onClick={() => setDepartment("all")}
          >
            All
          </button>
          <button
            aria-pressed={department === "CMP"}
            onClick={() => setDepartment("CMP")}
          >
            CMP
          </button>
          <button
            aria-pressed={department === "AID"}
            onClick={() => setDepartment("AID")}
          >
            AID
          </button>
        </div>
        <button
          className={`icon-button ${filters ? "active" : ""}`}
          aria-label="Filter courses"
          aria-expanded={filters}
          onClick={() => setFilters(!filters)}
        >
          <SlidersHorizontal size={17} />
        </button>
      </div>
      {filters && (
        <div className="catalog-filters">
          <label>
            Department
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="all">All departments</option>
              {[...new Set(plan.catalogSnapshot.map((c) => c.department))].map(
                (d) => (
                  <option key={d}>{d}</option>
                ),
              )}
            </select>
          </label>
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {Object.entries(categoryLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">All statuses</option>
              {Object.entries(roleLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setDepartment("all");
              setCategory("all");
              setStatus("all");
              setQuery("");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="catalog-count">
        <span>{courses.length} courses</span>
        <span>2026–2027 Fall</span>
      </div>
      <div className="catalog-list">
        {courses.map((c) => {
          const selected = plan.selections[c.id] || EMPTY_SELECTION;
          const first = c.sections[0];
          const days = [
            ...new Set(first.meetings.map((m) => meetingText(m).split(" ")[0])),
          ].join(" / ");
          return (
            <article className={`course-card role-${selected.role}`} key={c.id}>
              <div className="course-code">
                <button
                  className="course-title-button"
                  onClick={() => onDetail(c)}
                >
                  <i style={{ background: courseColor(c.id)[1] }} />
                  {c.code || "CUSTOM"}
                  <ChevronDown size={12} />
                </button>
                <span className="chip">
                  {c.ects === null ? "ECTS unknown" : `${c.ects} ECTS`}
                  {c.curriculum?.basis === "default" ? " (default)" : ""}
                </span>
              </div>
              <button className="course-name" onClick={() => onDetail(c)}>
                {c.title}
              </button>
              <div className="course-meta">
                <span>{categoryLabels[c.category]}</span>
                <span>
                  {c.scheduleStatus === "scheduled"
                    ? days
                    : c.scheduleStatus === "unknown"
                      ? "Time unknown"
                      : "No weekly meeting"}
                </span>
              </div>
              <div className="course-actions">
                <button
                  className={selected.role === "must" ? "selected must" : ""}
                  aria-pressed={selected.role === "must"}
                  aria-label={`Must take ${c.code || c.title}`}
                  onClick={() => choose(c, "must")}
                >
                  <LockKeyhole size={12} /> Must take
                </button>
                {c.category === "technical" && (
                  <button
                    className={
                      selected.role === "willing" ? "selected willing" : ""
                    }
                    aria-pressed={selected.role === "willing"}
                    aria-label={`Willing to take ${c.code || c.title}`}
                    onClick={() => choose(c, "willing")}
                  >
                    <Check size={13} /> Willing
                  </button>
                )}
                <button
                  className={`exclude-button ${selected.role === "excluded" ? "selected" : ""}`}
                  aria-pressed={selected.role === "excluded"}
                  aria-label={`Exclude ${c.code || c.title}`}
                  onClick={() => choose(c, "excluded")}
                >
                  Exclude
                </button>
              </div>
              {selected.role === "excluded" && (
                <input
                  className="exclusion-reason"
                  aria-label={`Exclusion reason for ${c.code || c.title}`}
                  value={selected.reason}
                  placeholder="Reason, e.g. already completed"
                  onChange={(e) =>
                    dispatch({
                      type: "select",
                      id: c.id,
                      value: { reason: e.target.value },
                    })
                  }
                />
              )}
            </article>
          );
        })}
        {!courses.length && (
          <div className="small-empty">No courses match these filters.</div>
        )}
      </div>
      <div className="catalog-footnote">
        Technical electives default to 6 ECTS.
        <br />
        Course details and credits are editable.
      </div>
    </aside>
  );
}
