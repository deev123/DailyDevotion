import "./loading-skeleton.css";

const paragraphs = [[100, 96, 74], [100, 92, 85], [98, 100, 62], [100, 88, 76]];

/** Visual placeholders only; the list variant sits inside its picker's status region. */
export default function LoadingSkeleton({ variant = "passage", label = "Loading passage…" }: {
    variant?: "passage" | "list";
    label?: string;
}) {
    return <div className={`loading-skeleton loading-skeleton-${variant}`} role={variant === "passage" ? "status" : undefined}>
        <span className="loading-skeleton-label">{label}</span>
        <div aria-hidden="true">
            {variant === "passage" ? paragraphs.map((lines, paragraph) => <div className="loading-skeleton-paragraph" key={paragraph}>
                {lines.map((width, line) => <span className="loading-skeleton-block loading-skeleton-line" style={{ width: `${width}%` }} key={line} />)}
            </div>) : Array.from({ length: 4 }, (_, row) => <div className="loading-skeleton-block loading-skeleton-row" key={row} />)}
        </div>
    </div>;
}
