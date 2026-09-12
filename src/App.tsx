import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  Download,
  Upload,
  Printer,
  RotateCcw,
  Star,
  ArrowLeft,
  ArrowRight,
  Check,
  LockKeyhole,
  Info,
  FolderOpen,
  FileDown,
} from "lucide-react";
import {
  PlannerProvider,
  usePlanner,
  toInput,
  parsePlanningFile,
  migrateCatalog,
  createFavorite,
  type PlanningFile,
  type Favorite,
} from "./state/planner";
import {
  inputKey,
  provisional,
  mergeSolutions,
  bestVariant,
  compareVariants,
  sortGroups,
  credits,
  validateVariant,
} from "./domain/engine";
import {
  type Course,
  type ResultGroup,
  type SearchEvent,
  type SortMode,
  type Unavailable,
  type Variant,
} from "./domain/types";
import { Catalog } from "./components/Catalog";
import { PlannerControls } from "./components/PlannerControls";
import { Timetable, courseColor } from "./components/Timetable";
import { Results } from "./components/Results";
import { CourseEditor } from "./components/CourseEditor";
import { CourseDetails } from "./components/CourseDetails";
import { BlockEditor } from "./components/BlockEditor";
import { Modal } from "./components/Modal";
import { Comparison } from "./components/Comparison";
import { Scenarios } from "./components/Scenarios";
import { useWebMCP } from "./webmcp";
import { ThemeToggle } from "./components/ThemeToggle";

