import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";

type Props = {
    references: string[];
    value: number;
    onChange: (index: number) => void;
    formatReference?: (reference: string) => string;
};

type Book = { name: string; label: string; chapters: { number: string; index: number }[] };

/** Selects from a reader's chapter list, leaving loading and persistence to the reader. */
export default function PassagePicker({ references, value, onChange, formatReference = reference => reference }: Props) {
    const id = useId();
    const dialogRef = useRef<HTMLDialogElement>(null);
    const chapterPanelRef = useRef<HTMLDivElement>(null);
    const bookTabRef = useRef<HTMLButtonElement>(null);
    const chapterTabRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState<"book" | "chapter">("book");
    const [bookName, setBookName] = useState("");
    const books = useMemo(() => {
        const grouped = new Map<string, Book>();
        references.forEach((reference, index) => {
            const match = reference.trim().match(/^(.+?)\s+(\d+)$/u);
            if (!match) return;
            const [, name, number] = match;
            let book = grouped.get(name);
            if (!book) {
                book = { name, label: formatReference(reference).replace(/\s+\d+$/u, ""), chapters: [] };
                grouped.set(name, book);
            }
            book.chapters.push({ number, index });
        });
        return [...grouped.values()];
    }, [references, formatReference]);
    const chapterOnly = books.length === 1;
    const selectedBook = books.find(book => book.chapters.some(chapter => chapter.index === value));
    const draftBook = books.find(book => book.name === bookName) ?? selectedBook ?? books[0];

    function show() {
        setBookName((selectedBook ?? books[0])?.name ?? "");
        setTab(chapterOnly ? "chapter" : "book");
        setOpen(true);
        dialogRef.current?.showModal();
        (chapterOnly ? chapterPanelRef : bookTabRef).current?.focus();
    }

    function close() {
        dialogRef.current?.close();
        setOpen(false);
    }

    function switchTab(next: "book" | "chapter") {
        setTab(next);
        (next === "book" ? bookTabRef : chapterTabRef).current?.focus();
    }

    function tabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        switchTab(event.key === "Home" ? "book" : event.key === "End" ? "chapter" : tab === "book" ? "chapter" : "book");
    }

    return <>
        <button type="button" className="reading-title-select passage-picker-trigger"
            disabled={!books.length} aria-haspopup="dialog" aria-expanded={open}
            aria-controls={`${id}-dialog`} onClick={show}>
            <span>{references[value] ? formatReference(references[value]) : "Select passage"}</span>
            <span aria-hidden="true" className="material-icons">expand_more</span>
        </button>
        {createPortal(<dialog ref={dialogRef} id={`${id}-dialog`} className="passage-picker"
            aria-labelledby={`${id}-title`} onClose={() => setOpen(false)}
            onClick={event => {
                if (event.target !== event.currentTarget) return;
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
            }}>
            <div className="passage-picker-heading">
                <h2 id={`${id}-title`}>{chapterOnly ? "Select chapter" : "Select passage"}</h2>
                <button type="button" className="passage-picker-close" aria-label="Close passage selector" onClick={close}>×</button>
            </div>
            {!chapterOnly && <div className="passage-picker-tabs" role="tablist" aria-label="Passage selection">
                <button ref={bookTabRef} type="button" role="tab" id={`${id}-book-tab`}
                    aria-selected={tab === "book"} aria-controls={`${id}-book-panel`}
                    tabIndex={tab === "book" ? 0 : -1} onKeyDown={tabKeyDown} onClick={() => switchTab("book")}>Book</button>
                <button ref={chapterTabRef} type="button" role="tab" id={`${id}-chapter-tab`}
                    aria-selected={tab === "chapter"} aria-controls={`${id}-chapter-panel`}
                    tabIndex={tab === "chapter" ? 0 : -1} onKeyDown={tabKeyDown} onClick={() => switchTab("chapter")}>Chapter</button>
            </div>}
            {!chapterOnly && <div role="tabpanel" id={`${id}-book-panel`} aria-labelledby={`${id}-book-tab`} hidden={tab !== "book"}
                className="passage-picker-panel" tabIndex={0}>
                <div className="passage-picker-books">
                    {books.map(book => <button key={book.name} type="button"
                        aria-pressed={book.name === draftBook?.name} onClick={() => {
                            setBookName(book.name);
                            switchTab("chapter");
                        }}>{book.label}</button>)}
                </div>
            </div>}
            <div ref={chapterPanelRef} role={chapterOnly ? "region" : "tabpanel"} id={`${id}-chapter-panel`}
                aria-labelledby={chapterOnly ? `${id}-title` : `${id}-chapter-tab`} hidden={!chapterOnly && tab !== "chapter"}
                className="passage-picker-panel" tabIndex={0}>
                <p className="passage-picker-book-name">{draftBook?.label}</p>
                <div className="passage-picker-chapters">
                    {draftBook?.chapters.map(chapter => <button key={chapter.index} type="button"
                        aria-label={`${draftBook.label} ${chapter.number}`} aria-current={chapter.index === value ? "true" : undefined}
                        onClick={() => { onChange(chapter.index); close(); }}>{chapter.number}</button>)}
                </div>
            </div>
        </dialog>, document.body)}
    </>;
}
