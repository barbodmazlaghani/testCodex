import React, { useEffect, useState, useRef } from 'react';
import styled from "styled-components";
import axios from 'axios'; // Make sure axios is installed
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from 'leaflet';
import logophoto from "./logo-white.png"; // Import Leaflet

const Screen = styled.div`
  height: 100vh;
  //background: rgb(14, 3, 33);
  //background: linear-gradient(45deg, rgba(14, 3, 33, 1) 0%, rgba(46, 55, 177, 1) 43%, rgba(16, 12, 32, 1) 100%);
  //background: rgb(7,37,97);
  //background: linear-gradient(45deg, rgba(7,37,97,1) 0%, rgba(40,58,102,1) 35%, rgba(56,78,130,1) 52%, rgba(145,93,60,1) 64%, rgba(119,51,2,1) 100%);
  //background: rgb(7,37,97);
  //background: linear-gradient(225deg, rgba(7,37,97,1) 0%, rgba(40,58,102,1) 35%, rgba(56,78,130,1) 52%, rgba(145,93,60,1) 64%, rgba(119,51,2,1) 100%);
  background: rgb(7, 37, 97);
  background: linear-gradient(55deg, rgba(7, 37, 97, 1) 0%, rgba(68, 96, 163, 1) 35%, rgba(99, 122, 176, 1) 52%, rgba(235, 150, 96, 1) 64%, rgba(255, 108, 2, 1) 100%);
  //background: rgb(7,37,97);
  //background: radial-gradient(circle, rgba(7,37,97,1) 0%, rgba(68,96,163,1) 35%, rgba(99,122,176,1) 52%, rgba(235,150,96,1) 64%, rgba(255,108,2,1) 100%);
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`
const customIcon = L.icon({
    iconUrl: logophoto,
    iconSize: [38, 38],
    iconAnchor: [22, 30],
    popupAnchor: [-3, -40]

});
const FitBounds = ({ locations }) => {
    const map = useMap();

    useEffect(() => {
        if (locations.length > 0) {
            const bounds = L.latLngBounds(locations);
            map.fitBounds(bounds);
        }
    }, [locations, map]);

    return null;
};
const Monitoring = () => {
    const [devices, setDevices] = useState([]);
    const mapRef = useRef();
    const token = JSON.parse(localStorage.getItem('user')).access_token

    useEffect(() => {
        const fetchData = async () => {
            try {

                const apiUrl = `https://khodroai.com/api/get-cars-latest-data`;
                const response = await axios.get(apiUrl, {
                    headers: {
                        Authorization: `Token ${token}`
                    }
                });
                console.log("RESPONSE " , response.data)
                setDevices(response.data);
            } catch (error) {
                console.error('Error fetching data: ', error);
            }
        };

        fetchData();
    }, []);
    const locations = devices.map(device => [device.location.latitude, device.location.longitude]);

    return (
        <Screen>
            <MapContainer
                ref={mapRef}
                center={[35.7219, 51.3347]}
                zoom={10}
                scrollWheelZoom={false}
                style={{ height: "95vh", width: '90vw', borderRadius: "10px" }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {devices.map(device => (
                    <Marker
                        key={device._id}
                        position={[device.location.latitude, device.location.longitude]}
                        icon={customIcon}
                    >
                        <Popup>
                            Driver: {device.driver}<br/>
                            Device ID: {device.carID}<br/>
                            Latitude: {device.location.latitude}<br/>
                            Longitude: {device.location.longitude}
                        </Popup>
                    </Marker>
                ))}
                <FitBounds locations={locations} />
            </MapContainer>
        </Screen>
    );
}

export default Monitoring;
