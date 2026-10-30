import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deleteAppData } from "./deleteAppData";

export default function DeleteData() {
    const id = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [confirmation, setConfirmation] = useState("");
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState("");

    async function removeData() {
        if (confirmation !== "RESET" || deleting) return;
        setDeleting(true);
        setError("");
        try {
            await deleteAppData();
            window.location.reload();
        } catch {
            setError("Could not reset the app. Some data may already have been deleted. Please try again.");
            setDeleting(false);
        }
    }

    return <div className="settings-danger-zone">
        <h2>Reset app</h2>
        <p>Restore the app to its original settings.</p>
        <button type="button" className="danger-outline-button" onClick={() => {
            setConfirmation("");
            setError("");
            dialogRef.current?.showModal();
        }}>Reset app…</button>
        {createPortal(<dialog ref={dialogRef} className="passage-picker delete-data-dialog"
            aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
            onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}
            onCancel={event => { if (deleting) event.preventDefault(); }}
            onClick={event => event.stopPropagation()}>
            <div className="delete-data-heading">
                <span className="material-icons" aria-hidden="true">warning</span>
                <h2 id={`${id}-title`}>Reset app?</h2>
            </div>
            <div className="passage-picker-panel delete-data-content">
                <p id={`${id}-description`}><strong>This cannot be undone.</strong> The app will be reset to its defaults, and your streak and all saved data on this device will be lost.</p>
                <p>This includes your reading progress, notes, saved PDFs, playlists, and settings. Close other open tabs of this app before deleting.</p>
                <label htmlFor={`${id}-confirm`}>Type <strong>RESET</strong> to confirm</label>
                <input id={`${id}-confirm`} type="text" value={confirmation} onChange={event => setConfirmation(event.target.value)}
                    autoComplete="off" spellCheck={false} disabled={deleting} />
                {error && <p role="alert" className="delete-data-error">{error}</p>}
                <div className="delete-data-actions">
                    <button type="button" autoFocus disabled={deleting} onClick={() => dialogRef.current?.close()}>Cancel</button>
                    <button type="button" className="danger-solid-button" disabled={confirmation !== "RESET" || deleting}
                        onClick={removeData}>{deleting ? "Resetting…" : "Reset app and delete data"}</button>
                </div>
            </div>
        </dialog>, document.body)}
    </div>;
}
