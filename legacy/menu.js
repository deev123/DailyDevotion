class Menu {
    constructor(button, options)
    {
        this.anchor = button;
        this.options = options;
        this.menu = null;
        this.popperInstance = null;
        this.isOpen = false;

        this.buildMenu();

        this.anchorClickHandler = (e) => {
            e.stopPropagation();
            this.toggle();
        };

        this.anchor.addEventListener("click", this.anchorClickHandler);

        // clicking outside closes the menu
        this.outsideClickHandler = (e) => {
            if (!this.menu.contains(e.target) && e.target !== this.anchor) {
                this.close();
            }
        };
    }

    buildMenu()
    {
        this.menu = document.createElement("div");
        this.menu.className = "menu";
        this.menu.style.display = "none";

        this.options.forEach(opt => {
            const item = document.createElement("button");
            item.textContent = opt.label;

            // not storing handlers since browser can delete them when the menu is removed from DOM
            item.addEventListener("click", (e) => {
                e.stopPropagation();
                this.close();
                opt.action();
            });

            this.menu.appendChild(item);
        });

        // stored just as a chilld of document to hover using popper.js instance
        document.body.appendChild(this.menu);
    }

    open()
    {
        if (this.isOpen) return;

        this.menu.style.display = "block";

        if (!this.popperInstance)
        {
            this.popperInstance = Popper.createPopper(this.anchor, this.menu, {
                placement: 'bottom-start',
                modifiers: [
                    { name: 'offset', options: { offset: [0, 8] } },
                    { name: 'preventOverflow', options: { padding: 8 } },
                    { name: 'flip', options: { fallbackPlacements: ['top-start'] } },
                ],
            });
        }
        else
        {
            this.popperInstance.update();
        }

        document.addEventListener("click", this.outsideClickHandler);
        this.isOpen = true;
    }

    close()
    {
        if (!this.isOpen) return;

        this.menu.style.display = "none";
        document.removeEventListener("click", this.outsideClickHandler);
        this.isOpen = false;
    }

    toggle()
    {
        this.isOpen ? this.close() : this.open();
    }

    destroy()
    {
        // closing removes outsideclick handler
        this.close();

        if (this.popperInstance)
        {
            this.popperInstance.destroy();
            this.popperInstance = null;
        }

        // remove anchor toggle listener
        if (this.anchor && this.anchorClickHandler)
        {
            this.anchor.removeEventListener("click", this.anchorClickHandler);
        }

        // remove menu from DOM
        if (this.menu && this.menu.parentElement)
        {
            this.menu.parentElement.removeChild(this.menu);
        }

        this.menu = null;
        this.anchor = null;
        this.options = null;
    }
}