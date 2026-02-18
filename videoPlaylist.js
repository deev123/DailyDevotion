
const videoList = [
  {  "title": "Genesis",  "videoId": "B2tlR3nfzjQ"  },  {  "title": "Exodus",  "videoId": "J0e_uxK0bz0"  },  {  "title": "Leviticus",  "videoId": "E6gUYzYbHbQ"  },  {  "title": "Numbers",  "videoId": "VnihqFO0MiQ"  },  {  "title": "Deuteronomy",  "videoId": "yUdIi2IGZu4"  },  {  "title": "Joshua",  "videoId": "S-PI6iXQMU4"  },  {  "title": "Judges",  "videoId": "tZDvCkmqM-A"  },  {  "title": "Ruth",  "videoId": "cMv371tkH1E"  },  {  "title": "1 Samuel",  "videoId": "BIgh_IpdISg"  },  {  "title": "2 Samuel",  "videoId": "G7Tu2JqRv3A"  },  {  "title": "1 Kings",  "videoId": "co75stajLdk"  },  {  "title": "2 Kings",  "videoId": "wAwtDOPdfCk"  },  {  "title": "1 Chronicles",  "videoId": "doV8Zjqfi7U"  },  {  "title": "2 Chronicles",  "videoId": "p0Q2HUhpw4o"  },  {  "title": "Ezra",  "videoId": "Pnuk0XGZ0lY"  },  {  "title": "Nehemiah",  "videoId": "PkfKP1qEswM"  },  {  "title": "Esther",  "videoId": "sQk6uP311rk"  },  {  "title": "Job",  "videoId": "joPmadKxL-Y"  },  {  "title": "Psalm",  "videoId": "_3-Zr7wqErs"  },  {  "title": "Proverbs",  "videoId": "BkWNYCZXWJE"  },  {  "title": "Ecclesiastes",  "videoId": "XIfQdgzhD-w"  },  {  "title": "SongOfSongs",  "videoId": "UsEPTbTatl8"  },  {  "title": "Isaiah",  "videoId": "eWuhblhOZ9Q"  },  {  "title": "Jeremiah",  "videoId": "3QN7MuOol5w"  },  {  "title": "Lamentations",  "videoId": "fXNNuO7d2QU"  },  {  "title": "Ezekiel",  "videoId": "n_4ST-3Nik4"  },  {  "title": "Daniel",  "videoId": "9Ff05Zm6ogc"  },  {  "title": "Hosea",  "videoId": "JW_5atAqu2M"  },  {  "title": "Joel",  "videoId": "5KE8FlvBfdw"  },  {  "title": "Amos",  "videoId": "a24kNqzgSXE"  },  {  "title": "Obadiah",  "videoId": "-kAhauTqfoI"  },  {  "title": "Jonah",  "videoId": "HQv7j1UM1Zs"  },  {  "title": "Micah",  "videoId": "Y8Xu79aiWGU"  },  {  "title": "Nahum",  "videoId": "zWlWPkaadqo"  },  {  "title": "Habakkuk",  "videoId": "484sH79PpFw"  },  {  "title": "Zephaniah",  "videoId": "pgAbsrw_JWc"  },  {  "title": "Haggai",  "videoId": "6ZubXeDx9is"  },  {  "title": "Zechariah",  "videoId": "J7Ax7N8TpJg"  },  {  "title": "Malachi",  "videoId": "rz4_oy-MnF0"  },  {  "title": "Matthew",  "videoId": "tZ2PkTAdhRQ"  },  {  "title": "Mark",  "videoId": "0VbV5MwAYHQ"  },  {  "title": "Luke",  "videoId": "GZATXSARxUE"  },  {  "title": "John",  "videoId": "yu4mOHg3Oi4"  },  {  "title": "Acts",  "videoId": "bPlIWm4iJrM"  },  {  "title": "Romans",  "videoId": "vvsiq_4aUzg"  },  {  "title": "1 Corinthians",  "videoId": "CmsjIuZK55A"  },  {  "title": "2 Corinthians",  "videoId": "rMWT6-HRr44"  },  {  "title": "Galatians",  "videoId": "D_VIJl_6e1o"  },  {  "title": "Ephesians",  "videoId": "SKBYglw-pFA"  },  {  "title": "Philippians",  "videoId": "JU1Jbnog8JM"  },  {  "title": "Colossians",  "videoId": "rLgCYDx7Aj8"  },  {  "title": "1 Thessalonians",  "videoId": "p1ycnLkP7w0"  },  {  "title": "2 Thessalonians",  "videoId": "U-QD18LOnoA"  },  {  "title": "1 Timothy",  "videoId": "ppmJQuuWxVg"  },  {  "title": "2 Timothy",  "videoId": "ol-4p2u2Ops"  },  {  "title": "Titus",  "videoId": "f7HgDzW3jGM"  },  {  "title": "Philemon",  "videoId": "MupQJ7KkiTc"  },  {  "title": "Hebrews",  "videoId": "l2OUFDyqCEY"  },  {  "title": "James",  "videoId": "NmDYWctvcWI"  },  {  "title": "1 Peter",  "videoId": "SBGdT17yQCM"  },  {  "title": "2 Peter",  "videoId": "7P-iqS0VswM"  },  {  "title": "1 John",  "videoId": "ISkzwbxn27U"  },  {  "title": "2 John",  "videoId": "DVffthy-uHQ"  },  {  "title": "3 John",  "videoId": "dHN8r6l69_o"  },  {  "title": "Jude",  "videoId": "gOTweLZPtL0"  },  {  "title": "Revelation",  "videoId": "5BUEszR0Irg"  } 
];


