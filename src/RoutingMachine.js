import L from "leaflet";
import { createControlComponent } from "@react-leaflet/core";
import "leaflet-routing-machine";

const createRoutineMachineLayer = (props) => {
    const { waypoints, color } = props;

    const instance = L.Routing.control({
        waypoints,
        lineOptions: {
            styles: [
                { color, weight: 10 },
            ]
        },
        show: false,
        addWaypoints: false,
        routeWhileDragging: true,
        draggableWaypoints: true,
        fitSelectedRoutes: false,
        showAlternatives: false,
        createMarker: function () {
            return null;
        }
    });

    return instance;
};

const RoutingMachine = createControlComponent(createRoutineMachineLayer);

export default RoutingMachine;