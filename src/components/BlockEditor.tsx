import { useState } from "react";
import { Modal } from "./Modal";
import {
  DAYS,
  time,
  minutes,
  unavailableSchema,
  type Unavailable,
} from "../domain/types";
export function BlockEditor({
  block,
  onSave,
  onClose,
}: {
  block?: Partial<Unavailable>;
  onSave: (b: Unavailable) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Unavailable>({
    id: crypto.randomUUID(),
    label: "Unavailable",
    day: 0,
    start: 580,
    end: 630,
    enabled: true,
    ...block,
  });
  const [error, setError] = useState("");
  return (
    <Modal
      title={block?.id ? "Edit unavailable time" : "Block unavailable time"}
      onClose={onClose}
    >
      <form
        className="editor-form"
        onSubmit={(e) => {
          e.preventDefault();
          const parsed = unavailableSchema.safeParse(draft);
          if (!parsed.success)
            setError(parsed.error.issues.map((i) => i.message).join(" "));
          else onSave(parsed.data);
        }}
      >
        <div className="form-grid">
          <label className="span-2">
            Label
            <input
              required
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
            />
          </label>
          <label className="span-2">
            Day
            <select
              value={draft.day}
              onChange={(e) =>
                setDraft({ ...draft, day: Number(e.target.value) })
              }
            >
              {DAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label>
            Start
            <input
              required
              type="time"
              value={time(draft.start)}
              onInput={(e) => {
                const start = minutes(e.currentTarget.value);
                setDraft((d) => ({ ...d, start }));
              }}
              onChange={(e) =>
                setDraft({ ...draft, start: minutes(e.target.value) })
              }
            />
          </label>
          <label>
            End
            <input
              required
              type="time"
              value={time(draft.end)}
              onInput={(e) => {
                const end = minutes(e.currentTarget.value);
                setDraft((d) => ({ ...d, end }));
              }}
              onChange={(e) =>
                setDraft({ ...draft, end: minutes(e.target.value) })
              }
            />
          </label>
        </div>
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <div className="modal-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            Save time block
          </button>
        </div>
      </form>
    </Modal>
  );
}
