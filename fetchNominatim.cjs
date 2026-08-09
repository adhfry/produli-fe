const axios = require('axios');
const fs = require('fs');

async function run() {
  const subdistricts = [
    "Gapura", "Kota Sumenep", "Kalianget", "Batuan", "Bluto", "Saronggi", "Manding", "Dasuk", "Rubaru", "Lenteng", "Ganding", "Pragaan", "Ambunten", "Pasongsongan", "Batuputih", "Dungkek", "Batang Batang"
  ];
  const uniqueSub = [...new Set(subdistricts)];
  const features = [];

  for (let s of uniqueSub) {
    try {
      console.log("Fetching " + s + "...");
      const url1 = `https://nominatim.openstreetmap.org/search?q=Kecamatan+${encodeURIComponent(s)},+Sumenep&format=geojson&polygon_geojson=1`;
      let res = await axios.get(url1, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      
      if (!res.data.features || res.data.features.length === 0) {
        await new Promise(r => setTimeout(r, 1500));
        const url2 = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(s)},+Sumenep&format=geojson&polygon_geojson=1`;
        res = await axios.get(url2, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
      }

      if (res.data.features && res.data.features.length > 0) {
        let f = res.data.features.find(x => x.geometry.type.includes('Polygon'));
        if (f) {
           f.properties = {
              name: "Kec. " + s,
              risk: s.includes("Gapura") ? "tinggi" : (s.includes("Kota") || s.includes("Batuan") ? "sedang" : "rendah")
           };
           features.push(f);
        } else {
           console.log("Only points found for " + s);
        }
      } else {
        console.log("Not found for " + s);
      }
      await new Promise(r => setTimeout(r, 1500));
    } catch(e) { console.error("Error for " + s, e.message); }
  }

  const fc = { type: "FeatureCollection", features };
  fs.writeFileSync('./public/sumenep.geojson', JSON.stringify(fc));
  console.log("Saved " + features.length + " features to public/sumenep.geojson!");
}
run();
