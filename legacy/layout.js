// for holding a list of components which can be reordered etc
class Layout
{
    //create empty layout
    constructor()
    {
        this.componentList = [];
    }

    // load the layout from a json object
    async loadFromJSON(json)
    {     
        this.componentList = []; // clear any existing
        if (!Array.isArray(json)) return;

        for(const component of json)
        {
            const builder = componentBuilders[component.type];
            if(!builder)
            {
            console.warn(`Component not recognised: "${component.type}. Skipping..."`);
            continue;
            }

            const instance = await builder(component);

            this.componentList.push(instance);

        }
    }

    // initialise all of the components using their own init methods
    initRenderer(containerElement)
    {  
        let layoutContainer = containerElement;
        layoutContainer.innerHTML = "";
        for(const component of this.componentList)
        {
            
            let componentContainer = document.createElement("section");
            componentContainer.id = component.id + "_container";
            layoutContainer.appendChild(componentContainer);
            component.initRenderer(componentContainer);

            const optionsContainer = document.createElement("div");
            let optionsButton = createOptionsButton();
            optionsContainer.appendChild(optionsButton);

            // link options menu to the button
            let optionsMenu = new Menu(optionsButton,
                [
                {label:"Move up", action: () => {this.moveUp(component.id); this.initRenderer(containerElement);}},
                {label:"Move down", action: () => {this.moveDown(component.id); this.initRenderer(containerElement);}},
                {label:"Delete", action: () => {this.deleteComponent(component.id); this.initRenderer(containerElement);}}
                ]
            );
            component.getHeaderContainer().appendChild(optionsContainer);
        }

        // + component with menu to add new component to layout
        

        const addContainer = document.createElement("section");
        addContainer.className = "add-component-container";

        const addButton = document.createElement("button");
        addButton.textContent = "+";
        addButton.className = "add-component-button";

        addContainer.appendChild(addButton);
        layoutContainer.appendChild(addContainer);

        new Menu(addButton,[
            {
                label: "Passage",
                action: async () => {
                    await this.addComponent({
                        type: "passage",
                        id: this.generateId(),
                        list: "Bible_Chapters.txt"
                    }, containerElement);
                }
            },
            {
                label: "Psalm",
                action: async () => {
                    await this.addComponent({
                        type: "passage",
                        id: this.generateId(),
                        list: "Psalms.txt"
                    }, containerElement);
                }
            },
            {
                label: "Note Box",
                action: async () => {
                    await this.addComponent({
                        type: "notebox",
                        id: this.generateId(),
                    }, containerElement);
                }
            },
            // video playlist
            {
                label: "Video Playlist",
                action: async () => {
                    await this.addComponent({
                        type: "videoPlaylist",
                        id: this.generateId(),
                    }, containerElement);
                }
            }
        ]);

    }

    // render the components using their own render initiate methods
    render()
    {
        for(const component of this.componentList)
        {
            component.render();
        }
    }

    moveUp(id)
    {
        const index = this.componentList.findIndex(c => c.id === id);
        if (index <= 0) return;

        let temp = this.componentList[index -1];
        this.componentList[index -1] = this.componentList[index];
        this.componentList[index] = temp;
        saveComponentsConfig(this.toJSON());
    }

    moveDown(id)
    {
        const index = this.componentList.findIndex(c => c.id === id);
        if (index >= this.componentList.length - 1) return;

        let temp = this.componentList[index +1];
        this.componentList[index +1] = this.componentList[index];
        this.componentList[index] = temp;
        saveComponentsConfig(this.toJSON());
    }

    deleteComponent(id)
    {
        const index = this.componentList.findIndex(c => c.id === id);
        if(index === -1) return;

        const component = this.componentList[index];
        if(component.destroy) component.destroy();

        this.componentList.splice(index, 1);
        saveComponentsConfig(this.toJSON());
    }

    toJSON()
    {
        return this.componentList.map(comp => comp.toJSON());
    }

    // generate a unique id for a new element
    generateId()
    {
        let id;
        do
        {
            id = "comp_" + Math.random().toString(36).slice(2, 9);
        } while (this.componentList.some(c => c.id === id));
        return id;
    }

    async addComponent(config, containerElement)
    {
        const builder = componentBuilders[config.type];
        if (!builder) return;

        const instance = await builder(config);

        this.componentList.push(instance);

        saveComponentsConfig(this.toJSON());
        this.initRenderer(containerElement);
    }

}