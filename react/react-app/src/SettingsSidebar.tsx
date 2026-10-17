import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

const FONT_OPTIONS = [
    { id: "arial", label: "Arial (default)", family: "Arial, sans-serif" },
    { id: "helvetica", label: "Helvetica", family: "Helvetica, Arial, sans-serif" },
    { id: "verdana", label: "Verdana", family: "Verdana, sans-serif" },
    { id: "tahoma", label: "Tahoma", family: "Tahoma, Verdana, sans-serif" },
    { id: "trebuchet", label: "Trebuchet MS", family: '"Trebuchet MS", Arial, sans-serif' },
    { id: "georgia", label: "Georgia", family: "Georgia, serif" },
    { id: "times", label: "Times New Roman", family: '"Times New Roman", Times, serif' },
    { id: "palatino", label: "Palatino", family: '"Palatino Linotype", "Book Antiqua", Palatino, serif' },
    { id: "courier", label: "Courier New", family: '"Courier New", Courier, monospace' },
    { id: "lucida-console", label: "Lucida Console", family: '"Lucida Console", Monaco, monospace' },
    { id: "comic-sans", label: "Comic Sans MS", family: '"Comic Sans MS", cursive' },
    { id: "impact", label: "Impact", family: 'Impact, "Arial Narrow", sans-serif' },
    { id: "system", label: "System default", family: "system-ui, sans-serif" },
    { id: "sans-serif", label: "Sans-serif", family: "sans-serif" },
    { id: "serif", label: "Serif", family: "serif" },
    { id: "monospace", label: "Monospace", family: "monospace" },
    { id: "cursive", label: "Cursive", family: "cursive" },
    { id: "fantasy", label: "Fantasy", family: "fantasy" },
    { id: "opendyslexic", label: "OpenDyslexic", family: '"OpenDyslexic", Arial, sans-serif' },
];

