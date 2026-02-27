import type { MenuOption } from "./Menu.tsx" // import type important for importing types
import Menu from "./Menu.tsx"

type NoteBoxProps = {
    layoutOptions: MenuOption[];
}

function NoteBox({ layoutOptions }: NoteBoxProps){

    // add additional options to menu if needed:
    // const menuOptions = [...layoutOptions, ...extraOptions];
    // console.log(layoutOptions);

    return (
    <section>
        <div className="notes-container">
            <div className="notes-header">
                <h2>Skeleton - Example Title{/* title variable */}</h2>
                <div className="notes-header-buttons">
                    <button className="material-icons icon-button notes-edit-button">visibility</button>
                    <Menu options={layoutOptions}>
                        <button className="dots-button">⋮</button>
                    </Menu>
                </div>
            </div>
            <div className="notes-content">
                Skeleton - 
                Example Content
                Example Content
                Example Content
                Example Content
                Example Content
                Example Content
            </div>
        </div>
    </section>
    )
}

export default NoteBox
