import styled from "styled-components";
import React, {useEffect, useRef, useState} from "react";
import {CircleMarker, MapContainer, Marker, Popup, TileLayer} from "react-leaflet";
import axios from "axios";
import {useLocation} from "react-router-dom";
import L from "leaflet";


const CardsContainer = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  justify-content: space-evenly;
  align-items: center;
  @media (max-width: 768px) {
    flex-direction: column;
  }

`
const CardWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width:10vw;
  @media (max-width: 768px) {
    width: 100%;
  }

`
const Card = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  gap: 0.25rem;
  padding: 0;
  @media (max-width: 768px) {
    width: 100%;
  }
`

const FirstCard = styled(Card)`
  height: 10vh;
  background: rgb(244, 183, 54);
  background: linear-gradient(28deg, rgba(244, 183, 54, 1) 0%, rgba(253, 187, 45, 1) 100%);
`
const SecondCard = styled(Card)`
  height: 10vh;
  background: rgb(75, 237, 89);
  background: linear-gradient(28deg, rgba(75, 237, 89, 1) 0%, rgba(36, 236, 9, 1) 100%);
`
const ThirdCard = styled(Card)`
  height: 10vh;
  background: rgb(75, 179, 237);
  background: linear-gradient(28deg, rgba(75, 179, 237, 1) 0%, rgba(9, 25, 236, 1) 100%);
`
const FourthCard = styled(Card)`
  height: 10vh;
  background: rgb(219, 158, 9);
  background: linear-gradient(28deg, rgba(219, 158, 9, 1) 0%, rgba(228, 162, 0, 1) 100%);
`
const FifthCard = styled(Card)`
  height: 10vh;
  background: rgb(0, 202, 30);
  background: linear-gradient(28deg, rgba(0, 202, 30, 1) 0%, rgba(0, 201, 0, 1) 100%);
`
const SixthCard = styled(Card)`
  height: 10vh;
  background: rgb(0, 124, 202);
  background: linear-gradient(28deg, rgba(0, 124, 202, 1) 0%, rgba(0, 0, 201, 1) 100%);
`
const SeventhCard = styled(Card)`
  height: 10vh;
  background: rgb(194, 140, 0);
  background: linear-gradient(28deg, rgba(194, 140, 0, 1) 0%, rgba(203, 143, 0, 1) 100%);
`
const EighthCard = styled(Card)`
  height: 10vh;
  background: rgb(0, 167, 0);
  background: linear-gradient(28deg, rgba(0, 167, 0, 1) 0%, rgba(0, 167, 0, 1) 100%);
`
const NinthCard = styled(Card)`
  height: 10vh;
  background: rgb(0, 103, 167);
  background: linear-gradient(28deg, rgba(0, 103, 167, 1) 0%, rgba(0, 0, 167, 1) 100%);
`
const MapWrapperSummary = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  width: 100%;
  

`

