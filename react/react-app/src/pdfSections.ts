export type PdfSections = {
    page: boolean;
    text: boolean;
    showPage: boolean;
    showText: boolean;
    zoom: 1 | 1.5 | 2;
    runner: boolean;
    speech: boolean;
};

const defaults: PdfSections = { page: true, text: false, showPage: true, showText: true, zoom: 1, runner: false, speech: false };

export function loadPdfSections(id: string): PdfSections {
    try {
        const saved: unknown = JSON.parse(localStorage.getItem(id + "_pdfSections") ?? "null");
        if (!saved || typeof saved !== "object") return { ...defaults };
        const values = saved as Partial<Record<keyof PdfSections, unknown>>;
        return {
            page: typeof values.page === "boolean" ? values.page : defaults.page,
            text: typeof values.text === "boolean" ? values.text : defaults.text,
            showPage: typeof values.showPage === "boolean" ? values.showPage : defaults.showPage,
            showText: typeof values.showText === "boolean" ? values.showText : defaults.showText,
            zoom: values.zoom === 1 || values.zoom === 1.5 || values.zoom === 2 ? values.zoom : defaults.zoom,
            runner: typeof values.runner === "boolean" ? values.runner : defaults.runner,
            speech: typeof values.speech === "boolean" ? values.speech : defaults.speech,
        };
    } catch { return { ...defaults }; }
}

export function savePdfSections(id: string, sections: PdfSections): void {
    try { localStorage.setItem(id + "_pdfSections", JSON.stringify(sections)); }
    catch { /* The reader still works if browser storage is unavailable. */ }
}
