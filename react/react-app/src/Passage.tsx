import type { MenuOption } from "./Menu.tsx" // import type important for importing types
import Menu from "./Menu.tsx"

type PassageProps = {
    layoutOptions: MenuOption[];
}

function Passage({ layoutOptions }: PassageProps){

    // add additional options to menu if needed:
    // const menuOptions = [...layoutOptions, ...extraOptions];
    // console.log(layoutOptions);

    return (
    <section>
        <div className="passage-header">
            <select className="reading-title-select">
                <option value="0">Psalm 1</option>
                <option value="1">Psalm 2</option>
                <option value="2">Psalm 3</option>
            </select>
            <div>
                <Menu options={layoutOptions}>
                    <button className="dots-button">⋮</button>
                </Menu>
            </div>
        </div>
        <div>
            <p>Passage</p>
        </div>
    </section>
    )
}

export default Passage
