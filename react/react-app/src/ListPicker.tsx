import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Option = { value: number; label: string; group?: string };
type Props = {
    title: string;
    options: Option[];
    value: number | null;
    onChange: (value: number) => void;
    className?: string;
    disabled?: boolean;
    describedBy?: string;
    triggerIcon?: string;
    triggerLabel?: string;
};

/** A flat list, or language-style accordion groups, with selection owned by the caller. */
export default function ListPicker({ title, options, value, onChange, className = "reading-title-select", disabled = false, describedBy, triggerIcon, triggerLabel }: Props) {
    const id = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [open, setOpen] = useState(false);
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const selected = options.find(option => option.value === value);
    const grouped = options.some(option => option.group !== undefined);
    const groups = new Map<string, Option[]>();
    if (grouped) options.forEach(option => {
        const group = option.group || "Other";
        const entries = groups.get(group) ?? [];
        entries.push(option);
        groups.set(group, entries);
    });

    function show() {
        setExpandedGroup(selected?.group || groups.keys().next().value || null);
        setOpen(true);
        dialogRef.current?.showModal();
    }

    function close() {
        dialogRef.current?.close();
        setOpen(false);
    }

    function renderOptions(entries: Option[]) {
        return <div className="list-picker-options">
            {entries.map(option => <button key={option.value} type="button"
                aria-current={option.value === value ? "true" : undefined}
                onClick={() => { onChange(option.value); close(); }}>
                <span>{option.label}</span>
                {option.value === value && <span className="material-icons" aria-hidden="true">check</span>}
            </button>)}
        </div>;
    }

    return <>
        <button type="button" className={`${className} passage-picker-trigger`}
            disabled={disabled || !options.length} aria-haspopup="dialog" aria-expanded={open}
            aria-controls={`${id}-dialog`} aria-describedby={describedBy} aria-label={`${title}: ${selected?.label ?? "None selected"}`} onClick={show}>
            {triggerLabel !== undefined ? <span>{triggerLabel}</span> : triggerIcon ? <span className="material-icons" aria-hidden="true">{triggerIcon}</span> : <>
                <span>{selected?.label ?? title}</span>
                <span className="material-icons" aria-hidden="true">expand_more</span>
            </>}
        </button>
        {createPortal(<dialog ref={dialogRef} id={`${id}-dialog`} className="passage-picker list-picker"
            aria-labelledby={`${id}-title`} onClose={() => setOpen(false)}
            onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}
            onClick={event => {
                // A portal can still bubble into the settings sidebar's overlay.
                event.stopPropagation();
                if (event.target !== event.currentTarget) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
            }}>
            <div className="passage-picker-heading">
                <h2 id={`${id}-title`}>{title}</h2>
                <button type="button" className="passage-picker-close" aria-label={`Close ${title.toLowerCase()}`} onClick={close}>×</button>
            </div>
            <div className="passage-picker-panel">
                {grouped ? [...groups].map(([group, entries], index) => <div className="list-picker-group" key={group}>
                    <button type="button" className="list-picker-group-toggle"
                        aria-expanded={expandedGroup === group} aria-controls={`${id}-group-${index}`}
                        onClick={() => setExpandedGroup(expandedGroup === group ? null : group)}>
                        <span>{group}</span>
                        <span className="material-icons" aria-hidden="true">{expandedGroup === group ? "expand_less" : "expand_more"}</span>
                    </button>
                    <div id={`${id}-group-${index}`} hidden={expandedGroup !== group}>
                        {renderOptions(entries)}
                    </div>
                </div>) : renderOptions(options)}
            </div>
        </dialog>, document.body)}
    </>;
}
