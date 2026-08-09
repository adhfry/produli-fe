const fs = require('fs');
const turf = require('@turf/turf');

const subdistricts = [
  { name: 'Kota Sumenep', coords: [113.86, -7.01], risk: 'sedang' },
  { name: 'Kalianget', coords: [113.91, -7.05], risk: 'rendah' },
  { name: 'Batuan', coords: [113.84, -7.02], risk: 'sedang' },
  { name: 'Manding', coords: [113.85, -6.95], risk: 'rendah' },
  { name: 'Dasuk', coords: [113.85, -6.89], risk: 'rendah' },
  { name: 'Rubaru', coords: [113.80, -6.93], risk: 'rendah' },
  { name: 'Pasongsongan', coords: [113.72, -6.89], risk: 'rendah' },
  { name: 'Ambunten', coords: [113.77, -6.90], risk: 'rendah' },
  { name: 'Batuputih', coords: [113.91, -6.90], risk: 'rendah' },
  { name: 'Gapura', coords: [113.91, -6.97], risk: 'tinggi' },
  { name: 'Dungkek', coords: [114.00, -6.95], risk: 'rendah' },
  { name: 'Batang Batang', coords: [113.96, -6.91], risk: 'rendah' },
  { name: 'Lenteng', coords: [113.78, -7.02], risk: 'rendah' },
  { name: 'Ganding', coords: [113.71, -7.02], risk: 'rendah' },
  { name: 'Pragaan', coords: [113.63, -7.08], risk: 'rendah' },
  { name: 'Bluto', coords: [113.78, -7.08], risk: 'rendah' },
  { name: 'Saronggi', coords: [113.84, -7.08], risk: 'rendah' },
  { name: 'Talango', coords: [113.96, -7.07], risk: 'rendah' },
  { name: 'Giligenting', coords: [113.94, -7.20], risk: 'rendah' },
  { name: 'Gayam', coords: [114.32, -7.15], risk: 'rendah' }
];

const points = turf.featureCollection(
  subdistricts.map(s => turf.point(s.coords, { name: 'Kec. ' + s.name, risk: s.risk }))
);

const bbox = [113.55, -7.25, 114.40, -6.80];
const voronoiPolygons = turf.voronoi(points, { bbox });

// Re-attach properties based on bounding box intersection since voronoi doesn't preserve properties order safely in all turf versions
turf.featureEach(voronoiPolygons, (currentFeature, featureIndex) => {
    let closestPoint = null;
    let minDistance = Infinity;
    
    // Find which point this polygon belongs to
    subdistricts.forEach(s => {
       const pt = turf.point(s.coords);
       // Check if point is inside polygon
       if (turf.booleanPointInPolygon(pt, currentFeature)) {
           closestPoint = s;
       }
    });

    if (closestPoint) {
        currentFeature.properties = {
            name: 'Kec. ' + closestPoint.name,
            risk: closestPoint.risk
        };
    } else {
        currentFeature.properties = { name: 'Unknown', risk: 'rendah' };
    }
});

fs.writeFileSync('./public/sumenep.geojson', JSON.stringify(voronoiPolygons));
console.log("Successfully generated realistic Voronoi mapping for Sumenep.");
