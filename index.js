// Mapbox Access Token
mapboxgl.accessToken =
    "pk.eyJ1IjoiYWJqYXJkaW0iLCJhIjoiY2tmZmpyM3d3MGZkdzJ1cXZ3a3kza3BybiJ9.2CgI2GbcJysBRHmh7WwdVA";

// The DDW Location
const end = [8.872643564339544, 51.94003709534788];

let markerFixed = true;

// Create map
const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/abjardim/clwq8mlvp010y01pn32ro63bq",
    center: end,
    zoom: 15.53,
});

const width = 20;
const height = 40;

// Restrict map panning to a radius
var radiusInKm = 10;
// Calculate bounding box
var centerPoint = turf.point(end);
var buffered = turf.buffer(centerPoint, radiusInKm, { units: "kilometers" });
var bbox = turf.bbox(buffered);
// Convert bounding box to Mapbox format
var bounds = [
    [bbox[0], bbox[1]], // [minLng, minLat]
    [bbox[2], bbox[3]], // [maxLng, maxLat]
];
// Set the max bounds on the map
map.on("load", function () {
    map.setMaxBounds(bounds);
});

let start;

let animationRange = [500, 1000];

let points = {
    driving: {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "Point",
                    coordinates: end,
                },
            },
        ],
    },
    cycling: {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "Point",
                    coordinates: end,
                },
            },
        ],
    },
};

let icons = {
    driving: "driving",
    cycling: "cycling",
};

let counters = {
    driving: 0,
    cycling: 0,
};

let steps = {
    driving: 700,
    cycling: 500,
};

let routing = {
    driving: null,
    cycling: null,
};

let animatedRoutes = {
    driving: [],
    cycling: [],
};

let data = {
    driving: null,
    cycling: null,
};

let offsets = {
    driving: 3,
    cycling: -3,
};

let colors = {
    driving: "#FFFFFF",
    cycling: "#FFFFFF",
};

let barCounter = {
    driving: {
        duration: 0.0,
        cost: 0.0,
        emission: 0.0,
    },
    cycling: {
        duration: 0.0,
        cost: 0.0,
        emission: 0.0,
    },
};

let barPercentage = {
    driving: {
        duration: 0,
        cost: 0,
        emission: 0,
    },
    cycling: {
        duration: 0,
        cost: 0,
        emission: 0,
    },
};

let barIncrement = {
    driving: {
        duration: 0.0,
        cost: 0.0,
        emission: 0.0,
    },
    cycling: {
        duration: 0.0,
        cost: 0.0,
        emission: 0.0,
    },
};

let barWidth = {
    driving: {
        duration: 0.0,
        cost: 0.0,
        emission: 0.0,
    },
    cycling: {
        duration: 0.0,
        cost: 0.0,
        emission: 0.0,
    },
};

let iconSize = {
    driving: 0.12,
    cycling: 0.8,
};

let costPerKm = {
    driving: 0.89, // €
    cycling: 0.14,
};

let emissionPerKm = {
    driving: 271.0, // g CO2
    cycling: 21.0,
};

let cost = {
    driving: 0.0,
    cycling: 0.0,
};

let emission = {
    driving: 0.0,
    cycling: 0.0,
};

