import { useMemo, useState } from "react";
import ListPicker from "../../components/ListPicker";
import YouVersionAPI, { type BibleVersion, type BibleVersionDetail } from "./YouVersionAPI";

/** Translation browsing loads on demand, independently of passage reading. */
export default function TranslationPicker({ value, detail, onChange, className = "integrated-translation-button" }: {
    value: number | null; detail: BibleVersionDetail | null; onChange: (value: number) => void; className?: string;
}) {
    const [index, setIndex] = useState<BibleVersion[]>([]);
    const [names, setNames] = useState<Map<string, Record<string, string>>>(new Map());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    async function loadIndex() {
        setLoading(true); setError("");
        try {
            const versions = await YouVersionAPI.fetchVersionIndex();
            if (!versions.length) throw new Error();
            setIndex(versions);
        } catch { setError("Could not load translations. Please retry."); }
        finally { setLoading(false); }
    }
    async function loadNames() {
        try { setNames(await YouVersionAPI.fetchLanguageNames()); }
        catch { /* Browser language names remain usable if the extra names fail. */ }
    }
    const options = useMemo(() => {
        const values = new Map(index.map(version => [version.id, version]));
        if (value && !values.has(value)) values.set(value, {
            id: value, title: detail?.title ?? `Translation ${value}`, abbreviation: detail?.abbreviation ?? "",
            languageTag: detail?.languageTag ?? "und", languageName: "", languageGroup: "", languageSearch: "", books: null,
        });
        const labels = new Map<string, { label: string; search: string }>();
        return [...values.values()].map(version => {
            const tag = version.languageTag || "und";
            const parts = tag.split("-");
            const script = parts.find(part => /^[a-z]{4}$/i.test(part));
            const group = parts[0].toLowerCase() + (script ? `-${script}` : "");
            if (!labels.has(group)) {
                const provided = names.get(group.toLowerCase()) ?? names.get(parts[0].toLowerCase());
                let label = provided?.[group] ?? provided?.[parts[0]], english = provided?.en;
                try {
                    label ||= new Intl.DisplayNames([group], { type: "language" }).of(group);
                    english ||= new Intl.DisplayNames(["en"], { type: "language" }).of(group);
                } catch { /* Fall back to a language code. */ }
                labels.set(group, { label: label ?? english ?? group, search: `${tag} ${english ?? ""}` });
            }
            const language = labels.get(group)!;
            const selected = version.id === value && detail;
            const title = selected ? `${detail.abbreviation} — ${detail.title}` : version.abbreviation ? `${version.abbreviation} — ${version.title}` : version.title;
            return { value: version.id, label: title, group: language.label, groupKey: group, groupSearch: language.search };
        }).sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
    }, [index, value, detail, names]);
    return <ListPicker title="Select translation" allowEmpty groupTabs className={className} value={value}
        triggerLabel={detail?.abbreviation || (value ? String(value) : "…")} options={options}
        onOpen={() => { void loadIndex(); }} onTabChange={tab => { if (tab === "language") void loadNames(); }} onChange={onChange}
        status={loading ? "Loading translations…" : error ? <>{error} <button type="button" onClick={() => { void loadIndex(); }}>Retry</button></> : undefined} />;
}
