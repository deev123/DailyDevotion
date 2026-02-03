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


            let optionsButton = createOptionsButton();
            component.getHeaderContainer().appendChild(optionsButton);
            // TODO: Add organise controls and + control
            // possibly need separate containers for each with controls outside
        }

    }

    // render the components using their own render initiate methods
    render()
    {
        for(const component of this.componentList)
        {
            component.render();
        }
    }

    setActive()
    {
        //TODO:
    }

    moveUp(sectionId)
    {
        // TODO: 
    }

    moveDown(sectionId)
    {
        // TODO:
    }

    toJSON()
    {
        return this.componentList.map(comp => comp.toJSON());
    }

}