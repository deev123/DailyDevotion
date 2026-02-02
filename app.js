// list of all readings on page
let readings = [];

// config of readings
// TODO: Load these from cookies and add page customisability
const readingConfigs = [
    {id: "dailyPsalm", file: "Psalms.txt"},
    {id: "dailyReading", file:"Bible_Chapters.txt"}
];

// initialise the reading elements and render
async function initReadings(configs)
{
  for (const cfg of configs)
  {
    const list = await loadList(cfg.file);
    const savedIndex = parseInt(getCookie(cfg.id)) || 0;
    const reading = new Passage(cfg.id, list, savedIndex);
    await reading.initRenderer(cfg.containerId);
    await reading.render();

    // Store in global registry
    readings.push(reading);
  }
}

initReadings(readingConfigs);



class ContinuousPassage // TODO: Infinite Scroll viewport version
{

}

class Video // TODO: Video embed element (audio bible etc) with saved timestamp
{

}
