import { useEffect, useRef, useState } from "react"

// read the current value of a theme CSS variable from <html>
function readCssVar(name: string): string {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// small settings sidebar: a hamburger button that opens a sliding panel.
// currently the only settings are global text and background colours,
// applied by overriding the theme CSS variables on <html>.
function SettingsSidebar() {

    const [open, setOpen] = useState(false);
    // tracks whether we're animating closed but not yet removed from the DOM
    const [closing, setClosing] = useState(false);

    const [background, setBackground] = useState("");
    const [text, setText] = useState("");

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
            setClosing(false);
        }, 120); // slightly faster than the open animation
    }

    function toggleSidebar() {
        if (open) {
            closeSidebar();
        } else {
            setOpen(true);
        }
    }

    // load any saved theme, else default to the values defined in the css
    useEffect(() => {
        const savedBg = localStorage.getItem("themeBackground") ?? readCssVar("--background");
        const savedText = localStorage.getItem("themeText") ?? readCssVar("--text");
        setBackground(savedBg);
        setText(savedText);
        applyTheme(savedBg, savedText);
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
        <header className="top-header" onClick={() => { if (open) closeSidebar(); }}>
            <button
                className="material-icons hamburger-button"
                aria-label="Settings"
                aria-expanded={open}
                onClick={(e) => { e.stopPropagation(); toggleSidebar(); }}
            >
                {open ? "close" : "menu"}
            </button>
        </header>

        {(open || closing) &&
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
                </aside>
            </div>
        }
    </>
    )
}

export default SettingsSidebar
