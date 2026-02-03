// abstraction of api for getting the verses
class BibleAPI
{
  static async fetchPassage(reference, translation = "WEB")
  {
    if (!reference) return [];

    try
    {
        const url = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Failed to fetch passage");

         const data = await response.json();

        if (data.verses)
        {
        return data.verses.map(v => ({ verse: v.verse, text: v.text }));
        }
        else
        {
            return [{ verse: "", text: "No passage found." }];
        }
    }
    catch (err)
    {
      console.error("BibleAPI error:", err);
      return [{ verse: "", text: "Error fetching passage." }];
    }
  }
}

// class for rendering verses in a viewport
class VerseRenderer {

    
  // make WEB translation more like the NIV
  static convertToLORD(text)
  {
    // regex to find Yahweh, Yah, LORD GOD, GOD
    const replacements = {
      "\\bYahweh\\b": "(The) LORD",
      "\\bYah\\b": "(The) LORD"
    };

    for (const pattern in replacements) {
      const regex = new RegExp(pattern, "g");
      text = text.replace(regex, replacements[pattern]);
    }

    // Optional: fix double spaces
    return text.replace(/\s{2,}/g, " ");
  }

  static renderVerses(container, verses)
  {
    if (!container) return;
    container.innerHTML = "";

    verses.forEach(v =>
    {
      const p = document.createElement("p");
      const span = document.createElement("span");
      span.className = "verse-number";
      span.textContent = v.verse ? `${v.verse}. ` : "";
      p.appendChild(span);
      p.appendChild(document.createTextNode(VerseRenderer.convertToLORD(v.text)));
      container.appendChild(p);
    });
  }

}

// set a local storage value
function setStore(name, value)
{
    localStorage.setItem(name, JSON.stringify(value));
}

// get a local storage value
function getStore(name)
{
    const value = localStorage.getItem(name);
    return value ? JSON.parse(value) : null;
}

// delete a local storage value
function deleteStore(name) {
    localStorage.removeItem(name);
}

// return as an array a list separated by newlines
async function loadList(file) {
  try {
    const response = await fetch(file);
    if (!response.ok) throw new Error("Failed to load file");

    const text = await response.text();

    // Split by line breaks and remove empty lines
    return text
      .split(/\r?\n/)       // works for \n or \r\n
      .map(line => line.trim()) // remove leading/trailing spaces
      .filter(line => line.length > 0); // skip empty lines

  } catch (err) {
    console.error(err);
  }
}

// save json representation of layout to local storage
function saveComponentsConfig(json)
{
    localStorage.setItem("componentsConfig", JSON.stringify(json))
}

// load the layout of components as a json object from local storage or return null
function loadComponentsConfig()
{
    const json = localStorage.getItem("componentsConfig");
    if(!json) return null;
    return JSON.parse(json);
}

// js code to create a special checkbox
function createGooeyCheckbox(id) {
  const wrapper = document.createElement("div");
  wrapper.className = `checkbox-wrapper-${id}`;

  wrapper.innerHTML = `
    <div class="checkbox-wrapper-12">
    <div class="cbx">
        <input id="cbx-12" type="checkbox"/>
        <label for="cbx-12"></label>
        <svg width="15" height="14" viewbox="0 0 15 14" fill="none">
        <path d="M2 8.36364L6.23077 12L13 2"></path>
        </svg>
    </div>
    <!-- Gooey-->
    <svg xmlns="http://www.w3.org/2000/svg" version="1.1">
        <defs>
        <filter id="goo-12">
            <fegaussianblur in="SourceGraphic" stddeviation="4" result="blur"></fegaussianblur>
            <fecolormatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -7" result="goo-12"></fecolormatrix>
            <feblend in="SourceGraphic" in2="goo-12"></feblend>
        </filter>
        </defs>
    </svg>
    </div>
  `;

  return wrapper;
}
