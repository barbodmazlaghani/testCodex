import React, {useState, useEffect, useRef} from 'react';
import {MdDirectionsCar, MdOutlineDescription, MdSettingsInputAntenna} from 'react-icons/md';
import { FaSdCard } from "react-icons/fa";
import { LuBrain } from "react-icons/lu";
import { FaCheckCircle, FaTimesCircle } from 'react-icons/fa'; // Icons for tick and cross
import { Button } from '@mui/material';
import {MapContainer, TileLayer, Polyline, Marker, Popup, useMap, CircleMarker} from 'react-leaflet';
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import * as XLSX from 'xlsx';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import logoImage from './logo-white.png'
import styled from "styled-components";
import Globe from "react-globe.gl"
import {BiExit, BiMenu} from "react-icons/bi";
import RoutingMachine from "./RoutingMachine";
import axios from "axios";
import {BsFilePerson, BsPersonSquare} from "react-icons/bs";
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import {Box, CircularProgress, Backdrop} from "@mui/material";
import {useNavigate} from "react-router-dom";
import Card from "./components/Card/Card";
import Dashboard from "./components/Dashboard/Dashboard";
import PidSelectorDropdown from './components/PidSelectorDropdown';


//const server_address = '127.0.0.1:8000'
const server_address = 'khodroai.com'

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow
});

L.Marker.prototype.options.icon = DefaultIcon;
const customStyles = {
    path: {
        stroke: '#ffffff', // Set the stroke color to white
        strokeLinecap: 'round', // Optional: Rounded line ends
    },
    trail: {
        stroke: 'transparent', // Hide the trail (background) by making it transparent
    },
    text: {
        fill: '#ffffff', // Set the text color to white
        fontSize: '24px', // Optional: Adjust font size
    },
};

const getVariableName = (code) => {
    switch (code) {
        case '032a':
            return 'Engine speed';
        case '030a':
            return 'Battery voltage';
        case '031f':
            return 'Coolant temperature';
        case '0329':
            return 'Vehicle Speed';
        case '0356':
            return 'Cumulative mileage';
        case '0408':
            return 'Trip fuel consumption';
        case '0316':
            return 'Fuel level';
        case '0348':
            return 'Switch status';
        case '0345':
            return 'Engine status';
        case '034f':
            return 'Current gear shift position';
        case '031a':
            return 'Throttle position';
        case '031c':
            return 'Accelerator pedal position';
        case '0405':
            return 'Clutch torque';
        case '0313':
            return 'Electrical load';
        case '0314':
            return 'Switch';
        case '0318':
            return 'Intake manifold absolute pressure';
        case '040a':
            return 'Pumping and rubbing friction torque at current condition';
        case '0409':
            return 'Average fuel consumption rate';
        case '0411':
            return 'RON factor';
        case '033d':
            return 'Estimated catalyst temperature';
        case '032f':
            return ' Target air-fuel ratio';
        default:
            return null;
    }
};

const getDashboardName = (code) => {
    switch (code) {
        case 'd1':
            return 'Instantaneous fuel consumption';
        case 'd2':
            return 'Average fuel consumption';
        case 'd3':
            return 'Kilometers traveled on the trip';
        case 'd4':
            return 'Kilometers traveled without fuel consumption';
        case 'd5':
            return 'Fuel storage potential';
        case 'd6':
            return 'Kilometers can be navigated with the current fuel level';
        case 'd7':
            return 'Momentary torque';
        case 'd8':
            return 'Medium torque';
        case 'd9':
            return 'Medium power';
        case 'd10':
            return 'Instantaneous power';
        default:
            return code;
    }
};

const getScoreName = (code) => {
    switch (code) {
        case 's0':
            return 'Total Score';
        case 's1':
            return 'Emission Score';
        case 's2':
            return 'Acceleration Score';
        case 's3':
            return 'Anticipation Score';
        case 's4':
            return 'Gear Selection Score';
        case 's5':
            return 'Safety score';
        case 's6':
            return 'Fuel Consumption Score';
        default:
            return code;
    }
};

const getUnit = (key) => {
    switch (key) {
        case 'Engine_speed':
            return 'RPM';
        case 'Battery_voltage':
            return 'V';
        case 'Coolant_temperature':
            return 'C';
        case 'Vehicle_Speed':
            return 'Km/h';
        case 'Cumulative_mileage':
            return 'km';
        case 'Trip_fuel_consumption':
            return 'uL';
        case 'Fuel_level':
            return '%';
        case 'Status_bit':
            return '';
        case 'Engine_status':
            return '';
        case 'Intake_manifold_absolute_pressure':
            return 'kPa';
        case 'Throttle_position':
            return '%';
        case 'Accelerator_pedal_position':
            return '%';
        case 'Pumping_and_rubbing_friction_torque_at_current_condition':
            return 'Nm';
        case 'Clutch_torque':
            return 'Nm';
        case 'Average_fuel_consumption_rate':
            return 'mL/s';
        case 'Estimated_catalyst_temperature':
            return '℃';

        default:
            return '';
    }
};
const readExcelData = async () => {
    const response = await fetch('/DTC(updated).xlsx',
        {
            headers: {
                'Content-Type': 'application/octet-stream',
                'Accept': 'application/octet-stream'
            }
        }
    );
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {type: 'array'});
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    return jsonData;
}
const GaugeContainer = styled.div`
  //background-color: papayawhip;
  width: 20%;
  display: flex;
  margin: 0.25rem;
  padding: 0.25rem;
  justify-content: center;
  align-items: center;
  border-radius: 1.25rem;
  @media (max-width: 768px) {
    width: 70%;
    margin: -1rem;
  }
`;
const RadialGaugeWrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  width: 100%;
  @media (max-width: 768px) {
    width: 90vw;
  }
`;
const Screen = styled.div`
  padding: 1rem 0;
  //background: rgb(14, 3, 33);
  //background: linear-gradient(45deg, rgba(14, 3, 33, 1) 0%, rgba(46, 55, 177, 1) 43%, rgba(16, 12, 32, 1) 100%);
  //background: rgb(7,37,97);
  //background: linear-gradient(45deg, rgba(7,37,97,1) 0%, rgba(40,58,102,1) 35%, rgba(56,78,130,1) 52%, rgba(145,93,60,1) 64%, rgba(119,51,2,1) 100%);
  //background: rgb(7,37,97);
  //background: linear-gradient(225deg, rgba(7,37,97,1) 0%, rgba(40,58,102,1) 35%, rgba(56,78,130,1) 52%, rgba(145,93,60,1) 64%, rgba(119,51,2,1) 100%);
  background: #49505f;
  //background: linear-gradient(55deg, rgba(7, 37, 97, 1) 0%, rgba(68, 96, 163, 1) 35%, rgba(99, 122, 176, 1) 52%, rgba(235, 150, 96, 1) 64%, rgba(255, 108, 2, 1) 100%);
  //background: rgb(7,37,97);
  //background: radial-gradient(circle, rgba(7,37,97,1) 0%, rgba(68,96,163,1) 35%, rgba(99,122,176,1) 52%, rgba(235,150,96,1) 64%, rgba(255,108,2,1) 100%);
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
`
const TopDownButton = styled.button`
  background: none;
  color: inherit;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  outline: inherit;
