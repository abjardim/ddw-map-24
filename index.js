// Create Map
mapboxgl.accessToken =
    "pk.eyJ1IjoiYWJqYXJkaW0iLCJhIjoiY2tmZmpyM3d3MGZkdzJ1cXZ3a3kza3BybiJ9.2CgI2GbcJysBRHmh7WwdVA";

const end = [8.872643564339544, 51.94003709534788]; // The DDW Location

let markerFixed = true;

// Define the radius in kilometers
var radiusInKm = 10;

// Calculate the bounding box using Turf.js
var centerPoint = turf.point(end);
var buffered = turf.buffer(centerPoint, radiusInKm, { units: "kilometers" });
var bbox = turf.bbox(buffered);

// Convert the bounding box to a format Mapbox GL JS understands
var bounds = [
    [bbox[0], bbox[1]], // [minLng, minLat]
    [bbox[2], bbox[3]], // [maxLng, maxLat]
];

const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/dark-v9",
    center: end,
    zoom: 15.53,
});

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
    driving: "car-15",
    cycling: "bicycle-15",
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
    driving: "#FF6D00",
    cycling: "#071689",
};

let barCounter = {
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
    map.addLayer({
        id: id,
        source: id,
        type: "symbol",
        layout: {
            "icon-image": icons[id],
            "icon-rotate": ["get", "bearing"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": 3,
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
            padding: 70,
        });
    }
}

function arraysEqual(arr1, arr2) {
    return JSON.stringify(arr1) === JSON.stringify(arr2);
}

function animate(id, route) {
    // Update point geometry to a new position based on counter denoting
    // the index to access the route.
    points[id].features[0].geometry.coordinates = route[counters[id]];

    // Update the source with this new data.
    map.getSource(id).setData(points[id]);
    document.getElementById("cost-" + id).style.height =
        String(barCounter[id]) + "%";
    document.getElementById("carbon-" + id).style.height =
        String(barCounter[id]) + "%";

    // Request the next frame of animation so long the end has not been reached.
    if (counters[id] < steps[id]) {
        requestAnimationFrame(function () {
            animate(id, route);
        });
    }

    counters[id] += 1;
    barCounter[id] += 0.1;
}

function updateSlider(count) {
    points["driving"].features[0].geometry.coordinates =
        animatedRoutes["driving"][count];
    points["cycling"].features[0].geometry.coordinates =
        animatedRoutes["cycling"][count];
    map.getSource("driving").setData(points["driving"]);
    map.getSource("cycling").setData(points["cycling"]);
}

function chooseModus(e) {
    chosenModus = e.id;

    // Hide modus choice
    document.getElementById("info").innerHTML = "Wählt ein Ausgangspunkt aus";
    document.getElementById("modus").classList.add("invisible");

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

    map.addLayer({
        id: chosenModus,
        source: chosenModus,
        type: "symbol",
        layout: {
            "icon-image": icons[chosenModus],
            "icon-rotate": ["get", "bearing"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": 3,
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
    if (e.keyCode === 13) {
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

        console.log(data);
        console.log(steps);

        drawRoute("driving");
        drawRoute("cycling");

        console.log(animatedRoutes);

        animate("driving", animatedRoutes["driving"]);
        animate("cycling", animatedRoutes["cycling"]);
    }
};
