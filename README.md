# Course Selection Visualizer

A browser-only planner for CMP and AID senior students. It includes 49 courses from the supplied Fall 2026–2027 schedule, including 20 technical electives. Build a fixed must-take timetable, choose acceptable electives, generate every compatible course set, and compare section alternatives.

## Run locally

Install Node.js 22.13 or newer and pnpm 11.19.0. From this directory:

```sh
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173/`. Keep that terminal running while using the app.

```sh
pnpm test       # Scheduling oracle, source-data checks, persistence validation
pnpm build      # TypeScript checks and static production build
pnpm preview    # Serve the production build
```

No API keys, database, login, or backend are needed. Fonts and all application assets use local/system resources.

## Use the planner

1. Mark retakes, projects, outside courses, and any locked electives **Must take**.
2. Mark acceptable technical electives **Willing**. **Exclude** keeps a course out and lets you record a reason, such as already completed.
   Use **Clear must take**, **Clear willing**, or **Clear both** below the selection counts to start the selections again. These apply across the entire catalog, including filtered-out courses; exclusions, course corrections, targets, time blocks, and favorites are preserved. Existing results become outdated until regenerated.
3. Select an exact count, count range, or technical ECTS range. Locked technical electives count toward the goal.
4. Add nontechnical courses with **Add course**. Use one meeting per recurring time block; add sections for alternative schedules.
5. Add unavailable periods with **Add time block** or click an empty calendar period.
6. **Generate** enumerates every matching combination in a background worker. Identical section times count once; different section timetables are grouped under the same course set.
7. Sort, preview, and star timetables. Open **Shortlist**, select up to three, and compare them.
   **Total ECTS: highest first / lowest first** sorts by the sum of all selected courses, using the catalog snapshot from generation. Unknown totals appear last; ties use fewer days and less idle time. Section variants of a single combination have the same ECTS.
8. **Export** opens a complete JSON backup with a download button and a copyable-text fallback for embedded browsers that do not support downloads. **Import** validates a file and asks before replacing the current plan. The printer button produces a clean timetable suitable for Save as PDF in browsers supporting printing.

Browser storage is local to the browser and site address. Use export/import when moving from localhost to GitHub Pages, another browser, or another device. Reset only affects this browser. Generated result lists are recalculated after reloading; shortlisted timetable snapshots are preserved.

## Saved scenarios

Open **Scenarios** in the header, enter a name, and choose **Save current as new**. Each scenario contains the full course catalog with personal corrections and custom courses, selections and section restrictions, elective target, unavailable periods, and favorites. Changes to the active scenario save automatically. Save another named copy before experimenting if you want to keep the current setup unchanged.

Use **Load** to switch scenarios, then generate combinations again. An unnamed working setup is saved as **Previous setup** before switching so it is not lost. Scenarios can be renamed or deleted; deleting the active scenario leaves its working setup open. All scenarios are included in JSON backups. Old backups remain importable. The limit is 50 scenarios, subject to browser storage and the 20 MB planning-file limit; invalid drafts do not overwrite the last valid scenario. Reset plan clears scenarios as well as the current setup.

## Catalog and academic assumptions

The source is `2026-2027 CMP & AID Fall Course Schedule - Schedule.pdf`, supplied by the user. The original PDF is not required at runtime. `src/data/catalog.ts` contains the transcribed data, which was visually compared to both PDF pages.