class VideoPlaylist
{
    constructor(id, list = videoList, index = 0)
    {
        this.id = id;
        this.list = list;
        this.index = index;

        this.container = null;
        this.headerContainer = null;
        this.videoContainer = null;
        this.footerContainer = null;
    }

    current()
    {
        return this.list[this.index];
    }

    next()
    {
        if (this.index < this.list.length - 1)
        {
            this.index++;
        }
        else
        {
            this.index = 0; // wrap
        }
        
        this.saveState()
        this.render();
    }

    prev()
    {
        if (this.index > 0)
        {
            this.index--;
        }
        else
        {
            this.index = this.list.length - 1; // wrap
        }
        
        this.saveState()
        this.render();
    }

    async initRenderer(containerElement)
    {

        
        this.loadState();
        
        //create and assign container
        this.container = document.createElement("div");
        this.container.id = this.id;
        containerElement.appendChild(this.container);
        
        // container for all header elements
        this.headerContainer = document.createElement("div");
        this.headerContainer.classList.add("passage-header")
        
        this.titleSelect = document.createElement("select");
        this.titleSelect.className = "reading-title-select";
        this.titleSelect.id = this.id + "_select";
        
        this.headerContainer.appendChild(this.titleSelect);
        this.container.appendChild(this.headerContainer);
        
        // add title options to titleSelect
        this.list.forEach((video, i) => {
            const option = document.createElement("option");
            option.value = i;
            option.textContent = video.title;
            this.titleSelect.appendChild(option);
        });
        this.titleSelect.value = this.index;
        
        this.titleSelect.addEventListener("change", () => {
            this.index = parseInt(this.titleSelect.value);
            this.saveState();
            this.render();
        });
        //
        
        // this.verseContainer = document.createElement("div");
        // this.container.appendChild(this.verseContainer);
        
        // Video container
        this.videoContainer = document.createElement("div");
        this.videoContainer.classList.add("video-container");
        this.container.appendChild(this.videoContainer);
        
        // temporary nav buttons
        // this.footerContainer = document.createElement("div");
        // this.footerContainer.classList.add("passage-footer")
        
        
        // const prevBtn = document.createElement("button");
        // prevBtn.textContent = "Previous";
        // prevBtn.addEventListener("click", () => this.prev());
        
        // const nextBtn = document.createElement("button");
        // nextBtn.textContent = "Next";
        // nextBtn.addEventListener("click", () => this.next());
        
        // this.footerContainer.appendChild(prevBtn);
        // this.footerContainer.appendChild(nextBtn);
        
        // this.container.appendChild(this.footerContainer);
        
        this.render();
    
    }

    render()
    {
        if (!this.videoContainer) return;

        const video = this.current();

        // Clear existing video
        this.videoContainer.innerHTML = "";

        const iframe = document.createElement("iframe");
        iframe.width = "100%";
        iframe.height = "400";
        iframe.src = `https://www.youtube.com/embed/${video.videoId}?rel=0`;
        iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;

        this.videoContainer.appendChild(iframe);

        this.titleSelect.value = this.index;
    }

    saveState()
    {
        setStore(this.id + "_index", this.index);
    }

    loadState()
    {
        const saved = localStorage.getItem(this.id + "_index");
        this.index = parseInt(saved) || 0;
    }

    toJSON()
    {
        return {
            type: "videoPlaylist",
            id: this.id,
            list: this.list
        };
    }

    getHeaderContainer()
    {
        return this.headerContainer;
    }

    getFooterContainer()
    {
        return this.footerContainer;
    }

    destroy()
    {
        if (this.container && this.container.parentElement)
        {
            this.container.parentElement.removeChild(this.container);
        }

        this.container = null;
        this.videoContainer = null;
        this.headerContainer = null;
        this.footerContainer = null;
    }
}

