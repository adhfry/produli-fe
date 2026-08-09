const fs = require('fs');
const osmtogeojson = require('osmtogeojson');

try {
  const data = JSON.parse(fs.readFileSync('./public/sumenep.geojson', 'utf8'));
  const geojson = osmtogeojson(data);
  
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

  fs.writeFileSync('./public/sumenep-final.geojson', JSON.stringify(geojson));
  console.log("Success! Converted to public/sumenep-final.geojson with " + geojson.features.length + " features.");
} catch(e) {
  console.error("Error:", e.message);
}