`
const SignalText = ({ signal }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <MdSettingsInputAntenna style={{ marginRight: 4 }} />
        {`${signal}%`}
    </div>
);
const DropDownMenu = styled.div`
  position: absolute;
  top: 0;
  left: -75px;
  background-color: rgb(244, 183, 54);
  min-width: 160px;
  box-shadow: 0px 8px 16px 0px rgba(0, 0, 0, 0.2);
  padding: 12px 16px;
  z-index: 9999;
`
const TopDownListButton = styled.button`
  background: none;
  color: inherit;
  border: none;
  padding: 0;
  font: inherit;
  cursor: pointer;
  outline: inherit;
  margin: 0.25rem;
`
const TopDownList = styled.div`
  background: rgb(7, 37, 97);
  background: linear-gradient(100deg, rgba(7, 37, 97, 1) 0%, rgba(84, 87, 110, 1) 100%);
  border-radius: 10px;
  border: #898989 1px solid;
`
const Accordion = ({title, children}) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div>
            <h2 className="accordion-header" onClick={() => setIsOpen(!isOpen)}>
                <span>{title}</span>
                <span>{isOpen ? '▼' : '►'}</span>
            </h2>
            <div className={`panel ${isOpen ? 'open' : ''}`}>
                {children}
            </div>
        </div>
    );
};

const CardsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 20px;
  padding: 20px;
`;
// Gen random data
const N = 30;
const gData = [...Array(N).keys()].map(() => ({
    lat: (Math.random() - 0.5) * 180,
    lng: (Math.random() - 0.5) * 360,
    size: 10,
    color: ['white'][Math.round(Math.random() * 3)]
}));
gData.push({lat: 35.75882, color: "white", size: 40, lng: 50.78001})
const App = () => {
    const navigate = useNavigate();
    const isUser = localStorage.getItem("user")
    const [ecuSelectedDicts,setEcuSelectedDicts] = useState({"main":{},"inverse":{}})
    const [isDataLoading, setIsDataLoading] = useState(false); // State for loading indicator
    // const excludeKeys = ['0348', '0314', '0313', '0318', '033d', '0345', '0348', '040a', '0409'];
    if (!isUser) return window.location = "/login-register"
    const token = JSON.parse(localStorage.getItem('user')).access_token
    const [isOpen, setIsOpen] = useState(false);
    const [data, setData] = useState({
        "timestamp": "N/A",
        "carID": "N/A",
        "variables": {
        },
        "DTC": {
            "codes": [],
            "status": []
        },
        "scores": {
            "s0": 0,
            "s1": 0,
            "s2": 0,
            "s3": 0,
            "s4": 0,
            "s5": 0,
            "s6": 0
        },
        "dashboard": {
            "d1": 0,
            "d2": 0,
            "d3": 0,
            "d4": 0,
            "d5": 0,
            "d6": 0,
            "d7": 0,
            "d8": 0,
            "d9": 0,
            "d10": 0
        },
        "location": {
            "latitude": 0,
            "longitude": 0,
            "altitude": 0
        }
    });
    const [isSelectOpen, setIsSelectOpen] = useState(false);
    const [startDateTime, setStartDateTime] = useState('');
    const [endDateTime, setEndDateTime] = useState('');
    const [interval, setInterval] = useState('');
    const [sendRequest, setSendRequest] = useState(false);
    const boxRef = useRef(null);
    const selectRef = useRef(null);

    const handleOpen = () => {
        setIsSelectOpen(true);
        console.log("Handle Open Triggered");
    };

    const handleClose = () => {
        setIsSelectOpen(false);
        console.log("Handle Close Triggered");
    };

    const handleApply = () => {
        if (startDateTime && endDateTime) {
            setIsSelectOpen(false);
            setSendRequest(!sendRequest);
        }
    };

    const handleDateTimeChange = (event) => {
        if (event.target.name === "startDateTime") {
            setStartDateTime(event.target.value);
            setInterval('');
        } else if (event.target.name === "endDateTime") {
            setEndDateTime(event.target.value);
            setInterval('');
        }
    };

    const handleClickOutside = (event) => {
        if (
            boxRef.current &&
            !boxRef.current.contains(event.target) &&
            selectRef.current &&
            !selectRef.current.contains(event.target)
        ) {
            console.log("CLICKED OUTSIDE");
            handleClose();
        }
    };

    useEffect(() => {
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleExit = () => {
        if (window.confirm('Are you sure you want to exit? ')) {
            localStorage.clear();
            navigate('/login-register')
        }
    }


    function getInfo(errorCode) {
        const row = dtcCodes.find(r => r.error_code === errorCode);
        return row ? row.info : 'Error code not found';
    }

    function getErrorCodeInfo(errorCode) {
        const matchedCode = dtcCodes.find((code) => code.error_codes.includes(errorCode));

        if (matchedCode) {
            return matchedCode.info;
        }

        return "No information available for the provided error code.";
    }

    const capitalize = (string) => {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }
    const [locations, setLocations] = useState([]);
    const [speeds, setSpeeds] = useState([])
    const [selectedCarID, setSelectedCarID] = useState('');
    const [selectedCar, setSelectedCar] = useState({})
    const [ecuType,setEcuType] = useState();
    const [ecuDicts,setEcuDicts] = useState({})
    const [ws, setWs] = useState(null);
    const [dtcCodes, setDtcCodes] = useState([]);
    const [historyData, setHistoryData] = useState({})
    const splitIndex = Math.floor(locations.length / 2);
    // const [connectionStatus, setConnectionStatus] = useState("offline");
    const [lastReceivedTime, setLastReceivedTime] = useState(null);
    const [isOffline, setIsOffline] = useState(true);
    const [timer, setTimer] = useState(null)
    const mapRef = useRef();
    const globeEl = useRef();
    const bounds = new L.LatLngBounds();
    const [age, setAge] = React.useState(15);
    const [timeStamps, setTimeStamps] = useState([]);
    const [speedChartData, setSpeedChartData] = useState([]);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [highlightedMarker, setHighlightedMarker] = useState(null);
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const latestHoveredIndex = useRef(null);
    const [cars, setCars] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    let timeoutId;
    const [includeData, setIncludeData] = useState(true); // Default unchecked for 'Include Data'
    const [compressData, setCompressData] = useState(false)
    const [status, setStatus] = useState(null); // Track the current status
    useEffect(() => {
        // Update the status only if it's explicitly 1 or 0
        if (data?.sd_status === 1 || data?.sd_status === 0) {
          setStatus(data.sd_status);
        }
        // Otherwise, preserve the previous state
      }, [data?.sd_status]);

    const convertToTehranTime = (date) => {
        let tehranDate = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Tehran"}));
        let options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        return new Intl.DateTimeFormat('en-US', options).format(tehranDate);
    };

    const handleDownloadClick = async () => {
        if (!startTime || !endTime) {
            alert('Please select both start and end times.');
            return;
        }

        setIsLoading(true); // Start loading

        const fromTime = new Date(startTime).getTime() / 1000;
        const toTime = new Date(endTime).getTime() / 1000;
        const formattedFromTime = convertToTehranTime(new Date(startTime));
        const formattedToTime = convertToTehranTime(new Date(endTime));

        let apiUrl = `https://khodroai.com/api/history/carID/${selectedCarID}/?fromTime=${fromTime}&toTime=${toTime}&fields=location,variables,DTC&data_format=csv`;

        // Append onlyTripReport if includeData is unchecked
        if (!includeData) {
            apiUrl += '&onlyTripReport=1';
        }
        if(compressData){
            apiUrl += '&compressed=1';
        }

        const selectedVehicle = cars.find(car => car.carID === selectedCarID);

        try {
            const response = await axios.get(apiUrl, {
                headers: {
                    Authorization: `Token ${token}`
                },
                responseType: 'blob'
            });
            if (response.status == 200){
            
            const extension = compressData ? 'zip' : 'csv';
            const mimeType = compressData
            ? 'application/zip'
            : 'text/csv;charset=utf-8;';
        
            const file = new Blob([response.data], { type: mimeType });
            const fileURL = URL.createObjectURL(file);
            const link = document.createElement('a');
            link.href = fileURL;
            link.download = `Car_${selectedVehicle.car_model}_${selectedVehicle.car_plate}_Data_${formattedFromTime}_to_${formattedToTime}.${extension}`;
            link.click();
            }
        } catch (error) {
            console.error('Error fetching or downloading the file:', error);
        } finally {
            setIsLoading(false); // Stop loading
        }
    };
    // const debouncedSetHighlightedMarker = debounce((index) => {
    //     if (!(locations.length === 0)) {
    //         if (index !== -1 && index < locations.length - (dots.length - locations.length)) {
    //             const hoveredLocation = locations[index];
    //             if (!(hoveredLocation == null))
    //                 setHighlightedMarker({
    //                     latitude: hoveredLocation.latitude,
    //                     longitude: hoveredLocation.longitude
    //                 });
    //         }
    //     }
    // }, 500);
    useEffect(() => {
        const handleWindowResize = () => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleWindowResize);

        return () => {
            window.removeEventListener('resize', handleWindowResize);
        };
    }, []);
    const handleChange = (event) => {
        setAge(event.target.value);
    };
    const handledeviceChange = (event) => {
        setSelectedCarID(event.target.value);
        localStorage.setItem('selectedCarID', event.target.value);
        if (ws) {
            ws.close();
            console.log("ws closed");
        }

        const selectedVehicle = cars.find(car => car.carID === event.target.value);
        if (selectedVehicle) {
            // console.log("SELECTED ECU",selectedVehicle.ecu_type)
            setSelectedCar(selectedVehicle);
            // console.log("TAGHIR KARD")
            setEcuType(selectedVehicle.ecu_type);
            // console.log("TAGHIR KARX",ecuSelectedDicts)
        }
        // setTimer(null)
    };
    let markers, dots;
    if (locations.length > 0) {
        markers = locations.map(location => (
            <Marker
                key={location.id}
                position={[location.latitude, location.longitude]}
            />
        ));
        // dots = locations.map((location, index) => {
        //     let color;
        //     if (!(location.latitude >= 35.3 && location.latitude <= 36.11 && location.longitude >= 50.27 && location.longitude <= 52.3)) {
        //         locations.splice(index, 1);
        //         speeds.splice(index, 1);
        //         timeStamps.splice(index, 1);
        //         return;
        //     }
        //     bounds.extend([location.latitude, location.longitude]);
        //     if (speeds[index] >= 80) {
        //         color = "red"
        //     } else if (speeds[index] < 80 && speeds[index] > 50) {
        //         color = "blue"
        //     } else if (speeds[index] <= 50) {
        //         color = "green"
        //     } else {
        //         color = "yellow"
        //     }
        //     return (
        //         <CircleMarker
        //             key={location.id}
        //             center={[location.latitude, location.longitude]}
        //             pathOptions={{
        //                 fillColor: color,
        //                 fillOpacity: 0.7,
        //                 stroke: false
        //             }}
        //             radius={3}
        //         />
        //     );
        //
        // });
        // console.log("dots")
        // console.log(dots.length)
        // console.log("dots")
    }
    // console.log("HISTORY DATA ___>")
    // console.log(historyData)
    // console.log("location injie")
    //
    // console.log(locations.length)
    // console.log(speeds.length)
    // console.log("location balaie")

    function ws_onopen() {
        console.log('WebSocket Client Connected');
    }

    const handleMouseEnter = () => {
        setShowMenu(true)
    };
    const handleMouseLeave = () => {
        setShowMenu(false)
    };
    const handleDashboardClick = () => {
        navigate('/monitoring')
    };
    const handleSummaryClick = () => {

        navigate('/summary', {state : selectedCarID})
    };
    const handleAIClick = () => {
        navigate(`/ai`);
    };
    const handleChangePassClick = () => {

        navigate('/change-password')
    };

    function ws_onmessage(message) {
        const data = JSON.parse(message.data).message;
        // console.log("WEBSOCKET DATA : ",data)

        setData(data);

        // Update lastReceivedTime
        setLastReceivedTime(new Date(data.timestamp));
    }
    function startTimeout() {
        timeoutId = setTimeout(() => {
            checkTimeDifference();
        }, 85000); // Timeout set for 5 seconds
    }
    function resetTimeout() {
        clearTimeout(timeoutId);
        startTimeout();
    }
    const checkTimeDifference = () => {
        const currentTime = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Tehran"}));

        if (lastReceivedTime === null) {
            // console.log("NULL")
            setIsOffline(true);
            return;
        }
        // console.log("CURRENT : ",currentTime,"LAST : ",lastReceivedTime);
        const diffInMinutes = (currentTime - lastReceivedTime) / 60000;
        // console.log("DIFF IN MIN : ",diffInMinutes)
        if (diffInMinutes > 1.5) {
            setIsOffline(true);
        } else {
            setIsOffline(false);
        }
    };
    useEffect(() => {
        checkTimeDifference();
        // 60000 milliseconds = 1 minute

        const interval = setInterval(checkTimeDifference, 60000); // 60000 milliseconds = 1 minute

        return () => clearInterval(interval);
        // return () => clearInterval(interval);
    }, [lastReceivedTime]);

    // useEffect(() => {
    //     const fetchData = async () => {
    //         setLoading(true);
    //         try {
    //             const apiUrl = `https://khodroai.com/api/get-cars/`;
    //             const response = await axios.get(apiUrl, {
    //                 headers: {
    //                     Authorization: `Token ${token}`
    //                 }
    //             });
    //             setCars(response.data);
    //             if (response.data.length > 0) {
    //                 setSelectedCar(response.data[0])
    //                 handledeviceChange({target: {value: response.data[0].carID}});
    //             }
    //         } catch (error) {
    //             console.error('Error fetching data: ', error);
    //         }
    //         setLoading(false);
    //     };
    //
    //     fetchData();
    // }, [token]);
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const apiUrl = `https://khodroai.com/api/get-cars/`;
                const response = await axios.get(apiUrl, {
                    headers: {
                        Authorization: `Token ${token}`
                    }
                });
                setCars(response.data);
                if (response.data.length > 0) {
                    let selectedCar;
                    const savedCarID = localStorage.getItem('selectedCarID');
                    if (savedCarID) {
                        selectedCar = response.data.find(car => car.carID === savedCarID);
                    } else {
                        selectedCar = response.data[0];
                        localStorage.setItem('selectedCarID', selectedCar.carID);
                    }
                    setEcuType(selectedCar.ecu_type)
                    setSelectedCar(selectedCar);
                    handledeviceChange({target: {value: selectedCar.carID}});

                }
            } catch (error) {
                console.error('Error fetching data: ', error);
            }
            setLoading(false);
        };

        fetchData();
    }, [token]);
    useEffect(() => {
        const fetchData = async () => {
            try {
                const apiUrl = `https://khodroai.com/api/get-ecu-variables/`;
                const response = await axios.get(apiUrl, {
                    headers: {
                        Authorization: `Token ${token}`
                    }
                });

                if (response.data) {
                    // console.log("ECU DICTS",response.data)
                    setEcuDicts(response.data)

                }
            } catch (error) {
                console.error('Error fetching data: ', error);
            }
        };

        fetchData();
    }, [token]);
    useEffect(() => {
        if(ecuType && ecuDicts){
            let selectedDic = ecuDicts[ecuType]
            const invertedData = {};
            for (let key in selectedDic) {
                invertedData[selectedDic[key]] = key;
            }
            setEcuSelectedDicts({"main":selectedDic,"inverse":invertedData})
            localStorage.setItem("ecuSelectedDicts", JSON.stringify({"main":selectedDic,"inverse":invertedData}));
        }
    }, [ecuType,ecuDicts]);


    useEffect(() => {
        setSpeedChartData(
            timeStamps.map((ts, i) => [ts, speeds[i]])
        );
    }, [timeStamps, speeds]);
    useEffect(() => {

        if (mapRef.current) {
            if (bounds.isValid()) {
                mapRef.current.fitBounds(bounds);
            }
        }

    }, []);
    useEffect(() => {
        let timeoutId;
        const fetchData = async () => {
            const excel = await readExcelData();
            setDtcCodes(excel);
        };
        fetchData();
        console.log("WEB SOCKET " + selectedCarID)

        const ws = new WebSocket(`wss://${server_address}/ws/car_data/${selectedCarID}/?token=${token}`);
        setWs(ws);

        ws.onopen = () => {
            ws_onopen();
            // setConnectionStatus("live"); // Set to 'live' when WebSocket connection is open
        };
        // setTimer(setTimeout(() => setIsOffline(true), 10000))
        ws.onmessage = (event) => {
            ws_onmessage(event);

            // clearTimeout(timeoutId); // Clear the timeout whenever a new message arrives
            //
            // if (event.data) {
            //     timeoutId = setTimeout(() => setConnectionStatus("offline"), 10000); // Set to 'null' after 10 seconds if no new message
            // } else {
            //     // setConnectionStatus("live");
            // }
        };

        return () => {
            ws.close();
            console.log("ws closed");
            // clearTimeout(timeoutId); // Clear the timeout when the component unmounts
            // clearTimeout(timer)
        };
    }, [selectedCarID]);

    // const optionsSpeed = {
    //     chart: {
    //         type: 'area',
    //         height: "100%",
    //         width: "100%",
    //         zoom: {
    //             autoScaleYaxis: true
    //         },
    //         stroke: {
    //             width: 1,
    //             opacity: 0.5,
    //         },
    //         events: {
    //             mouseMove: function (event, chartContext, config) {
    //                 const hoveredIndex = config.dataPointIndex;
    //                 // console.log(hoveredIndex);
    //                 if (hoveredIndex < locations.length) {
    //                     latestHoveredIndex.current = hoveredIndex;
    //                     debouncedSetHighlightedMarker(hoveredIndex);
    //                 }
    //             },
    //             mouseLeave: function (event, chartContext, config) {
    //                 debouncedSetHighlightedMarker(null);
    //             },
    //         }
    //     },
    //
    //     dataLabels: {
    //         enabled: false
    //     },
    //
    //     markers: {
    //         size: 0,
    //         style: 'hollow'
    //     },
    //
    //     xaxis: {
    //         type: 'datetime',
    //         min: new Date().getTime() - (age * 60 * 1000), // now - age in minutes
    //         max: Math.floor(new Date(data?.timestamp_received).getTime()) || new Date().getTime(),
    //         labels: {
    //             formatter: function (value) {
    //                 const date = new Date(value);
    //                 const options = {
    //                     timeZone: 'Asia/Tehran',
    //                     hour: '2-digit',
    //                     minute: '2-digit',
    //                     second: '2-digit'
    //                 };
    //                 return new Intl.DateTimeFormat('en-US', options).format(date);
    //             }
    //         }
    //     },
    //
    //     tooltip: {
    //         x: {
    //             format: 'dd MMM yyyy HH:mm:ss',
    //             formatter: function (value) {
    //                 const date = new Date(value);
    //                 const options = {
    //                     timeZone: 'Asia/Tehran',
    //                     year: 'numeric',
    //                     month: 'short',
    //                     day: 'numeric',
    //                     hour: '2-digit',
    //                     minute: '2-digit',
    //                     second: '2-digit'
    //                 };
    //                 return new Intl.DateTimeFormat('en-US', options).format(date);
    //             }
    //         }
    //     },
    //
    //     fill: {
    //         type: 'gradient',
    //         gradient: {
    //             opacityFrom: 0.5,
    //             opacityTo: 0.7,
    //             stops: [0, 100]
    //         }
    //     }
    // };
    useEffect(() => {
        const now = Math.floor(Date.now() / 1000); // Get current timestamp in seconds
        const fromTime = now - (age * 60); // Convert age from minutes to seconds and subtract from current timestamp

        const fetchData = async () => {
            if (selectedCarID) { // Check if selectedCarID is not null
                setIsDataLoading(true); // Start loading
                const apiUrl = `https://khodroai.com/api/history/carID/${selectedCarID}/?fromTime=${fromTime}&toTime=${now}&fields=location,variables&maxPoints=1800`; // Changed maxPoints
                try {
                    const response = (await axios.get(apiUrl, {
                        headers: {
                            Authorization: `Token ${token}`
                        }
                    }));
                    if (response.status == 200){

                    setHistoryData(response.data)
                    setLocations(response.data.location);
                    const timestampsArr = response.data.timestamp.map(dateStr => {
                        return new Date(dateStr).getTime();
                    });
                    setTimeStamps(timestampsArr)
                    const speedsArr = response.data.variables.map(arr => arr[ecuSelectedDicts['inverse']['Vehicle_Speed']]);
                    setSpeeds(speedsArr);
                }
                } catch (error) {
                    console.error(error);
                } finally {
                    setIsDataLoading(false); // Stop loading
                }
            }
        }
        fetchData();

        if (windowWidth > 768) {
            const globe = globeEl.current;

            const animate = () => {
                globe.controls().autoRotate = true;
                globe.controls().autoRotateSpeed = 0.5;
            }

            animate();
            globe.controls().enableZoom = false;
        }

    }, [age, selectedCarID]);
    useEffect(() => {
        const convertToTehranTime = (date) => {
            let tehranDate = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Tehran"}));
            let options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
            return new Intl.DateTimeFormat('en-US', options).format(tehranDate);
        };
        if(startDateTime !== "" && endDateTime !== "") {
            const fromTime = new Date(startDateTime).getTime() / 1000;
            const toTime = new Date(endDateTime).getTime() / 1000;
            const formattedFromTime = convertToTehranTime(new Date(fromTime));
            const formattedToTime = convertToTehranTime(new Date(toTime));
            console.log(fromTime,toTime)
            const fetchData = async () => {
                if (selectedCarID) { // Check if selectedCarID is not null
                    setIsDataLoading(true); // Start loading
                    const apiUrl = `https://khodroai.com/api/history/carID/${selectedCarID}/?fromTime=${fromTime}&toTime=${toTime}&fields=location,variables&maxPoints=1800`; // Changed maxPoints
                    try {
                        const response = (await axios.get(apiUrl, {
                            headers: {
                                Authorization: `Token ${token}`
                            }
                        }));
                        // console.log("res" ,response)
                        if (response.status == 200){

                        setHistoryData(response.data)
                        setLocations(response.data.location);
                        const timestampsArr = response.data.timestamp.map(dateStr => {
                            return new Date(dateStr).getTime();
                        });
                        setTimeStamps(timestampsArr)
                        const speedsArr = response.data.variables.map(arr => arr[ecuSelectedDicts['inverse']['Vehicle_Speed']]);
                        setSpeeds(speedsArr);
                    }
                    } catch (error) {
                        console.error(error);
                    } finally {
                        setIsDataLoading(false); // Stop loading
                    }
                }
            }
            fetchData();
        }


    }, [sendRequest]);

    const markerSvg = `<svg viewBox="-4 0 36 36">
    <path fill="currentColor" d="M14,0 C21.732,0 28,5.641 28,12.6 C28,23.963 14,36 14,36 C14,36 0,24.064 0,12.6 C0,5.641 6.268,0 14,0 Z"></path>
    <circle fill="black" cx="14" cy="14" r="7"></circle>
  </svg>`;

    const percentage = 66; // Example value
    return (
        <Screen>

            <div className="top-bar">
                <div style={{display: "flex", alignItems: "center", flexWrap: "wrap"}}>
                    <img src={logoImage} alt={"image"} style={{width: "60px"}}/>
                    <div style={{marginLeft: "20px",fontSize:"15px",display:"flex",flexDirection:"column"}}>
                        <div>
                            Last update
                        </div>
                        <div>
                            {data?.timestamp ? (
                            <>
                                {data.timestamp.split(' ')[0]}<br />
                                {data.timestamp.split(' ')[1]}
                            </>
                            ) : (
                            'Live'
                            )}
                        </div>
                    </div>

                </div>
                <div style={{display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center"}}>
                    {/*<div style={{marginRight: "10px"}}>{data?.timestamp_received ? 'Offline' : 'Online'}</div>*/}
                    <div style={{display:"flex",flexDirection:"column",justifyContent:"space-around",alignItems:"center", width: 50, height: 60 }}>
      {status === 1 ? (
        <FaCheckCircle style={{ color: 'green', fontSize: '1rem' }} />
      ) : status === 0 ? (
        <FaTimesCircle style={{ color: 'red', fontSize: '1rem' }} />
      ) : null /* Keep the previous state */}
      <FaSdCard style={{marginTop:3}}/>

    </div>
                    <div style={{width:50,height:60}}>
                        <CircularProgressbar styles={customStyles} value={data?.signal || 0} maxValue={100} text={`${data?.signal || 0}%`} />
                        <MdSettingsInputAntenna style={{marginTop:3}}/>
                    </div>

                    <div style={{margin:"0 1rem"}}>
                        <div style={{
                            height: '10px',
                            width: '10px',
                            backgroundColor: isOffline ? 'red' : '#5BE12C',
                            borderRadius: '50%',
                            display: 'inline-block',
                            marginRight: '5px'
                        }} />
                        <span>{isOffline ? 'Offline' : 'Online'}</span>
                    </div>
                    <div style={{marginRight: "20px", fontSize: "20px"}}>
                        {capitalize(JSON.parse(localStorage.getItem('user')).username)}
                    </div>
                    {/*<TopDownButton>*/}
                    {/*    <BsFilePerson style={{color: "white", fontSize: "27px", padding: "0.25rem"}}/>*/}
                    {/*</TopDownButton>*/}
                    <FormControl sx={{m: 1, minWidth: 120}} size="small">
                        <InputLabel id="demo-select-small-label-device-id"
                                    sx={{color: selectedCarID ? 'inherit' : 'white'}}>Car</InputLabel>
                        <Select
                            labelId="demo-select-small-label-device-id"
                            id="demo-select-small-device-id"
                            value={selectedCarID}
                            label="Car"
                            onChange={handledeviceChange}
                            sx={{
                                color: "white",
                                '.MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(228, 219, 233, 0.25)',
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(228, 219, 233, 0.25)',
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(228, 219, 233, 0.25)',
                                },
                                '.MuiSvgIcon-root ': {
                                    fill: "white !important",
                                }
                            }}
                        >
                            {loading ? (
                                <MenuItem value="">
                                    <CircularProgress size={24}/>
                                </MenuItem>
                            ) : cars.length > 0 ? (
                                cars.map(car => (
                                    <MenuItem key={car.carID} value={car.carID} style={{ display: 'flex', justifyContent: 'space-between' }}>
    <span>
      {car.car_model} - {car.car_plate}
    </span>
    <span>{car.is_active ? "🟢" : "🔴"}</span>
  </MenuItem>
                                ))
                            ) : (
                                <MenuItem value="">
                                    <em>No Cars Available</em>
                                </MenuItem>
                            )}
                        </Select>
                    </FormControl>
                    <FormControl sx={{m: 1, minWidth: 120}} size="small">
                        <InputLabel id="demo-select-small-label"
                                    sx={{color: age ? 'inherit' : 'white'}}>Interval</InputLabel>
                        <Select
                            labelId="demo-select-small-label"
                            id="demo-select-small"
                            value={age}
                            label="Interval"
                            onChange={handleChange}
                            sx={{
                                color: "white",
                                '.MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(228, 219, 233, 0.25)',
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(228, 219, 233, 0.25)',
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(228, 219, 233, 0.25)',
                                },
                                '.MuiSvgIcon-root ': {
                                    fill: "white !important",
                                }
                            }}
                        >
                            {/*<MenuItem value="">*/}
                            {/*    <em>None</em>*/}
                            {/*</MenuItem>*/}
                            <MenuItem value={5}>5 Min</MenuItem>
                            <MenuItem value={15}>15 Min</MenuItem>
                            <MenuItem value={30}>30 Min</MenuItem>
                            <MenuItem value={60}>1 H</MenuItem>
                            <MenuItem value={240}>4 H</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl sx={{ m: 1, minWidth: 120 }} size="small">
                        <InputLabel
                            id="demo-select-small-label"
                            sx={{ color: interval || startDateTime || endDateTime ? 'inherit' : 'white' }}
                        >
                            Interval
                        </InputLabel>
                        <Select
                            labelId="demo-select-small-label"
                            id="demo-select-small"
                            open={isSelectOpen}
                            onOpen={handleOpen}
                            // onClose={handleClose}
                            value={interval || startDateTime || endDateTime}
                            label="Interval"
                            ref={selectRef}
                            sx={{
                                color: "white",
                                '.MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(228, 219, 233, 0.25)',
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(228, 219, 233, 0.25)',
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'rgba(228, 219, 233, 0.25)',
                                },
                                '.MuiSvgIcon-root ': {
                                    fill: "white !important",
                                }
                            }}
                            renderValue={() => interval || `${startDateTime} - ${endDateTime}`}
                        >
                            <Box
                                display="flex"
                                flexDirection="column"
                                alignItems="center"
                                justifyContent="space-between"
                                padding="10px"
                                ref={boxRef}
                                onClick={(e) => e.stopPropagation()} // Prevent click event from closing the Select component
                            >
                                <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
                                    <input
                                        className="time-picker"
                                        type="datetime-local"
                                        value={startDateTime}
                                        name="startDateTime"
                                        onChange={handleDateTimeChange}
                                        style={{ flex: 1, marginRight: '10px' }}
                                        onClick={(e) => e.stopPropagation()} // Prevent click event from closing the Select component
                                    />
                                    <input
                                        className="time-picker"
                                        type="datetime-local"
                                        value={endDateTime}
                                        name="endDateTime"
                                        onChange={handleDateTimeChange}
                                        style={{ flex: 1 }}
                                        onClick={(e) => e.stopPropagation()} // Prevent click event from closing the Select component
                                    />
                                </Box>
                                <Button onClick={handleApply} sx={{ marginTop: '10px' }}>Apply</Button>
                            </Box>
                        </Select>
                    </FormControl>
                    {/*<div style={{position: 'relative', display: 'inline-block', padding: "0.25rem"}}>*/}
                    {/*    <TopDownButton onClick={() => setIsOpen(!isOpen)}>*/}
                    {/*        <MdDirectionsCar style={{color: "white", fontSize: "30px"}}/>*/}
                    {/*    </TopDownButton>*/}
                    {/*    /!*<p>Selected device ID: {selectedCarID}</p>*!/*/}
                    {/*</div>*/}
                    {isUser && <PidSelectorDropdown carID={selectedCarID} />}
                    <TopDownButton onMouseEnter={handleMouseEnter}
                                   onMouseLeave={handleMouseLeave}>
                        <BiMenu style={{color: "white", fontSize: "30px", padding: "0.25rem"}}/>
                        {showMenu && (
                            <div style={{position: "relative"}} onMouseLeave={handleMouseLeave}
                                 onMouseEnter={handleMouseEnter}>
                                <DropDownMenu>
                                    <div onClick={handleDashboardClick} style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "start"
                                    }}>
                                        <div style={{fontWeight: "bold"}}>Dashboard</div>
                                        <div><MdDirectionsCar
                                            style={{color: "white", fontSize: "20px"}}/></div>
                                    </div>
                                    <div onClick={handleSummaryClick} style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "start"
                                    }}>
                                        <div style={{fontWeight: "bold"}}>Summary</div>
                                        <div><MdOutlineDescription
                                            style={{color: "white", fontSize: "20px"}}/></div>
                                    </div>
                                    <div onClick={handleChangePassClick} style={{
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "start"
                                    }}>
                                        <div style={{fontWeight: "bold"}}>Change Password</div>
                                        <div><MdOutlineDescription
                                            style={{color: "white", fontSize: "20px"}}/></div>
                                    </div>
                                    <div onClick={handleAIClick} style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                                        <div style={{ fontWeight: "bold" }}>AI </div>
                                        <div><LuBrain style={{ color: "white", fontSize: "20px" }} /></div>
                                    </div>

                                </DropDownMenu>
                            </div>
                        )}
                    </TopDownButton>
                    <TopDownButton onClick={handleExit}>
                        <BiExit style={{color: "white", fontSize: "30px", padding: "0.25rem"}}/>
                    </TopDownButton>
                </div>
            </div>
            <div style={{width: "100%"}}>
                <Backdrop
                    sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1, position: 'absolute' }}
                    open={isDataLoading}
                >
                    <CircularProgress color="inherit" />
                </Backdrop>
                {ecuSelectedDicts.main && ecuSelectedDicts.inverse && Object.keys(ecuSelectedDicts.main).length === 0 && Object.keys(ecuSelectedDicts.inverse).length === 0
                    ? <div>Loading ECU Data...</div> // Keep loading text for initial ECU data
                    : <Dashboard data={data} car={selectedCar} token={token} interval={age} send={sendRequest} start={startDateTime} end={endDateTime} ecu={ecuSelectedDicts}/>
                }
            </div>
            <div className="main-content">
                {/* <div className="right-bar">
          <div>Timestamp: {data?.timestamp || 'N/A'}</div>
          <div>Device ID: {data?.carID || 'N/A'}</div>
        </div> */}
                <div className="globe-map"
                     style={{display: "flex", justifyContent: "space-between", alignItems: "center", height: "100%"}}>
                    {windowWidth >= 768 ? (
                        <Globe
                            width="600"
                            ref={globeEl}
                            backgroundColor="rgba(0,0,0,0)"
                            globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
                            htmlElementsData={gData}
                            htmlElement={(d) => {
                                const el = document.createElement('div');
                                el.innerHTML = markerSvg;
                                el.style.color = d.color;
                                el.style.width = `${d.size}px`;

                                el.style['pointer-events'] = 'auto';
                                el.style.cursor = 'pointer';
                                el.onclick = () => console.info(d);
                                return el;
                            }}
                        />
                    ) : null}
                </div>
                {/*<div className="gauge-container">*/}

                {/*    <GaugeContainer>*/}
                {/*        <RadialGaugeWrapper>*/}
                {/*            <RadialGauge*/}
                {/*                id="rpm-gauge"*/}
                {/*                units='RPM'*/}
                {/*                title='Engine Speed'*/}
                {/*                value={data?.variables['032a'] || 0}*/}
                {/*                minValue={0}*/}
                {/*                maxValue={6000}*/}
                {/*                majorTicks={['0', '1000', '2000', '3000', '4000', '5000', '6000']}*/}
                {/*                minorTicks={5}*/}
                {/*                highlights={[{"from": 1400, "to": 2600, "color": "rgba(0,255,0,.85)"}]}*/}
                {/*            />*/}
                {/*        </RadialGaugeWrapper>*/}
                {/*    </GaugeContainer>*/}

                {/*    <GaugeContainer>*/}
                {/*        <RadialGaugeWrapper>*/}
                {/*            <RadialGauge*/}
                {/*                id="speed-gauge"*/}
                {/*                units='Km/h'*/}
                {/*                title='Vehicle Speed'*/}
                {/*                value={data?.variables['0329'] || 0}*/}
                {/*                minValue={0}*/}
                {/*                maxValue={160}*/}
                {/*                majorTicks={['0', '20', '40', '60', '80', '100', '120', '140', '160']}*/}
                {/*                minorTicks={4}*/}
                {/*                highlights={[{"from": 40, "to": 80, "color": "rgba(0,255,0,.85)"}]}*/}
                {/*            />*/}
                {/*        </RadialGaugeWrapper>*/}

                {/*    </GaugeContainer>*/}
                {/*    <GaugeContainer>*/}
                {/*        <RadialGaugeWrapper>*/}
                {/*            <RadialGauge*/}
                {/*                id="fuel-level-gauge"*/}
                {/*                units='%'*/}
                {/*                title="Fuel Level"*/}
                {/*                value={data?.variables['0316'] || 0}*/}
                {/*                minValue={0}*/}
                {/*                maxValue={100}*/}
                {/*                majorTicks={['0', '25', '50', '75', '100']}*/}
                {/*                minorTicks={4}*/}
                {/*                highlights={[{"from": 0, "to": 10, "color": "rgba(255,0,0,.85)"}]}*/}
                {/*            />*/}
                {/*        </RadialGaugeWrapper>*/}
                {/*    </GaugeContainer>*/}
                {/*</div>*/}
                {/*<div className="chart-container" style={{*/}
                {/*    display: "flex",*/}
                {/*    justifyContent: "center",*/}
                {/*    alignItems: "center",*/}
                {/*    flexWrap: "wrap",*/}
                {/*    gap: "10px"*/}

                {/*}}>*/}
                {/*    <div className={"chart-container"} id={"upper-speed-chart"}*/}
                {/*         style={{*/}
                {/*             height: "55vh",*/}
                {/*             backgroundColor: "white",*/}
                {/*             borderRadius: "10px",*/}
                {/*             display: "flex",*/}
                {/*             justifyContent: "center",*/}
                {/*             alignItems: "center"*/}
                {/*         }}>*/}
                {/*        <Chart*/}
                {/*            options={optionsSpeed}*/}
                {/*            series={[{data: speedChartData}]}*/}
                {/*            type="area"*/}
                {/*            height="100%"*/}
                {/*            width="100%"*/}
                {/*        />*/}
                {/*    </div>*/}
                {/*    <div className={"chart-container"}*/}
                {/*         style={{*/}
                {/*             width: "50vw",*/}
                {/*             backgroundColor: "white",*/}
                {/*             borderRadius: "10px",*/}
                {/*             display: "flex",*/}
                {/*             justifyContent: "center",*/}
                {/*             alignItems: "center"*/}
                {/*         }}>*/}
                {/*        <MapContainer id={"upper-map"} center={[35.7219, 51.3347]} zoom={10} scrollWheelZoom={false}*/}
                {/*                      ref={mapRef}*/}
                {/*                      style={{height: "55vh", width: '60vw', borderRadius: "10px"}}>*/}
                {/*            <TileLayer*/}
                {/*                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"*/}
                {/*            />*/}
                {/*            <Marker position={[data.location.latitude, data.location.longitude]}>*/}
                {/*                <Popup>*/}
                {/*                    A pretty CSS3 popup. <br/> Easily customizable.*/}
                {/*                </Popup>*/}
                {/*            </Marker>*/}

                {/*            {dots}*/}
                {/*            {highlightedMarker && (*/}
                {/*                <CircleMarker*/}
                {/*                    center={[highlightedMarker.latitude, highlightedMarker.longitude]}*/}
                {/*                    pathOptions={{*/}
                {/*                        fillColor: "black",*/}
                {/*                        fillOpacity: 1,*/}
                {/*                        stroke: true,*/}
                {/*                        color: "black"*/}
                {/*                    }}*/}
                {/*                    radius={5}*/}
                {/*                />*/}
                {/*            )}*/}
                {/*        </MapContainer>*/}
                {/*    </div>*/}
                {/*</div>*/}
                {/*<div>*/}
                {/*    <div>Last update: {data?.timestamp || 'Live'}</div>*/}
                {/*</div>*/}
                {data && (
                    <>
                        <div className="tables-container">
                            <Accordion title="Variables">
                                <CardsContainer>
                                    {ecuSelectedDicts.main && ecuSelectedDicts.inverse && Object.keys(ecuSelectedDicts.main).length === 0 && Object.keys(ecuSelectedDicts.inverse).length === 0
                                        ? <div>Loading ...</div> :
                                        ecuSelectedDicts.main && Object.entries(data.variables)
                                            // .filter(([key]) => !excludeKeys.includes(key))
                                            .map(([key, value]) => (
                                                <Card
                                                    key={key}
                                                    name={ecuSelectedDicts?.main?.[key]?.replace(/_/g, ' ') ?? ''}
                                                    value={value}
                                                    unit={getUnit(ecuSelectedDicts["main"][key])}
                                                />
                                            ))}
                                </CardsContainer>
                            </Accordion>
                            <Accordion title={"Dashboard"}>
                                <CardsContainer>
                                    {Object.entries(data.dashboard)
                                        // .filter(([key]) => !excludeKeys.includes(key))
                                        .map(([key, value]) => (
                                            <Card
                                                key={key}
                                                name={getDashboardName(key)}
                                                value={value}
                                                unit={getUnit(key)}
                                            />
                                        ))}
                                </CardsContainer>
                            </Accordion>
                            <Accordion title={"Scores"}>
                                <CardsContainer>
                                    {Object.entries(data.scores)
                                        // .filter(([key]) => !excludeKeys.includes(key))
                                        .map(([key, value]) => (
                                            <Card
                                                key={key}
                                                name={getScoreName(key)}
                                                value={value}
                                                unit={getUnit(key)}
                                            />
                                        ))}
                                </CardsContainer>
                            </Accordion>
                            <Accordion title={"DTC"}>
                                <CardsContainer>
                                    {/*{Object.entries(data.DTC.codes)*/}
                                    {/*    // .filter(([key]) => !excludeKeys.includes(key))*/}
                                    {/*    .map(([key, value]) => (*/}
                                    {/*        <Card*/}
                                    {/*            key={key}*/}
                                    {/*            name={getErrorCodeInfo(value)}*/}
                                    {/*            value={value}*/}
                                    {/*            unit={data.DTC.status[value]}*/}
                                    {/*        />*/}
                                    {/*    ))}*/}
                                    {
                                        Object.entries(data.DTC.codes)
                                            .filter(([key, value]) => (data.DTC.status[key] & 8) !== 0) // Filter where 4th bit is 1
                                            .map(([key, value]) => (
                                                <Card
                                                    key={key}
                                                    name={getErrorCodeInfo(value)}
                                                    value={value}
                                                    unit={data.DTC.status[value]}
                                                />
                                            ))
                                    }
                                </CardsContainer>
                            </Accordion>
                            {/*<div className="table-container">*/}
                            {/*    <h2>DTC</h2>*/}
                            {/*    <table>*/}
                            {/*        <thead>*/}
                            {/*        <tr>*/}
                            {/*            <th>Code</th>*/}
                            {/*            <th>Info</th>*/}
                            {/*            <th>Status</th>*/}
                            {/*        </tr>*/}
                            {/*        </thead>*/}
                            {/*        <tbody>*/}
                            {/*        {data.DTC.codes.map((code, index) => (*/}
                            {/*            <tr key={index}>*/}
                            {/*                <td>{code}</td>*/}
                            {/*                <td>{getErrorCodeInfo(code)}</td>*/}
                            {/*                <td>{data.DTC.status[index]}</td>*/}
                            {/*                /!*<td>{value}</td>*!/*/}
                            {/*                /!*<td>{getUnit(key)}</td>*!/*/}
                            {/*            </tr>*/}
                            {/*        ))}*/}
                            {/*        </tbody>*/}
                            {/*    </table>*/}
                            {/*</div>*/}
                        </div>
                        <div className="csv-container">
                            <input className="time-picker" type="datetime-local" value={startTime}
                                   onChange={e => setStartTime(e.target.value)} />
                            <input className="time-picker" type="datetime-local" value={endTime}
                                   onChange={e => setEndTime(e.target.value)} />

                            {/* Checkbox for Include Data */}
                            <label>
                                <input type="checkbox" checked={includeData} onChange={() => setIncludeData(!includeData)} />
                                Include Data
                            </label>
                            <label>
                                <input type="checkbox" checked={compressData} onChange={() => setCompressData(!compressData)} />
                                Compress
                            </label>

                            {/* Single Download Button */}
                            <button className="download-button"
                                    onClick={handleDownloadClick}>
                                {isLoading ? 'Downloading...' : 'Download'}
                            </button>
                        </div>

                        {/*<MapContainer center={[data.location.latitude, data.location.longitude]} zoom={16}*/}
                        {/*              scrollWheelZoom={false} style={{height: "60vh", width: '100%'}}>*/}
                        {/*    <TileLayer*/}
                        {/*        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'*/}
                        {/*        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"*/}
                        {/*    />*/}
                        {/*    <CenterMarker center={[data.location.latitude, data.location.longitude]}/>*/}
                        {/*    <Marker position={[data.location.latitude, data.location.longitude]}>*/}
                        {/*        <Popup>*/}
                        {/*            A pretty CSS3 popup. <br/> Easily customizable.*/}
                        {/*        </Popup>*/}
                        {/*    </Marker>*/}
                        {/*</MapContainer>*/}

                    </>
                )}
            </div>
        </Screen>
    )
        ;
};

export default App;

