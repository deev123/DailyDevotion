class Notebox
{
    constructor(id)
    {
        this.id = id;
        this.container = null;
        this.contentContainer = null;
        this.titleElement = null;
        this.header = null;
        this.editButton = null;
        this.isEditing = false;
        this.listeners = [];
    }

    load()
    {
        return localStorage.getItem(this.id) || "";
    }

    save(text)
    {
        localStorage.setItem(this.id, text);
    }

    async initRenderer(containerElement)
    {
        this.container = document.createElement("div");
        this.container.id = this.id;
        this.container.className = "notes-container";

        // header
        this.header = document.createElement("div");
        this.header.className = "notes-header";

        // separate part for buttons away from title
        this.headerButtons = document.createElement("div");
        this.headerButtons.className = "notes-header-buttons";

        // title in header
        this.titleElement = document.createElement("h2");
        this.titleElement.textContent = "Notes"
        this.header.appendChild(this.titleElement);
        
        this.container.appendChild(this.header);
        this.header.appendChild(this.headerButtons);

        // main note area
        this.contentContainer = document.createElement("div");
        this.contentContainer.className = "notes-content";
        this.contentContainer.innerHTML = this.load(); // render saved HTML
        this.container.appendChild(this.contentContainer);

        // add the toggle edit button
        this.editButton = document.createElement("button");
        this.editButton.textContent = "edit";
        // use google icons
        this.editButton.classList.add("material-icons", "icon-button", "notes-edit-button");
        this.headerButtons.appendChild(this.editButton); // add to buttons header part

        // Button click toggles edit mode
        this.editButton.addEventListener("click", () => this.toggleEditMode());
        this.listeners.push({
            element: this.editButton,
            type: "click",
            handler: this.toggleEditMode
        });

        containerElement.appendChild(this.container);
    }

    toggleEditMode()
    {
        if (!this.isEditing)
        {
            // set content to be editable
            this.contentContainer.contentEditable = true;
            this.contentContainer.focus();

            // change the button icon to a tick
            this.editButton.textContent = "done";

            // save input while typing
            this.inputListener = () =>
            {
                this.save(this.contentContainer.innerHTML);
            };
            this.contentContainer.addEventListener("input", this.inputListener);
        } 
        else // toggle non editing mode
        {
        
            this.contentContainer.contentEditable = false;
            this.editButton.textContent = "edit";

            // remove event listener for typing
            this.contentContainer.removeEventListener("input", this.inputListener);
        }

        this.isEditing = !this.isEditing;
    }

    render()
    {
        // do nothing as the content is updated manually by user
    }

    destroy()
    {
        if(this.isEditing)
        {
            this.toggleEditMode(); // removes event listener for input
        }
        
        localStorage.removeItem(this.id);

        // remove event listeners
        this.listeners.forEach(l => {
            l.element.removeEventListener(l.type, l.handler);
        });
        this.listeners = [];

        if (this.container && this.container.parentElement) {
            this.container.parentElement.removeChild(this.container);
        }
        
        this.container = null;
        this.contentContainer = null;
        this.header = null;
        this.editButton = null;

    }

    toJSON() {
        return {
            type: "notebox",
            id: this.id
        };
    }

    getHeaderContainer()
    {
        // return the buttons part instead for this component
        return this.headerButtons; // needed to add layout options button
    }

    getFooterContainer()
    {
        // not used yet
        return null;
    }

}