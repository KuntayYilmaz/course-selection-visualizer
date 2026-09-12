import { Modal } from "./Modal";
import { Timetable } from "./Timetable";
import type { Favorite } from "../state/planner";
import { credits, validateVariant, inputKey } from "../domain/engine";
import { time, type PlannerInput } from "../domain/types";
export function Comparison({
  favorites,
  input,
  onClose,
}: {
  favorites: Favorite[];
  input: PlannerInput;
  onClose: () => void;
}) {
  const common =
    favorites[0]?.courses
      .filter((c) =>
        favorites.every((f) => f.courses.some((x) => x.id === c.id)),
      )
      .map((c) => c.id) || [];
  return (
    <Modal title="Compare shortlisted timetables" onClose={onClose} wide>
      <div
        className="comparison-grid"
        style={{
          gridTemplateColumns: `repeat(${favorites.length},minmax(270px,1fr))`,
        }}
      >
        {favorites.map((f) => {
          const cr = credits(f.courses),
            m = f.variant.metrics,
            issues = validateVariant(f.variant, input);
          return (
            <article className="comparison-card" key={f.id}>
              <h3>{f.name}</h3>
              {f.inputKey !== inputKey(input) && (
                <p className="favorite-status">
                  Saved snapshot ·{" "}
                  {issues.length ? "needs review" : "still compatible"}
                </p>
              )}
              <Timetable compact courses={f.courses} variant={f.variant} />
              <dl className="comparison-metrics">
                <div>
                  <dt>Technical electives</dt>
                  <dd>
                    {cr.technicalCount} · {cr.technical} ECTS
                  </dd>
                </div>
                <div>
                  <dt>Other credits</dt>
                  <dd>{cr.other} ECTS</dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>
                    {cr.total}
                    {cr.missing.length ? " known" : ""} ECTS
                  </dd>
                </div>
                <div>
                  <dt>Days on campus</dt>
                  <dd>{m.days}</dd>
                </div>
                <div>
                  <dt>Time between classes</dt>
                  <dd>{m.idle} min</dd>
                </div>
                <div>
                  <dt>Earliest start / latest finish</dt>
                  <dd>
                    {m.earliest === 1440 ? "—" : time(m.earliest)} /{" "}
                    {m.latest === 0 ? "—" : time(m.latest)}
                  </dd>
                </div>
              </dl>
              {cr.missing.length > 0 && (
                <p className="missing-credits">
                  Credits unknown: {cr.missing.join(", ")}
                </p>
              )}
              <h4>Courses</h4>
              <ul className="comparison-courses">
                {f.courses.map((c) => (
                  <li
                    key={c.id}
                    className={common.includes(c.id) ? "shared" : "different"}
                  >
                    <b>{c.code || c.title}</b>
                    <span>
                      {common.includes(c.id) ? "Shared" : "Different"}
                    </span>
                    <small>{c.title}</small>
                  </li>
                ))}
              </ul>
              {issues.length > 0 && (
                <ul className="comparison-issues">
                  {issues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              )}
            </article>
          );
        })}
      </div>
    </Modal>
  );
}
