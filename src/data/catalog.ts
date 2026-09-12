import type { Course, Meeting, Section, Category } from "../domain/types";
import { curriculumMetadata } from "./curriculum";
export const CATALOG_VERSION = "2026-2027-fall-v4-old-credits";
export const SOURCE_NAME =
  "2026-2027 CMP & AID Fall Course Schedule - Schedule.pdf";
const m = (
  day: number,
  start: number,
  end: number,
  room = "",
  kind: Meeting["kind"] = "lecture",
): Meeting => ({ day, start, end, room, kind });
const slots = (
  day: number,
  hour: number,
  count: number,
  room = "",
  kind: Meeting["kind"] = "lecture",
) =>
  Array.from({ length: count }, (_, i) =>
    m(day, (hour + i) * 60 + 40, (hour + i) * 60 + 90, room, kind),
  );
const sections = (
  labels: string[],
  meetings: Meeting[],
  instructors: string[] = [],
  rooms: string[] = [],
): Section[] =>
  labels.map((label, i) => ({
    id: label,
    label,
    instructor: instructors[i] || "",
    meetings: meetings.map((x) => ({ ...x, room: rooms[i] || x.room })),
  }));
function c(
  code: string,
  title: string,
  category: Category,
  secs: Section[],
  department = code.startsWith("AID")
    ? "AID"
    : code.startsWith("CMP") || code.startsWith("BBM")
      ? "CMP"
      : "Shared",
  note = "",
): Course {
  const metadata = curriculumMetadata[code];
  if (!metadata) throw new Error(`Missing curriculum metadata for ${code}`);
  return {
    ...metadata,
    id: code,
    code,
    title: metadata.title ?? title,
    department,
    category,
    scheduleStatus: "scheduled",
    sections: secs,
    source: "pdf",
    sourceNote: note,
  };
}
const lecture = (
  code: string,
  title: string,
  day: number,
  hour: number,
  room: string,
  instructor: string,
) =>
  c(
    code,
    title,
    "technical",
    sections(["01"], slots(day, hour, 3, room), [instructor]),
  );
