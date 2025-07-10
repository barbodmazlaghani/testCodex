import React, {useEffect, useRef, useState} from 'react';
import styled from 'styled-components';
import carphoto from '../../1709673_prev_ui.png'
import logophoto from '../../logo-white.png'
import SynchronizedCharts from "../chart/SynchronizedCharts";
import {CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap} from "react-leaflet";
import StackedCharts from "../chart/StackedChart";
import GaugeComponent from "react-gauge-component";
import axios from "axios";
import L from "leaflet";
import 'leaflet/dist/leaflet.css';
import moment from "moment";

const Container = styled.div`
  display: flex;
  flex-direction: row;
  align-items: start;
  margin: 1rem 0;

  @media (max-width: 768px) {
    flex-direction: column;
    align-items: center;
  }
`;

const Section = styled.div`
  display: flex;
  height: 90vh;
  flex-direction: column;
  justify-content: space-evenly;
  overflow: auto;
  padding: 0.75rem 0;
`;

const FirstSection = styled(Section)`
  width: 40%;
  @media (max-width: 768px) {
    width: 100%;
    height: 150vh;
  }
`;

const SecondSection = styled(Section)`
  width: 35%;
  @media (max-width: 768px) {
    width: 100%;
    height: 150vh;
    margin-top: 20vh;
  }
  overflow: visible;
`;

const ThirdSection = styled(Section)`
  height: 92vh;
  width: 23%;
  @media (max-width: 768px) {
    width: 80%;
    margin-top: 20vh;
  }
`;

const GaugeAndCarContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  overflow: hidden;
  height: 30vh;

  @media (max-width: 768px) {
    flex-direction: column;
    height: 90vh;
  }
`;

const CarImage = styled.img`
  width: 40%;
  height: 20vh;
  object-fit: contain;

  @media (max-width: 768px) {
    width: 80%;
  }
`;

const CardsContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-evenly;
  align-items: center;
  @media (max-width: 768px) {
    flex-direction: column;
  }
`;

const CardWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 14vh;
  width: 30%;
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const MapWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  padding-bottom: 1rem;
`;

const Card = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  gap: 0.25rem;
  padding: 0;
  box-shadow: rgba(0, 0, 0, 0.24) 0px 3px 8px;
  @media (max-width: 768px) {
    width: 100%;
  }
`;

const FirstCard = styled(Card)`
  height: 10vh;
  background: rgb(244, 183, 54);
  background: linear-gradient(28deg, rgba(244, 183, 54, 1) 0%, rgba(253, 187, 45, 1) 100%);
`;

const SecondCard = styled(Card)`
  height: 10vh;
  background: rgb(75, 237, 89);
  background: linear-gradient(28deg, rgba(75, 237, 89, 1) 0%, rgba(36, 236, 9, 1) 100%);
`;

const ThirdCard = styled(Card)`
  height: 10vh;
  background: rgb(75, 179, 237);
  background: linear-gradient(28deg, rgba(75, 179, 237, 1) 0%, rgba(9, 25, 236, 1) 100%);
`;

const CenterButton = ({ center }) => {
    const map = useMap();

    const handleClick = () => {
        map.flyTo(center, map.getZoom());
    };

    return (
        <div
            style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 1000,
                background: '#111111',
                borderRadius: '100%',
                boxShadow: '0 1px 5px rgba(0,0,0,0.65)',
                padding: '10px 10px',
                cursor: 'pointer'
            }}
            onClick={handleClick}
        >
            🔍
        </div>
    );
};

