import type { MouseEvent } from "react";

/** Backdrop clicks target the dialog itself, but fall outside its rectangle. */
export function dismissDialogOnOutsideClick(event: MouseEvent<HTMLDialogElement>) {
    // Dialog portals can bubble through other overlays in the React tree.
    event.stopPropagation();
    if (event.target !== event.currentTarget) return;
    const dialog = event.currentTarget;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}