export const catalog: Course[] = [
  lecture("CMP402", "Theory of Computation", 4, 9, "D10", "Lale Özkahya"),
  lecture("CMP406", "Game Technologies", 0, 9, "SH", "Ufuk Çelikcan"),
  lecture("CMP413", "Microprocessors", 4, 13, "D8", "Harun Artuner"),
  c(
    "CMP422",
    "Computer Networks",
    "technical",
    sections(
      ["01"],
      [...slots(2, 9, 3, "SH"), m(2, 1000, 1110, "", "lab")],
      ["Sevil Şen"],
    ),
    "CMP",
    "Wednesday 16:40–18:30 lab is part of this course; its room is not specified. No separate lab credits.",
  ),
  lecture("CMP424", "Wireless and Mobile Networks", 1, 9, "SH", "Suat Özdemir"),
  lecture("CMP432", "Distributed Systems", 2, 9, "D3", "Adnan Özsoy"),
  lecture("CMP441", "Information Security", 4, 9, "D9", "Murat Aydos"),
  lecture(
    "CMP453",
    "Software Development",
    2,
    13,
    "D10",
    "Ayça Kolukısa Tarhan",
  ),
  lecture("CMP461", "Database Management Systems", 1, 13, "D1", "Engin Demir"),
  lecture(
    "CMP472",
    "Introduction to Machine Learning",
    3,
    9,
    "D10",
    "Hacer Yalım Keleş",
  ),
  lecture(
    "CMP473",
    "Introduction to Image Processing",
    0,
    13,
    "D10",
    "Aydın Kaya",
  ),
  lecture(
    "CMP474",
    "Introduction to Computer Vision",
    1,
    9,
    "D1",
    "Ali Seydi Keçeli",
  ),
  lecture(
    "CMP475",
    "Introduction to Medical Image Analysis",
    2,
    13,
    "SH",
    "Cemil Zalluhoğlu",
  ),
  lecture(
    "CMP476",
    "Introduction to Natural Language Processing",
    3,
    13,
    "D8",
    "İlyas Çiçekli",
  ),
  lecture(
    "CMP478",
    "Introduction to Bioinformatics",
    1,
    13,
    "SH",
    "Tunca Doğan",
  ),
  lecture(
    "AID401",
    "Fundamentals of Computer Vision",
    3,
    9,
    "D8",
    "Nazlı İkizler Cinbiş",
  ),
  lecture(
    "AID421",
    "Fundamentals of Natural Language Processing",
    3,
    13,
    "D9",
    "Özlem Özcan Şimsek",
  ),
  lecture("AID441", "Big Data Analytics and Mining", 2, 13, "D1", "Çağla Acun"),
  lecture("AID443", "Information Retrieval", 4, 9, "D8", "Pınar Duygulu Şahin"),
  lecture(
    "AID466",
    "Introduction to Human Robot Interaction",
    2,
    9,
    "D1",
    "Özgur Erkent",
  ),
  c(
    "CMP491",
    "Design Project I",
    "project",
    sections(["Unspecified"], slots(2, 12, 1, "", "project"), ["Burkay Genç"]),
    "CMP",
    "The PDF places this project at Wednesday 12:40–13:30. Section and room are not specified.",
  ),
  c(
    "AID491",
    "Project I",
    "project",
    sections(["Unspecified"], slots(0, 12, 1, "", "project"), ["Çağla Acun"]),
    "AID",
    "The PDF places this project at Monday 12:40–13:30. Section and room are not specified.",
  ),
  c(
    "AID492",
    "Project II",
    "project",
    sections(["Unspecified"], slots(1, 12, 1, "", "project"), ["Çağla Acun"]),
    "AID",
    "The PDF places this project at Tuesday 12:40–13:30. Section and room are not specified.",
  ),
  c(
    "CMP301",
    "Programming Languages",
    "required",
    sections(
      ["01", "02"],
      slots(3, 9, 3),
      ["Gülden Olgun", "Pınar Duygulu Şahin"],
      ["SH", "D9"],
    ),
  ),
  c(
    "BBM341",
    "Systems Programming",
    "required",
    sections(
      ["01", "02"],
      slots(1, 12, 3),
      ["Harun Artuner", "Kayhan İmre"],
      ["D8", "D9"],
    ),
  ),
  c(
    "CMP361",
    "Data Management",
    "required",
    sections(
      ["01", "02"],
      slots(0, 12, 3),
      ["Engin Demir", "Tuğba Gürgen Erdoğan"],
      ["D8", "D9"],
    ),
  ),
  c(
    "CMP201",
    "Data Structures",
    "required",
    sections(
      ["01", "02", "03"],
      slots(0, 9, 3),
      ["Adnan Özsoy", "Hacer Yalım Keleş", "Özlem Özcan Şimsek"],
      ["D8", "D9", "D10"],
    ),
  ),
  c(
    "CMP203",
    "Software Laboratory I",
    "lab",
    ["01", "02", "03", "04"].map(
      (label, i) =>
        sections([label], slots(4, 13 + i, 1, "Computer Lab", "lab"), [
          ["Adnan Özsoy", "Hacer Yalım Keleş", "Özlem Özcan Şimsek", ""][i],
        ])[0],
    ),
  ),
  c(
    "CMP205",
    "Discrete Structures",
    "required",
    sections(
      ["01", "02", "03"],
      slots(1, 9, 3),
      ["Burkay Genç", "Gülden Olgun", "Lale Özkahya"],
      ["D8", "D9", "D10"],
    ),
  ),
  c(
    "CMP211",
    "Logic Design",
    "required",
    sections(
      ["01", "02"],
      slots(2, 12, 3),
      ["Süleyman Tosun", "Ufuk Çelikcan"],
      ["D8", "D9"],
    ),
  ),
  c("CMP213", "Logic Design Laboratory", "lab", [
    ...sections(["01"], slots(4, 8, 2, "Logic Lab", "lab"), ["Süleyman Tosun"]),
    ...sections(["02"], slots(4, 10, 2, "Logic Lab", "lab"), ["Ufuk Çelikcan"]),
  ]),
  c(
    "AID201",
    "Elements of Data Science",
    "required",
    sections(["01"], slots(2, 9, 3, "D2"), ["Nazlı İkizler Cinbiş"]),
  ),
  c(
    "AID202",
    "Foundations of Machine Learning",
    "required",
    sections(["01"], slots(1, 12, 3, "D10"), ["Erkut Erdem"]),
  ),
  c(
    "AID203",
    "Data Science Laboratory",
    "lab",
    sections(["01"], [m(2, 1000, 1110, "D2", "lab")], ["Nazlı İkizler Cinbiş"]),
  ),
  c(
    "AID204",
    "Machine Learning Laboratory",
    "lab",
    sections(["01"], [m(1, 940, 1050, "D10", "lab")], ["Erkut Erdem"]),
  ),
  c(
    "CMP100",
    "Computer Engineering Orientation",
    "required",
    sections(["01"], slots(1, 12, 1, "M8"), ["Ebru Sezer"]),
  ),
  c(
    "AID100",
    "Artificial Intelligence Orientation",
    "required",
    sections(["01"], slots(1, 12, 1, "SH"), ["Çağla Acun"]),
  ),
  c(
    "CMP101",
    "Introduction to Programming I",
    "required",
    sections(
      ["01", "02", "03"],
      slots(2, 9, 3),
      ["Aydın Kaya", "Selman Bozkır", "Ahmet Rifaioglu"],
      ["D8", "D9", "D10"],
    ),
  ),
  c(
    "CMP103",
    "Introduction to Programming Laboratory I",
    "lab",
    ["01", "02", "03", "04"].map(
      (label, i) =>
        sections([label], slots(3, 12 + i, 1, "Computer Lab", "lab"), [
          ["Aydın Kaya", "Selman Bozkır", "Ahmet Rifaioglu", ""][i],
        ])[0],
    ),
  ),
  c(
    "MAT123",
    "Name not supplied in schedule",
    "required",
    ["01", "10", "14"].map(
      (label, i) =>
        sections(
          [label],
          [
            ...slots(0, 9, 2, ["D1", "D2", "D3"][i]),
            ...slots(3, 9, 2, ["D1", "D2", "D3"][i]),
            ...slots(4, 9, 2, ["M12", "D2", "D3"][i]),
          ],
        )[0],
    ),
  ),
  c(
    "ING111",
    "Name not supplied in schedule",
    "required",
    sections(["86", "87"], slots(0, 13, 3), [], ["D3", "D4"]),
    "Shared",
    "Section 86 is marked CMP; section 87 is marked AID in the PDF.",
  ),
  c(
    "FİZ117",
    "Name not supplied in schedule",
    "required",
    [
      ...sections(["15"], slots(1, 9, 3, "LS1")),
      ...sections(["29"], slots(1, 8, 3, "LS2")),
    ],
    "AID",
  ),
  c(
    "FIZ127",
    "Name not supplied in schedule",
    "required",
    sections(["25", "26"], slots(1, 13, 3), [], ["M13", "D3"]),
  ),
  c(
    "TKD103",
    "Name not supplied in schedule",
    "required",
    sections(["29"], [m(0, 1060, 1170)]),
  ),
  c(
    "MÜH103",
    "Name not supplied in schedule",
    "required",
    sections(["01"], slots(2, 18, 1)),
  ),
  c(
    "MÜH104",
    "Name not supplied in schedule",
    "required",
    sections(["01"], slots(2, 19, 1)),
  ),
  c(
    "AIT203",
    "Name not supplied in schedule",
    "required",
    sections(["70"], slots(0, 12, 2, "M13")),
  ),
  c(
    "İST292",
    "Name not supplied in schedule",
    "required",
    sections(["02"], slots(2, 13, 3, "D3")),
    "AID",
  ),
  c("IST299", "Name not supplied in schedule", "required", [
    ...sections(["03"], slots(3, 9, 3, "D4")),
    ...sections(["04"], slots(3, 13, 3, "D2")),
  ]),
];
