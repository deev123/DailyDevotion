import { useLayoutEffect, useRef, useState } from "react";
import "./overflow-label.css";

type Fit = { source: string; label: string; size?: number; spacing?: string };

/** Prefer shorter labels as needed; optionally shrink the final label to fit. */
export default function OverflowLabel({ text, variants, shrink = false }: { text: string; variants?: string[]; shrink?: boolean }) {
    const viewport = useRef<HTMLSpanElement>(null);
    const measurements = useRef<HTMLSpanElement>(null);
    const [fit, setFit] = useState<Fit>({ source: text, label: text });
    const choices = variants?.length ? variants : [text];
    useLayoutEffect(() => {
        const outer = viewport.current, measure = measurements.current;
        if (!outer || !measure) return;
        const labels = Array.from(measure.children) as HTMLElement[];
        const updateFit = () => {
            const available = outer.clientWidth;
            if (!available) return;
            // Leave a pixel for fractional font/layout rounding rather than truncating
            // a reference or translation that only just fits in the measured width.
            const targetWidth = Math.max(1, available - 1);
            const found = labels.findIndex(label => label.getBoundingClientRect().width <= targetWidth);
            const selected = found < 0 ? labels.length - 1 : found;
            const label = labels[selected];
            if (!label) return;
            const style = getComputedStyle(label);
            const baseSize = parseFloat(style.fontSize);
            const measuredWidth = label.getBoundingClientRect().width;
            const size = shrink && measuredWidth > targetWidth ? baseSize * targetWidth / measuredWidth : undefined;
            const spacing = size ? `${(parseFloat(style.letterSpacing) || 0) / baseSize}em` : undefined;
            const value = label.dataset.label ?? text;
            setFit(previous => previous.source === text && previous.label === value && previous.size === size && previous.spacing === spacing
                ? previous : { source: text, label: value, size, spacing });
        };
        // A chapter change can mount a new header. Fit its label before paint,
        // rather than briefly displaying the full-size text until observation.
        updateFit();
        const observer = new ResizeObserver(updateFit);
        observer.observe(outer);
        labels.forEach(label => observer.observe(label));
        return () => observer.disconnect();
    }, [text, variants, shrink]);
    const current = fit.source === text ? fit : { source: text, label: text };
    return <span ref={viewport} dir="auto" title={text} className="overflow-label">
        <span className="overflow-label-text" style={{ fontSize: current.size, letterSpacing: current.spacing }}>{current.label}</span>
        <span ref={measurements} className="overflow-label-measurements" aria-hidden="true">
            {choices.map((label, index) => <span key={index} data-label={label} />)}
        </span>
    </span>;
}
