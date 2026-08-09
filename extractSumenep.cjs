const fs = require('fs');

try {
  console.log("Reading indonesia.geojson...");
  const data = JSON.parse(fs.readFileSync('./public/indonesia.geojson', 'utf8'));
  const sumenepFeatures = [];
  
  if (data.features) {
    data.features.forEach(f => {
      const propsStr = JSON.stringify(f.properties).toLowerCase();
      // Look for Sumenep in properties
      if (propsStr.includes('sumenep')) {
         // Extract kecamatan name depending on typical property structures
         const name = f.properties.WADMKC || f.properties.KECAMATAN || f.properties.NAMOBJ || f.properties.name || "Unknown";
         
         let risk = 'rendah';
         if (name.toLowerCase().includes('gapura')) {
           risk = 'tinggi';
         } else if (name.toLowerCase().includes('kota') || name.toLowerCase().includes('batuan')) {
           risk = 'sedang';
         }
         
         f.properties = {
            name: "Kec. " + (name !== "Unknown" ? name : "Sumenep"),
            risk: risk
         };
         sumenepFeatures.push(f);
      }
    });
  }
  
  fs.writeFileSync('./public/sumenep.geojson', JSON.stringify({ type: 'FeatureCollection', features: sumenepFeatures }));
  console.log("Extracted " + sumenepFeatures.length + " features for Sumenep.");
} catch(e) { 
  console.error(e.message); 
}
