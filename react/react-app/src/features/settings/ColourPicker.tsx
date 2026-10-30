import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { hasReadableContrast } from "./themeContrast";

const swatches = ["#1e1e1e", "#000000", "#363636", "#707070", "#d7d7d7", "#ffffff", "#fff4dc", "#d9e8db", "#cbdff4", "#d9cef5", "#866efb", "#794b38"];
const channels = ["Red", "Green", "Blue"];

function normalise(value: string): string | null {
    const hex = value.trim().replace(/^#/, "");
    if (/^[\da-f]{6}$/i.test(hex)) return `#${hex.toLowerCase()}`;
    if (/^[\da-f]{3}$/i.test(hex)) return `#${[...hex].map(char => char + char).join("").toLowerCase()}`;
    return null;
}

export default function ColourPicker({ label, value, contrastWith, target, onChange }: {
    label: string; value: string; contrastWith: string; target: "text" | "background"; onChange: (colour: string) => void;
}) {
    const id = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("#1e1e1e");
    const [hex, setHex] = useState(draft);
    const valid = normalise(hex);
    const readable = valid !== null && hasReadableContrast(valid, contrastWith);

    function setColour(colour: string) {
        setDraft(colour);
        setHex(colour);
    }

    function close() {
        dialogRef.current?.close();
        setOpen(false);
    }

    return <>
        <button type="button" className="colour-picker-trigger" aria-label={`${label}: ${value}`}
            aria-haspopup="dialog" aria-expanded={open} aria-controls={`${id}-dialog`}
            onClick={() => {
                setColour(normalise(value) ?? "#1e1e1e");
                setOpen(true);
                dialogRef.current?.showModal();
            }}>
            <span style={{ background: value }} />
        </button>
        {createPortal(<dialog ref={dialogRef} id={`${id}-dialog`} className="passage-picker colour-picker"
            aria-labelledby={`${id}-title`} onClose={() => setOpen(false)}
            onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}
            onClick={event => {
                // Portals still bubble through the settings overlay in React.
                event.stopPropagation();
                if (event.target !== event.currentTarget) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
            }}>
            <div className="passage-picker-heading">
                <h2 id={`${id}-title`}>{label}</h2>
                <button type="button" className="passage-picker-close" aria-label="Cancel colour selection" onClick={close}>×</button>
            </div>
            <div className="passage-picker-panel">
                <div className="colour-picker-preview" style={{
                    background: target === "background" ? draft : contrastWith,
                    color: target === "text" ? draft : contrastWith,
                }}>
                    <span>Sample reading text</span>
                </div>
                <div className="colour-picker-swatches" role="group" aria-label="Colour presets">
                    {swatches.map(colour => <button key={colour} type="button" aria-label={colour}
                        aria-pressed={draft === colour} onClick={() => setColour(colour)}>
                        <span style={{ background: colour }} />
                    </button>)}
                </div>
                {channels.map((channel, index) => {
                    const amount = parseInt(draft.slice(1 + index * 2, 3 + index * 2), 16);
                    return <label className="colour-picker-channel" key={channel}>
                        <span>{channel}<span>{amount}</span></span>
                        <input type="range" min="0" max="255" value={amount} onChange={event => {
                            const start = 1 + index * 2;
                            setColour(draft.slice(0, start) + Number(event.target.value).toString(16).padStart(2, "0") + draft.slice(start + 2));
                        }} />
                    </label>;
                })}
                <label className="colour-picker-hex" htmlFor={`${id}-hex`}>Hex colour</label>
                <input id={`${id}-hex`} className="colour-picker-input" type="text" value={hex}
                    spellCheck={false} autoComplete="off" maxLength={7} aria-invalid={!valid || !readable}
                    aria-describedby={`${id}-help`} onChange={event => {
                        setHex(event.target.value);
                        const colour = normalise(event.target.value);
                        if (colour) setDraft(colour);
                    }} />
                <p id={`${id}-help`} className="speech-caption">{valid ? "Use 3 or 6 hex digits, for example #d7d7d7." : "Enter a valid colour using 3 or 6 hex digits."}</p>
                {valid && !readable && <p className="speech-caption" role="status">
                    These colours have very similar greyscale brightness. Choose a slightly lighter or darker colour.
                </p>}
                <div className="colour-picker-actions">
                    <button type="button" onClick={close}>Cancel</button>
                    <button type="button" disabled={!readable} onClick={() => {
                        if (valid && readable) { onChange(valid); close(); }
                    }}>Apply colour</button>
                </div>
            </div>
        </dialog>, document.body)}
    </>;
}
