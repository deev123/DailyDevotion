import { createPortal } from "react-dom";
import { createPopper } from "@popperjs/core"
import { useRef, useState, useEffect, useLayoutEffect, cloneElement, type ReactElement, type ComponentPropsWithRef} from "react"


export type MenuOption = {
    label: string;
    action: () => void; // ...args: any allows function parameters
}

type ClickableElement = ReactElement<ComponentPropsWithRef<"button">>;

export type MenuProps = {
    options: MenuOption[];
    children: ClickableElement;
}


/*

Menu defined like:

<Menu MenuProps=[...Menuoptions] >
<button>  <--- when this is clicked the menu is conditionally rendered from the Menu options prop
</Menu>

*/


function Menu({ options , children}: MenuProps)
{

    const [open, setOpen] = useState(false);

    // refs for popper positioning
    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // when open, add eventlistener which closes menu on a click outside of the menu
    useEffect(
        () =>
        {
            if(!open) return;
            // console.log(options);
            // add eventlistener to close the menu if something outside the menu is clicked
            function handleClick(e: PointerEvent)
            {
                if(!triggerRef.current?.contains(e.target as Node) && !menuRef.current?.contains(e.target as Node))
                {
                    setOpen(false);
                }
            }
            document.addEventListener("pointerdown", handleClick);

            // return function to remove the eventlistener
            return () => {
                document.removeEventListener("pointerdown", handleClick);
            }

        }
    , [open]);

    // Portal menus escape clipping and sticky-header stacking contexts.
    useLayoutEffect(() => {
        if(!open) return;
        const button = triggerRef.current?.querySelector("button");
        if (!button || !menuRef.current) return;

        const popper = createPopper(button, menuRef.current, {
                placement: "bottom-end",
                strategy: "fixed",
                modifiers: [
                    { name: "offset", options: { offset: [0, 8] } },
                    { name: "preventOverflow", options: { padding: 8 } },
                    { name: "flip", options: { fallbackPlacements: ["top-end", "bottom-start", "top-start"] } },
                ],
            })

        popper.forceUpdate();

        return () => {
            popper.destroy();
        }

    }, [open]);

    // add an onClick prop to the child button element by cloning and adding the prop
    // element must contain a button element as the child
    // ( <Menu MenuProps=[...Menuoptions]> <button/> </Menu> )
    // WARNING: Will overwrite any existing props
    const trigger = cloneElement(children, {
        "aria-expanded": open,
        onClick: () => setOpen(o => !o)
    });
    // could also wrap in element to add onclick?

    return (
    <div ref={triggerRef}>
        
        {trigger}{/* add trigger element (copied and onclick prop inserted) */} 
        {/* conditionally render if open */}
        {open && createPortal(
            <div ref={menuRef} className="menu" onKeyDown={event => {
                if (event.key === "Escape") {
                    event.stopPropagation();
                    setOpen(false);
                    triggerRef.current?.querySelector("button")?.focus({ preventScroll: true });
                }
            }}>
                {/* add options from props */}
                {options.map((option, i) => (
                    <button key={i} onClick={() => {option.action(); setOpen(false);}}>
                        {option.label}
                    </button>
                ))}
            </div>, document.body
        )}
    </div>
    )

}

export default Menu
