const axios = require('axios');
const fs = require('fs');
const osmtogeojson = require('osmtogeojson');

async function run() {
  const query = `[out:json];area["name"="Sumenep"]["admin_level"="6"]->.searchArea;relation["admin_level"="7"](area.searchArea);out geom;`;
  try {
    console.log("Fetching from Overpass API...");
    const url = 'https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query);
    const res = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }});
    const geojson = osmtogeojson(res.data);
    
    if (geojson.features) {
      geojson.features.forEach(f => {
        const name = f.properties.name || '';
        if (name.toLowerCase().includes('gapura')) {
          f.properties.risk = 'tinggi';
        } else if (name.toLowerCase().includes('kota') || name.toLowerCase().includes('batuan')) {
          f.properties.risk = 'sedang';
        } else {
          f.properties.risk = 'rendah';
        }
      });
    }

    fs.writeFileSync('./public/sumenep.geojson', JSON.stringify(geojson));
    console.log("Success! Saved to public/sumenep.geojson with " + geojson.features.length + " features.");
  } catch(e) {
    console.error("Error:", e.message);
  }
}
run();
