# Course Selection Visualizer

A timetable planner for Hacettepe CMP and AID students.

[Open the app](https://kuntayyilmaz.github.io/course-selection-visualizer/)

## Usage

1. Mark courses **Must take**, **Willing**, or **Excluded**. Use the clear buttons to reset selections.
2. Set an elective count or ECTS target. Must-take technical electives count toward it.
3. Add or edit courses and block unavailable times, then **Generate** conflict-free combinations.
4. Sort results, inspect section variants, and favorite timetables. Compare up to three from **Shortlist**.
5. Use **Scenarios** to save named setups and switch between them. Changes to the active scenario save automatically.

Generate again after changing inputs or loading a scenario. The planner checks timetable conflicts and targets; it does not determine eligibility or graduation requirements.

Plans and scenarios stay in your current browser. **Export / Import** backs them up or transfers them between localhost, the live site, browsers, or devices. **Save PDF** beside the weekly timetable downloads its calendar and course details; **Print** opens the browser's print dialog.

Use the sun/moon button in the header to switch light and dark mode. Your choice is saved in this browser; printed timetables stay light.

## Local development

Requires Node.js 22.13+ and pnpm 11.19.0.

```sh
pnpm install
pnpm dev
```

Open `http://127.0.0.1:5173/`.

```sh
pnpm test      # Run tests
pnpm build     # Check TypeScript and build to dist/
pnpm preview   # Preview the production build
```

Built with React, TypeScript, and Vite. No backend, accounts, or API keys are needed.

## Deployment

GitHub Pages is already configured for this repository. Pushing to `master` or `main` runs the tests, builds the app, and deploys it through GitHub Actions. The workflow sets the site's base path automatically.
