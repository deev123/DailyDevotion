import { useEffect, useState } from "react"

// streak storage format: consecutive days the app was used, with a one-day grace
// (a gap of up to ~48h keeps the streak alive; a larger gap breaks it)
const STREAK_KEY = "streak";
// tolerance in ms: a gap up to this keeps the streak (one missed day + half a day)
const GRACE_MS = 48 * 60 * 60 * 1000;
// consider a check-in a "new day" if more than this elapsed since the last one,
// so re-opening within a short window doesn't double-count
const NEW_DAY_MS = 6 * 60 * 60 * 1000;

type StreakRecord = {
    count: number,
    lastDate: number // epoch ms of last check-in
}

function loadRecord(): StreakRecord | null {
    try {
        const raw = localStorage.getItem(STREAK_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return (data && typeof data.count === "number" && typeof data.lastDate === "number") ? data : null;
    } catch (err) {
        console.error(err);
        return null;
    }
}

function Streak() {

    let [count, setCount] = useState(0);

    useEffect(() => {
        const now = Date.now();
        const record = loadRecord();

        if (!record) {
            // first ever use: start the streak
            localStorage.setItem(STREAK_KEY, JSON.stringify({ count: 1, lastDate: now }));
            setCount(1);
            return;
        }

        // past the grace window: streak is broken, restart
        if (now - record.lastDate > GRACE_MS) {
            localStorage.setItem(STREAK_KEY, JSON.stringify({ count: 1, lastDate: now }));
            setCount(1);
            return;
        }

        // within grace: if this is a fresh day, extend the streak; otherwise it's
        // just another visit today and we don't double-count
        if (now - record.lastDate > NEW_DAY_MS) {
            const next = record.count + 1;
            localStorage.setItem(STREAK_KEY, JSON.stringify({ count: next, lastDate: now }));
            setCount(next);
        } else {
            // same visit window: keep the stored count, refresh the timestamp
            localStorage.setItem(STREAK_KEY, JSON.stringify({ count: record.count, lastDate: now }));
            setCount(record.count);
        }
    }, []);

    // fade the pill out once the page is scrolled away from the very top
    let [faded, setFaded] = useState(false);

    useEffect(() => {
        function onScroll() {
            setFaded(window.scrollY > 12);
        }
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    return (
        <section className={"streak-area" + (faded ? " streak-faded" : "")}>
            <div className="streak-pill">
                <span className="streak-flame">🔥</span>
                <span className="streak-count">{count}</span>
            </div>
        </section>
    )
}

export default Streak
