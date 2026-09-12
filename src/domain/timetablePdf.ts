import { jsPDF } from "jspdf";
import { buildTimetable, palette } from "./timetable";
import { credits, overlaps } from "./engine";
import {
  DAYS,
  time,
  type Course,
  type CourseSelection,
  type Unavailable,
  type Variant,
} from "./types";

export type TimetablePdfInput = {
  courses: Course[];
  variant: Variant;
  selections: Record<string, CourseSelection>;
  blocks: Unavailable[];
  title: string;
  status: string;
  issues: string[];
};

let fontRequest: Promise<Uint8Array> | undefined;
function loadFont() {
  return (fontRequest ??= fetch(
    `${import.meta.env.BASE_URL}fonts/NotoSans-Regular.ttf`,
  )
    .then(async (response) => {
      if (!response.ok) throw new Error("The PDF font could not be loaded.");
      return new Uint8Array(await response.arrayBuffer());
    })
    .catch((error) => {
      fontRequest = undefined;
      throw error;
    }));
}

/** Render from the displayed snapshot, independent of screen size and theme. */
export function createTimetablePdf(input: TimetablePdfInput, font: Uint8Array) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });
  let binary = "";
  for (let i = 0; i < font.length; i += 8192)
    binary += String.fromCharCode(...font.subarray(i, i + 8192));
  doc.addFileToVFS("NotoSans.ttf", btoa(binary));
  doc.addFont("NotoSans.ttf", "NotoSans", "normal");
  doc.setFont("NotoSans");
  doc.setProperties({
    title: "Weekly timetable",
    subject: "Hacettepe CMP & AID - Fall 2026-2027",
    creator: "Hacettepe Course Planner",
  });
  const selected = input.variant.options
    .map((o) => input.courses.find((c) => c.id === o.courseId))
    .filter((c): c is Course => !!c);
  const totals = credits(selected);
  const { events, placed, first, last, span, ticks } = buildTimetable(
    input.courses,
    input.variant,
    input.blocks,
  );
  const ink = "#213632",
    muted = "#53655c",
    border = "#d8e1db";
  const clean = (s: string) =>
    s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/[\u2010-\u2015]/g, "-");
  const text = (s: string, x: number, y: number, size = 9, color = ink) => {
    doc.setFontSize(size).setTextColor(color).text(clean(s), x, y);
  };
  const fit = (s: string, width: number, size: number) => {
    doc.setFontSize(size);
    s = clean(s);
    if (doc.getTextWidth(s) <= width) return s;
    while (s.length && doc.getTextWidth(s + "...") > width) s = s.slice(0, -1);
    return s ? s + "..." : "";
  };
  const conflicted = (event: (typeof events)[number]) =>
    events.some(
      (other) =>
        other.key !== event.key &&
        other.course?.id !== event.course?.id &&
        event.meetings.some((m) => other.meetings.some((n) => overlaps(m, n))),
    );
  const hasConflicts = events.some(conflicted);
  text("Weekly timetable", 12, 16, 18);
  text("Hacettepe CMP & AID | Fall 2026-2027", 12, 23, 9, muted);
  text(fit(`${input.title} | ${input.status}`, 273, 9), 12, 30, 9, muted);
  text(
    `${totals.technicalCount} technical electives | ${totals.technical} technical ECTS | ${totals.other} other known ECTS | ${totals.total}${totals.missing.length ? "+ known" : ""} total ECTS`,
    12,
    37,
    9,
  );
  if (input.issues.length || hasConflicts)
    text(
      "Review needed: this timetable has unresolved issues. See the course details page.",
      12,
      44,
      9,
      "#9b3041",
    );

  const x = 25,
    y = 55,
    width = 260,
    height = 134,
    dayWidth = width / 5;
  const yAt = (minute: number) => y + ((minute - first) / span) * height;
  for (let d = 0; d < 5; d++) text(DAYS[d], x + d * dayWidth + 3, y - 4, 10);
  for (const tick of ticks) {
    const breakStart = Math.min(last, tick + 50),
      breakEnd = Math.min(last, tick + 60);
    doc
      .setFillColor("#f2f5f3")
      .rect(x, yAt(breakStart), width, yAt(breakEnd) - yAt(breakStart), "F");
    doc
      .setDrawColor(border)
      .setLineWidth(0.15)
      .line(x, yAt(tick), x + width, yAt(tick));
    text(time(tick), 12, yAt(tick) + 2, 7, muted);
  }
  doc.setDrawColor(border).rect(x, y, width, height);
  for (let d = 1; d < 5; d++)
    doc.line(x + d * dayWidth, y, x + d * dayWidth, y + height);
  for (const event of placed) {
    let hash = 0;
    for (const c of event.course?.id || "")
      hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    const [background, foreground] = event.course
      ? palette[hash % palette.length]
      : ["#e9eeea", "#4f6155"];
    const laneWidth = dayWidth / (event.lanes || 1);
    const left = x + event.day * dayWidth + (event.lane || 0) * laneWidth + 0.6;
    const top = yAt(event.start) + 0.3,
      w = laneWidth - 1.2;
    const h = Math.max(0.25, yAt(event.end) - yAt(event.start) - 0.6);
    doc.setFillColor(background).rect(left, top, w, h, "F");
    doc
      .setDrawColor(conflicted(event) ? "#b84254" : foreground)
      .setLineWidth(conflicted(event) ? 0.6 : 0.25);
    if (event.block) doc.setLineDashPattern([1, 1], 0);
    doc.rect(left, top, w, h);
    doc.setLineDashPattern([], 0);
    const label =
      event.course?.code || event.course?.title || event.block?.label || "";
    const must =
      event.course && input.selections[event.course.id]?.role === "must";
    const lines = [
      label + (event.kind === "lab" ? " Lab" : ""),
      `${time(event.start)}-${time(event.end)}`,
      event.block
        ? "Unavailable"
        : `Section ${event.sectionLabel}${event.room ? ` | ${event.room}` : ""}`,
      conflicted(event) ? "OVERLAP" : must ? "Must take" : "",
    ].filter(Boolean);
    // Tiny or crowded blocks retain geometry; full text is on the details pages.
    const compact = h < 12;
    const lineHeight = compact ? 2.6 : 3.3;
    const count = Math.min(lines.length, Math.floor((h - 0.6) / lineHeight));
    for (let i = 0; i < count; i++)
      text(
        fit(
          lines[i],
          Math.max(0, w - 3),
          compact ? (i === 0 ? 6.5 : 6) : i === 0 ? 8 : 7,
        ),
        left + 1.5,
        top + (compact ? 2.1 : 3) + i * lineHeight,
        compact ? (i === 0 ? 6.5 : 6) : i === 0 ? 8 : 7,
        foreground,
      );
  }
  text(
    "Shaded rows: teaching breaks. Dashed blocks: unavailable. Full meeting details follow.",
    12,
    197,
    8,
    muted,
  );

  let cursor = 0;
  function detailPage() {
    doc.addPage();
    text("Course and meeting details", 12, 16, 16);
    text("Fall 2026-2027 | " + fit(input.status, 215, 9), 12, 23, 9, muted);
    cursor = 33;
  }
  function paragraph(value: string, size = 9, color = ink) {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(clean(value), 270) as string[];
    for (const line of lines) {
      if (cursor > 190) detailPage();
      text(line, 12, cursor, size, color);
      cursor += size * 0.45;
    }
  }
  detailPage();
  const warnings = [...input.issues];
  if (hasConflicts)
    warnings.unshift(
      "Overlapping meetings are outlined in red on the weekly grid.",
    );
  for (const warning of warnings) paragraph(warning, 9, "#9b3041");
  if (warnings.length) cursor += 4;
  for (const course of selected) {
    if (cursor > 170) detailPage();
    const option = input.variant.options.find((o) => o.courseId === course.id)!;
    const sections = option.sectionIds
      .map((id) => course.sections.find((s) => s.id === id)?.label || id)
      .join(" / ");
    paragraph(`${course.code || "Custom"} - ${course.title}`, 11);
    paragraph(
      `${course.ects === null ? "ECTS unknown" : `${course.ects} ECTS`} | Section ${sections}${input.selections[course.id]?.role === "must" ? " | Must take" : ""}`,
      9,
      muted,
    );
    if (course.scheduleStatus === "unknown")
      paragraph(
        "Meeting times unknown - resolve before relying on this timetable.",
        9,
        "#9b3041",
      );
    else if (!option.meetings.length)
      paragraph("No fixed weekly meeting.", 9, muted);
    for (const meeting of [...option.meetings].sort(
      (a, b) => a.day - b.day || a.start - b.start,
    ))
      paragraph(
        `${DAYS[meeting.day]} ${time(meeting.start)}-${time(meeting.end)} | ${meeting.kind} | ${meeting.room || "Room not supplied"}`,
        9,
        muted,
      );
    cursor += 5;
  }
  const blocks = input.blocks.filter((b) => b.enabled);
  if (blocks.length) {
    paragraph("Unavailable periods", 11);
    for (const block of blocks)
      paragraph(
        `${block.label}: ${DAYS[block.day]} ${time(block.start)}-${time(block.end)}`,
        9,
        muted,
      );
    cursor += 4;
  }
  paragraph(
    `${totals.total}${totals.missing.length ? "+ known" : ""} total ECTS (${totals.technical} technical + ${totals.other} other known credits).`,
    10,
  );
  if (totals.missing.length)
    paragraph("Credits unknown: " + totals.missing.join(", "), 9, "#9b3041");
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    text(`${page} / ${doc.getNumberOfPages()}`, 273, 204, 8, muted);
  }
  return doc;
}

export async function saveTimetablePdf(input: TimetablePdfInput) {
  const font = await loadFont();
  const doc = createTimetablePdf(input, font);
  await doc.save("weekly-timetable-2026-fall.pdf", { returnPromise: true });
}
