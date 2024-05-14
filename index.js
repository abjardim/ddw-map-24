// Create Map
mapboxgl.accessToken =
    "pk.eyJ1IjoiYWJqYXJkaW0iLCJhIjoiY2tmZmpyM3d3MGZkdzJ1cXZ3a3kza3BybiJ9.2CgI2GbcJysBRHmh7WwdVA";

const center = [8.879, 51.936];

let markerFixed = true;

const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/dark-v9",
    center: center,
    zoom: 15.53,
});

map.on("style.load", () => {
    // Insert the layer beneath any symbol layer.
    const layers = map.getStyle().layers;
    const labelLayerId = layers.find(
        (layer) => layer.type === "symbol" && layer.layout["text-field"]
    ).id;

    // The 'building' layer in the Mapbox Streets
    // vector tileset contains building height data
    // from OpenStreetMap.
    // map.addLayer(
    //     {
    //         id: "add-3d-buildings",
    //         source: "composite",
    //         "source-layer": "building",
    //         filter: ["==", "extrude", "true"],
    //         type: "fill-extrusion",
    //         minzoom: 15,
    //         paint: {
    //             "fill-extrusion-color": "#aaa",

    //             // Use an 'interpolate' expression to
    //             // add a smooth transition effect to
    //             // the buildings as the user zooms in.
    //             "fill-extrusion-height": [
    //                 "interpolate",
    //                 ["linear"],
    //                 ["zoom"],
    //                 15,
    //                 0,
    //                 15.05,
    //                 ["get", "height"],
    //             ],
    //             "fill-extrusion-base": [
    //                 "interpolate",
    //                 ["linear"],
    //                 ["zoom"],
    //                 15,
    //                 0,
    //                 15.05,
    //                 ["get", "min_height"],
    //             ],
    //             "fill-extrusion-opacity": 0.6,
    //         },
    //     },
    //     labelLayerId
    // );
});

let start;
let chosenModus;
let carData;
let carRoute;
let bikeData;
let bikeRoute;
const end = [8.87912, 51.93507]; // The DDW Location

