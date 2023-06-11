// Earthquake geoJSON (week or month)
// const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson";
const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson";

// Boundaries geoJSON (also in /data/)
const urlBoundaries = "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json";

// define so they are only calculated once, as they can noticeably slow down page load
let gradientColors = ["#FFF769", "#87FF9C", "#34C4C9", "#1823C6", "#9F06C9", "#B80000"];
let colorDomain;
let chromaScale;

// `async` function because I was having trouble with loading the plate data with d3.json().then()
// not finishing reading while the original data was trying to make the map, causing an error
// with the layers. So instead, I await for both files to load, then create the features.
// I suppose I could have done d3.json(url_1).then(data_1 => {d3.json(url_2).then(data_2 => {})})
// but that is not as readable.
/** Starting function, loads the data, calculates the depth gradient */
async function init() {
    let earthquakeData = await d3.json(url);
    let plateBoundaryData = await d3.json(urlBoundaries);

    // set Color Values
    let allDepths = getDepths(earthquakeData.features);
    console.log("Total Earthquakes", allDepths.length);
    colorDomain = chroma.limits(allDepths, 'l', gradientColors.length - 1);  // logarithmic
    chromaScale = chroma.scale(gradientColors).domain(colorDomain);

    // create Part 1 Main features
    let earthquakeFeatures = createEarthquakeFeatures(earthquakeData.features);
    
    // create Part 2 OPTIONAL features
    let plateBoundaryFeatures = createPlateBoundaryFeatures(plateBoundaryData);

    createMap(earthquakeFeatures, plateBoundaryFeatures);
}


/**
 * Function to create an array for all depths in the earthquake data
 * 
 * NOTE: Because a logarithmic scale is used for the depth color,
 *  values > 0 are not valid and are instead converted to 0.01
 * 
 * @param {any} features geoJSON features
 * @returns Array of numbers
 */
function getDepths(features) {
    let depths = []
    features.forEach(element => {
        let value = element.geometry.coordinates[2];
        depths.push(value > 0 ? value : 0.01);
    });
    return depths;
}

/**
 * Gives a color for a given depth. Values >= 0 are the same color as 0.001
 * @param {number} depth
 * @returns hex color string
 */
function colorDepth(depth) {
    return chromaScale(depth).hex();
}

/**
 * Gives the radius to use given a magnitude number.
 * 
 * Values (including negatives) less than 0.5 are given a minimum size of 2
 *  otherwise values could be too small to click on.
 * @param {number} magnitude
 */
function radiusMagnitude(magnitude) {
    if (magnitude < 0.5) {
        return 2;
    } else {
        return magnitude * 4;
    }
}

/**
 * Adds a popup to a layer (each earthquake) containing the location, depth, magnitude, and date-time
 */
function _addPopup(feature, layer) {
    const dateFormat = new Intl.DateTimeFormat("en-us", {dateStyle: "medium", timeStyle: "short", timeZone: "UTC"})
    layer.bindPopup(`${feature.properties.place}
                    <hr>
                    Depth: ${feature.geometry.coordinates[2]} km<br>
                    Magnitude: ${feature.properties.mag}<hr>
                    ${dateFormat.format(new Date(feature.properties.time))} UTC`)
}

/**
 * Converts the geoJSON point to a circleMarker layer.
 */
function _pointToLayer(feature, latLong) {
    return L.circleMarker(latLong, {
        color: colorDepth(feature.geometry.coordinates[2]),
        fillColor: colorDepth(feature.geometry.coordinates[2]),
        fillOpacity: 0.8,
        stroke: false,
        radius: radiusMagnitude(feature.properties.mag),
    })
}

/** Creates the earthquake markers layer for the map */
function createEarthquakeFeatures(earthquakeData) {
    let earthquakes = L.geoJSON(earthquakeData,
        {onEachFeature: _addPopup,
         pointToLayer: _pointToLayer,
        });
    return earthquakes
}

/** Creates the optional plate boundary layer for the map */
function createPlateBoundaryFeatures(plateBoundaryData) {
    let boundaries = L.geoJSON(plateBoundaryData,
        {color: "#ff6e00",  // orange
        });
    return boundaries;
}


/** Create the legend for the depth of the earthquakes */
function createLegend() {
    let legend = L.control({position: "bottomright"});

    legend.onAdd = () => {
        let div = L.DomUtil.create("div", "legend");

        // create list of html <li> elements with scale values
        let htmlLI = []
        colorDomain.forEach((value, index) => {
            // smallest value is slightly greater than 0, so we will display it as 0.01 +
            let formattedValue = index == 0 ? "0.01 +" : value.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
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


/** Creates the map and adds the base & overlay layers and the legend */
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
        maxZoom: 16,
        attribution: 'Tiles courtesy of the <a href="https://usgs.gov/">U.S. Geological Survey</a>'
    });

    let NASAGIBS_ViirsEarthAtNight2012 = L.tileLayer('https://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/{time}/{tilematrixset}{maxZoom}/{z}/{y}/{x}.{format}', {
        attribution: 'Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (<a href="https://earthdata.nasa.gov">ESDIS</a>) with funding provided by NASA/HQ.',
        minZoom: 1,
        maxZoom: 8,
        format: 'jpg',
        time: '',
        tilematrixset: 'GoogleMapsCompatible_Level'
    });

    let baseMaps = {
        Base: esriGray,
        Streets: street,
        Satellite: USGS_USImagery,
        Night: NASAGIBS_ViirsEarthAtNight2012,
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

    // Boundary lines to make clear where the edge of the map with data is
    L.polyline([[-85,180],[85,180]], {color: "#ddd"}).addTo(earthquakeMap);
    L.polyline([[-85,-180],[85,-180]], {color: "#ddd"}).addTo(earthquakeMap);

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

// run the init function to start map creation
init();