import { createPopper } from "@popperjs/core"
import type { Instance } from '@popperjs/core'
import { useRef, useState, useEffect, cloneElement, type MouseEventHandler, type ReactElement, type RefObject} from 'react'


export type MenuOption = {
    label: string;
    action: () => void; // ...args: any allows function parameters
}

type ClickableElement = ReactElement<React.HTMLAttributes<HTMLElement>>;

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

    // need reference to container to tell if a click occurs outside of the element
    const containerRef = useRef<HTMLDivElement>(null);
    
    // popper instance for positioning the menu
    const [popperInstance, setPopperInstance] = useState<Instance | null>(null);
    // refs for popper positioning
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // when open, add eventlistener which closes menu on a click outside of the menu
    useEffect(
        () =>
        {
            if(!open) return;
            // console.log(options);
            // add eventlistener to close the menu if something outside the menu is clicked
            function handleClick(e: MouseEvent)
            {
                if(containerRef.current && !containerRef.current.contains(e.target as Node))
                {
                    setOpen(false);
                }
            }
            document.addEventListener("mousedown", handleClick);

            // return function to remove the eventlistener
            return () => {
                document.removeEventListener("mousedown", handleClick);
            }

        }
    , [open]);

    // useeffect for popper positioning, create instance on opening menu
    useEffect(() => {
        if(!open) return;
        if (!buttonRef.current || !menuRef.current) return;

        const popper = createPopper(buttonRef.current, menuRef.current, {
                placement: 'bottom-start',
                modifiers: [
                    { name: 'offset', options: { offset: [0, 8] } },
                    { name: 'preventOverflow', options: { padding: 8 } },
                    { name: 'flip', options: { fallbackPlacements: ['top-start'] } },
                ],
            })

        setPopperInstance(popper);

        return () => {
            popper.destroy();
            setPopperInstance(null);
        }

    }, [open]);

    // add an onClick prop to the child button element by cloning and adding the prop
    // element must contain a button element as the child
    // ( <Menu MenuProps=[...Menuoptions]> <button/> </Menu> )
    // WARNING: Will overwrite any existing props
    const trigger = cloneElement(children as React.ReactElement<any>, {
        onClick: () => setOpen(o => !o),
        ref: buttonRef
    });
    // could also wrap in element to add onclick?

    return (
    <div ref={containerRef}>
        
        {trigger}{/* add trigger element (copied and onclick prop inserted) */} 
        <div ref={menuRef} className="menu">
            {
            
            /* add options from props */
            // conditionally render if open
            open && (
                options.map((option, i) => {
                    return (
                    <button key={i} onClick={() => {option.action(); setOpen(false);}}>
                        {option.label}
                    </button>
                    )
                })
            )
            
            }
        </div>
    </div>
    )

}

export default Menu
