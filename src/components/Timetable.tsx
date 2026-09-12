import { CalendarDays, LockKeyhole } from "lucide-react";
import {
  DAYS,
  time,
  type Course,
  type Variant,
  type Unavailable,
  type CourseSelection,
  type Meeting,
} from "../domain/types";
import { overlaps } from "../domain/engine";
const palette = [
  ["#dcefeb", "#235e50"],
  ["#e5e8fb", "#4859a5"],
  ["#fff0d6", "#966414"],
  ["#f8e3e8", "#9a4c64"],
  ["#e2edf9", "#35678e"],
  ["#efE4f5", "#794a92"],
  ["#eaf0d8", "#647c30"],
  ["#fbe7db", "#a25b35"],
];
export function courseColor(id: string) {
  let n = 0;
  for (const c of id) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return palette[n % palette.length];
}
type Event = {
  key: string;
  day: number;
  start: number;
  end: number;
  course?: Course;
  sectionLabel?: string;
  room: string;
  kind: string;
  block?: Unavailable;
  meetings: Meeting[];
  lane?: number;
  lanes?: number;
};
function layout(events: Event[]): Event[] {
  const out: Event[] = [];
  for (let day = 0; day < 5; day++) {
    const sorted = events
      .filter((e) => e.day === day)
      .sort((a, b) => a.start - b.start || b.end - a.end);
    let cluster: Event[] = [],
      end = -1;
    function flush() {
      const laneEnds: number[] = [];
      for (const e of cluster) {
        let lane = laneEnds.findIndex((t) => t <= e.start);
        if (lane < 0) lane = laneEnds.length;
        laneEnds[lane] = e.end;
        e.lane = lane;
      }
      for (const e of cluster) e.lanes = laneEnds.length;
      out.push(...cluster);
      cluster = [];
    }
    for (const e of sorted) {
      if (e.start >= end && cluster.length) flush();
      cluster.push(e);
      end = Math.max(cluster.length === 1 ? -1 : end, e.end);
    }
    flush();
  }
  return out;
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
  const events: Event[] = [];
  for (const option of variant.options) {
    const course = courses.find((c) => c.id === option.courseId);
    if (!course) continue;
    const label = option.sectionIds
      .map((id) => course.sections.find((s) => s.id === id)?.label || id)
      .join("/");
    const meetings = [...option.meetings].sort(
      (a, b) => a.day - b.day || a.start - b.start,
    );
    let previous: Event | undefined;
    for (const m of meetings) {
      if (
        previous &&
        previous.day === m.day &&
        previous.end + 10 === m.start &&
        previous.kind === m.kind &&
        previous.room === m.room
      ) {
        previous.end = m.end;
        previous.meetings.push(m);
      } else {
        previous = {
          key: `${course.id}-${m.day}-${m.start}`,
          course,
          sectionLabel: label,
          day: m.day,
          start: m.start,
          end: m.end,
          room: m.room,
          kind: m.kind,
          meetings: [m],
        };
        events.push(previous);
      }
    }
  }
  for (const b of blocks.filter((b) => b.enabled))
    events.push({
      key: b.id,
      day: b.day,
      start: b.start,
      end: b.end,
      room: "",
      kind: "unavailable",
      block: b,
      meetings: [{ ...b, room: "", kind: "other" }],
    });
  const first = Math.min(520, ...events.map((e) => e.start));
  const last = Math.max(1230, ...events.map((e) => e.end));
  const span = last - first;
  const height = compact ? 320 : Math.max(590, span * 0.83);
  const ticks: number[] = [];
  for (let n = 520; n < last; n += 60) if (n >= first) ticks.push(n);
  if (!ticks.includes(first)) ticks.unshift(first);
  const placed = layout(events);
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
