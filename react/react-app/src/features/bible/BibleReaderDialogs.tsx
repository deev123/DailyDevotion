import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { dismissDialogOnOutsideClick } from "../../components/dialogDismiss";
import type { ReadingPosition } from "./readingHistory";

type DialogRef = RefObject<HTMLDialogElement | null>;

export function BibleHistoryDialog({ dialogRef, history, references, onSelect }: {
    dialogRef: DialogRef;
    history: ReadingPosition[];
    references: string[];
    onSelect: (position: ReadingPosition) => void;
}) {
    return createPortal(<dialog ref={dialogRef} className="dialog bible-history" aria-labelledby="bible-history-title" onClick={dismissDialogOnOutsideClick}>
        <div className="dialog-heading">
            <h2 id="bible-history-title">Reading history</h2>
            <button type="button" className="dialog-close" aria-label="Close reading history" onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        <ol className="dialog-panel bible-history-list" tabIndex={0} aria-label="Recent reading positions">
            {[...history].reverse().map((entry, index) => <li key={index}>
                <button type="button" onClick={() => { dialogRef.current?.close(); onSelect(entry); }}>
                    {references[entry.index] ?? "Loading passage…"}:{entry.verse}
                </button>
            </li>)}
        </ol>
    </dialog>, document.body);
}

export function BibleSettingsDialog({ dialogRef, infinite, onInfiniteChange }: {
    dialogRef: DialogRef;
    infinite: boolean;
    onInfiniteChange: (enabled: boolean) => void;
}) {
    return createPortal(<dialog ref={dialogRef} className="dialog bible-settings" aria-labelledby="bible-settings-title" onClick={dismissDialogOnOutsideClick}>
        <div className="dialog-heading">
            <h2 id="bible-settings-title">Bible settings</h2>
            <button type="button" className="dialog-close" aria-label="Close Bible settings" onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        <div className="dialog-panel bible-settings-content">
            <label><input type="checkbox" checked={infinite} onChange={event => onInfiniteChange(event.target.checked)} /> Infinite scroll</label>
            <p>Keep scrolling to read earlier or later chapters.</p>
        </div>
    </dialog>, document.body);
}
