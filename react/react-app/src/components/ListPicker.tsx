import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Option = { value: number; label: string; group?: string; groupKey?: string; groupSearch?: string };
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
    closeOnSelect?: boolean;
    groupTabs?: boolean;
    searchable?: boolean;
};

/** A flat list, or language-style accordion groups, with selection owned by the caller. */
export default function ListPicker({ title, options, value, onChange, className = "title-select", disabled = false, describedBy, triggerIcon, triggerLabel, closeOnSelect = true, groupTabs = false, searchable = false }: Props) {
    const id = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [open, setOpen] = useState(false);
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
    const [tab, setTab] = useState<"language" | "translation">("translation");
    const [search, setSearch] = useState("");
    const selected = options.find(option => option.value === value);
    const grouped = options.some(option => option.group !== undefined);
    const groups = new Map<string, Option[]>();
    if (grouped) options.forEach(option => {
        const group = option.groupKey || option.group || "Other";
        const entries = groups.get(group) ?? [];
        entries.push(option);
        groups.set(group, entries);
    });

    function show() {
        setExpandedGroup(selected?.groupKey || selected?.group || groups.keys().next().value || null);
        setTab("translation");
        setSearch("");
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
                onClick={() => { onChange(option.value); if (closeOnSelect) close(); }}>
                <span>{option.label}</span>
                {option.value === value && <span className="material-icons" aria-hidden="true">check</span>}
            </button>)}
        </div>;
    }

    return <>
        <button type="button" className={`${className} picker-trigger`}
            disabled={disabled || !options.length} aria-haspopup="dialog" aria-expanded={open}
            aria-controls={`${id}-dialog`} aria-describedby={describedBy} aria-label={`${title}: ${selected?.label ?? "None selected"}`} onClick={show}>
            {triggerLabel !== undefined ? <span>{triggerLabel}</span> : triggerIcon ? <span className="material-icons" aria-hidden="true">{triggerIcon}</span> : <>
                <span>{selected?.label ?? title}</span>
                <span className="material-icons" aria-hidden="true">expand_more</span>
            </>}
        </button>
        {createPortal(<dialog ref={dialogRef} id={`${id}-dialog`} className="dialog list-picker"
            aria-labelledby={`${id}-title`} onClose={() => setOpen(false)}
            onKeyDown={event => { if (event.key === "Escape") event.stopPropagation(); }}
            onClick={event => {
                // A portal can still bubble into the settings sidebar's overlay.
                event.stopPropagation();
                if (event.target !== event.currentTarget) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
            }}>
            <div className="dialog-heading">
                <h2 id={`${id}-title`}>{title}</h2>
                <button type="button" className="dialog-close" aria-label={`Close ${title.toLowerCase()}`} onClick={close}>×</button>
            </div>
            {groupTabs && grouped && <div className="passage-picker-tabs" role="tablist" aria-label="Translation selection">
                {(["language", "translation"] as const).map(item => <button key={item} type="button" role="tab" id={`${id}-${item}-tab`}
                    aria-selected={tab === item} aria-controls={`${id}-${item}-panel`} tabIndex={tab === item ? 0 : -1}
                    onKeyDown={event => {
                        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                        event.preventDefault();
                        const next = event.key === "Home" ? "language" : event.key === "End" ? "translation" : tab === "language" ? "translation" : "language";
                        setTab(next);
                        document.getElementById(`${id}-${next}-tab`)?.focus();
                    }} onClick={() => setTab(item)}>{item === "language" ? "Language" : "Translation"}</button>)}
            </div>}
            {groupTabs && grouped ? <>
                <div className="dialog-panel" role="tabpanel" id={`${id}-language-panel`} aria-labelledby={`${id}-language-tab`} hidden={tab !== "language"}>
                    <input className="language-search" type="search" aria-label="Search languages" placeholder="Search languages" value={search} onChange={event => setSearch(event.target.value)} />
                    <div className="list-picker-options">{[...groups.keys()].filter(group => (groups.get(group) ?? []).some(option => `${option.group} ${option.groupSearch ?? ""} ${group}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))).map(group =>
                        <button type="button" key={group} onClick={() => { setExpandedGroup(group); setTab("translation"); }}>
                            <span>{groups.get(group)?.[0]?.group ?? group}</span><span className="material-icons" aria-hidden="true">chevron_right</span>
                        </button>)}</div>
                </div>
                <div className="dialog-panel" role="tabpanel" id={`${id}-translation-panel`} aria-labelledby={`${id}-translation-tab`} hidden={tab !== "translation"}>
                    <p className="passage-picker-book-name">{groups.get(expandedGroup || "")?.[0]?.group ?? expandedGroup}</p>
                    {renderOptions(groups.get(expandedGroup || "") ?? [])}
                </div>
            </> : <div className="dialog-panel">
                {searchable && <input className="language-search" type="search" aria-label={`Search ${title.toLowerCase()}`} placeholder="Search" value={search} onChange={event => setSearch(event.target.value)} />}
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
                </div>) : renderOptions(searchable ? options.filter(option => option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase())) : options)}
            </div>}
        </dialog>, document.body)}
    </>;
}
