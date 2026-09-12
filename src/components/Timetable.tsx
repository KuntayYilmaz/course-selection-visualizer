import { CalendarDays, LockKeyhole } from "lucide-react";
import {
  DAYS,
  time,
  type Course,
  type Variant,
  type Unavailable,
  type CourseSelection,
} from "../domain/types";
import { overlaps } from "../domain/engine";
import { buildTimetable, palette } from "../domain/timetable";
export function courseColor(id: string) {
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  const index = n % palette.length;
  return [
    `var(--course-${index}-bg, ${palette[index][0]})`,
    `var(--course-${index}-fg, ${palette[index][1]})`,
  ];
}
export function Timetable({
  courses,
  variant,
  selections = {},
  blocks = [],
  compact = false,
  onCourse,
  onBlock,
  onSlot,
}: {
  courses: Course[];
  variant: Variant;
  selections?: Record<string, CourseSelection>;
  blocks?: Unavailable[];
  compact?: boolean;
  onCourse?: (c: Course) => void;
  onBlock?: (b: Unavailable) => void;
  onSlot?: (day: number, start: number, end: number) => void;
}) {
  const { events, placed, first, last, span, ticks } = buildTimetable(
    courses,
    variant,
    blocks,
  );
  const height = compact ? 320 : Math.max(590, span * 0.83);
  return (
    <div className={`timetable-wrap ${compact ? "compact" : ""}`}>
      <div
        className="timetable"
        style={{ "--calendar-height": `${height}px` } as React.CSSProperties}
      >
        <div className="day-headers">
          <span className="time-label">TIME</span>
          {DAYS.map((d, i) => (
            <div key={d}>
              <span>
                {compact ? d.slice(0, 3) : d.toUpperCase().slice(0, 3)}
              </span>
              <small>{["01", "02", "03", "04", "05"][i]}</small>
            </div>
          ))}
        </div>
        <div className="calendar-body" style={{ height }}>
          <div className="time-axis">
            {ticks.map((t) => (
              <span key={t} style={{ top: `${((t - first) / span) * 100}%` }}>
                {time(t)}
              </span>
            ))}
          </div>
          <div className="calendar-days">
            {DAYS.map((day, i) => (
              <div key={day} className="calendar-day">
                {ticks.map((t) => (
                  <button
                    type="button"
                    tabIndex={compact || !onSlot ? -1 : 0}
                    disabled={!onSlot}
                    key={t}
                    className="calendar-slot"
                    aria-label={`Block ${day} ${time(t)} to ${time(Math.min(t + 50, 1440))}`}
                    onClick={() => onSlot?.(i, t, Math.min(t + 50, 1440))}
                    style={{
                      top: `${((t - first) / span) * 100}%`,
                      height: `${(Math.min(60, last - t) / span) * 100}%`,
                    }}
                  >
                    <span />
                  </button>
                ))}
              </div>
            ))}
            {placed.map((e) => {
              const conflicting = events.some(
                (other) =>
                  other.key !== e.key &&
                  other.course?.id !== e.course?.id &&
                  e.meetings.some((m) =>
                    other.meetings.some((n) => overlaps(m, n)),
                  ),
              );
              const [background, color] = e.course
                ? courseColor(e.course.id)
                : ["#edf0ee", "#6f7f75"];
              const must = e.course && selections[e.course.id]?.role === "must";
              return (
                <button
                  type="button"
                  key={e.key}
                  className={`calendar-event ${e.block ? "unavailable-event" : ""} ${must ? "locked-event" : ""} ${conflicting ? "conflicting-event" : ""}`}
                  style={{
                    top: `${((e.start - first) / span) * 100}%`,
                    height: `calc(${((e.end - e.start) / span) * 100}% - 3px)`,
                    left: `calc(${(e.day + (e.lane || 0) / (e.lanes || 1)) * 20}% + 3px)`,
                    width: `calc(${20 / (e.lanes || 1)}% - 6px)`,
                    background,
                    color,
                    borderLeftColor: color,
                  }}
                  onClick={() =>
                    e.course
                      ? onCourse?.(e.course)
                      : e.block && onBlock?.(e.block)
                  }
                  title={`${e.course?.title || e.block?.label}\n${DAYS[e.day]} ${time(e.start)}–${time(e.end)}\n${e.course ? `Section ${e.sectionLabel} · ${e.room || "Room not supplied"}` : ""}${conflicting ? "\nConflict" : ""}`}
                >
                  <strong>
                    {must && <LockKeyhole size={11} />}{" "}
                    {e.course?.code || e.course?.title || e.block?.label}
                    {e.kind === "lab" && (
                      <span className="event-lab"> Lab</span>
                    )}
                  </strong>
                  <span>
                    {time(e.start)}–{time(e.end)}
                  </span>
                  {!compact && (
                    <small>
                      {e.block
                        ? "Unavailable"
                        : `§ ${e.sectionLabel}${e.room ? ` · ${e.room}` : ""}`}
                    </small>
                  )}
                  {conflicting && (
                    <b className="event-conflict-label">Overlap</b>
                  )}
                </button>
              );
            })}
            {!events.length && !compact && (
              <div className="calendar-empty">
                <CalendarDays size={34} />
                <h3>No meetings to display</h3>
                <p>
                  Must-take courses appear here before generation.
                  <br />
                  Click an empty period to block time.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
