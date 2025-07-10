import React, {PureComponent} from 'react';
import {AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer} from 'recharts';
import moment from 'moment';

// Function to generate random data with timestamps
const generateData = (metric, range, count) => {
    let currentTime = moment();
    return Array.from({length: count}, (_, index) => ({
        time: currentTime.subtract(range / count, 'minutes').format('HH:mm'),
        value: Math.floor(Math.random() * 100) // Random value for demonstration
    })).reverse();
};

const CustomTooltip = ({active, payload, data, label, onHover}) => {
    if (active && payload && payload.length) {
        // console.log("Payload :", payload)
        const time = payload[0].payload.time;
        const index = data.findIndex(item => item.time === time);
        // console.log("INDEX in custom tooltip :", index)
        if (index !== -1) {
            onHover(index)
        }
        return (
            <div style={{
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: 'white',
                margin: "0px",
                padding: '0px',
                border: '1px solid #ccc',
                borderRadius: '4px'
            }}>
                {payload.map((data, index) => (
                    <p key={index} style={{color: data.color, padding: "0px", margin: "0px", fontSize: "12px"}}>
                        {`${data.name}: ${data.value.toFixed(2)}`}
                    </p>
                ))}
                <p style={{
                    padding: '0px',
                    margin: "0px",
                    backgroundColor: "darkblue",
                    fontSize: "12px"
                }}>{`Time: ${label}`}</p>
            </div>
        );
    }
    else {
        onHover(null);
    }

    return null;
};

const dataSpeed = generateData('Speed', 20, 375); // 20 data points for 20 minutes
const dataThrottle = generateData('Throttle Position', 20, 375);
const dataClutchTorque = generateData('Clutch Torque', 20, 375);

class SynchronizedCharts extends PureComponent {
    render() {
        const {data} = this.props;
        // console.log("DATAAAAA")
        // console.log(data)
        const realSpeed = data.speeds
        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
        const heightInVh = 0.12 * vh;
        const realThrottle = data.throttlePositions
        const realClutchTorque = data.clutchTorques
        const realAltitude = data.locations.map(location => location.altitude)
        // locations.map(location => location.altitude);
        // console.log("ALTIDUE :", realAltitude)
        const realTimeStamps = data.timeStamps.map(timestamp => moment(timestamp).format('HH:mm:ss'));
        const realSpeedData = realSpeed.map((speed, index) => ({value: speed, time: realTimeStamps[index]}));
        const realThrottleData = realThrottle.map((throttle, index) => ({
            value: throttle,
            time: realTimeStamps[index]
        }));
        const realClutchTorqueData = realClutchTorque.map((clutchTorque, index) => ({
            value: clutchTorque,
            time: realTimeStamps[index]
        }));
        const realAltitudeData = realAltitude.map((altitude, index) => ({
            value: altitude,
            time: realTimeStamps[index]
        }));
        return (
            <div style={{
                width: '100%',
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "0.25rem 0"
            }}>
                {/* Speed Chart */}
                <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Speed (km/h)</p>
                <ResponsiveContainer width="95%" height={heightInVh} style={{
                    backgroundColor: "#282c33",
                    borderRadius: "8px",
                    margin: "0 0.5rem",
                    boxShadow:"rgba(0, 0, 0, 0.24) 0px 3px 8px"
                }}>
                    <AreaChart data={realSpeedData} syncId="anyId" margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="time" tick={{fontSize: 12}}/>
                        <YAxis tick={{fontSize: 12}}/>
                        <Tooltip content={<CustomTooltip data={realSpeedData} onHover={this.props.onDataPointHover}/>}/>
                        <defs>
                            <linearGradient id="colorSpeed" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke="#8884d8" fillOpacity={1} fill="url(#colorSpeed)"/>
                    </AreaChart>
                </ResponsiveContainer>

                {/* Throttle Position Chart */}
                <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Throttle Position</p>
                <ResponsiveContainer width="95%" height={heightInVh} style={{
                    backgroundColor: "#282c33",
                    borderRadius: "8px",
                    margin: "0 0.5rem",
                    boxShadow:"rgba(0, 0, 0, 0.24) 0px 3px 8px"
                }}>
                    <AreaChart data={realThrottleData} syncId="anyId" margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="time" tick={{fontSize: 12}}/>
                        <YAxis tick={{fontSize: 12}}/>
                        <Tooltip content={<CustomTooltip data={realThrottleData} onHover={this.props.onDataPointHover}/>}/>
                        <defs>
                            <linearGradient id="colorThrottle" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke="#82ca9d" fillOpacity={1}
                              fill="url(#colorThrottle)"/>
                    </AreaChart>
                </ResponsiveContainer>

                {/* Clutch Torque Chart */}
                <p style={{padding: "0", margin: "0",fontSize:"14px"}}>Altitude</p>
                <ResponsiveContainer width="95%" height={heightInVh} style={{
                    backgroundColor: "#282c33",
                    borderRadius: "8px",
                    margin: "0 0.5rem",
                    boxShadow:"rgba(0, 0, 0, 0.24) 0px 3px 8px"
                }}>
                    <AreaChart data={realAltitudeData} syncId="anyId"
                               margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="time" tick={{fontSize: 12}}/>
                        <YAxis tick={{fontSize: 12}} domain={[dataMin => (Math.floor(dataMin)), dataMax => (Math.ceil(dataMax))]}/>
                        <Tooltip content={<CustomTooltip data={realAltitudeData} onHover={this.props.onDataPointHover}/>}/>
                        <defs>
                            <linearGradient id="colorTorque" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ffc658" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#ffc658" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <Area type="monotone" dataKey="value" stroke="#ffc658" fillOpacity={1}
                              fill="url(#colorTorque)"/>
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    }
}

export default SynchronizedCharts;