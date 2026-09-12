import { useState } from "react";
import {
  ArrowRight,
  Square,
  Plus,
  Trash2,
  Clock3,
  ChevronDown,
} from "lucide-react";
import { usePlanner } from "../state/planner";
import {
  targetSchema,
  DAYS,
  time,
  type Target,
  type Unavailable,
} from "../domain/types";
export function PlannerControls({
  running,
  onGenerate,
  onCancel,
  onBlock,
}: {
  running: boolean;
  onGenerate: () => void;
  onCancel: () => void;
  onBlock: (block?: Partial<Unavailable>) => void;
}) {
  const { plan, dispatch } = usePlanner();
  const [expanded, setExpanded] = useState(false);
  const t = plan.target;
  const valid = targetSchema.safeParse(t);
  const fixed = plan.catalogSnapshot.filter(
    (c) => c.category === "technical" && plan.selections[c.id]?.role === "must",
  ).length;
  function update(value: Partial<Target>) {
    dispatch({ type: "target", value: { ...t, ...value } });
  }
  return (
    <div className="planner-controls">
      <div className="target-row">
        <div className="target-label">
          <div>
            <h3>Elective target</h3>
            <p>Includes technical electives marked “must take”.</p>
          </div>
        </div>
        <div className="target-fields">
          <label>
            Target mode
            <select
              value={t.mode}
              onChange={(e) => {
                const mode = e.target.value as Target["mode"];
                const multiplier =
                  t.mode === "ects" && mode !== "ects"
                    ? 1 / 6
                    : t.mode !== "ects" && mode === "ects"
                      ? 6
                      : 1;
                const min = Math.round(t.min * multiplier),
                  max = Math.round(t.max * multiplier);
                update({ mode, min, max: mode === "exact" ? min : max });
              }}
            >
              <option value="exact">Exact course count</option>
              <option value="count">Course count range</option>
              <option value="ects">ECTS range</option>
            </select>
          </label>
          <label>
            {t.mode === "exact" ? "Courses" : "Minimum"}
            <input
              aria-label={
                t.mode === "exact" ? "Elective course count" : "Minimum target"
              }
              type="number"
              min="0"
              step={t.mode === "ects" ? "0.5" : "1"}
              value={t.min}
              onChange={(e) => {
                const min = Number(e.target.value);
                update({ min, ...(t.mode === "exact" ? { max: min } : {}) });
              }}
            />
          </label>
          {t.mode !== "exact" && (
            <label>
              Maximum
              <input
                aria-label="Maximum target"
                type="number"
                min="0"
                step={t.mode === "ects" ? "0.5" : "1"}
                value={t.max}
                onChange={(e) => update({ max: Number(e.target.value) })}
              />
            </label>
          )}
        </div>
        <button
          className="primary generate-button"
          disabled={!valid.success}
          onClick={running ? onCancel : onGenerate}
        >
          {running ? (
            <>
              <Square size={15} /> Stop search
            </>
          ) : (
            <>
              Generate <ArrowRight size={17} />
            </>
          )}
        </button>
      </div>
      {!valid.success && (
        <p className="inline-error" role="alert">
          {valid.error.issues.map((i) => i.message).join(" ")}
        </p>
      )}
      {fixed > 0 && (
        <p className="fixed-note">
          {fixed} locked technical elective{fixed !== 1 ? "s" : ""} already
          count{fixed === 1 ? "s" : ""} toward this target.
        </p>
      )}
      <div className="availability-head">
        <button
          className="text-button"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          <Clock3 size={15} /> Unavailable time{" "}
          <span className="count-pill">
            {plan.unavailable.filter((b) => b.enabled).length}
          </span>
          <ChevronDown size={14} />
        </button>
        <button className="text-button" onClick={() => onBlock()}>
          <Plus size={15} /> Add time block
        </button>
      </div>
      {expanded && (
        <div className="availability-list">
          {!plan.unavailable.length && (
            <p>
              No unavailable periods. Add one here or click an empty calendar
              period.
            </p>
          )}
          {plan.unavailable.map((b) => (
            <div className="availability-item" key={b.id}>
              <label className="check-label">
                <input
                  aria-label={`Enable ${b.label}`}
                  type="checkbox"
                  checked={b.enabled}
                  onChange={(e) =>
                    dispatch({
                      type: "block",
                      block: { ...b, enabled: e.target.checked },
                    })
                  }
                />
              </label>
              <button
                className="text-button block-summary"
                onClick={() => onBlock(b)}
              >
                <b>{b.label}</b>
                <span>
                  {DAYS[b.day].slice(0, 3)} {time(b.start)}–{time(b.end)}
                </span>
              </button>
              <button
                className="icon-button"
                aria-label={`Delete ${b.label}`}
                onClick={() => dispatch({ type: "delete-block", id: b.id })}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
