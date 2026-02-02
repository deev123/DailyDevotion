class Passage
{
    constructor(id, list, index = 0)
    {
        this.id = id;
        this.list = list;
        this.index = index;
        
        // containers for rendering
        this.containerId = null;
        this.titleContainer = null;
        this.verseContainer = null;
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
    async initRenderer(containerId)
    {

        //create and assign container
        this.container = document.createElement("div");
        this.container.id = this.id;

        // append container to page
        if (!this.container) return;

        this.titleContainer = document.createElement("h2");
        this.container.appendChild(this.titleContainer);

        this.verseContainer = document.createElement("div");
        this.container.appendChild(this.verseContainer);

        // temporary nav buttons
        const navDiv = document.createElement("div");
        navDiv.classList.add("nav-buttons")
        const prevBtn = document.createElement("button");
        prevBtn.textContent = "Previous";
        prevBtn.addEventListener("click", () => {this.prev(); this.render()});
        const nextBtn = document.createElement("button");
        nextBtn.textContent = "Next";
        nextBtn.addEventListener("click", () => {this.next(); this.render()});
        navDiv.appendChild(prevBtn);
        navDiv.appendChild(nextBtn);
        this.container.appendChild(navDiv);

        // add elements to a div "container" in the HTML
        document.getElementById("container").appendChild(this.container);

        // render first content
        await this.render();

    }

    // fetch verses and render element if initialised
    async render()
    {
        if (!this.titleContainer || !this.verseContainer) return;

        this.titleContainer.textContent = this.current();
        const verses = await BibleAPI.fetchPassage(this.current());
        VerseRenderer.renderVerses(this.verseContainer, verses);

    }

    // save current index of passage as a cookie for persistance
    saveState()
    {
        //save state in a cookie
        setCookie(this.id, this.index);
    }

}