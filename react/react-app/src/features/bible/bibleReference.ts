import YouVersionAPI from "./YouVersionAPI";

export function commentaryUrl(reference: string): string | null {
    const match = reference.trim().match(/^(.+?)\s+(\d+)$/);
    if (!match || !YouVersionAPI.referenceToUsfm(reference)) return null;

    const book = match[1] === "Psalm" ? "psalms" : match[1].toLowerCase().replace(/\s+/g, "-");
    const chapter = Number(match[2]);
    if (chapter < 1) return null;
    // Bible Study Tools uses a different chapter filename for this book.
    const filename = book === "song-of-solomon" ? `${book}-${chapter}` : String(chapter);
    return `https://www.biblestudytools.com/commentaries/matthew-henry-complete/${book}/${filename}.html`;
}

