// A simple greyscale brightness heuristic (0–255), not a contrast-ratio test.
// Weight RGB channels to reflect their contribution to perceived brightness.
function greyscale(hex: string): number {
    const value = hex.replace(/^#/, "");
    const full = value.length === 3 ? [...value].map(char => char + char).join("") : value;
    const [red, green, blue] = [0, 2, 4].map(offset => parseInt(full.slice(offset, offset + 2), 16));
    return red * 0.299 + green * 0.587 + blue * 0.114;
}

// Start with a small gap of 30 shades (about 12% of the brightness scale).
const minimumBrightnessGap = 30;

export function hasReadableContrast(first: string, second: string): boolean {
    return Math.abs(greyscale(first) - greyscale(second)) >= minimumBrightnessGap;
}

export function readableText(background: string): string {
    return greyscale(background) >= 127.5 ? "#000000" : "#ffffff";
}
