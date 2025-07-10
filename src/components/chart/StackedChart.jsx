import React, {PureComponent} from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    FormControl, InputLabel, Select, MenuItem, OutlinedInput,
    Checkbox, ListItemText
} from '@mui/material';
import VariableSelect from "./VariableSelect";

/**
 * Custom tooltip that also reports which data index is hovered,
 * so the parent can highlight that point on the map if needed.
 */
class CustomTooltip extends PureComponent {
    render() {
        const {active, payload, label, data, onHover} = this.props;
        if (active && payload && payload.length) {
            const index = data.findIndex(item => item.time === label);
            if (index !== -1) {
                onHover(index);
            }
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: 'white',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    padding: '5px'
                }}>
                    {payload.map((item, i) => (
                        <p key={i} style={{color: item.color, margin: 0, fontSize: '12px'}}>
                            {item.name}: {item.value != null ? item.value.toFixed(2) : 'N/A'}
                        </p>
                    ))}
                    <p style={{margin: 0, fontSize: '12px', color: 'darkblue'}}>
                        Time: {label}
                    </p>
                </div>
            );
        }
        // If not active, clear hover
        onHover(null);
        return null;
    }
}

/**
 * This chart displays all ECU variables found in `data`.
 * data is an array of objects: [ { time: 'HH:mm:ss', MyVar: 12.3, AnotherVar: 99, ... }, ... ]
 */
class StackedCharts extends PureComponent {
    constructor(props) {
        super(props);
        this.state = {
            selectedKeys: [] // which variable keys to display
        };
    }

    static getDerivedStateFromProps(props, state) {
        // Build a list of all keys except "time" from the first data row
        if (!props.data || props.data.length === 0) return null;

        const allKeys = Object.keys(props.data[0]).filter(k => k !== 'time');
        // If we have no selected keys yet (like first time), default to all
        if (state.selectedKeys.length === 0 && !state.__initialized) {
            return { selectedKeys: allKeys, __initialized: true };
        }
        // Otherwise, preserve existing selection
        return null;
    }

    handleChange = (event) => {
        this.setState({selectedKeys: event.target.value});
    };

    // Simple color palette for each variable
    colorArray = [
        "#8884d8", "#82ca9d", "#ffc658", "#d84b8c", "#4fb8cf",
        "#cca26e", "#7e57c2", "#ff7043", "#26a69a", "#ffd600",
        "#2f4554", "#61a0a8", "#d48265", "#91c7ae"
    ];

    render() {
        const {data, onDataPointHover} = this.props;
        const {selectedKeys} = this.state;

        if (!data || data.length === 0) {
            return <div style={{color: '#ccc', textAlign: 'center'}}>No data</div>;
        }

        // All possible keys (besides time)
        const allVarKeys = Object.keys(data[0]).filter(k => k !== 'time');

        // We'll map each selected variable to a color
        const displayedVars = selectedKeys.map((key, idx) => {
            return {
                key,
                color: this.colorArray[idx % this.colorArray.length]
            };
        });

        // We'll do ~55% of the viewport height, as you did originally
        const vh = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
        const heightInVh = 0.55 * vh;

        return (
            <div style={{
                width: '100%',
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "0.25rem 0"
            }}>
                <VariableSelect
                    allVarKeys={allVarKeys}
                    selectedKeys={selectedKeys}
                    onChange={(keys) => this.setState({ selectedKeys: keys })}
                />


                <p style={{padding: "0", margin: "0"}}>Combined Data (Stacked)</p>
                <ResponsiveContainer
                    width="95%"
                    height={heightInVh}
                    style={{
                        backgroundColor: "#282c33",
                        borderRadius: "8px",
                        boxShadow: "rgba(0, 0, 0, 0.24) 0px 3px 8px"
                    }}
                >
                    <AreaChart data={data} margin={{top: 10, right: 30, left: 0, bottom: 0}}>
                        <CartesianGrid strokeDasharray="3 3"/>
                        <XAxis dataKey="time"/>
                        <YAxis/>
                        <Tooltip
                            content={
                                <CustomTooltip
                                    data={data}
                                    onHover={onDataPointHover}
                                />
                            }
                        />

                        {/* dynamic defs */}
                        <defs>
                            {displayedVars.map(({key, color}) => (
                                <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor={color} stopOpacity={0}/>
                                </linearGradient>
                            ))}
                        </defs>

                        {/* stacked areas */}
                        {displayedVars.map(({key, color}) => (
                            <Area
                                key={key}
                                name={key}
                                type="monotone"
                                dataKey={key}
                                stroke={color}
                                fill={`url(#grad-${key})`}
                                stackId="stack"
                            />
                        ))}
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        );
    }
}

export default StackedCharts;
