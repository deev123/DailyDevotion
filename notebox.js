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

        this.states = {
            visible: "visibility",
            hidden: "visibility_off",
            locked: "lock"
        };

        // all state values
        this.title;
        this.state;
        this.text;

        
       
    }

    load()
    {
        
        this.title = localStorage.getItem(this.id + "_title") || "Notes";
        this.state = localStorage.getItem(this.id + "_state") || this.states.visible;
        this.text = localStorage.getItem(this.id + "_text") || "<br>";
    }

    save(key, text)
    {
        if(key === "_text" || key === "_title" || key === "_state")
        {
            localStorage.setItem(this.id + key, text);
        }
    }

    async initRenderer(containerElement)
    {
        // load title, text and state
        this.load();

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
        this.titleElement.textContent = this.title;
        this.header.appendChild(this.titleElement);
        
        this.container.appendChild(this.header);
        this.header.appendChild(this.headerButtons);

        // main note area
        this.contentContainer = document.createElement("div");
        this.contentContainer.className = "notes-content";

        this.contentContainer.innerHTML = this.text; // render saved HTML
        this.container.appendChild(this.contentContainer);

        // add the toggle edit button
        this.editButton = document.createElement("button");
        this.editButton.textContent = this.state;
        // use google icons
        this.editButton.classList.add("material-icons", "icon-button", "notes-edit-button");
        this.headerButtons.appendChild(this.editButton); // add to buttons header part


        this.stateClickHandler = () => {
            this.cycleState();
            this.applyState();
        };
        // Button click toggles edit mode
        this.editButton.addEventListener("click", this.stateClickHandler);
        this.listeners.push({
            element: this.editButton,
            type: "click",
            handler: this.stateClickHandler
        });

        containerElement.appendChild(this.container);

        // apply state that was loaded
        this.applyState();
    }

    // prefferably not used now. use {enable/disable}EditMode
    toggleEditMode()
    {
        if (!this.isEditing)
        {
            this.enableEditMode();
        } 
        else // toggle non editing mode
        {
        
            this.disableEditMode();
        }

    }

    enableEditMode()
    {
        if (!this.isEditing)
        {
            // set content to be editable
            this.contentContainer.contentEditable = true;
            
            this.titleElement.contentEditable = true;
            // this.contentContainer.focus();

            // change the button icon to a tick
            // this.editButton.textContent = "done";

            // save input while typing
            this.textInputListener = () =>
            {
                this.save("_text", this.contentContainer.innerHTML);
            };
            this.titleInputListener = () =>
            {
                this.save("_title", this.titleElement.innerHTML);
            };
            this.contentContainer.addEventListener("input", this.textInputListener);
            this.titleElement.addEventListener("input", this.titleInputListener);
            
            this.isEditing = true;
        } 
    }

    disableEditMode()
    {
        if (this.isEditing)
        {
        
            this.contentContainer.contentEditable = false;
            this.titleElement.contentEditable = false;
            // this.editButton.textContent = "edit";

            // remove event listener for typing
            // could do nothing if they dont exist
            this.contentContainer.removeEventListener("input", this.textInputListener);
            this.titleElement.removeEventListener("input", this.titleInputListener);
            
            this.isEditing = false;
        }
    }

    // strictly cycles the state variable to the next value. use applyState() afterwards to apply the state
    cycleState()
    {
        if(this.state === this.states.hidden)
        {
            // turn visible
            this.state = this.states.visible;
        }
        else if(this.state === this.states.visible)
        {
            // turn locked
            this.state = this.states.locked;

        }
        else if(this.state === this.states.locked)
        {
            // turn hidden
            this.state = this.states.hidden;
        }
        else // save with a fallback incase the state is currupted
        {
            console.warn("A notebox state was corrupt. using state = visible fallback");
            this.state = this.states.visible;
        }
    }

    applyState()
    {
        if(this.state === this.states.hidden)
        {
            this.editButton.textContent = this.state;
            this.disableEditMode();
            this.save("_state", this.state);
            this.contentContainer.classList.add("hide-text");

        }
        else if(this.state === this.states.visible)
        {
            
            this.editButton.textContent = this.state;
            this.enableEditMode();
            this.contentContainer.classList.remove("hide-text");
            this.save("_state", this.state);
            

        }
        else if(this.state === this.states.locked)
        {
            this.editButton.textContent = this.state;
            this.disableEditMode();
            this.contentContainer.classList.remove("hide-text");
            this.save("_state", this.state);

        }
    }

    render()
    {
        // do nothing as the content is updated manually by user
    }

    destroy()
    {
        if(this.isEditing)
        {
            this.disableEditMode(); // removes event listener for input
        }
        
        localStorage.removeItem(this.id + "_text");
        localStorage.removeItem(this.id + "_title");
        localStorage.removeItem(this.id + "_state");

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