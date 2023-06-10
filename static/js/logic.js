const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";
// const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson";

// boundaries JSON (also in /data/)
const urlBoundaries = "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json";

// define so they are only calculated once, as they can noticeably slow down page load
let gradientColors = ["#B6FFC2", "#59C0ED", "#0065B2", "#761DAD", "#CD3300"];
let colorDomain;
let chromaScale;

// function init() {
//     let earthquakeFeatures;
//     let plateBoundaryFeatures;

//     d3.json(url).then(data => {
//         let allDepths = getDepths(data.features);
//         colorDomain = chroma.limits(allDepths, 'l', gradientColors.length - 1);
//         chromaScale = chroma.scale(gradientColors).domain(colorDomain);
//         earthquakeFeatures = createEarthquakeFeatures(data.features);
//     });

//     // d3.json(urlBoundaries).then(data => {
//     //     console.log(data);
//     //     plateBoundaryFeatures = L.geoJSON(data);
//     // });

//     createMap(earthquakeFeatures, plateBoundaryFeatures);
// }

async function init() {
    let earthquakeData = await d3.json(url);
    let plateBoundaryData = await d3.json(urlBoundaries);

    // set Color Values
    let allDepths = getDepths(earthquakeData.features);
    colorDomain = chroma.limits(allDepths, 'l', gradientColors.length - 1);
    chromaScale = chroma.scale(gradientColors).domain(colorDomain);

    // create Part 1 Main features
    let earthquakeFeatures = createEarthquakeFeatures(earthquakeData.features);
    
    // create Part 2 BONUS features
    let plateBoundaryFeatures = createPlateBoundaryFeatures(plateBoundaryData);

    createMap(earthquakeFeatures, plateBoundaryFeatures);
}


/**
 * Function to create an array for all depths in the earthquake data
 * 
 * NOTE: Because a logarithmic scale is used for the depth color,
 *  values > 0 are not valid and are instead converted to 0.0001
 * 
 * @param {any} features geoJSON features
 * @returns Array of numbers
 */
function getDepths(features) {
    let depths = []
    features.forEach(element => {
        let value = element.geometry.coordinates[2];
        depths.push(value > 0 ? value : 0.001);
    });
    return depths;
}


function colorDepth(depth) {
    return chromaScale(depth).hex();
}

function radiusMagnitude(magnitude) {
    return magnitude * 4;
}

function _addPopup(feature, layer) {
    layer.bindPopup(`${feature.properties.place}
                    <hr>
                    Depth: ${feature.geometry.coordinates[2]} km<br>
                    Magnitude: ${feature.properties.mag}<br>
                    ${new Date(feature.properties.time).toISOString()} UTC`)
}

function _pointToLayer(feature, latLong) {
    return L.circleMarker(latLong, {
        color: colorDepth(feature.geometry.coordinates[2]),
        fillColor: colorDepth(feature.geometry.coordinates[2]),
        fillOpacity: 0.75,
        stroke: false,
        radius: radiusMagnitude(feature.properties.mag),
    })
}

function createEarthquakeFeatures(earthquakeData) {
    let earthquakes = L.geoJSON(earthquakeData,
        {onEachFeature: _addPopup,
         pointToLayer: _pointToLayer,
        });
    return earthquakes
}

function createPlateBoundaryFeatures(plateBoundaryData) {
    let boundaries = L.geoJSON(plateBoundaryData,
        {color: "#ffae00",  // gold-yellow
        });
    return boundaries;
}


function createLegend() {
    let legend = L.control({position: "bottomright"});

    legend.onAdd = () => {
        let div = L.DomUtil.create("div", "legend");

        // create list of html <li> elements with scale values
        let htmlLI = []
        colorDomain.forEach((value, index) => {
            // smallest value is slightly greater than 0, so we will display it as 0.00 +
            let formattedValue = index == 0 ? "0.00 +" : value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
            htmlLI.push("<li>" + formattedValue + "</li>");
        });

        // create the HTML for the legend
        div.innerHTML = `<h3 class="legend_title">Depth (km)</h3>
                        <div class="data_container">
                            <div class="gradient" style="background: linear-gradient(${gradientColors.join(", ")})"></div>
                            <div class="gradient_values">
                                <ul>
                                    ${htmlLI.join('')}
                                </ul>
                            </div>
                        </div>`;
        return div;
    }
    return legend;
}


function createMap(earthquakes, plateBoundaries) {
    // For tile map options see: https://leaflet-extras.github.io/leaflet-providers/preview/
    let esriGray = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ',
        maxZoom: 16
    });

    let street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    })

    let USGS_USImagery = L.tileLayer('https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 20,
        attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
    });

    let baseMaps = {
        Base: esriGray,
        Streets: street,
        Satellite: USGS_USImagery
    };

    let overlayMaps = {
        Earthquakes: earthquakes,
        "Plate Boundaries": plateBoundaries
    };

    // create the map
    let earthquakeMap = L.map("map", {
        center: [37.0902, -95.7129],
        zoom: 4,
        layers: [esriGray, earthquakes]
    });

    // add the layers
    L.control.layers(
        baseMaps,
        overlayMaps,
        {collapsed: false})
        .addTo(earthquakeMap);
    
    // add the legend
    let legend = createLegend();
    legend.addTo(earthquakeMap);
}

init();