// read the current value of a theme CSS variable from <html>
function readCssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readNumberSetting(key: string, fallback: number, min: number, max: number): number {
    const stored = localStorage.getItem(key);
    const value = stored === null || stored.trim() === "" ? fallback : Number(stored);
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

// small settings sidebar: a hamburger button that opens a sliding panel.
// Colours and font are applied through CSS variables on <html>.
function SettingsSidebar({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {

    const [open, setOpen] = useState(false);
    // tracks whether we're animating closed but not yet removed from the DOM
    const [closing, setClosing] = useState(false);

    const [background, setBackground] = useState("");
    const [text, setText] = useState("");
    const [font, setFont] = useState("arial");
    const [fontSize, setFontSize] = useState(100);
    const [letterSpacing, setLetterSpacing] = useState(0);

    function applyFontSize(value: number) {
        setFontSize(value);
        document.documentElement.style.setProperty("--font-size", `${value}%`);
        localStorage.setItem("themeFontSize", String(value));
    }

    function applyLetterSpacing(value: number) {
        setLetterSpacing(value);
        document.documentElement.style.setProperty("--letter-spacing", `${value}em`);
        localStorage.setItem("themeLetterSpacing", String(value));
    }

    function applyFont(id: string) {
        const selected = FONT_OPTIONS.find((option) => option.id === id) ?? FONT_OPTIONS[0];
        setFont(selected.id);
        document.documentElement.style.setProperty("--font-family", selected.family);
        localStorage.setItem("themeFont", selected.id);
    }

    // element ref so we can move focus into the dialog when it opens
    const sidebarRef = useRef<HTMLElement | null>(null);

    // apply both CSS variables and persist to local storage
    function applyTheme(bg: string, txt: string) {
        document.documentElement.style.setProperty("--background", bg);
        document.documentElement.style.setProperty("--text", txt);
        localStorage.setItem("themeBackground", bg);
        localStorage.setItem("themeText", txt);
    }

    // close with a quick exit animation, then remove from the DOM
    function closeSidebar() {
        setClosing(true);
        setTimeout(() => {
            setOpen(false);
            onOpenChange(false);
            setClosing(false);
        }, 120); // slightly faster than the open animation
    }

    function toggleSidebar() {
        if (open) {
            closeSidebar();
        } else {
            setOpen(true);
            onOpenChange(true);
        }
    }

    // load any saved theme, else default to the values defined in the css
    useEffect(() => {
        const savedBg = localStorage.getItem("themeBackground") ?? readCssVar("--background");
        const savedText = localStorage.getItem("themeText") ?? readCssVar("--text");
        setBackground(savedBg);
        setText(savedText);
        applyTheme(savedBg, savedText);
        applyFont(localStorage.getItem("themeFont") ?? "arial");
        applyFontSize(readNumberSetting("themeFontSize", 100, 75, 150));
        applyLetterSpacing(readNumberSetting("themeLetterSpacing", 0, -0.15, 0.2));
    }, []);

    // close the dialog when the Escape key is pressed
    useEffect(() => {
        if (!open) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === "Escape") closeSidebar();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [open, closeSidebar]);

    // move focus into the dialog when it opens
    useEffect(() => {
        if (open) sidebarRef.current?.focus();
    }, [open]);

    return (
    <>
            <button
                className="material-icons hamburger-button"
                aria-label="Settings"
                aria-expanded={open}
                onClick={(e) => { e.stopPropagation(); toggleSidebar(); }}
            >
                {open ? "close" : "menu"}
            </button>

        {(open || closing) && createPortal(
            <div className={"sidebar-overlay" + (closing ? " closing" : "")} onClick={closeSidebar}>
                <aside
                    className="settings-sidebar"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Settings"
                    tabIndex={-1}
                    ref={sidebarRef}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="settings-sidebar-header">
                        <span>Settings</span>
                        <button
                            className="material-icons hamburger-button"
                            aria-label="Close settings"
                            onClick={closeSidebar}
                        >close</button>
                    </div>

                    <label className="settings-row">
                        <span>Text colour</span>
                        <input
                            type="color"
                            value={text}
                            onChange={(e) => { setText(e.target.value); applyTheme(background, e.target.value); }}
                        />
                    </label>

                    <label className="settings-row">
                        <span>Background colour</span>
                        <input
                            type="color"
                            value={background}
                            onChange={(e) => { setBackground(e.target.value); applyTheme(e.target.value, text); }}
                        />
                    </label>

                    <label className="settings-row">
                        <span>Font</span>
                        <select
                            className="settings-font-select"
                            aria-describedby="font-availability-note"
                            value={font}
                            onChange={(e) => applyFont(e.target.value)}
                        >
                            {FONT_OPTIONS.map((option) => (
                                <option key={option.id} value={option.id}>{option.label}</option>
                            ))}
                        </select>
                    </label>
                    <p id="font-availability-note" className="settings-help">
                        Some fonts may not be installed on your device. If unavailable, a similar font will be used.
                    </p>

                    <label className="settings-row settings-slider-row">
                        <span>Font size: {fontSize}%</span>
                        <input
                            type="range"
                            min="75"
                            max="150"
                            step="5"
                            value={fontSize}
                            aria-valuetext={`${fontSize}%`}
                            onChange={(e) => applyFontSize(Number(e.target.value))}
                        />
                    </label>

                    <label className="settings-row settings-slider-row">
                        <span>Letter spacing: {letterSpacing.toFixed(2)} em</span>
                        <input
                            type="range"
                            min="-0.15"
                            max="0.2"
                            step="0.01"
                            value={letterSpacing}
                            aria-valuetext={`${letterSpacing.toFixed(2)} em`}
                            onChange={(e) => applyLetterSpacing(Number(e.target.value))}
                        />
                    </label>
                </aside>
            </div>, document.body
        )}
    </>
    )
}

export default SettingsSidebar
