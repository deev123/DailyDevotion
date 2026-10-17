import { useEffect, useState } from "react"
import SettingsSidebar from "./SettingsSidebar.tsx"
import Streak from "./Streak.tsx"

function Header() {
    const [hidden, setHidden] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);

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

    return (
        <header className={"top-header" + (hidden && !settingsOpen ? " header-hidden" : "")}>
            <Streak />
            <SettingsSidebar onOpenChange={setSettingsOpen} />
        </header>
    );
}

export default Header