async function requestRoute(modus, start, end) {
    const query = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/${modus}/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`,
        { method: "GET" }
    );
    const json = await query.json();
    data = json.routes[0];
    route = data.geometry.coordinates;
    return data;
}

// Function to make the route request
async function getRoutes(start, end) {
    bikeData = await requestRoute("cycling", start, end);
    bikeRoute = bikeData.geometry.coordinates;
    carData = await requestRoute("driving", start, end);
    carRoute = carData.geometry.coordinates;

    // Add end point to the map
    let marker = new mapboxgl.Marker({ color: colorBlue })
        .setLngLat(end)
        .addTo(map);

    // Uncomment to show route on the map
    drawRoute(bikeRoute, 3, colorOrange, "cycling");
    // drawRoute(carRoute, -3, colorBlue, "driving");
    // animateRoute(route);
}

const colorOrange = "#FF6D00";
const colorBlue = "#071689";

// Function to show requested route on the map
function drawRoute(route, offset, color, id) {
    const geojson = {
        type: "Feature",
        properties: {},
        geometry: {
            type: "LineString",
            coordinates: route,
        },
    };
    // If the route already exists on the map, we'll reset it using setData
    if (map.getSource(id)) {
        map.getSource(id).setData(geojson);
    }
    // Otherwise, we'll make a new request
    else {
        map.addLayer({
            id: id,
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
                "line-color": "#3887be",
                "line-width": 5,
                "line-opacity": 0.75,
                "line-offset": offset,
                "line-color": color,
            },
        });
    }

    // Calculate the distance in kilometers between route start/end point.
    var line = { geometry: bikeData.geometry, type: "Feature" };
    var lineDistance = turf.lineDistance(line, "kilometers");

    // Draw an arc between the `origin` & `destination` of the two points
    for (var i = 0; i < lineDistance; i += lineDistance / steps) {
        var segment = turf.along(bikeData.geometry, i, "kilometers");
        animatedRoute.push(segment.geometry.coordinates);
    }

    animate();
}

// Used to increment the value of the point measurement against the route.
let steps = 500;
let counter = 0;
let point;
let animatedRoute = [];

function animate() {
    // Update point geometry to a new position based on counter denoting
    // the index to access the arc.
    point.features[0].geometry.coordinates = animatedRoute[counter];

    // Update the source with this new data.
    map.getSource("point").setData(point);

    // Request the next frame of animation so long the end has not been reached.
    if (counter < steps) {
        requestAnimationFrame(animate);
    }

    counter = counter + 1;
}

function animateRoute(route) {
    // this is the path the camera will look at
    const targetRoute = route;
    // this is the path the camera will move along
    const cameraRoute = route;
    const animationDuration = 20000;
    const cameraAltitude = 50;
    // get the overall distance of each route so we can interpolate along them
    const routeDistance = turf.lineDistance(turf.lineString(targetRoute));
    const cameraRouteDistance = turf.lineDistance(turf.lineString(cameraRoute));

    let start;

    function frame(time) {
        if (!start) start = time;
        // phase determines how far through the animation we are
        const phase = (time - start) / animationDuration;

        // phase is normalized between 0 and 1
        // when the animation is finished, reset start to loop the animation
        // if (phase > 1) {
        //     // wait 1.5 seconds before looping
        //     setTimeout(() => {
        //         start = 0.0;
        //     }, 1500);
        // }

        // use the phase to get a point that is the appropriate distance along the route
        // this approach syncs the camera and route positions ensuring they move
        // at roughly equal rates even if they don't contain the same number of points
        const alongRoute = turf.along(
            turf.lineString(targetRoute),
            routeDistance * phase
        ).geometry.coordinates;

        const alongCamera = turf.along(
            turf.lineString(cameraRoute),
            cameraRouteDistance * phase
        ).geometry.coordinates;

        const camera = map.getFreeCameraOptions();

        // set the position and altitude of the camera
        camera.position = mapboxgl.MercatorCoordinate.fromLngLat(
            {
                lng: alongCamera[0],
                lat: alongCamera[1],
            },
            cameraAltitude
        );

        // tell the camera to look at a point along the route
        camera.lookAtPoint({
            lng: alongRoute[0],
            lat: alongRoute[1],
        });

        map.setFreeCameraOptions(camera);

        window.requestAnimationFrame(frame);
    }

    window.requestAnimationFrame(frame);
}

let iconImage;

// Function I started for the modus selection, but still doesn't do anything
function chooseModus(e) {
    chosenModus = e.id;
    iconImage = chosenModus === "car" ? "car-15" : "bicycle-15";

    // Hide modus choice
    document.getElementById("info").innerHTML = "Wählt ein Ausgangspunkt aus";
    document.getElementById("modus").classList.add("invisible");

    // A single point that animates along the route.
    // Coordinates are initially set to origin.
    point = {
        type: "FeatureCollection",
        features: [
            {
                type: "Feature",
                properties: {},
                geometry: {
                    type: "Point",
                    coordinates: center,
                },
            },
        ],
    };

    map.addSource("point", {
        type: "geojson",
        data: point,
    });

    map.addLayer({
        id: "point",
        source: "point",
        type: "symbol",
        layout: {
            "icon-image": iconImage,
            "icon-rotate": ["get", "bearing"],
            "icon-rotation-alignment": "map",
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
            "icon-size": 3,
        },
    });

    // This keeps the location icon centralized when the map is moved
    // so the user can choose their starting point
    map.on("movestart", function (e) {
        if (markerFixed) {
            // point.setLngLat(map.getCenter());
            const center = map.getCenter();
            point.features[0].geometry.coordinates = [center.lng, center.lat];
            map.getSource("point").setData(point);
        }
    });

    map.on("move", function (e) {
        if (markerFixed) {
            const center = map.getCenter();
            // point.setLngLat(map.getCenter());
            point.features[0].geometry.coordinates = [center.lng, center.lat];
            map.getSource("point").setData(point);
        }
    });

    map.on("moveend", function (e) {
        if (markerFixed) {
            const center = map.getCenter();
            // point.setLngLat(map.getCenter());
            point.features[0].geometry.coordinates = [center.lng, center.lat];
            map.getSource("point").setData(point);
        }
    });

    map.on("click", function () {
        console.log("clicked");
    });

    const event = new MouseEvent({
        clientX: 200,
        clientY: 200,
        bubbles: true,
    });

    // map.fire("click", {
    //     latLng: map.getCenter(),
    //     point: map.project(map.getCenter()),
    //     originalEvent: {},
    // });
}

// On 'Enter' center map on choice
document.onkeydown = function (e) {
    if (e.keyCode === 13) {
        // if enter pressed
        markerFixed = false;

        let point = map.getCenter();

        start = [point.lng, point.lat];

        getRoutes(start, end);
    }
};
