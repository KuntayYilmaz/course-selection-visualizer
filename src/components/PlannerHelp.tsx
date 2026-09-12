import { useState } from "react";
import { Info } from "lucide-react";
import { Modal } from "./Modal";

export function PlannerHelp() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="icon-button"
        aria-label="How to use the planner"
        aria-haspopup="dialog"
        title="How to use the planner"
        onClick={() => setOpen(true)}
      >
        <Info size={18} />
      </button>
      {open && (
        <Modal title="How to use the planner" onClose={() => setOpen(false)}>
          <div className="detail-body planner-help">
            <ol>
              <li>
                <strong>Choose courses.</strong> Must take includes a course in
                every result. Willing lets the planner choose from acceptable
                technical electives. Exclude keeps completed or unwanted courses
                out.
              </li>
              <li>
                <strong>Set your target.</strong> Choose an elective count or
                ECTS range. Must-take electives count toward it: one locked
                elective and a target of three adds two willing electives.
              </li>
              <li>
                <strong>Add your constraints.</strong> Add outside courses, edit
                course times or sections, and block unavailable hours.
              </li>
              <li>
                <strong>Generate and compare.</strong> Browse conflict-free
                combinations, sort them, and inspect section variants. Star
                favorites and compare up to three in Shortlist.
              </li>
              <li>
                <strong>Keep or share your work.</strong> Scenarios saves named
                setups. Save PDF downloads the displayed timetable. Export makes
                a JSON backup; Import restores it, replacing the current plan
                and scenarios after confirmation.
              </li>
            </ol>
            <p>
              Your plan autosaves in this browser. Generate again after changing
              inputs or loading a scenario. Clear buttons deselect courses;
              Reset plan also clears saved scenarios and personal edits.
            </p>
            <div className="modal-footer">
              <button className="primary" onClick={() => setOpen(false)}>
                Got it
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