function Planner() {
  const { plan, dispatch, storageError } = usePlanner();
  const input = useMemo(
    () => toInput(plan),
    [plan.catalogSnapshot, plan.selections, plan.target, plan.unavailable],
  );
  const key = useMemo(() => inputKey(input), [input]);
  const baseline = useMemo(() => provisional(input), [input]);
  const [groups, setGroups] = useState<ResultGroup[]>([]),
    [generationInput, setGenerationInput] = useState(input),
    [generationKey, setGenerationKey] = useState("");
  const groupMap = useRef(new Map<string, ResultGroup>());
  const worker = useRef<Worker | null>(null);
  const [running, setRunning] = useState(false),
    [complete, setComplete] = useState(false),
    [cancelled, setCancelled] = useState(false),
    [visited, setVisited] = useState(0),
    [issues, setIssues] = useState<string[]>([]);
  const [sort, setSort] = useState<SortMode>("days"),
    [page, setPage] = useState(0),
    [activeId, setActiveId] = useState(""),
    [variantId, setVariantId] = useState("");
  const [shortlistOnly, setShortlistOnly] = useState(false),
    [favoriteView, setFavoriteView] = useState<Favorite | null>(null),
    [compareIds, setCompareIds] = useState<string[]>(() =>
      plan.favorites.slice(0, 3).map((f) => f.id),
    ),
    [comparing, setComparing] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null),
    [editor, setEditor] = useState<{ course?: Course } | null>(null),
    [blockEditor, setBlockEditor] = useState<Partial<Unavailable> | null>(null);
  const [confirmation, setConfirmation] = useState<{
      title: string;
      body: string;
      action: () => void;
    } | null>(null),
    [importPreview, setImportPreview] = useState<PlanningFile | null>(null),
    [exportPreview, setExportPreview] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  const [tab, setTab] = useState("calendar");
  const [scenariosOpen, setScenariosOpen] = useState(false);
  const [savingPdf, setSavingPdf] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const stale = !!generationKey && generationKey !== key;
  useEffect(() => () => worker.current?.terminate(), []);
  useEffect(() => {
    if (running && stale) {
      worker.current?.terminate();
      worker.current = null;
      setRunning(false);
      setCancelled(true);
    }
  }, [key, running, stale]);
  useEffect(() => {
    setCompareIds((ids) =>
      ids.filter((id) => plan.favorites.some((f) => f.id === id)),
    );
  }, [plan.favorites]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(t);
  }, [notice]);
  function generate() {
    worker.current?.terminate();
    groupMap.current = new Map();
    setGroups([]);
    setIssues([]);
    setRunning(true);
    setComplete(false);
    setCancelled(false);
    setVisited(0);
    setGenerationKey(key);
    setGenerationInput(structuredClone(input));
    setActiveId("");
    setVariantId("");
    setPage(0);
    setFavoriteView(null);
    setShortlistOnly(false);
    try {
      const w = new Worker(new URL("./workers/scheduler.ts", import.meta.url), {
        type: "module",
      });
      worker.current = w;
      w.onmessage = (
        e: MessageEvent<SearchEvent | { type: "error"; message: string }>,
      ) => {
        if (worker.current !== w) return;
        const event = e.data;
        if (event.type === "error") {
          setIssues([event.message]);
          setRunning(false);
          setCancelled(true);
          w.terminate();
          worker.current = null;
          return;
        }
        mergeSolutions(groupMap.current, event.solutions);
        setGroups([...groupMap.current.values()]);
        setVisited(event.visited);
        if (event.type === "done") {
          setComplete(true);
          setIssues(event.issues);
          setRunning(false);
          w.terminate();
          worker.current = null;
        }
      };
      w.onerror = () => {
        setIssues([
          "The background search could not finish. Try generating again.",
        ]);
        setRunning(false);
        setCancelled(true);
        w.terminate();
        worker.current = null;
      };
      w.postMessage(input);
    } catch (error) {
      setRunning(false);
      setCancelled(true);
      setIssues([
        error instanceof Error
          ? error.message
          : "Could not start the background search.",
      ]);
    }
  }
  function cancel() {
    worker.current?.terminate();
    worker.current = null;
    setRunning(false);
    setCancelled(true);
  }
  useWebMCP(input, dispatch, generate);
  const ordered = useMemo(
    () => sortGroups(groups, sort, generationInput.catalog),
    [groups, sort, generationInput.catalog],
  );
  const active = groups.find((g) => g.id === activeId) || ordered[0];
  const resultVariant =
    active?.variants.find((v) => v.id === variantId) ||
    (active ? bestVariant(active, sort) : undefined);
  const displayed = favoriteView?.variant || resultVariant || baseline.variant;
  const displayedCatalog =
    favoriteView?.courses ||
    (resultVariant ? generationInput.catalog : plan.catalogSnapshot);
  const displayInput = favoriteView
    ? input
    : resultVariant
      ? generationInput
      : input;
  const displayedCourses = displayed.options
    .map((o) => displayedCatalog.find((c) => c.id === o.courseId))
    .filter((c): c is Course => !!c);
  const totals = credits(displayedCourses);
  const selectedIndex = active
    ? ordered.findIndex((g) => g.id === active.id)
    : -1;
  function select(id: string) {
    setActiveId(id);
    setVariantId("");
    setFavoriteView(null);
  }
  function favorite(g: ResultGroup, v: Variant) {
    if (plan.favorites.some((f) => f.id === v.id)) {
      dispatch({ type: "remove-favorite", id: v.id });
      if (favoriteView?.id === v.id) setFavoriteView(null);
      return;
    }
    const cs = g.courseIds
      .map((id) => generationInput.catalog.find((c) => c.id === id))
      .filter((c): c is Course => !!c);
    const f = createFavorite(
      cs,
      v,
      generationInput,
      `Plan ${plan.favorites.length + 1}`,
    );
    dispatch({ type: "favorite", favorite: f });
    setCompareIds((ids) => (ids.length < 3 ? [...ids, f.id] : ids));
    setNotice("Timetable added to your shortlist.");
  }
  function resetTransient() {
    cancel();
    setGroups([]);
    setGenerationKey("");
    setComplete(false);
    setCancelled(false);
    setIssues([]);
    setFavoriteView(null);
    setCompareIds([]);
    setActiveId("");
    setVariantId("");
  }
  function exportPlan() {
    const raw = JSON.stringify(plan, null, 2);
    try {
      parsePlanningFile(raw);
      setExportPreview(raw);
    } catch {
      setNotice(
        "Correct incomplete or invalid fields before exporting this plan.",
      );
    }
  }
  function downloadBackup() {
    if (!exportPreview) return;
    const blob = new Blob([exportPreview], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "course-plan-2026-fall.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20_000_000)
        throw new Error("This planning file exceeds 20 MB.");
      setImportPreview(migrateCatalog(parsePlanningFile(await file.text())));
    } catch (error) {
      setNotice(
        `Import rejected; your current plan is unchanged. ${error instanceof Error ? error.message : "Invalid file."}`,
      );
    }
    if (fileRef.current) fileRef.current.value = "";
  }
  const detail = plan.catalogSnapshot.find((c) => c.id === detailId);
  const displayIssues = favoriteView
    ? validateVariant(favoriteView.variant, input)
    : resultVariant
      ? issues
      : baseline.issues;
  async function savePdf() {
    if (savingPdf) return;
    setSavingPdf(true);
    const outdated = favoriteView ? favoriteView.inputKey !== key : stale;
    const status = favoriteView
      ? `Saved timetable${outdated ? " - outdated snapshot" : ""}`
      : resultVariant
        ? `Generated timetable${outdated ? " - inputs changed" : !complete ? " - search incomplete" : ""}`
        : `Must-take preview${baseline.hasAlternatives ? " - provisional sections" : ""}`;
    const snapshot = structuredClone({
      courses: displayedCatalog,
      variant: displayed,
      selections: displayInput.selections,
      blocks: favoriteView ? [] : displayInput.unavailable,
      title:
        favoriteView?.name ||
        (resultVariant ? `Timetable ${selectedIndex + 1}` : "Weekly timetable"),
      status,
      issues: [
        ...displayIssues,
        ...(outdated
          ? [
              "This is an older timetable snapshot. Regenerate or revalidate it against your current plan.",
            ]
          : []),
      ],
    });
    try {
      const { saveTimetablePdf } = await import("./domain/timetablePdf");
      await saveTimetablePdf(snapshot);
    } catch (error) {
      setNotice(
        `PDF download failed. ${error instanceof Error ? error.message : "Please try again."} You can also use Print timetable and choose Save as PDF in your browser.`,
      );
    } finally {
      setSavingPdf(false);
    }
  }
  return (
    <>
      <header className="app-header">
        <div className="brand-icon">
          <CalendarDays size={23} />
        </div>
        <div>
          <h1>
            Course Selection <span>Visualizer</span>
          </h1>
          <p>CMP & AID · Fall 2026–2027</p>
        </div>
        <div className="header-right">
          <ThemeToggle />
          <button
            onClick={() => setScenariosOpen(true)}
            title="Saved scenarios"
            aria-label="Saved scenarios"
          >
            <FolderOpen size={16} />
            <span>Scenarios ({plan.scenarios.length})</span>
          </button>
          <span className="local-tag">
            <Check size={12} />{" "}
            {storageError ? "Session only" : "Autosaves on this device"}
          </span>
          <button onClick={exportPlan} title="Export a planning file">
            <Download size={16} />
            <span>Export</span>
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            title="Import a planning file"
          >
            <Upload size={16} />
            <span>Import</span>
          </button>
          <button
            className="icon-button"
            aria-label="Reset plan"
            title="Reset plan"
            onClick={() =>
              setConfirmation({
                title: "Reset your plan?",
                body: "Your selections, custom courses, corrections, unavailable periods, shortlist, and all saved scenarios will be cleared. Export a backup first if you want to keep them.",
                action: () => {
                  resetTransient();
                  dispatch({ type: "reset" });
                },
              })
            }
          >
            <RotateCcw size={16} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            aria-label="Import planning file"
            onChange={(e) => void importFile(e.target.files?.[0])}
          />
        </div>
      </header>
      <div className="intro planner-instructions">
        <p>Select courses, set an elective target, then generate timetables.</p>
        {plan.activeScenarioId && (
          <button
            className="text-button"
            onClick={() => setScenariosOpen(true)}
          >
            Scenario:{" "}
            {plan.scenarios.find((s) => s.id === plan.activeScenarioId)?.name}
          </button>
        )}
      </div>
      {storageError && (
        <div className="global-alert" role="alert">
          {storageError} <button onClick={exportPlan}>Export backup</button>
        </div>
      )}
      <nav className="mobile-tabs" aria-label="Planner view">
        {[
          ["courses", "Courses"],
          ["calendar", "Timetable"],
          ["results", "Results"],
        ].map(([id, label]) => (
          <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
            {id === "results" && groups.length > 0 ? ` (${groups.length})` : ""}
          </button>
        ))}
      </nav>
      <main className={`workspace show-${tab}`}>
        <div className="catalog-column">
          <Catalog
            onAdd={() => setEditor({})}
            onDetail={(c) => setDetailId(c.id)}
          />
        </div>
        <section className="center-column">
          <PlannerControls
            running={running}
            onGenerate={generate}
            onCancel={cancel}
            onBlock={(b) => setBlockEditor(b || {})}
          />
          <section className="panel calendar-panel">
            <div className="panel-heading calendar-heading">
              <div>
                <div className="calendar-eyebrow">
                  {favoriteView
                    ? "SAVED TIMETABLE"
                    : resultVariant
                      ? "GENERATED RESULT"
                      : "MUST-TAKE PREVIEW"}
                </div>
                <h3>
                  {favoriteView
                    ? favoriteView.name
                    : resultVariant
                      ? `Timetable ${selectedIndex + 1} of ${ordered.length}`
                      : "Weekly timetable"}
                </h3>
                <p>
                  {favoriteView
                    ? "Saved course and meeting snapshot"
                    : resultVariant
                      ? "Every must-take course, with compatible electives"
                      : baseline.hasAlternatives
                        ? "Provisional sections · generation checks all allowed alternatives"
                        : "Your must-take courses appear here"}
                </p>
              </div>
              <div className="calendar-actions">
                <button
                  onClick={() => void savePdf()}
                  disabled={savingPdf || !displayedCourses.length}
                  aria-label="Save weekly timetable as PDF"
                  aria-busy={savingPdf}
                  title="Download the displayed timetable as a PDF"
                >
                  <FileDown size={17} />
                  {savingPdf ? "Saving..." : "Save PDF"}
                </button>
                {resultVariant && active && !favoriteView && (
                  <button
                    className={`icon-button ${plan.favorites.some((f) => f.id === resultVariant.id) ? "starred" : ""}`}
                    aria-label="Shortlist displayed timetable"
                    onClick={() => favorite(active, resultVariant)}
                  >
                    <Star
                      size={17}
                      fill={
                        plan.favorites.some((f) => f.id === resultVariant.id)
                          ? "currentColor"
                          : "none"
                      }
                    />
                  </button>
                )}
                <button
                  className="icon-button"
                  aria-label="Print timetable"
                  onClick={() => window.print()}
                >
                  <Printer size={17} />
                </button>
              </div>
            </div>
            {stale && !favoriteView && !!resultVariant && (
              <div className="calendar-banner">
                Inputs changed. This is the previous result; generate again to
                apply your changes.
              </div>
            )}
            {favoriteView && favoriteView.inputKey !== key && (
              <div className="calendar-banner">
                Saved snapshot is outdated.{" "}
                {displayIssues.length
                  ? "Review the issues below."
                  : "It is still compatible with your current constraints."}
              </div>
            )}
            {displayIssues.length > 0 && (
              <div className="conflict-box" role="alert">
                <b>
                  {resultVariant || favoriteView
                    ? "Review this plan"
                    : "Resolve these constraints"}
                </b>
                <ul>
                  {displayIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
            {!resultVariant &&
              issues.filter((i) => !displayIssues.includes(i)).length > 0 && (
                <div className="conflict-box" role="alert">
                  <b>No matching combination</b>
                  <ul>
                    {issues
                      .filter((i) => !displayIssues.includes(i))
                      .map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                  </ul>
                </div>
              )}
            {!!active && resultVariant && !favoriteView && (
              <div className="variant-toolbar">
                <label>
                  Section timetable
                  <select
                    aria-label="Section timetable"
                    value={resultVariant.id}
                    onChange={(e) => setVariantId(e.target.value)}
                  >
                    {[...active.variants]
                      .sort((a, b) => compareVariants(a, b, sort))
                      .map((v, i) => (
                        <option key={v.id} value={v.id}>
                          Variant {i + 1} · {v.metrics.days} days ·{" "}
                          {v.metrics.idle}m gaps
                        </option>
                      ))}
                  </select>
                </label>
                <div className="timetable-navigation">
                  <button
                    aria-label="Previous timetable"
                    disabled={selectedIndex <= 0}
                    onClick={() => select(ordered[selectedIndex - 1].id)}
                  >
                    <ArrowLeft size={14} />
                  </button>
                  <button
                    aria-label="Next timetable"
                    disabled={selectedIndex >= ordered.length - 1}
                    onClick={() => select(ordered[selectedIndex + 1].id)}
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
            <Timetable
              courses={displayedCatalog}
              variant={displayed}
              selections={displayInput.selections}
              blocks={favoriteView ? [] : displayInput.unavailable}
              onCourse={(c) => {
                if (plan.catalogSnapshot.some((x) => x.id === c.id))
                  setDetailId(c.id);
                else
                  setNotice(
                    "This saved course no longer exists in your current catalog.",
                  );
              }}
              onBlock={(b) => setBlockEditor(b)}
              onSlot={(day, start, end) => setBlockEditor({ day, start, end })}
            />
            <div className="calendar-legend">
              <span>
                <LockKeyhole size={12} /> Must take
              </span>
              <span>
                <i className="legend-elective" /> Elective
              </span>
              <span>
                <i className="legend-block" /> Unavailable
              </span>
              <span className="break-note">50 min classes · 10 min breaks</span>
            </div>
            <div className="credit-strip">
              <div>
                <strong>{totals.technicalCount}</strong>
                <span>technical electives</span>
              </div>
              <div>
                <strong>
                  {totals.technical}
                  <small> ECTS</small>
                </strong>
                <span>technical credits</span>
              </div>
              <div>
                <strong>
                  {totals.other}
                  <small> ECTS</small>
                </strong>
                <span>other known credits</span>
              </div>
              <div className="total-credit">
                <strong>
                  {totals.total}
                  <small> ECTS</small>
                </strong>
                <span>
                  {totals.missing.length ? "known subtotal" : "total credits"}
                </span>
              </div>
            </div>
            {totals.missing.length > 0 && (
              <p className="missing-credits">
                <Info size={14} /> Credits not supplied:{" "}
                {totals.missing.join(", ")}. Edit these courses to complete the
                total.
              </p>
            )}
            <div className="selected-course-list">
              {displayedCourses.map((c) => (
                <div className="selected-course" key={c.id}>
                  <i style={{ background: courseColor(c.id)[1] }} />
                  <b>{c.code || "Custom"}</b>
                  <span>{c.title}</span>
                  <small>{c.ects === null ? "?" : c.ects} ECTS</small>
                </div>
              ))}
            </div>
            <div className="print-note">
              Fall 2026–2027 ·{" "}
              {favoriteView
                ? "Saved timetable"
                : resultVariant
                  ? "Generated timetable"
                  : "Must-take preview"}
              {stale
                ? " · Previous inputs; regenerate before relying on this timetable"
                : ""}
              {displayIssues.length ? " · Contains unresolved issues" : ""}
            </div>
          </section>
          <p className="planner-footnote">
            <Info size={13} /> Course times from the supplied CMP & AID
            schedule. Credits and course details are editable.
          </p>
        </section>
        <div className="results-column">
          <Results
            groups={ordered}
            catalog={generationInput.catalog}
            activeId={active?.id || ""}
            onSelect={select}
            sort={sort}
            onSort={(s) => {
              setSort(s);
              setPage(0);
              setVariantId("");
            }}
            page={page}
            onPage={setPage}
            running={running}
            visited={visited}
            complete={complete}
            cancelled={cancelled}
            stale={stale}
            favorites={plan.favorites}
            shortlistOnly={shortlistOnly}
            onShortlistOnly={setShortlistOnly}
            onFavorite={favorite}
            onViewFavorite={(f) => setFavoriteView(f)}
            compareIds={compareIds}
            onCompareIds={setCompareIds}
            onCompare={() => setComparing(true)}
            input={input}
          />
        </div>
      </main>
      {scenariosOpen && (
        <Scenarios
          onClose={() => setScenariosOpen(false)}
          onLoaded={() => {
            resetTransient();
            setNotice("Scenario loaded. Generate to calculate combinations.");
          }}
        />
      )}
      {detail && (
        <CourseDetails
          course={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEditor({ course: detail });
            setDetailId(null);
          }}
          onConfirm={(title, body, action) =>
            setConfirmation({ title, body, action })
          }
        />
      )}
      {editor && (
        <CourseEditor
          course={editor.course}
          initialRole={
            editor.course ? plan.selections[editor.course.id]?.role : undefined
          }
          onClose={() => setEditor(null)}
          onSave={(course, role) => {
            dispatch({ type: "course", course, role });
            setEditor(null);
            setNotice("Course saved to your plan.");
          }}
        />
      )}
      {blockEditor && (
        <BlockEditor
          block={blockEditor}
          onClose={() => setBlockEditor(null)}
          onSave={(block) => {
            dispatch({ type: "block", block });
            setBlockEditor(null);
          }}
        />
      )}
      {confirmation && (
        <Modal title={confirmation.title} onClose={() => setConfirmation(null)}>
          <div className="detail-body">
            <p>{confirmation.body}</p>
            <div className="modal-footer">
              <button onClick={() => setConfirmation(null)}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  confirmation.action();
                  setConfirmation(null);
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </Modal>
      )}
      {importPreview && (
        <Modal
          title="Review planning file"
          onClose={() => setImportPreview(null)}
        >
          <div className="detail-body">
            <p>
              This file contains {importPreview.catalogSnapshot.length} courses,{" "}
              {
                Object.values(importPreview.selections).filter(
                  (s) => s.role === "must",
                ).length
              }{" "}
              must-take selections, {importPreview.unavailable.length}{" "}
              unavailable periods, and {importPreview.favorites.length} saved
              timetables, plus {importPreview.scenarios.length} saved scenarios.
            </p>
            <p className="source-note">
              Importing replaces your current plan. Older bundled courses are
              updated to the current catalog, preserving custom courses and
              personal corrections. Saved timetables retain their snapshots.
            </p>
            <div className="modal-footer">
              <button onClick={() => setImportPreview(null)}>Cancel</button>
              <button
                className="primary"
                onClick={() => {
                  resetTransient();
                  dispatch({ type: "import", plan: importPreview });
                  setCompareIds(
                    importPreview.favorites.slice(0, 3).map((f) => f.id),
                  );
                  setImportPreview(null);
                  setNotice(
                    "Planning file imported. Generate to calculate combinations.",
                  );
                }}
              >
                Replace current plan
              </button>
            </div>
          </div>
        </Modal>
      )}
      {comparing && compareIds.length > 0 && (
        <Comparison
          favorites={plan.favorites.filter((f) => compareIds.includes(f.id))}
          input={input}
          onClose={() => setComparing(false)}
        />
      )}
      {exportPreview && (
        <Modal
          title="Export your planning file"
          onClose={() => setExportPreview(null)}
        >
          <div className="detail-body">
            <p>
              Download a complete backup to move your courses and shortlist to
              another browser or GitHub Pages.
            </p>
            <details className="backup-text">
              <summary>Copy the JSON instead</summary>
              <p>
                If your browser does not support downloads, copy this text into
                a file ending in .json.
              </p>
              <textarea
                aria-label="Planning file JSON"
                readOnly
                value={exportPreview}
                rows={8}
                onFocus={(e) => e.target.select()}
              />
            </details>
            <div className="modal-footer">
              <button onClick={() => setExportPreview(null)}>Close</button>
              <button className="primary" onClick={downloadBackup}>
                <Download size={16} /> Download JSON
              </button>
            </div>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
export default function App() {
  return (
    <PlannerProvider>
      <Planner />
    </PlannerProvider>
  );
}
