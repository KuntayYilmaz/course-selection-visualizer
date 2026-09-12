import {
  ArrowRight,
  ArrowLeft,
  Star,
  GitCompareArrows,
  Clock3,
  CalendarDays,
} from "lucide-react";
import {
  bestVariant,
  credits,
  validateVariant,
  inputKey,
} from "../domain/engine";
import {
  type Course,
  type ResultGroup,
  type SortMode,
  type Variant,
  type PlannerInput,
} from "../domain/types";
import type { Favorite } from "../state/planner";
export function Results({
  groups,
  catalog,
  activeId,
  onSelect,
  sort,
  onSort,
  page,
  onPage,
  running,
  visited,
  complete,
  cancelled,
  stale,
  favorites,
  shortlistOnly,
  onShortlistOnly,
  onFavorite,
  onViewFavorite,
  compareIds,
  onCompareIds,
  onCompare,
  input,
}: {
  groups: ResultGroup[];
  catalog: Course[];
  activeId: string;
  onSelect: (id: string) => void;
  sort: SortMode;
  onSort: (s: SortMode) => void;
  page: number;
  onPage: (p: number) => void;
  running: boolean;
  visited: number;
  complete: boolean;
  cancelled: boolean;
  stale: boolean;
  favorites: Favorite[];
  shortlistOnly: boolean;
  onShortlistOnly: (v: boolean) => void;
  onFavorite: (g: ResultGroup, v: Variant) => void;
  onViewFavorite: (f: Favorite) => void;
  compareIds: string[];
  onCompareIds: (ids: string[]) => void;
  onCompare: () => void;
  input: PlannerInput;
}) {
  const ordered = groups;
  const pages = Math.max(1, Math.ceil(ordered.length / 25));
  const actualPage = Math.min(page, pages - 1);
  const visible = ordered.slice(actualPage * 25, (actualPage + 1) * 25);
  const variants = groups.reduce((n, g) => n + g.variants.length, 0);
  return (
    <aside className="panel results-panel">
      <div className="panel-heading">
        <div>
          <h3>Combinations</h3>
          <p>
            {running
              ? "Generating combinations…"
              : complete && !stale
                ? "Every compatible course set"
                : cancelled
                  ? "Search stopped · incomplete"
                  : "No current results"}
          </p>
        </div>
        <span className="results-count">
          {!complete && (running || cancelled) ? "≥" : ""}
          {groups.length.toLocaleString()}
        </span>
      </div>
      <div className="results-tabs">
        <button
          aria-pressed={!shortlistOnly}
          onClick={() => onShortlistOnly(false)}
        >
          All results
        </button>
        <button
          aria-pressed={shortlistOnly}
          onClick={() => onShortlistOnly(true)}
        >
          <Star size={13} /> Shortlist <span>{favorites.length}</span>
        </button>
      </div>
      {shortlistOnly ? (
        <div className="result-list favorite-list">
          {favorites.length === 0 ? (
            <div className="small-empty">Star a timetable to keep it here.</div>
          ) : (
            favorites.map((f, i) => {
              const invalid = validateVariant(f.variant, input),
                outdated = f.inputKey !== inputKey(input);
              return (
                <article className="result-card" key={f.id}>
                  <div className="result-card-top">
                    <button
                      className="result-name"
                      onClick={() => onViewFavorite(f)}
                    >
                      {f.name || `Saved plan ${i + 1}`}
                    </button>
                    <button
                      className="icon-button starred"
                      aria-label={`Remove ${f.name} from shortlist`}
                      onClick={() =>
                        onFavorite(
                          {
                            id: JSON.stringify(f.courses.map((c) => c.id)),
                            courseIds: f.courses.map((c) => c.id),
                            variants: [f.variant],
                          },
                          f.variant,
                        )
                      }
                    >
                      <Star size={16} fill="currentColor" />
                    </button>
                  </div>
                  <button
                    className="result-preview-button"
                    onClick={() => onViewFavorite(f)}
                  >
                    <p className="result-codes">
                      {f.courses.map((c) => c.code || c.title).join(" · ") ||
                        "No courses"}
                    </p>
                    <p className="result-meta">
                      {credits(f.courses).total} known ECTS ·{" "}
                      {f.variant.metrics.days} days
                    </p>
                  </button>
                  {outdated && (
                    <p
                      className={`favorite-status ${invalid.length ? "invalid" : ""}`}
                    >
                      {invalid.length
                        ? "Outdated · needs review"
                        : "Outdated · still compatible"}
                    </p>
                  )}
                  <label className="check-label compare-check">
                    <input
                      type="checkbox"
                      checked={compareIds.includes(f.id)}
                      disabled={
                        !compareIds.includes(f.id) && compareIds.length >= 3
                      }
                      onChange={(e) =>
                        onCompareIds(
                          e.target.checked
                            ? [...compareIds, f.id]
                            : compareIds.filter((id) => id !== f.id),
                        )
                      }
                    />{" "}
                    Compare
                  </label>
                </article>
              );
            })
          )}
        </div>
      ) : (
        <>
          <div className="sort-control">
            <label>
              Sort by
              <select
                value={sort}
                onChange={(e) => onSort(e.target.value as SortMode)}
              >
                <option value="days">Fewest days on campus</option>
                <option value="idle">Least time between classes</option>
                <option value="late">Latest morning starts</option>
                <option value="early">Earliest evening finishes</option>
                <option value="ects-desc">Total ECTS: highest first</option>
                <option value="ects-asc">Total ECTS: lowest first</option>
              </select>
            </label>
            {(sort === "ects-desc" || sort === "ects-asc") && (
              <p className="source-note">
                Includes all selected courses. Unknown totals appear last.
                Section variants of the same course set have equal ECTS.
              </p>
            )}
          </div>
          {(groups.length > 0 || running) && (
            <div className="results-info">
              <span>{variants.toLocaleString()} timetable variants</span>
              {running && (
                <span className="working-indicator" role="status">
                  Searching · {visited.toLocaleString()} steps
                </span>
              )}
              {stale && (
                <span className="stale-label">Inputs changed · regenerate</span>
              )}
              {cancelled && (
                <span className="stale-label">
                  Partial results · count is not final
                </span>
              )}
            </div>
          )}
          <div className="result-list">
            {visible.map((g, i) => {
              const v = bestVariant(g, sort),
                courses = g.courseIds
                  .map((id) => catalog.find((c) => c.id === id))
                  .filter((c): c is Course => !!c);
              const cr = credits(courses);
              const saved = favorites.some((f) => f.id === v.id);
              return (
                <article
                  className={`result-card ${activeId === g.id ? "active" : ""}`}
                  key={g.id}
                >
                  <div className="result-card-top">
                    <button
                      className="result-name"
                      onClick={() => onSelect(g.id)}
                    >
                      Option {String(actualPage * 25 + i + 1).padStart(2, "0")}
                    </button>
                    <button
                      className={`icon-button ${saved ? "starred" : ""}`}
                      aria-label={`${saved ? "Remove" : "Shortlist"} option ${actualPage * 25 + i + 1}`}
                      onClick={() => onFavorite(g, v)}
                    >
                      <Star size={16} fill={saved ? "currentColor" : "none"} />
                    </button>
                  </div>
                  <button
                    className="result-preview-button"
                    onClick={() => onSelect(g.id)}
                  >
                    <p className="result-codes">
                      {courses.map((c) => c.code || c.title).join(" · ") ||
                        "No courses"}
                    </p>
                    <div className="result-badges">
                      <span>{cr.technicalCount} electives</span>
                      <span>
                        {cr.total}
                        {cr.missing.length ? "+" : ""} ECTS
                      </span>
                    </div>
                    <div className="result-meta">
                      <span>
                        <CalendarDays size={12} />
                        {v.metrics.days} days
                      </span>
                      <span>
                        <Clock3 size={12} />
                        {v.metrics.idle}m gaps
                      </span>
                    </div>
                    {g.variants.length > 1 && (
                      <p className="variant-note">
                        {g.variants.length} section timetables
                      </p>
                    )}
                  </button>
                </article>
              );
            })}
            {!visible.length && (
              <div className="empty-results">
                <div className="result-symbol">
                  <ArrowRight />
                </div>
                <h3>
                  {complete ? "No matching combinations" : "No results yet"}
                </h3>
                <p>
                  {complete
                    ? "Review the conflict details, adjust your selections, and generate again."
                    : "Select courses, set an elective target, and click Generate."}
                </p>
              </div>
            )}
          </div>
          {pages > 1 && (
            <div className="pagination">
              <button
                aria-label="Previous results page"
                disabled={actualPage === 0}
                onClick={() => onPage(actualPage - 1)}
              >
                <ArrowLeft size={14} />
              </button>
              <span>
                {actualPage + 1} / {pages}
              </span>
              <button
                aria-label="Next results page"
                disabled={actualPage >= pages - 1}
                onClick={() => onPage(actualPage + 1)}
              >
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </>
      )}
      {shortlistOnly && favorites.length > 0 && (
        <div className="compare-footer">
          <button
            className="primary"
            disabled={!compareIds.length}
            onClick={onCompare}
          >
            <GitCompareArrows size={16} /> Compare {compareIds.length} selected
          </button>
          <p>Choose up to three timetables.</p>
        </div>
      )}
    </aside>
  );
}
