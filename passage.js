class Passage
{
    constructor(id, list, index = 0, listSource)
    {
        this.id = id;
        this.list = list;
        this.listSource = listSource;
        this.index = index;
        
        // containers for rendering
        this.containerId = null;
        this.titleContainer = null;
        this.verseContainer = null;
        this.headerContainer = null;
        this.footerContainer = null;
    }

    
    // return current element of index
    current()
    {
        return this.list[this.index];
    }

    next() // increment index and return element
    {
        if (this.index < this.list.length - 1)
        {
            this.index++;
            this.saveState();
        }
        else // wrap
        {
            this.index = 0;
        }
        return this.current();
    }

    prev() // decrement index and return element
    {
        if (this.index > 0)
        {
            this.index--;
            this.saveState();
        }
        else // wrap
        {
            this.index = this.list.length - 1;
        }
        return this.current();
    }

    // call once to create the passage elements
    async initRenderer(containerElement)
    {

        //create and assign container
        this.container = document.createElement("div");
        this.container.id = this.id;

        // append container to page
        if (!this.container) return;

        this.titleContainer = document.createElement("h1");
        this.titleContainer.classList.add("hidden");
        this.container.appendChild(this.titleContainer);

        // container for all header elements
        this.headerContainer = document.createElement("div");
        this.headerContainer.classList.add("passage-header")

        this.titleSelect = document.createElement("select");
        this.titleSelect.className = "reading-title-select";
        this.titleSelect.id = this.id + "_select";

        this.headerContainer.appendChild(this.titleSelect);
        this.container.appendChild(this.headerContainer);

        this.list.forEach((passage, i) => {
            const option = document.createElement("option");
            option.value = i;
            option.textContent = passage;
            this.titleSelect.appendChild(option);
        });
        this.titleSelect.value = this.index;
        
        this.titleSelect.addEventListener("change", () => {
            this.index = parseInt(this.titleSelect.value);
            this.saveState();
            this.render();
        });
        //

        this.verseContainer = document.createElement("div");
        this.container.appendChild(this.verseContainer);

        // temporary nav buttons
        this.footerContainer = document.createElement("div");
        this.footerContainer.classList.add("passage-footer")


        // const prevBtn = document.createElement("button");
        // prevBtn.textContent = "Previous";
        // prevBtn.addEventListener("click", () => {this.prev(); this.render()});
        // const nextBtn = document.createElement("button");
        // nextBtn.textContent = "Next";
        // nextBtn.addEventListener("click", () =>
        //     {
        //         confetti({particleCount: 50, spread: 1000, origin: { y: 0.5 }});
        //         this.next(); this.render()
        //     });
        // navDiv.appendChild(prevBtn);
        // navDiv.appendChild(nextBtn);


        // checkbox for advancing
        const checkbox = createGooeyCheckbox(this.id + "_checkbox");
        this.footerContainer.appendChild(checkbox);

        checkbox.addEventListener("change", async () => {
            let check = checkbox.querySelector("input[type='checkbox']");
            if (!check.checked) return;
            
            confetti({particleCount: 50, spread: 1000, origin: { y: 0.5 }});
            
            await new Promise(resolve => setTimeout(resolve, 1000));
            this.next();
            // add effect to reading to swoop in?
            await this.render();

            // reset for next
            check.checked = false;
            
        });

        // to find the checkbox from the checkbox id:
        // let check = checkbox.querySelector("input[type='checkbox']");
        // check.checked = true;

        this.container.appendChild(this.footerContainer);
        // add elements to container
        containerElement.appendChild(this.container);

        // render first content
        await this.render();

    }

    // fetch verses and render element if initialised
    async render()
    {
        if (!this.titleContainer || !this.verseContainer) return;

        // transition out current

        this.titleContainer.textContent = this.current();
        const verses = await BibleAPI.fetchPassage(this.current());
        VerseRenderer.renderVerses(this.verseContainer, verses);
        
        //transition in new
        
        this.titleSelect.value = this.index;
    }

    // save current index of passage as a cookie for persistance
    saveState()
    {
        //save state in a cookie
        setStore(this.id, this.index);
    }

    toJSON()
    {
        return {
            type: "passage",
            id: this.id,
            list: this.listSource
        }
    }

    // get the header element for inserting components like for layout
    getHeaderContainer()
    {
        return this.headerContainer;
    }

    // get the footer nav controls element
    getFooterContainer()
    {
        return this.footerContainer;
    }

}