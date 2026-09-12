import type { Course } from "../domain/types";
export const OLD_CS_CURRICULUM =
  "https://cs.hacettepe.edu.tr/_sub_pages/curriculum_ce.html";
type Metadata = Pick<Course, "ects"> & {
  title?: string;
  curriculum: NonNullable<Course["curriculum"]>;
};
function entry(
  ects: number,
  oldCode: string,
  source: "CS" | "AIN",
  title?: string,
  matchNote?: string,
): Metadata {
  return {
    ects,
    ...(title ? { title } : {}),
    curriculum: {
      sources: source === "CS" ? [OLD_CS_CURRICULUM] : [],
      checkedAt: "2026-09-12",
      label:
        source === "CS"
          ? "Old Computer Engineering curriculum"
          : "Old AIN curriculum status form (supplied PDF)",
      matchedCode: oldCode,
      basis: "matched",
      matchNote:
        matchNote ??
        "Credits matched by course title; this is not an official course-equivalence decision.",
    },
  };
}
// Only academic facts are retained. No identifiers, grades, student completion
// status, or private document are bundled. Current timetable IDs stay unchanged.
export const curriculumMetadata: Record<string, Metadata> = {
  CMP100: entry(2, "BBM105", "CS"),
  AID100: entry(
    2,
    "AIN101",
    "AIN",
    undefined,
    "Orientation is matched to the old seminar course AIN101 by its introductory role. Confirm this title-based match if needed.",
  ),
  CMP101: entry(6, "BBM101", "CS"),
  CMP103: entry(4, "BBM103", "CS"),
  MAT123: entry(6, "MAT123", "CS", "Mathematics I"),
  ING111: entry(3, "İNG111", "CS", "Language Skills I"),
  FİZ117: entry(2, "FİZ117", "AIN", "General Physics Laboratory"),
  FIZ127: entry(5, "FİZ127", "CS", "Physics I"),
  TKD103: entry(2, "TKD103", "CS", "Turkish I"),
  CMP201: entry(5, "BBM201", "CS"),
  CMP203: entry(2, "BBM203", "CS"),
  CMP205: entry(5, "BBM205", "CS"),
  CMP211: entry(5, "BBM231", "CS"),
  CMP213: entry(2, "BBM233", "CS"),
  AID201: entry(6, "AIN212", "AIN"),
  AID203: entry(4, "AIN214", "AIN"),
  AID202: entry(6, "AIN311", "AIN"),
  AID204: entry(4, "AIN313", "AIN"),
  IST299: entry(5, "İST299", "CS", "Probability"),
  İST292: entry(5, "İST292", "AIN", "Statistics"),
  CMP301: entry(4, "BBM301", "CS"),
  CMP361: entry(4, "BBM371", "CS"),
  BBM341: entry(4, "BBM341", "CS"),
  AIT203: entry(
    2,
    "AİT203",
    "AIN",
    "Atatürk's Principles and History of the Turkish Revolution I",
  ),
  CMP491: entry(4, "BBM479", "CS"),
  AID491: entry(4, "AIN479", "AIN"),
  AID492: entry(6, "AIN480", "AIN"),
  MÜH103: entry(1, "MÜH103", "CS", "Occupational Health and Safety I"),
  MÜH104: entry(1, "MÜH104", "CS", "Occupational Health and Safety II"),
  CMP402: entry(6, "BBM402", "CS"),
  CMP406: entry(6, "BBM421", "CS"),
  CMP413: entry(6, "BBM433", "CS"),
  CMP422: entry(
    6,
    "BBM451",
    "CS",
    undefined,
    "6 ECTS for the lecture. Its Wednesday meeting remains included; no separate old laboratory credits are added automatically.",
  ),
  CMP424: entry(6, "BBM458", "CS"),
  CMP432: {
    ects: 6,
    curriculum: {
      sources: [],
      checkedAt: "2026-09-12",
      label: "Technical-elective default",
      basis: "default",
      matchNote:
        "No clear Distributed Systems match was found in the supplied old curricula. 6 ECTS is an unverified default; edit it if your registration record differs.",
    },
  },
  CMP441: entry(6, "BBM463", "CS"),
  CMP453: entry(6, "BBM481", "CS"),
  CMP461: entry(6, "BBM471", "CS"),
  CMP472: entry(6, "BBM406", "CS"),
  CMP473: entry(6, "BBM413", "CS"),
  CMP474: entry(6, "BBM416", "CS"),
  CMP475: entry(6, "AIN412", "AIN"),
  CMP476: entry(6, "BBM495", "CS"),
  CMP478: entry(6, "BBM411", "CS"),
  AID401: entry(6, "AIN431", "AIN"),
  AID421: entry(6, "AIN440", "AIN"),
  AID441: entry(
    6,
    "AIN447 / AIN427",
    "AIN",
    undefined,
    "Matched to the old data-mining courses, both 6 ECTS. The new Big Data Analytics and Mining title is broader; formal equivalence is not established.",
  ),
  AID443: entry(6, "AIN428", "AIN"),
  AID466: entry(6, "AIN455", "AIN"),
};
// v2/v3 defaults let migration distinguish unchanged credits from overrides.
export const previousCurriculumCredits: Record<string, number> =
  Object.fromEntries(
    Object.entries(curriculumMetadata).map(([code, m]) => [code, m.ects!]),
  );
Object.assign(previousCurriculumCredits, {
  AID100: 1,
  CMP103: 3,
  CMP203: 3,
  CMP213: 3,
  AID203: 2,
  AID204: 2,
  CMP301: 5,
  CMP361: 6,
  AID491: 6,
});
