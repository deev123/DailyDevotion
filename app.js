// When there is no saved layout the dafault is a psalm and bible passage
let componentsConfigDefault = [
  {
    type: "passage",
    id: "section1",
    list: "Psalms.txt",
  },
  {
    type: "passage",
    id: "section2",
    list: "Bible_Chapters.txt",
  }
];

// functions to instantiate a component by type and return it
const componentBuilders =
{
  passage: async (config) =>
  {
    const list = await loadList(config.list);
    const savedIndex = parseInt(getStore(config.id)) || 0;
    const passage = new Passage(config.id, list, savedIndex, config.list);

    return passage;
  },
  notebox: async (config) =>
  {
    const notebox = new Notebox(config.id);
    return notebox;
    // contents loaded from local storage by initrenderer of notebox
  }
};

// layout is empty now but will be populated with either the local storage componentsConfig or default componentsConfig
let layout = new Layout();

async function initApp()
{
  // load json for layout
  // use componentsConfigDefault if none found
  const configs = loadComponentsConfig() || componentsConfigDefault;

  // load layout
  await layout.loadFromJSON(configs);
  await layout.initRenderer(document.getElementById("container"));
  await layout.render();
  
  // once loaded save the config incase its new
  saveComponentsConfig(layout.toJSON());

}

initApp(componentsConfigDefault);



// other components

class ContinuousPassage // TODO: Infinite Scroll viewport version
{

}

class Video // TODO: Video embed element (audio bible etc) with saved timestamp
{

}

class Notes // TODO: Note area which persists between sessions
{

}

class MemoryPassage // TODO: A passage which has visualisations to aid memorisation?
{

}

class PassageSearch // TODO: component to search for a passage rather than load from a list
{

}