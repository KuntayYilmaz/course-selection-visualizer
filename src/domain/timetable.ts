import type { Course, Variant, Unavailable, Meeting } from "./types";

export const palette = [
  ["#dcefeb", "#235e50"],
  ["#e5e8fb", "#4859a5"],
  ["#fff0d6", "#966414"],
  ["#f8e3e8", "#9a4c64"],
  ["#e2edf9", "#35678e"],
  ["#efE4f5", "#794a92"],
  ["#eaf0d8", "#647c30"],
  ["#fbe7db", "#a25b35"],
];
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
export function buildTimetable(
  courses: Course[],
  variant: Variant,
  blocks: Unavailable[] = [],
) {
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
  const ticks: number[] = [];
  for (let n = 520; n < last; n += 60) if (n >= first) ticks.push(n);
  if (!ticks.includes(first)) ticks.unshift(first);
  const placed = layout(events);
  return { events, placed, first, last, span, ticks };
}
