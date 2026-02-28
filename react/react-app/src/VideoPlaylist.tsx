import type { MenuOption } from "./Menu.tsx" // import type important for importing types
import Menu from "./Menu.tsx"

type VideoPlaylistProps = {
    layoutOptions: MenuOption[],
    id: string,
    list: string // file name or local store var name
}

function VideoPlaylist({ layoutOptions, id, list }: VideoPlaylistProps){

    return <section>
        <div className="passage-header">
             <select className="reading-title-select">
                <option value="0">Genesis</option>
                <option value="1">Exodus</option>
                <option value="2">Leviticus</option>
            </select>
            <div>
                <Menu options={layoutOptions}>
                    <button className="dots-button">⋮</button>
                </Menu>
            </div>
        </div>
        <div className="video-container">
        <h1>VideoPlaylist Skeleton</h1>
        </div>
    </section>
}

export default VideoPlaylist
