import { useEffect, useRef, useState } from "react"
import SettingsSidebar from "../features/settings/SettingsSidebar.tsx"
import Streak from "../features/streak/Streak.tsx"
import type { ComponentConfig } from "./layoutStorage.ts"

function Header({ components, activeTab, onTabChange }: {
    components: ComponentConfig[];
    activeTab: "bible" | "devotion";
    onTabChange: (tab: "bible" | "devotion") => void;
}) {
    const [hidden, setHidden] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const navigating = useRef(false);
    const navigationTimer = useRef<number | undefined>(undefined);

    function keepHeaderVisible() {
        navigating.current = true;
        setHidden(false);
        window.clearTimeout(navigationTimer.current);
        navigationTimer.current = window.setTimeout(() => {
            navigating.current = false;
            setHidden(false);
        }, 200);
    }

    useEffect(() => {
        let previousY = Math.max(0, window.scrollY);
        let direction = 0;
        let distance = 0;

        function onScroll() {
            // Clamp overscroll so bouncing at the bottom doesn't show the header.
            const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            const y = Math.min(maxY, Math.max(0, window.scrollY));
            const delta = y - previousY;
            previousY = y;

            if (navigating.current) {
                keepHeaderVisible();
                distance = 0;
                direction = 0;
                return;
            }
            if (settingsOpen || y <= 48) {
                setHidden(false);
                distance = 0;
                direction = 0;
                return;
            }
            if (delta === 0) return;
            const nextDirection = Math.sign(delta);
            if (nextDirection !== direction) distance = 0;
            direction = nextDirection;
            distance += Math.abs(delta);
            // Ignore tiny direction changes from touch and trackpad scrolling.
            if (distance >= 12) setHidden(direction > 0);
        }

        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, [settingsOpen]);

    useEffect(() => () => window.clearTimeout(navigationTimer.current), []);

    return (
        <header className={"top-header" + (hidden && !settingsOpen ? " header-hidden" : "")}>
            <div className="app-tabs" role="tablist" aria-label="App pages">
                {(["bible", "devotion"] as const).map(tab => <button key={tab} type="button" role="tab"
                    id={`${tab}-tab`} aria-controls={`${tab}-panel`} aria-selected={activeTab === tab}
                    tabIndex={activeTab === tab ? 0 : -1} onClick={() => { keepHeaderVisible(); onTabChange(tab); }}
                    onKeyDown={event => {
                        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                        event.preventDefault();
                        const next = event.key === "Home" ? "bible" : event.key === "End" ? "devotion" : tab === "bible" ? "devotion" : "bible";
                        keepHeaderVisible(); onTabChange(next);
                        document.getElementById(`${next}-tab`)?.focus({ preventScroll: true });
                    }}>{tab === "bible" ? "Bible" : "Daily Devotion"}</button>)}
            </div>
            <Streak />
            <SettingsSidebar onOpenChange={setSettingsOpen} onNavigate={() => { onTabChange("devotion"); keepHeaderVisible(); }} components={components} />
        </header>
    );
}

export default Header
