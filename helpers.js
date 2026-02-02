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

// set a cookie
function setCookie(name, value, days = 1000)
{
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};path=/;expires=${d.toUTCString()}`;
}

// get cookie value
function getCookie(name)
{
    const decoded = decodeURIComponent(document.cookie);
    const prefix = name + "=";
    const cookies = decoded.split(';');
    for (let cookie of cookies) {
        cookie = cookie.trim();
        if (cookie.startsWith(prefix)) return cookie.substring(prefix.length);
    }
    return null;
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