const Dashboard = ({data, car, token, interval, send, start, end, ecu}) => {
    const [locations, setLocations] = useState([]);
    const [fitMapFirstTime, setFitMapFirstTime] = useState(false);
    const [speeds, setSpeeds] = useState([]);
    const [throttlePositions, setThrottlePositions] = useState([]);
    const [clutchTorques, setClutchTorques] = useState([]);
    const [engineSpeeds, setEngineSpeeds] = useState([]);
    const [fuelLevels, setFuelLevels] = useState([]);
    const [cardsData, setCardsData] = useState({
        speed: 0, distance: 0, fuel: 0, speed_max: 0,
        speed_std: 0, time: 0, idle_time: 0, acceleration: 0, engine_speed: 0
    });
    const [timeStamps, setTimeStamps] = useState([]);
    const [activeDatapointIndex, setActiveDatapointIndex] = useState(null);
    const [combinedDataPointIndex, setCombinedDataPointIndex] = useState(null);

    // NEW: single array combining time + all ECU variables
    const [combinedVarData, setCombinedVarData] = useState([]);

    const mapRef = useRef();
    const bounds = new L.LatLngBounds();

    const customIcon = L.icon({
        iconUrl: logophoto,
        iconSize: [38, 38],
        iconAnchor: [22, 30],
        popupAnchor: [-3, -76]
    });

    const handleDataPointHover = (index) => {
        setActiveDatapointIndex(index);
    };

    const handleCombinedDataPointHover = (index) => {
        setCombinedDataPointIndex(index);
    };

    useEffect(() => {
        if (!fitMapFirstTime && mapRef.current && bounds.isValid()) {
            mapRef.current.fitBounds(bounds);
            setFitMapFirstTime(true);
        }
    }, [mapRef, bounds, fitMapFirstTime]);

    // Fetch data on mount or whenever interval/ecu changes
    useEffect(() => {
        const intervalInSeconds = interval * 60;

        const fetchData = async () => {
            if (car.carID) {
                const apiUrl = `https://khodroai.com/api/history/carID/${car.carID}/?lastInterval=${intervalInSeconds}&fields=location,variables&maxPoints=1800`;
                try {
                    const response = await axios.get(apiUrl, {
                        headers: {
                            Authorization: `Token ${token}`
                        }
                    });
                    if (response.status === 200) {
                        setFitMapFirstTime(false);
                        const timestampsArr = response.data.timestamp.map(dateStr => new Date(dateStr).getTime());

                        setLocations(response.data.location);
                        setTimeStamps(timestampsArr);

                        // Collect standard variables for SynchronizedCharts
                        const speedsArr = response.data.variables.map(
                            arr => arr[ecu['inverse']['Vehicle_Speed']]
                        );
                        setSpeeds(speedsArr);

                        const throttlesArr = response.data.variables.map(
                            arr => arr[ecu['inverse']['Throttle_position']]
                        );
                        setThrottlePositions(throttlesArr);

                        const clutchesArr = response.data.variables.map(
                            arr => arr[ecu['inverse']['Clutch_torque']]
                        );
                        setClutchTorques(clutchesArr);

                        const engineArr = response.data.variables.map(
                            arr => arr[ecu['inverse']['Engine_speed']]
                        );
                        setEngineSpeeds(engineArr);

                        const fuelArr = response.data.variables.map(
                            arr => arr[ecu['inverse']['Fuel_level']]
                        );
                        setFuelLevels(fuelArr);

                        // Build a single array of objects: { time, [friendlyName]: value }
                        // so we can pass it to StackedCharts for dynamic selection
                        const mergedArray = response.data.variables.map((varObj, idx) => {
                            const timeLabel = moment(timestampsArr[idx]).format("HH:mm:ss");
                            const row = { time: timeLabel };
                            for (let [hexCode, value] of Object.entries(varObj)) {
                                const friendlyName = ecu['main'][hexCode];
                                if (friendlyName) {
                                    row[friendlyName] = value;
                                }
                            }
                            return row;
                        });
                        setCombinedVarData(mergedArray);

                        // Set aggregated trip stats
                        setCardsData({
                            speed: response.data.trip_speed_avg,
                            distance: response.data.trip_distance,
                            fuel: response.data.trip_fuel_consumption_avg,
                            speed_max: response.data.trip_speed_max,
                            speed_std: response.data.trip_speed_std,
                            time: response.data.trip_time,
                            idle_time: response.data.trip_idle_time,
                            acceleration: response.data.trip_acceleration_avg,
                            engine_speed: response.data.trip_engine_speed_avg
                        });
                    }
                } catch (error) {
                    console.error(error);
                }
            }
        };

        fetchData();
    }, [interval, car, ecu, token]);

    // Fetch data again for custom "start"-"end" time
    useEffect(() => {
        if (start !== "" && end !== "") {
            const fromTime = new Date(start).getTime() / 1000;
            const toTime = new Date(end).getTime() / 1000;

            const fetchData = async () => {
                if (car.carID) {
                    const apiUrl = `https://khodroai.com/api/history/carID/${car.carID}/?fromTime=${fromTime}&toTime=${toTime}&fields=location,variables&maxPoints=1800`;
                    try {
                        const response = await axios.get(apiUrl, {
                            headers: {
                                Authorization: `Token ${token}`
                            }
                        });
                        if (response.status === 200) {
                            setFitMapFirstTime(false);
                            const timestampsArr = response.data.timestamp.map(dateStr => new Date(dateStr).getTime());

                            setLocations(response.data.location);
                            setTimeStamps(timestampsArr);

                            // standard arrays for SynchronizedCharts
                            const speedsArr = response.data.variables.map(
                                arr => arr[ecu['inverse']['Vehicle_Speed']]
                            );
                            setSpeeds(speedsArr);

                            const throttlesArr = response.data.variables.map(
                                arr => arr[ecu['inverse']['Throttle_position']]
                            );
                            setThrottlePositions(throttlesArr);

                            const clutchesArr = response.data.variables.map(
                                arr => arr[ecu['inverse']['Clutch_torque']]
                            );
                            setClutchTorques(clutchesArr);

                            const engineArr = response.data.variables.map(
                                arr => arr[ecu['inverse']['Engine_speed']]
                            );
                            setEngineSpeeds(engineArr);

                            const fuelArr = response.data.variables.map(
                                arr => arr[ecu['inverse']['Fuel_level']]
                            );
                            setFuelLevels(fuelArr);

                            // build combined array for StackedCharts
                            const mergedArray = response.data.variables.map((varObj, idx) => {
                                const timeLabel = moment(timestampsArr[idx]).format("HH:mm:ss");
                                const row = { time: timeLabel };
                                for (let [hexCode, value] of Object.entries(varObj)) {
                                    const friendlyName = ecu['main'][hexCode];
                                    if (friendlyName) {
                                        row[friendlyName] = value;
                                    }
                                }
                                return row;
                            });
                            setCombinedVarData(mergedArray);

                            // aggregated trip stats
                            setCardsData({
                                speed: response.data.trip_speed_avg,
                                distance: response.data.trip_distance,
                                fuel: response.data.trip_fuel_consumption_avg,
                                speed_max: response.data.trip_speed_max,
                                speed_std: response.data.trip_speed_std,
                                time: response.data.trip_time,
                                idle_time: response.data.trip_idle_time,
                                acceleration: response.data.trip_acceleration_avg,
                                engine_speed: response.data.trip_engine_speed_avg
                            });
                        }
                    } catch (error) {
                        console.error(error);
                    }
                }
            };

            fetchData();
        }
    }, [send, start, end, car, ecu, token]);

    let dots;
    const hasUndefined = speeds.includes(undefined);
    if (locations.length > 0 && speeds.length > 0 && fuelLevels.length > 0 && !hasUndefined) {
        dots = locations.map((location, index) => {
            let color;
            bounds.extend([location.latitude, location.longitude]);

            if (speeds[index] >= 80) {
                color = "red";
            } else if (speeds[index] < 80 && speeds[index] > 50) {
                color = "blue";
            } else if (speeds[index] <= 50) {
                color = "green";
            } else {
                color = "yellow";
            }
            return (
                <CircleMarker
                    key={location.id}
                    center={[location.latitude, location.longitude]}
                    pathOptions={{
                        fillColor: color,
                        fillOpacity: 0.7,
                        stroke: false
                    }}
                    radius={3}
                >
                <Popup>
                Speed: {speeds?.[index] != null ? speeds[index] : "N/A"} km/h<br/>
                Fuel level: {typeof fuelLevels?.[index] === 'number' ? fuelLevels[index].toFixed(1) : 'N/A'} %
                </Popup>
                </CircleMarker>
            );
        });
    }

    return (
        <Container>
            <FirstSection>
                <GaugeAndCarContainer>
                    <CarImage src={"https://khodroai.com/" + car.car_image} alt="car" />
                    {/* Speed gauge */}
                    <CardWrapper>
                        <p style={{padding: "0", margin:"0"}}>Speed</p>
                        <GaugeComponent
                            style={{
                                width: window.innerWidth <= 768 ? "90%" : "70%",
                                height: "70%",
                                margin: 0,
                                padding: 0,
                                fontSize: window.innerWidth <= 768 ? "20px" : "16px",
                            }}
                            type={"grafana"}
                            maxValue={200}
                            marginInPercent={{top: 0.06, bottom: 0.00, left: 0.05, right: 0.05}}
                            arc={{
                                subArcs: [
                                    {
                                        limit: 50,
                                        color: '#5BE12C',
                                        showTick: false
                                    },
                                    {
                                        limit: 90,
                                        color: '#F5CD19',
                                        showTick: false
                                    },
                                    {
                                        limit: 120,
                                        color: '#F58B19',
                                        showTick: false
                                    },
                                    {
                                        limit: 200,
                                        color: '#EA4228',
                                        showTick: false
                                    },
                                ]
                            }}
                            value={Math.floor(data?.variables[ecu['inverse']['Vehicle_Speed']]) || 0}
                            labels={{
                                valueLabel: {
                                    formatTextValue: value => value + '',
                                    matchColorWithArc: true,
                                    style: {fontSize: window.innerWidth <= 768 ? "35px" : "55px"}
                                },
                                tickLabels: {
                                    hideMinMax: true
                                }
                            }}
                        />
                    </CardWrapper>
                    {/* Engine Speed gauge */}
                    <CardWrapper>
                        <p style={{padding: "0", margin: "0"}}>Engine Speed</p>
                        <GaugeComponent
                            style={{
                                width: window.innerWidth <= 768 ? "90%" : "70%",
                                height: "70%",
                                margin: 0,
                                padding: 0,
                                fontSize: window.innerWidth <= 768 ? "20px" : "14px",
                            }}
                            type={"grafana"}
                            maxValue={6500}
                            marginInPercent={{top: 0.06, bottom: 0.00, left: 0.05, right: 0.05}}
                            arc={{
                                subArcs: [
                                    {
                                        limit: 1500,
                                        color: '#5BE12C',
                                        showTick: false
                                    },
                                    {
                                        limit: 3000,
                                        color: '#F5CD19',
                                        showTick: false
                                    },
                                    {
                                        limit: 4500,
                                        color: '#F58B19',
                                        showTick: false
                                    },
                                    {
                                        limit: 6500,
                                        color: '#EA4228',
                                        showTick: false
                                    },
                                ]
                            }}
                            value={Math.floor(data?.variables[ecu['inverse']['Engine_speed']]) || 0}
                            labels={{
                                valueLabel: {
                                    formatTextValue: value => value + '',
                                    matchColorWithArc: true,
                                    style: {fontSize: window.innerWidth <= 768 ? "35px" : "55px"}
                                },
                                tickLabels: {
                                    hideMinMax: true
                                }
                            }}
                        />
                    </CardWrapper>
                </GaugeAndCarContainer>

                {/* Our new stacked chart with multi-select (dynamic variables) */}
                <StackedCharts
                    data={combinedVarData}
                    onDataPointHover={handleCombinedDataPointHover}
                />
            </FirstSection>

            <SecondSection>
                <CardsContainer>
                    <CardWrapper>
                        <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Speed (avg)</p>
                        <FirstCard>
                            <p style={{fontSize: "xx-large", fontWeight: "bold", margin: "1.25rem 0"}}>
                                {cardsData.speed.toFixed(0)}
                            </p>
                            <p style={{fontSize: "small", margin: "1.25rem 0"}}>km/h</p>
                        </FirstCard>
                    </CardWrapper>

                    <CardWrapper>
                        <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Distance (trip)</p>
                        <SecondCard>
                            <p style={{fontSize: "xx-large", fontWeight: "bold", margin: "1.25rem 0"}}>
                                {cardsData.distance.toFixed(1)}
                            </p>
                            <p style={{fontSize: "small", margin: "1.25rem 0"}}>km</p>
                        </SecondCard>
                    </CardWrapper>

                    <CardWrapper>
                        <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Fuel Consumption</p>
                        <ThirdCard>
                            <p style={{fontSize: "xx-large", fontWeight: "bold", margin: "1.25rem 0"}}>
                                {cardsData.fuel.toFixed(1)}
                            </p>
                            <p style={{fontSize: "small", margin: "1.25rem 0"}}>L/100km</p>
                        </ThirdCard>
                    </CardWrapper>

                    <CardWrapper>
                        <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Speed (max)</p>
                        <FirstCard>
                            <p style={{fontSize: "xx-large", fontWeight: "bold", margin: "1.25rem 0"}}>
                                {cardsData.speed_max.toFixed(0)}
                            </p>
                            <p style={{fontSize: "small", margin: "1.25rem 0"}}>km/h</p>
                        </FirstCard>
                    </CardWrapper>

                    <CardWrapper>
                        <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Time (trip)</p>
                        <SecondCard>
                            <p style={{fontSize: "xx-large", fontWeight: "bold", margin: "1.25rem 0"}}>
                                {(cardsData.time.toFixed(1)/60).toFixed(1)}
                            </p>
                            <p style={{fontSize: "small", margin: "1.25rem 0"}}>min</p>
                        </SecondCard>
                    </CardWrapper>

                    <CardWrapper>
                        <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Acceleration (avg)</p>
                        <ThirdCard>
                            <p style={{fontSize: "xx-large", fontWeight: "bold", margin: "1.25rem 0"}}>
                                {cardsData.acceleration.toFixed(1)}
                            </p>
                            <p style={{fontSize: "small", margin: "1.25rem 0"}}>m/s2</p>
                        </ThirdCard>
                    </CardWrapper>

                    <CardWrapper>
                        <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Speed (std)</p>
                        <FirstCard>
                            <p style={{fontSize: "xx-large", fontWeight: "bold", margin: "1.25rem 0"}}>
                                {cardsData.speed_std.toFixed(0)}
                            </p>
                            <p style={{fontSize: "small", margin: "1.25rem 0"}}>km/h</p>
                        </FirstCard>
                    </CardWrapper>

                    <CardWrapper>
                        <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Idle Time (trip)</p>
                        <SecondCard>
                            <p style={{fontSize: "xx-large", fontWeight: "bold", margin: "1.25rem 0"}}>
                                {(cardsData.idle_time.toFixed(3)*100).toFixed(1)}
                            </p>
                            <p style={{fontSize: "small", margin: "1.25rem 0"}}>%</p>
                        </SecondCard>
                    </CardWrapper>

                    <CardWrapper>
                        <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Engine Speed (avg)</p>
                        <ThirdCard>
                            <p style={{fontSize: "xx-large", fontWeight: "bold", margin: "1.25rem 0"}}>
                                {cardsData.engine_speed.toFixed(0)}
                            </p>
                            <p style={{fontSize: "small", margin: "1.25rem 0"}}>rpm</p>
                        </ThirdCard>
                    </CardWrapper>
                </CardsContainer>

                {/* Original SynchronizedCharts */}
                <SynchronizedCharts
                    onDataPointHover={handleDataPointHover}
                    data={{speeds, throttlePositions, clutchTorques, timeStamps, locations}}
                />
            </SecondSection>

            <ThirdSection>
                <MapWrapper>
                    <p style={{ padding: "0", margin: "0"}}>GPS Position</p>
                    <MapContainer
                        center={[35.7219, 51.3347]}
                        zoom={10}
                        scrollWheelZoom={false}
                        ref={mapRef}
                        style={{ height: "84vh", width: '100%' }}
                    >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Marker
                            position={[data.location.latitude, data.location.longitude]}
                            icon={customIcon}
                        >
                            <Popup>We are here</Popup>
                        </Marker>

                        {/* Hovered points on the map (SynchronizedCharts) */}
                        {activeDatapointIndex !== null && activeDatapointIndex < locations.length && (
                            <Marker
                                position={[
                                    locations[activeDatapointIndex].latitude,
                                    locations[activeDatapointIndex].longitude
                                ]}
                                icon={customIcon}
                            />
                        )}

                        {combinedDataPointIndex !== null && combinedDataPointIndex < locations.length && (
                            <Marker
                                position={[
                                    locations[combinedDataPointIndex].latitude,
                                    locations[combinedDataPointIndex].longitude
                                ]}
                                icon={customIcon}
                            />
                        )}

                        {dots}
                        <CenterButton center={[data.location.latitude, data.location.longitude]} />
                    </MapContainer>
                </MapWrapper>
            </ThirdSection>
        </Container>
    );
};

export default Dashboard;
