const fs = require('fs');

try {
  const data = JSON.parse(fs.readFileSync('./public/indonesia.geojson', 'utf8'));
  
  if (data.features && data.features.length > 0) {
    console.log("Keys available in first feature:");
    console.log(Object.keys(data.features[0].properties));
    
    // search any feature that has sumenep in any value
    let found = data.features.filter(f => JSON.stringify(f.properties).toLowerCase().includes('sumenep'));
    console.log("Features mentioning sumenep: " + found.length);
    if(found.length > 0){
        console.log("Example:", found[0].properties);
    }
  }
} catch(e) { console.error(e.message); }