- Credits use the [old Computer Engineering curriculum](https://cs.hacettepe.edu.tr/_sub_pages/curriculum_ce.html) and the supplied old AIN curriculum status form, checked on 2026-09-12. Current timetable codes are matched to old codes by title; each match is visible in course details. `src/data/curriculum.ts` stores course facts separately from meeting times. No student identifiers, grades, completion history, or private PDF are included in the app.
- AID203 (AIN214) and AID204 (AIN313) are 4 ECTS each. CMP103 (BBM103) is 4; CMP203 (BBM203) and CMP213 (BBM233) are 2 each. CMP301 (BBM301) and CMP361 (BBM371) are 4 each. CMP491 and AID491 are 4, while AID492 is 6.
- The 20 technical electives remain 6 ECTS per lecture, without automatically adding old separate lab credits. CMP432 Distributed Systems has no clear old-course match in the supplied sources, so its 6 ECTS is visibly labeled as an unverified default. AID100 uses AIN101's 2 ECTS based on its introductory role; AID441 uses the related AIN447/AIN427 data-mining courses (both 6 ECTS). These less direct matches are explained in course details and remain editable.
- Courses have no year or curriculum-semester classification. Category filters include technical electives, required courses, projects, laboratories, and nontechnical electives.
- CMP491, AID491, and AID492 are projects, not technical electives. Their displayed weekly project periods follow the PDF. Section and room information absent from the PDF are marked as unspecified.
- CMP422 includes Wednesday's 16:40–18:30 lab as an additional meeting, without separate credit. Other separately coded labs are separately selectable.
- CMP103, CMP203, CMP213, FİZ117, and IST299 have sections with different times. Most lecture sections share times.
- BBM341 and the source's Turkish characters are preserved. BBM341 is 4 ECTS in the [official legacy curriculum](https://cs.hacettepe.edu.tr/_sub_pages/curriculum_ce.html); it is not replaced by the different new CMP341 course. Names missing from the PDF are filled from the curriculum.
- Rooms listed alongside grouped sections follow their order in the PDF. Where instructors are not mapped in the source (including fourth software lab sections), their names remain unknown.
- No prerequisite, curriculum-equivalence, enrollment, quota, or graduation-rule decisions are made. Students select the courses they are eligible and willing to take.

Changes to bundled courses are personal overrides. The default catalog is neutral, so Computer Vision is available to other students; your completed-course exclusion is saved in your own plan.

Reloading updates unedited bundled courses while preserving selections, custom courses, and favorites. For the original v1 catalog, courses with personal time corrections also receive missing credits; explicit credit overrides are preserved. Old imports receive the same migration before the replacement preview. Favorites retain their original snapshot and become outdated when planner inputs change. Use a course's Restore button to remove personal corrections and adopt its current bundled values.

For v2/v3 plans, credits still equal to the previous bundled defaults are upgraded even on courses with time corrections. Different personal credit values remain preserved. Because those versions tracked edits per course rather than per field, a personal credit choice equal to the former default cannot be distinguished from an unchanged default.

## Scheduling and data

`src/domain/engine.ts` uses integer-minute half-open intervals, precomputed option conflicts, and exhaustive backtracking with target pruning. Exact boundary times are compatible. All meetings and enabled unavailable periods are checked. Ordinary ten-minute inter-period breaks are excluded from idle-time metrics.

The worker streams batches and supports cancellation through termination. Incomplete counts are labeled as lower bounds. The search has no hidden top-N limit. Inputs that change during a search cancel it, and previous results are labeled outdated. Very large custom catalogs can still take substantial time and memory; cancellation preserves already received partial results.

Planning files use a versioned, runtime-validated schema and include a catalog snapshot, overrides, selections, target, unavailable periods, and favorites. Imports over 20 MB or with malformed references are rejected without replacing the current plan. Saved favorites retain their course and meeting snapshots and are revalidated against current constraints.

Optional WebMCP tools expose read, batch course selection, and start-generation operations in browsers supporting `document.modelContext`. These use the same planner state as the UI.

## GitHub Pages deployment

1. Create your GitHub repository and push this project to `main` or `master`.
2. In **Settings → Pages → Build and deployment**, select **GitHub Actions**.
3. Run the **Deploy planner to GitHub Pages** workflow (or push to the selected branch).
4. Open the URL shown by the completed deployment job.

The workflow tests and builds the app, derives `BASE_PATH` from GitHub's Pages metadata, and deploys only `dist/`. This supports both a repository subpath and a user/organization root site. Later pushes to `main` or `master` deploy updates. Student plans are not committed or uploaded by the app.

For a local production check under a repository prefix in PowerShell:

```powershell
$env:BASE_PATH='/course-planner/'
pnpm build
pnpm preview
# Open the printed preview URL with /course-planner/ appended.
Remove-Item Env:BASE_PATH
```
