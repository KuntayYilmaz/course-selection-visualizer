import { useState } from "react";
import { Modal } from "./Modal";
import { usePlanner, planningSchema, type Scenario } from "../state/planner";

function ScenarioRow({
  scenario,
  active,
  canLoad,
  onLoad,
  onRename,
  onDelete,
}: {
  scenario: Scenario;
  active: boolean;
  canLoad: boolean;
  onLoad: () => void;
  onRename: (name: string) => string;
  onDelete: () => void;
}) {
  const [name, setName] = useState(scenario.name),
    [renaming, setRenaming] = useState(false),
    [deleting, setDeleting] = useState(false),
    [error, setError] = useState("");
  const p = scenario.snapshot;
  const must = Object.values(p.selections).filter(
    (s) => s.role === "must",
  ).length;
  const willing = Object.values(p.selections).filter(
    (s) => s.role === "willing",
  ).length;
  const target =
    p.target.mode === "exact"
      ? `${p.target.min} electives`
      : `${p.target.min}–${p.target.max} ${p.target.mode === "ects" ? "elective ECTS" : "electives"}`;
  return (
    <article className="scenario-row">
      {renaming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const message = onRename(name);
            setError(message);
            if (!message) setRenaming(false);
          }}
          className="scenario-name-form"
        >
          <label>
            Scenario name
            <input
              autoFocus
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button type="submit">Save name</button>
          <button
            type="button"
            onClick={() => {
              setRenaming(false);
              setError("");
            }}
          >
            Cancel
          </button>
        </form>
      ) : (
        <h3>
          {scenario.name}
          {active && <span className="chip">Active</span>}
        </h3>
      )}
      <p>
        {must} must take · {willing} willing · {target}
      </p>
      <p>
        {p.unavailable.filter((b) => b.enabled).length} time blocks ·{" "}
        {p.favorites.length} favorites ·{" "}
        {p.catalogSnapshot.filter((c) => c.source === "custom").length} custom
        courses
      </p>
      {error && (
        <p role="alert" className="inline-error">
          {error}
        </p>
      )}
      {deleting ? (
        <div className="scenario-delete">
          <p>
            Delete “{scenario.name}”?
            {active
              ? " The current setup will remain open without a name."
              : ""}
          </p>
          <button className="danger" onClick={onDelete}>
            Confirm deletion
          </button>
          <button onClick={() => setDeleting(false)}>Cancel</button>
        </div>
      ) : (
        <div className="scenario-actions">
          <button disabled={active || !canLoad} onClick={onLoad}>
            {active ? "Active" : "Load"}
          </button>
          <button
            onClick={() => {
              setName(scenario.name);
              setRenaming(true);
            }}
          >
            Rename
          </button>
          <button className="danger" onClick={() => setDeleting(true)}>
            Delete
          </button>
        </div>
      )}
    </article>
  );
}

export function Scenarios({
  onClose,
  onLoaded,
}: {
  onClose: () => void;
  onLoaded: () => void;
}) {
  const { plan, dispatch } = usePlanner();
  const [name, setName] = useState(""),
    [error, setError] = useState("");
  const active = plan.scenarios.find((s) => s.id === plan.activeScenarioId);
  const valid = planningSchema.safeParse(plan).success;
  function validateName(name: string, except?: string) {
    if (!name.trim()) return "Enter a scenario name.";
    if (
      plan.scenarios.some(
        (s) =>
          s.id !== except &&
          s.name.toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
      )
    )
      return "A scenario with this name already exists.";
    return "";
  }
  return (
    <Modal title="Saved scenarios" onClose={onClose}>
      <div className="detail-body scenarios-body">
        <p>
          Save a complete setup: course selections, credits and meeting
          corrections, elective target, unavailable time, and favorites.
        </p>
        <p>
          <strong>
            {active ? `Active: ${active.name}` : "Current setup has no name."}
          </strong>
          {active
            ? " Changes to this scenario save automatically."
            : " Loading another scenario first saves this setup as “Previous setup”."}
        </p>
        <form
          className="scenario-name-form"
          onSubmit={(e) => {
            e.preventDefault();
            const message = validateName(name);
            setError(message);
            if (!message && valid && plan.scenarios.length < 50) {
              dispatch({
                type: "save-scenario",
                id: crypto.randomUUID(),
                name,
              });
              setName("");
            }
          }}
        >
          <label>
            New scenario name
            <input
              required
              maxLength={60}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Three electives with retake"
            />
          </label>
          <button
            type="submit"
            disabled={!valid || plan.scenarios.length >= 50}
          >
            Save current as new
          </button>
        </form>
        {error && (
          <p role="alert" className="inline-error">
            {error}
          </p>
        )}
        {!valid && (
          <p role="alert" className="inline-error">
            Correct incomplete fields before saving or switching scenarios.
          </p>
        )}
        {plan.scenarios.length >= 50 && (
          <p role="status">
            Scenario limit reached (50). Delete one before saving another or
            switching from an unnamed setup.
          </p>
        )}
        {plan.scenarios.length === 0 && <p>No saved scenarios yet.</p>}
        {plan.scenarios.map((scenario) => (
          <ScenarioRow
            key={scenario.id}
            scenario={scenario}
            active={scenario.id === plan.activeScenarioId}
            canLoad={
              valid && (!!plan.activeScenarioId || plan.scenarios.length < 50)
            }
            onLoad={() => {
              dispatch({
                type: "load-scenario",
                id: scenario.id,
                fallbackId: crypto.randomUUID(),
              });
              onLoaded();
              onClose();
            }}
            onRename={(name) => {
              const message = validateName(name, scenario.id);
              if (!message)
                dispatch({ type: "rename-scenario", id: scenario.id, name });
              return message;
            }}
            onDelete={() =>
              dispatch({ type: "delete-scenario", id: scenario.id })
            }
          />
        ))}
        <p className="source-note">
          Scenarios are stored in this browser and included in Export/Import.
          Generate again after loading a scenario.
        </p>
      </div>
    </Modal>
  );
}