const ScreenSummary = styled.div`
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
  padding: 0rem 3rem;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  @media (max-width: 768px) {
    height: 300vh;
    justify-content: space-evenly;
  }
`
const ButtonsContainer = styled.div`
    display: flex;
  justify-content: center;
  align-items: center;
  @media (max-width: 768px) {
    flex-direction: column;
  }
  
`
const Summary = () => {
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const location = useLocation();
    const selectedCarID = location.state;
    const [isLoading, setIsLoading] = useState(false);
    const [locations, setLocations] = useState([]);
    const [fitMapFirstTime, setFitMapFirstTime] = useState(false)
    const [speeds, setSpeeds] = useState([])
    const [throttlePositions, setThrottlePositions] = useState([])
    const [clutchTorques, setClutchTorques] = useState([]);
    const [engineSpeeds, setEngineSpeeds] = useState([]);
    const [fuelLevels,setFuelLevels] = useState([])
    const [cardsData, setCardsData] = useState({speed: 0, distance: 0, fuel: 0,speed_max:0,speed_std:0,time:0,idle_time:0,acceleration:0,engine_speed:0})
    const [timeStamps, setTimeStamps] = useState([]);
    const token = JSON.parse(localStorage.getItem('user')).access_token
    const mapRef = useRef();
    const bounds = new L.LatLngBounds();

    let dots;
    if (locations.length > 0) {
        dots = locations.map((location, index) => {
            let color;
            // if (!(location.latitude >= 35.3 && location.latitude <= 36.11 && location.longitude >= 50.27 && location.longitude <= 52.3)) {
            //     locations.splice(index, 1);
            //     speeds.splice(index, 1);
            //     timeStamps.splice(index, 1);
            //     return;
            // }
            bounds.extend([location.latitude, location.longitude]);
            if (speeds[index] >= 80) {
                color = "red"
            } else if (speeds[index] < 80 && speeds[index] > 50) {
                color = "blue"
            } else if (speeds[index] <= 50) {
                color = "green"
            } else {
                color = "yellow"
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
                        Speed: {speeds[index]} km/h<br/>
                        Fuel level : {fuelLevels[index].toFixed(1)} %
                    </Popup>
                </CircleMarker>
            );

        });
        // console.log("dots")
        // console.log(dots.length)
        // console.log("dots")
    }
    const handleDownloadClick = async () => {
        if (!startTime || !endTime) {
            alert('Please select both start and end times.');
            return;
        }

        setIsLoading(true);

        const convertToTehranTime = (date) => {
            let tehranDate = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Tehran"}));
            let options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
            return new Intl.DateTimeFormat('en-US', options).format(tehranDate);
        };



        const fromTime = new Date(startTime).getTime() / 1000;
        const toTime = new Date(endTime).getTime() / 1000;
        const formattedFromTime = convertToTehranTime(new Date(startTime));
        const formattedToTime = convertToTehranTime(new Date(endTime));
        const apiUrl = `https://khodroai.com/api/history/carID/${selectedCarID}/?fromTime=${fromTime}&toTime=${toTime}&fields=location,variables&maxPoints=1800`;
        const lastFourDigits = selectedCarID.slice(-4);

        try {
            const response = await axios.get(apiUrl, {
                headers: {
                    Authorization: `Token ${token}`
                }
            });
            if (response.status == 200){

            console.log("RESPONSE SUMMARY",response.data)
            setFitMapFirstTime(false)
            setLocations(response.data.location);
            const timestampsArr = response.data.timestamp.map(dateStr => {
                return new Date(dateStr).getTime();
            });
            setTimeStamps(timestampsArr)
            const speedsArr = response.data.variables.map(arr => arr['0329']);
            setSpeeds(speedsArr);
            const throttlesArr = response.data.variables.map(arr => arr['031a']);
            setThrottlePositions(throttlesArr);
            const clutchesArr = response.data.variables.map(arr => arr['0405']);
            setClutchTorques(clutchesArr);
            const engineArr = response.data.variables.map(arr => arr['032a']);
            setEngineSpeeds(engineArr)
            const fuelArr = response.data.variables.map(arr => arr['0316']);
            setFuelLevels(fuelArr)
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
            })
        }
        setIsLoading(false); // Stop loading

        } catch (error) {
            console.error('Error fetching or downloading the file:', error);
            setIsLoading(false); // Stop loading in case of error
        }
    };
    useEffect(() => {
        if (!fitMapFirstTime) {
            if (mapRef.current) {
                if (bounds.isValid()) {
                    mapRef.current.fitBounds(bounds);
                    setFitMapFirstTime(true)
                }
            }
        }

    }, [dots]);
    return (
        <ScreenSummary>
            <ButtonsContainer >
                <p>Start : </p>
                <input className="time-picker" type="datetime-local" value={startTime}
                       onChange={e => setStartTime(e.target.value)}/>
                <p>End : </p>
                <input className="time-picker" type="datetime-local" value={endTime}
                       onChange={e => setEndTime(e.target.value)}/>
                <button onClick={handleDownloadClick} className="apply-button">{isLoading ? 'Fetching...' : 'Apply'}</button>
            </ButtonsContainer>
            <CardsContainer>
                <CardWrapper>
                    <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Speed (avg) </p>
                    <FirstCard>
                        <p style={{
                            fontSize: "xx-large",
                            fontWeight: "bold",
                            margin: "1.25rem 0"
                        }}>{cardsData.speed.toFixed(0)}</p>
                        <p style={{fontSize: "small", margin: "1.25rem 0"}}>km/h</p>
                    </FirstCard>
                </CardWrapper>
                <CardWrapper>
                    <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Distance (trip) </p>
                    <SecondCard>
                        <p style={{
                            fontSize: "xx-large",
                            fontWeight: "bold",
                            margin: "1.25rem 0"
                        }}>{cardsData.distance.toFixed(1)}</p>
                        <p style={{fontSize: "small", margin: "1.25rem 0"}}>km</p>
                    </SecondCard>
                </CardWrapper>
                <CardWrapper>
                    <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Fuel Consumption </p>
                    <ThirdCard>
                        <p style={{
                            fontSize: "xx-large",
                            fontWeight: "bold",
                            margin: "1.25rem 0"
                        }}>{cardsData.fuel.toFixed(1)}</p>
                        <p style={{fontSize: "small", margin: "1.25rem 0"}}>L/100km</p>
                    </ThirdCard>
                </CardWrapper>
                <CardWrapper>
                    <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Speed (max) </p>
                    <FirstCard>
                        <p style={{
                            fontSize: "xx-large",
                            fontWeight: "bold",
                            margin: "1.25rem 0"
                        }}>{cardsData.speed_max.toFixed(0)}</p>
                        <p style={{fontSize: "small", margin: "1.25rem 0"}}>km/h</p>
                    </FirstCard>
                </CardWrapper>
                <CardWrapper>
                    <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Time (trip) </p>
                    <SecondCard>
                        <p style={{
                            fontSize: "xx-large",
                            fontWeight: "bold",
                            margin: "1.25rem 0"
                        }}>{(cardsData.time.toFixed(1)/60).toFixed(1)}</p>
                        <p style={{fontSize: "small", margin: "1.25rem 0"}}>min</p>
                    </SecondCard>
                </CardWrapper>
                <CardWrapper>
                    <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Acceleration (avg)</p>
                    <ThirdCard>
                        <p style={{
                            fontSize: "xx-large",
                            fontWeight: "bold",
                            margin: "1.25rem 0"
                        }}>{cardsData.acceleration.toFixed(1)}</p>
                        <p style={{fontSize: "small", margin: "1.25rem 0"}}>m/s2</p>
                    </ThirdCard>
                </CardWrapper>
                <CardWrapper>
                    <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Speed (std) </p>
                    <FirstCard>
                        <p style={{
                            fontSize: "xx-large",
                            fontWeight: "bold",
                            margin: "1.25rem 0"
                        }}>{cardsData.speed_std.toFixed(0)}</p>
                        <p style={{fontSize: "small", margin: "1.25rem 0"}}>km/h</p>
                    </FirstCard>
                </CardWrapper>
                <CardWrapper>
                    <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Idle Time (trip) </p>
                    <SecondCard>
                        <p style={{
                            fontSize: "xx-large",
                            fontWeight: "bold",
                            margin: "1.25rem 0"
                        }}>{(cardsData.idle_time.toFixed(3)*100).toFixed(1)}</p>
                        <p style={{fontSize: "small", margin: "1.25rem 0"}}>%</p>
                    </SecondCard>
                </CardWrapper>
                <CardWrapper>
                    <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Engine Speed (avg) </p>
                    <ThirdCard>
                        <p style={{
                            fontSize: "xx-large",
                            fontWeight: "bold",
                            margin: "1.25rem 0"
                        }}>{cardsData.engine_speed.toFixed(0)}</p>
                        <p style={{fontSize: "small", margin: "1.25rem 0"}}>rpm</p>
                    </ThirdCard>
                </CardWrapper>
            </CardsContainer>
            <MapWrapperSummary>
                <p style={{ padding: "0", margin: "0" }}>GPS Position </p>
                <MapContainer center={[35.7219, 51.3347]} zoom={10} scrollWheelZoom={false} ref={mapRef}
                              style={{ height: "75vh", width: '100%'}}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {dots}
                </MapContainer>
            </MapWrapperSummary>
        </ScreenSummary>
    );
}

export default Summary;
