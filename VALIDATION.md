# Verification record

## Dark mode — 13 September 2026

- Production build and all 42 project regression tests passed.
- Isolated Edge browser checks passed for the light/dark toggle, keyboard activation, persistence after reload, preservation of course selections, system theme on first visit, and switching when browser storage is blocked.
- Visually inspected dark desktop (1440 × 1000), mobile (375 × 812), scenarios dialog, generated results, and course editor. Mobile page has no horizontal overflow; the timetable retains its internal horizontal scrolling.
- Print-media inspection confirmed the light text, backgrounds, and original course palette while dark mode remained selected. No browser console errors occurred in the theme checks.

Verified locally on 12 September 2026.

- Production build: TypeScript and Vite build passed.
- Automated suite: 42 tests passed. Includes 80 seeded comparisons against an independent exhaustive reference, 16,384 streamed combinations, course-data checks, section grouping, credit targets, conflict explanations, snapshot isolation, backup validation, credit migration, old-backup compatibility, selection clearing, ECTS sorting, and saved scenarios.
- Scenarios: verified independent full setups, autosave, recovery of unnamed work, rename/delete, corrupt nested snapshots, pre-scenario backups, and export/reset/import restoration. Invalid drafts retain the last valid saved scenario. TypeScript and the production build passed. New scenario controls have not been separately browser-tested.
- Curriculum update: credits now use the old CS curriculum and supplied AIN status form. Name-based mappings are recorded in course details; CMP432 retains a labeled unverified default. AIN lab/project rows were visually checked. The migration test verifies 24 ECTS for the two AIN lecture/lab pairs plus Project I and preserves personal schedule corrections. Course-year fields, labels, filters, and curriculum-placement notes have been removed; old backups discard these obsolete fields. Build and local HTTP preview passed; this update's UI changes were not separately browser-tested. The browser checks below describe the original app acceptance run.
- PDF data: 49 courses, including 20 technical electives, visually reviewed against both pages. Different lab sections, repeated weekly meetings, evening periods, and CMP422's additional lab are represented.
- Browser scenario: a retake, project, locked elective, excluded Computer Vision, five optional electives, and a custom nontechnical course with two meetings produced 10 combinations for a three-elective target.
- Availability: blocking Wednesday 16:40–18:30 removed combinations containing CMP422, leaving six in that scenario.
- Shortlist: three favorites could be compared, with shared/different courses, credit totals, and time metrics visible.
- Persistence: reload retained selections; reset cleared the plan; malformed JSON was rejected without replacing the plan; a complete imported backup restored the custom course and three favorites and reproduced 10 combinations.
- Responsive UI: checked at 1440 × 1000 and 390 × 844. Mobile navigation switches between courses, timetable, and results. The weekly grid scrolls horizontally on narrow screens to keep course blocks readable.
- GitHub Pages compatibility: the production app was served at `/course-planner/`; assets and the background worker loaded, and generation produced the expected 10 combinations.
- WebMCP: read, batch selection, and start-generation tools registered in the browser. Invalid batch input was rejected before any selection changed.
- Test data was cleared from both browser origins; the delivered local app opens with the neutral 49-course catalog.

## Browser-specific limits of verification

The Codex in-app preview did not expose a download event for the standard JSON download. The export payload was inspected and verified, and the app includes a copyable JSON fallback. Native file downloads and the print dialog should be used in a regular browser; print styles are included, but an actual printed PDF was not inspected in this environment.

The GitHub Actions workflow runs the tests and production build before deploying. Check its latest run for remote deployment status.