async function requestRoute(modus, start, end) {
    const query = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${modus}/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`,
        { method: "GET" }
    );
    const json = await query.json();
    const jsonData = json.routes[0];
    return jsonData;
}

// Function to make the route request
async function getRoute(start, end, id) {
    let jsonData = await requestRoute(id, start, end);
    data[id] = jsonData;
    routing[id] = data[id].geometry.coordinates;

    // drawRoute(id);
}

function calculateSteps(id) {
    let otherId = id === "driving" ? "cycling" : "driving";
    if (data[id].duration > data[otherId].duration) {
        return;
    } else {
        steps[id] = animationRange[0];
        let difference = Math.floor(data[otherId].duration - data[id].duration);
        let stepsOtherId = steps[id] + difference;
        steps[otherId] =
            stepsOtherId > animationRange[1] ? animationRange[1] : stepsOtherId;
    }
}

function calculatePercentages() {
    for (id of ["cycling", "driving"]) {
        let duration = data[id]["duration"];
        cost[id] = (data[id].distance / 1000) * costPerKm[id];
        emission[id] = (data[id].distance / 1000) * emissionPerKm[id];
    }

    let maxCost = Math.max(cost["driving"], cost["cycling"]);
    let maxEmission = Math.max(emission["driving"], emission["cycling"]);
    let maxDuration = Math.max(
        data["driving"].duration,
        data["cycling"].duration
    );

    for (id of ["cycling", "driving"]) {
        barPercentage[id].duration = Math.floor(
            (data[id]["duration"] / maxDuration) * 100
        );
        barPercentage[id].cost = Math.floor((cost[id] / maxCost) * 100);
        barPercentage[id].emission = Math.floor(
            (emission[id] / maxEmission) * 100
        );

        barIncrement[id].duration = barPercentage[id].duration / steps[id];
        barIncrement[id].cost = barPercentage[id].cost / steps[id];
        barIncrement[id].emission = barPercentage[id].emission / steps[id];
    }

    console.log(barPercentage);
    console.log(barIncrement);
}

// Function to show requested route on the map
function drawRoute(id) {
    const route = routing[id];
    points[id].features[0].geometry.coordinates = route[0];
    const routeId = id + "Route";
    const geojson = {
        type: "Feature",
        properties: {},
        geometry: {
            type: "LineString",
            coordinates: route,
        },
    };
    // If the route already exists on the map, we'll reset it using setData
    if (map.getSource(routeId)) {
        map.getSource(routeId).setData(geojson);
    }
    // Otherwise, we'll add it
    else {
        map.addLayer({
            id: routeId,
            type: "line",
            source: {
                type: "geojson",
                data: geojson,
            },
            layout: {
                "line-join": "round",
                "line-cap": "round",
            },
            paint: {
                "line-color": colors[id],
                "line-width": 5,
                "line-opacity": 0.75,
                "line-offset": offsets[id],
            },
        });
    }

    // Clear the existing animated route for this mode
    animatedRoutes[id] = [];

    // Calculate the distance in kilometers between route start/end point.
    let line = { geometry: data[id].geometry, type: "Feature" };
    let lineDistance = turf.lineDistance(line, "kilometers");

    // Draw a path between the `origin` & `destination` of the two points
    for (let i = 0; i < lineDistance; i += lineDistance / steps[id]) {
        let segment = turf.along(data[id].geometry, i, "kilometers");
        animatedRoutes[id].push(segment.geometry.coordinates);
    }

    // Remove and add icon again so it is on top of route
    // stupid solution, try to find another later
    if (map.getSource(id)) {
        map.removeLayer(id);
        map.removeSource(id);
    }

    map.addSource(id, {
        type: "geojson",
        data: points[id],
    });

    let icon = id === chosenModus ? id + "-orange" : id + "-white";

    map.addLayer({
        id: id,
        source: id,
        type: "symbol",
        layout: {
            "icon-image": icon,
            "icon-allow-overlap": true,
            "icon-anchor": id === "cycling" ? "bottom" : "top",
            "icon-size": iconSize[id],
        },
    });

    if (map.getSource("drivingRoute") && map.getSource("cyclingRoute")) {
        // Geographic coordinates of the LineString
        const coordinates = routing["driving"].concat(routing["cycling"]);

        // Create a 'LngLatBounds' with both corners at the first coordinate.
        const bounds = new mapboxgl.LngLatBounds(
            coordinates[0],
            coordinates[0]
        );

        // Extend the 'LngLatBounds' to include every coordinate in the bounds result.
        for (const coord of coordinates) {
            bounds.extend(coord);
        }

        map.fitBounds(bounds, {
            padding: 150,
        });
    }
}

function animate(id, route) {
    // Update point geometry to a new position based on counter denoting
    // the index to access the route.
    points[id].features[0].geometry.coordinates = route[counters[id]];

    // Update the source with this new data.
    map.getSource(id).setData(points[id]);

    // Update the bar graphs
    let barDuration =
        id === chosenModus
            ? document.getElementById("duration-chosen")
            : document.getElementById("duration-other");
    let barCost =
        id === chosenModus
            ? document.getElementById("cost-chosen")
            : document.getElementById("cost-other");
    let barEmission =
        id === chosenModus
            ? document.getElementById("emission-chosen")
            : document.getElementById("emission-other");

    barWidth[id].duration += barIncrement[id].duration;
    barWidth[id].cost += barIncrement[id].cost;
    barWidth[id].emission += barIncrement[id].emission;

    barDuration.style.width = String(barWidth[id].duration) + "%";
    barCost.style.width = String(barWidth[id].cost) + "%";
    barEmission.style.width = String(barWidth[id].emission) + "%";

    let stepDuration = (data[id]["duration"] / steps[id]) * counters[id];
    barDuration.innerHTML = secondsToHms(stepDuration);
    let stepCost = (cost[id] / steps[id]) * counters[id];
    barCost.innerHTML = stepCost.toFixed(2) + " €";
    let stepEmission = (emission[id] / steps[id]) * counters[id];
    barEmission.innerHTML =
        stepEmission < 1000
            ? stepEmission.toFixed(2) + " g CO2"
            : (stepEmission / 1000).toFixed(2) + " kg CO2";

    // if (counters[id] === 500) {
    //     console.log(data[id]["duration"]);
    //     console.log(steps[id]);
    //     console.log(counters[id]);
    //     console.log(stepDuration);
    //     console.log(stepDuration < 60);
    // }

    // Request the next frame of animation so long the end has not been reached.
    if (counters[id] < steps[id]) {
        requestAnimationFrame(function () {
            animate(id, route);
        });
    }

    counters[id] += 1;
    // barCounter[id] += 0.1;
}

function secondsToHms(d) {
    d = Number(d);
    let h = Math.floor(d / 3600);
    let m = Math.floor((d % 3600) / 60);

    let hDisplay = h > 0 ? h + " h" : "";
    let mDisplay = m + " min";
    let display = h > 0 ? (hDisplay + m > 0 ? mDisplay : "") : mDisplay;
    return display;
}

// function updateSlider(count) {
//     points["driving"].features[0].geometry.coordinates =
//         animatedRoutes["driving"][count];
//     points["cycling"].features[0].geometry.coordinates =
//         animatedRoutes["cycling"][count];
//     map.getSource("driving").setData(points["driving"]);
//     map.getSource("cycling").setData(points["cycling"]);
// }

let chosenModus;
let otherModus;
function chooseModus(e) {
    chosenModus = e.id;
    otherModus = chosenModus === "driving" ? "cycling" : "driving";

    let chosenIcon = document.getElementById("icon-chosen");
    chosenIcon.setAttribute("href", chosenModus + ".svg#" + chosenModus);
    let otherIcon = document.getElementById("icon-other");
    otherIcon.setAttribute("href", otherModus + ".svg#" + otherModus);

    let cyclingIcon =
        chosenModus === "cycling"
            ? chosenIcon.parentElement
            : otherIcon.parentElement;
    cyclingIcon.style.width = "8rem";

    colors[chosenModus] = "#ff6d00";

    // Hide modus choice
    document.getElementById("info").innerHTML = "Wählt ein Ausgangspunkt aus";
    document.getElementById("modus").style.display = "none";

    // A single point that animates along the route.
    // Coordinates are initially set to center.
    points["driving"] = {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "Point",
                    coordinates: end,
                },
            },
        ],
    };

    points["cycling"] = points["driving"];

    map.addSource(chosenModus, {
        type: "geojson",
        data: points[chosenModus],
    });

    let icon = chosenModus + "-orange";

    map.addLayer({
        id: chosenModus,
        source: chosenModus,
        type: "symbol",
        layout: {
            "icon-image": icon,
            "icon-allow-overlap": true,
            "icon-size": iconSize[chosenModus],
        },
    });

    // This keeps the location icon centralized when the map is moved
    // so the user can choose their starting point.
    map.on("movestart", function (e) {
        if (markerFixed) {
            const center = map.getCenter();
            points[chosenModus].features[0].geometry.coordinates = [
                center.lng,
                center.lat,
            ];
            map.getSource(chosenModus).setData(points[chosenModus]);
        }
    });

    map.on("move", function (e) {
        if (markerFixed) {
            const center = map.getCenter();
            points[chosenModus].features[0].geometry.coordinates = [
                center.lng,
                center.lat,
            ];
            map.getSource(chosenModus).setData(points[chosenModus]);
        }
    });

    map.on("moveend", function (e) {
        if (markerFixed) {
            const center = map.getCenter();
            points[chosenModus].features[0].geometry.coordinates = [
                center.lng,
                center.lat,
            ];
            map.getSource(chosenModus).setData(points[chosenModus]);
        }
    });
}

// On 'Enter' center map on choice
document.onkeydown = async function (e) {
    if (e.keyCode === 13 && chosenModus) {
        // if enter pressed
        markerFixed = false;

        let center = map.getCenter();

        start = [center.lng, center.lat];

        // Add end point to the map
        let marker = new mapboxgl.Marker({ color: colors["cycling"] })
            .setLngLat(end)
            .addTo(map);

        await getRoute(start, end, "driving");
        await getRoute(start, end, "cycling");

        calculateSteps("driving");
        calculateSteps("cycling");

        calculatePercentages();

        document.getElementById("info").style.display = "none";
        document.getElementsByClassName("chart-wrapper")[0].style.display =
            "grid";

        drawRoute("driving");
        drawRoute("cycling");

        animate("driving", animatedRoutes["driving"]);
        animate("cycling", animatedRoutes["cycling"]);
    }
};
