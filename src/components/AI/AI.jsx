import React, {useEffect, useState} from "react";
import axios from "axios";
import * as tf from "@tensorflow/tfjs";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";

import {Bar, Line, Scatter} from "react-chartjs-2";

import {
    Box,
    Button,
    Stepper,
    Step,
    StepLabel,
    Typography,
    Card,
    CardContent,
    LinearProgress,
    Grid,
    TextField,
    Paper,
    Table,
    TableHead,
    TableRow,
    TableCell,
    TableBody,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
} from "@mui/material";

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

// ----------------------------------------------------------------
// 0. Constants
// ----------------------------------------------------------------
const COL_SPEED = "Vehicle_Speed";
const COL_GEAR = "Current_gear_shift_position_(Current_gear)";
const COL_FUEL = "Trip_fuel_consumption";
const COL_MOM_FUEL = "MomentaryFuel";
const COL_ACCELERATION = "Acceleration";
const COL_JERK = "Jerk";
const COL_MILEAGE = "Cumulative_mileage";

const FEATURE_COLS = [COL_SPEED, COL_GEAR, COL_JERK];
const TARGET_COL = COL_MOM_FUEL;

const SEQ_LEN = 10;
const DEFAULT_TEST_BLOCK_LENGTH = 600; // If user doesn't specify, we can default to 600

// ----------------------------------------------------------------
// 1. Helper functions
// ----------------------------------------------------------------
function transformGear(rows) {
    const updated = rows.map((row) => {
        const gearStr = String(row[COL_GEAR] ?? "");
        if (gearStr === "13" || gearStr === "127") {
            return {...row, [COL_GEAR]: 0};
        } else if (gearStr === "14") {
            return {...row, [COL_GEAR]: 1};
        }
        return {
            ...row,
            [COL_GEAR]: parseFloat(row[COL_GEAR]) || 0,
        };
    });
    return updated;
}

function createMomentaryFuel(rows, cumFuelCol = COL_FUEL, newCol = COL_MOM_FUEL) {
    const updated = [...rows];
    for (let i = 0; i < updated.length; i++) {
        updated[i][cumFuelCol] = parseFloat(updated[i][cumFuelCol]) || 0;
    }
    let prev = updated.length > 0 ? updated[0][cumFuelCol] : 0;
    updated[0][newCol] = 0;
    for (let i = 1; i < updated.length; i++) {
        const currVal = updated[i][cumFuelCol];
        const diffVal = currVal - prev;
        const clipped = Math.max(0, Math.min(diffVal, 25000));
        updated[i][newCol] = clipped;
        prev = currVal;
    }
    return updated;
}

function calculateAcceleration(rows, speedCol = COL_SPEED, accelCol = COL_ACCELERATION) {
    const updated = [...rows];
    for (let i = 0; i < updated.length; i++) {
        updated[i][speedCol] = parseFloat(updated[i][speedCol]) || 0;
    }
    if (updated.length > 0) {
        updated[0][accelCol] = 0;
        for (let i = 1; i < updated.length; i++) {
            updated[i][accelCol] = updated[i][speedCol] - updated[i - 1][speedCol];
        }
    }
    return updated;
}

function calculateJerk(rows, accelCol = COL_ACCELERATION, jerkCol = COL_JERK) {
    const updated = [...rows];
    if (updated.length > 0) {
        updated[0][jerkCol] = 0;
        for (let i = 1; i < updated.length; i++) {
            const prevA = parseFloat(updated[i - 1][accelCol]) || 0;
            const currA = parseFloat(updated[i][accelCol]) || 0;
            updated[i][jerkCol] = currA - prevA;
        }
    }
    return updated;
}

function dropNaNsForCols(rows, requiredCols) {
    return rows.filter((row) => {
        return requiredCols.every((col) => {
            const val = row[col];
            return val !== null && val !== undefined && !Number.isNaN(val);
        });
    });
}

async function createSequencesAsync(array2D, target1D, seqLength = 10) {
    if (array2D.length !== target1D.length) {
        throw new Error("Feature and target lengths must match.");
    }
    
    // Make sure we have enough data for at least one sequence
    if (array2D.length < seqLength) {
        console.error("Not enough data points for a sequence");
        return { X: null, y: null };
    }
    
    // Calculate how many complete sequences we can make
    const numSamples = Math.floor(array2D.length / seqLength);
    console.log(`Creating ${numSamples} sequences of length ${seqLength}`);
    
    if (numSamples < 1) {
        return { X: null, y: null };
    }
    
    const Xout = [];
    const yout = [];

    // For each sequence
    for (let i = 0; i < numSamples * seqLength; i += seqLength) {
        // Get sequence of features (should be 2D array)
        const featSlice = array2D.slice(i, i + seqLength);
        
        // Get sequence of targets (should be 1D array)
        const targSlice = target1D.slice(i, i + seqLength);
        
        // Make sure each feature entry is an array
        const featSeq = featSlice.map(feat => {
            // If feature is already an array, use it; otherwise wrap it in array
            return Array.isArray(feat) ? feat : [feat];
        });
        
        // Convert target to tensor's expected format (array of arrays)
        const targSeq = targSlice.map(t => [t]);
        
        // Add to output
        Xout.push(featSeq);
        yout.push(targSeq);

        // Yield to UI thread occasionally
        if (i % 1000 === 0 && i > 0) {
            await tf.nextFrame();
        }
    }
    
    // Log sample for debugging
    if (Xout.length > 0) {
        console.log("Sample X sequence shape:", 
            [Xout.length, Xout[0].length, Xout[0][0].length]);
        console.log("Sample X sequence:", Xout[0]);
        console.log("Sample y sequence shape:", 
            [yout.length, yout[0].length, yout[0][0].length]);
        console.log("Sample y sequence:", yout[0]);
    }
    
    return { X: Xout, y: yout };
}

// StandardScaler
class StandardScaler {
    constructor() {
        this.means = null;
        this.stds = null;
    }

    fit(data2D) {
        const tensor = tf.tensor2d(data2D);
        const meanTensor = tf.mean(tensor, 0);
        const stdTensor = tf.moments(tensor, 0).variance.sqrt();

        this.means = meanTensor.arraySync();
        this.stds = stdTensor.arraySync();

        tensor.dispose();
        meanTensor.dispose();
        stdTensor.dispose();
    }

    transform(data2D) {
        if (!this.means || !this.stds) {
            throw new Error("Scaler not fitted.");
        }
        const tensor = tf.tensor2d(data2D);
        const shifted = tensor.sub(this.means);
        const scaled = shifted.div(this.stds);
        const result = scaled.arraySync();

        tensor.dispose();
        shifted.dispose();
        scaled.dispose();
        return result;
    }

    fitTransform(data2D) {
        this.fit(data2D);
        return this.transform(data2D);
    }

    inverseTransform(data2D) {
        if (!this.means || !this.stds) {
            throw new Error("Scaler not fitted.");
        }
        const tensor = tf.tensor2d(data2D);
        const unscaled = tensor.mul(this.stds).add(this.means);
        const result = unscaled.arraySync();

        tensor.dispose();
        unscaled.dispose();
        return result;
    }
}

function createHistogram(values, bins = 50) {
    if (!values || values.length === 0) {
        return {labels: [], counts: []};
    }
    const numericVals = values.filter((v) => Number.isFinite(v));
    if (numericVals.length === 0) {
        return {labels: [], counts: []};
    }
    const minVal = Math.min(...numericVals);
    const maxVal = Math.max(...numericVals);
    if (minVal === maxVal) {
        return {
            labels: [`${minVal.toFixed(2)} - ${minVal.toFixed(2)}`],
            counts: [numericVals.length],
        };
    }
    const range = maxVal - minVal;
    const binSize = range / bins;
    const counts = new Array(bins).fill(0);
    for (let i = 0; i < numericVals.length; i++) {
        const val = numericVals[i];
        const idx = Math.floor((val - minVal) / binSize);
        if (idx >= 0 && idx < bins) {
            counts[idx]++;
        } else if (idx === bins) {
            counts[bins - 1]++;
        }
    }
    const labels = [];
    for (let i = 0; i < bins; i++) {
        const start = minVal + i * binSize;
        const end = start + binSize;
        labels.push(`${start.toFixed(2)} - ${end.toFixed(2)}`);
    }
    return {labels, counts};
}

// ----------------------------------------------------------------
// 2. Main AI Component
// ----------------------------------------------------------------
const AI = () => {
    // Application modes
    const APP_MODE = {
        HOME: "home",
        TRAIN_MODEL: "train_model",
        TEST_TRIPS: "test_trips",
        TEST_ROOM: "test_room"
    };
    
    const [appMode, setAppMode] = useState(APP_MODE.HOME);
    
    // Training workflow steps
    const trainingSteps = [
        "Download Data",
        "Preprocess & Split",
        "Histograms",
        "Model Options",
        "Train Model",
        "Evaluate & Plots",
    ];
    
    const [activeStep, setActiveStep] = useState(0);

    // token & server
    const token = React.useMemo(() => {
        const userData = localStorage.getItem("user");
        if (!userData) return null;
        return JSON.parse(userData).access_token || null;
    }, []);
    const [carID] = useState(() => {
        const saved = localStorage.getItem("selectedCarID");
        return saved || "";
    });
    const server_address = "khodroai.com";

    // data & states
    const [rawData, setRawData] = useState([]);
    const [isFetching, setIsFetching] = useState(false);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    const [trainRows, setTrainRows] = useState([]);
    const [testRows, setTestRows] = useState([]);

    const [trainHist, setTrainHist] = useState(null);
    const [testHist, setTestHist] = useState(null);

    // Training progress
    const [isTraining, setIsTraining] = useState(false);
    const [epochLogs, setEpochLogs] = useState([]);
    const [finalMetrics, setFinalMetrics] = useState(null);
    const [currentEpoch, setCurrentEpoch] = useState(0);

    // ← NEW: Let the user specify how many epochs they want
    const [numEpochs, setNumEpochs] = useState(50);

    const [predsOrig, setPredsOrig] = useState([]);
    const [actualOrig, setActualOrig] = useState([]);
    const [cumulativeReal, setCumulativeReal] = useState([]);
    const [cumulativePred, setCumulativePred] = useState([]);

    // Model handling
    const [modelLoaded, setModelLoaded] = useState(null); // store loaded model
    const [useExistingModel, setUseExistingModel] = useState(false);

    // For uploading existing model (two separate inputs)
    const [jsonFile, setJsonFile] = useState(null);
    const [binFile, setBinFile] = useState(null);

    // Test block selection
    const [testStartIndex, setTestStartIndex] = useState("");
    const [testEndIndex, setTestEndIndex] = useState("");

    // States for file upload prediction
    const [uploadedFile, setUploadedFile] = useState(null);
    const [uploadedFileData, setUploadedFileData] = useState([]);
    const [isProcessingUpload, setIsProcessingUpload] = useState(false);
    const [uploadedFileDistance, setUploadedFileDistance] = useState("");
    const [needsDistanceInput, setNeedsDistanceInput] = useState(false);
    const [predictionResultLPer100KM, setPredictionResultLPer100KM] = useState(null);
    const [predictedMomentaryFuel, setPredictedMomentaryFuel] = useState([]);
    const [actualMomentaryFuel, setActualMomentaryFuel] = useState([]);
    const [actualCumulativeFuelData, setActualCumulativeFuelData] = useState([]); // <-- New state
    const [previewData, setPreviewData] = useState([]); // <-- Preview state
    const [showPreview, setShowPreview] = useState(false); // <-- Preview visibility state
    const [predictStartIndex, setPredictStartIndex] = useState(""); // <-- Add state
    const [predictEndIndex, setPredictEndIndex] = useState(""); // <-- Add state
    
    // Column mapping for test trips
    const [columnMappings, setColumnMappings] = useState({
        [COL_SPEED]: "",
        [COL_GEAR]: "",
        [COL_MILEAGE]: "",
        [COL_FUEL]: "", // <-- Add fuel column
    });
    
    // Test room simulator cycle selection
    const [selectedCycle, setSelectedCycle] = useState("NEDC"); // Default to NEDC cycle
    const availableCycles = ["NEDC", "WLTC"]; // Future: Add more cycles
    
    // Navigation functions
    const goToHome = () => {
        setAppMode(APP_MODE.HOME);
        resetStates();
    };
    
    const goToTrainModel = () => {
        setAppMode(APP_MODE.TRAIN_MODEL);
        setActiveStep(0);
    };
    
    const goToTestTrips = () => {
        setAppMode(APP_MODE.TEST_TRIPS);
        // Reset relevant test trip states
        setUploadedFile(null);
        setUploadedFileData([]);
        setUploadedFileDistance("");
        setNeedsDistanceInput(false);
        setPredictionResultLPer100KM(null);
        setPredictedMomentaryFuel([]);
        setActualMomentaryFuel([]);
        setColumnMappings({
            [COL_SPEED]: "",
            [COL_GEAR]: "",
            [COL_MILEAGE]: "",
            [COL_FUEL]: "", // <-- Reset fuel column
        });
    };
    
    const goToTestRoom = () => {
        setAppMode(APP_MODE.TEST_ROOM);
        setSelectedCycle("NEDC");
        // Reset simulator-specific results
        setPredictionResultLPer100KM(null); 
        setPredictedMomentaryFuel([]);
        // Optionally clear actual fuel state if it's used elsewhere, though not directly in sim results
        // setActualMomentaryFuel([]); 
    };
    
    const resetStates = () => {
        // Reset all states to initial values
        setRawData([]);
        setTrainRows([]);
        setTestRows([]);
        setTrainHist(null);
        setTestHist(null);
        setEpochLogs([]);
        setFinalMetrics(null);
        setPredsOrig([]);
        setActualOrig([]);
        setCumulativeReal([]);
        setCumulativePred([]);
        setTestStartIndex("");
        setTestEndIndex("");
        // Note: Don't reset modelLoaded to maintain trained model across modes
    };

    const handleNext = () => setActiveStep((s) => Math.min(s + 1, trainingSteps.length - 1));
    const handleBack = () => setActiveStep((s) => Math.max(s - 1, 0));
    
    // Missing handler functions for file upload prediction
    const handleFileChange = (event) => {
        setUploadedFile(event.target.files[0]);
        setUploadedFileData([]);
        setNeedsDistanceInput(false);
        setUploadedFileDistance("");
        setPredictionResultLPer100KM(null);
        setPredictedMomentaryFuel([]);
        setActualMomentaryFuel([]);
    };
    
    // Function to preprocess data specifically for prediction (no target needed initially)
    const preprocessForPrediction = (rows, mappedFuelCol) => { // <-- Accept mapped fuel column
        if (!rows || rows.length === 0) return [];

        let processedRows = [...rows];

        // Ensure required feature columns exist and parse them
        const requiredFeatures = [COL_SPEED, COL_GEAR];
        // Also parse fuel column if provided
        if (mappedFuelCol) {
            requiredFeatures.push(mappedFuelCol);
        }

        processedRows.forEach((r) => {
            // Ensure feature columns are numeric
            (r[COL_SPEED]) = parseFloat(r[COL_SPEED]) || 0;
            (r[COL_GEAR]) = parseFloat(r[COL_GEAR]) || 0;
            // Ensure fuel column is numeric if present
            if (mappedFuelCol && r[mappedFuelCol] !== undefined) {
                r[mappedFuelCol] = parseFloat(r[mappedFuelCol]) || 0;
            }
        });

        processedRows = transformGear(processedRows); // Existing gear transformation
        processedRows = calculateAcceleration(processedRows, COL_SPEED, COL_ACCELERATION);
        processedRows = calculateJerk(processedRows, COL_ACCELERATION, COL_JERK);

        // Calculate momentary fuel *if* the mapped fuel column exists
        if (mappedFuelCol) {
            console.log("Calculating actual momentary fuel using column:", mappedFuelCol);
            processedRows = createMomentaryFuel(processedRows, mappedFuelCol, COL_MOM_FUEL);
        } else {
            // Ensure COL_MOM_FUEL exists even if not calculated, maybe fill with NaN or null?
             processedRows.forEach(r => r[COL_MOM_FUEL] = null);
        }

        // Define columns needed for the *model's features*
        const featureColsForDrop = [COL_SPEED, COL_GEAR, COL_ACCELERATION, COL_JERK];
        
        // Drop rows where any *required feature* is NaN after processing
        // Do NOT drop based on COL_MOM_FUEL being NaN here
        const originalLength = processedRows.length;
        processedRows = dropNaNsForCols(processedRows, featureColsForDrop);
        
        console.log(`Rows after preprocessing for prediction: ${processedRows.length} (started with ${originalLength})`);
        return processedRows;
    };
    
    // Test room cycle handling
    const handleSelectCycle = (cycle) => {
        setSelectedCycle(cycle);
    };
    
    // ----------------------------------------------------------------
    // Step 0: Download
    // ----------------------------------------------------------------
    const handleDownloadData = async () => {
        if (!startDate || !endDate) {
            alert("Please select start & end date/time.");
            return;
        }
        if (!carID) {
            alert("No carID found in localStorage.");
            return;
        }
        const ecuDictString = localStorage.getItem("ecuSelectedDicts");
        if (!ecuDictString) {
            alert("No ECU dictionary found in localStorage! Cannot decode hex codes.");
            return;
        }
        const ecuDict = JSON.parse(ecuDictString);
        setIsFetching(true);
        try {
            const fromTime = new Date(startDate).getTime() / 1000;
            const toTime = new Date(endDate).getTime() / 1000;
            const url = `https://${server_address}/api/history/carID/${carID}/?fromTime=${fromTime}&toTime=${toTime}&fields=variables&data_format=json`;

            const response = await axios.get(url, {
                headers: { Authorization: `Token ${token}` },
            });

            if (response.status === 200 && response.data?.variables) {
                const rawVars = response.data.variables;
                if (!Array.isArray(rawVars) || rawVars.length === 0) {
                    alert("Server returned 0 rows in 'variables'.");
                    setRawData([]);
                    return;
                }
                // Map each server row's hex->friendly
                const mappedRows = rawVars.map((varObj) => {
                    const row = {};
                    for (let [hexCode, value] of Object.entries(varObj)) {
                        const friendlyName = ecuDict["main"][hexCode];
                        if (friendlyName) {
                            row[friendlyName] = value;
                        }
                    }
                    return row;
                });
                setRawData(mappedRows);
                alert(`Downloaded & decoded ${mappedRows.length} rows.`);
            } else {
                alert("Empty or invalid data from server.");
            }
        } catch (err) {
            console.error(err);
            alert("Error downloading data. See console.");
        } finally {
            setIsFetching(false);
        }
    };

    // ----------------------------------------------------------------
    // Step 1: Preprocess
    // ----------------------------------------------------------------
    const handlePreprocessAndSplit = () => {
        if (rawData.length === 0) {
            alert("No raw data. Download first.");
            return;
        }
        let rows = [...rawData];

        // numeric parse
        rows.forEach((r) => {
            r[COL_SPEED] = parseFloat(r[COL_SPEED]) || 0;
            r[COL_FUEL] = parseFloat(r[COL_FUEL]) || 0;
            r[COL_GEAR] = parseFloat(r[COL_GEAR]) || 0;
        });

        rows = transformGear(rows);
        rows = createMomentaryFuel(rows, COL_FUEL, COL_MOM_FUEL);
        rows = calculateAcceleration(rows, COL_SPEED, COL_ACCELERATION);
        rows = calculateJerk(rows, COL_ACCELERATION, COL_JERK);

        rows = dropNaNsForCols(rows, [
            COL_SPEED,
            COL_GEAR,
            COL_FUEL,
            COL_MOM_FUEL,
            COL_ACCELERATION,
            COL_JERK,
        ]);

        if (rows.length < DEFAULT_TEST_BLOCK_LENGTH + SEQ_LEN) {
            alert(
                `Not enough rows after cleaning. We have ${rows.length}, need at least ${
                    DEFAULT_TEST_BLOCK_LENGTH + SEQ_LEN
                }.`
            );
            return;
        }

        // If user has provided test interval:
        let testStart = 0;
        let testEnd = 0;

        if (testStartIndex && testEndIndex) {
            testStart = parseInt(testStartIndex, 10);
            testEnd = parseInt(testEndIndex, 10);
            if (isNaN(testStart) || isNaN(testEnd) || testStart < 0 || testEnd <= testStart) {
                alert("Invalid test interval. Please provide valid numeric indices.");
                return;
            }
            if (testEnd > rows.length) {
                alert(
                    `${testEndIndex} is out of range: max index is ${rows.length - 1}`
                );
                return;
            }
        } else {
            // fallback to random block
            const maxStart = rows.length - DEFAULT_TEST_BLOCK_LENGTH;
            testStart = Math.floor(Math.random() * maxStart);
            testEnd = testStart + DEFAULT_TEST_BLOCK_LENGTH;
        }

        const dfTest = rows.slice(testStart, testEnd);
        const dfTrain = [...rows.slice(0, testStart), ...rows.slice(testEnd)];

        setTrainRows(dfTrain);
        setTestRows(dfTest);
        alert(`Training rows: ${dfTrain.length}, Test rows: ${dfTest.length}.`);
    };

    // ----------------------------------------------------------------
    // Step 2: Histograms
    // ----------------------------------------------------------------
    const handleBuildHistograms = () => {
        if (trainRows.length === 0) {
            alert("No train/test data. Preprocess first.");
            return;
        }

        function extractCols(rows) {
            const speedA = rows.map((r) => r[COL_SPEED]);
            const gearA = rows.map((r) => r[COL_GEAR]);
            const jerkA = rows.map((r) => r[COL_JERK]);
            const mfA = rows.map((r) => r[COL_MOM_FUEL]);
            return {speedA, gearA, jerkA, mfA};
        }

        const tTrain = extractCols(trainRows);
        const tTest = extractCols(testRows);

        function subsample(arr, step = 100) {
            const out = [];
            for (let i = 0; i < arr.length; i += step) {
                out.push(arr[i]);
            }
            return out;
        }

        const tTrainSpeedSub = subsample(tTrain.speedA, 100);
        const tTrainGearSub = subsample(tTrain.gearA, 100);
        const tTrainJerkSub = subsample(tTrain.jerkA, 100);
        const tTrainFuelSub = subsample(tTrain.mfA, 100);

        const tTestSpeedSub = subsample(tTest.speedA, 100);
        const tTestGearSub = subsample(tTest.gearA, 100);
        const tTestJerkSub = subsample(tTest.jerkA, 100);
        const tTestFuelSub = subsample(tTest.mfA, 100);

        const trainHistData = {
            speed: createHistogram(tTrainSpeedSub, 50),
            gear: createHistogram(tTrainGearSub, 20),
            jerk: createHistogram(tTrainJerkSub, 50),
            fuel: createHistogram(tTrainFuelSub, 50),
        };
        const testHistData = {
            speed: createHistogram(tTestSpeedSub, 50),
            gear: createHistogram(tTestGearSub, 20),
            jerk: createHistogram(tTestJerkSub, 50),
            fuel: createHistogram(tTestFuelSub, 50),
        };

        setTrainHist(trainHistData);
        setTestHist(testHistData);
    };
    
    // ----------------------------------------------------------------
    // Step 4 & 5: Model Training
    // ----------------------------------------------------------------
    const handleTrainModel = async () => {
        if (trainRows.length === 0 || testRows.length === 0) {
            alert("No train/test data available. Please preprocess first.");
            return;
        }
        
        // Reset training state
        setIsTraining(true);
        setEpochLogs([]);
        setFinalMetrics(null);
        setCurrentEpoch(0);
        setPredsOrig([]);
        setActualOrig([]);
        setCumulativeReal([]);
        setCumulativePred([]);
        
        // For debugging
        console.log("Starting model training with simplified tensor approach...");
        
        try {
            // Extract features and target variables
            const trainFeatures = trainRows.map(r => [
                parseFloat(r[COL_SPEED]) || 0,
                parseFloat(r[COL_GEAR]) || 0,
                parseFloat(r[COL_JERK]) || 0
            ]);

            const trainTarget = trainRows.map(r => 
                parseFloat(r[COL_MOM_FUEL]) || 0
            );
            
            const testFeatures = testRows.map(r => [
                parseFloat(r[COL_SPEED]) || 0,
                parseFloat(r[COL_GEAR]) || 0,
                parseFloat(r[COL_JERK]) || 0
            ]);
            
            const testTarget = testRows.map(r => 
                parseFloat(r[COL_MOM_FUEL]) || 0
            );
            
            // Create scalers
            const xScaler = new StandardScaler();
            const yScaler = new StandardScaler();
            
            // Fit and transform the data
            const trainFeaturesScaled = xScaler.fitTransform(trainFeatures);
            
            // Reshape target to 2D for scaler
            const trainTargetReshaped = trainTarget.map(v => [v]);
            const trainTargetScaled = yScaler.fitTransform(trainTargetReshaped).map(r => r[0]);
            
            // Make these scalers available globally for prediction later
            window.xScaler = xScaler;
            window.yScaler = yScaler;
            
            // Define model architecture if we're not using an existing model
            let model;
            if (modelLoaded && useExistingModel) {
                model = modelLoaded;
                console.log("Using existing model");
            } else {
                console.log("Creating new model");
                // Build a new model - Use a simpler architecture that doesn't require sequences
                model = tf.sequential();
                
                // Input layer
                model.add(tf.layers.dense({
                    units: 64,
                    activation: 'relu',
                    inputShape: [FEATURE_COLS.length]
                }));
                
                model.add(tf.layers.dense({
                    units: 32, 
                    activation: 'relu'
                }));
                
                model.add(tf.layers.dense({
                    units: 16, 
                    activation: 'relu'
                }));
                
                // Output layer
                model.add(tf.layers.dense({
                    units: 1
                }));
                
                // Compile the model with correct metric names
                model.compile({
                    optimizer: tf.train.adam(0.001),
                    loss: 'meanAbsoluteError', // Keep loss as full name
                    metrics: ['mae', 'mse'] // Use short names for metrics
                });
            }
            
            // Convert to tensors (2D instead of 3D)
            const trainXTensor = tf.tensor2d(trainFeaturesScaled);
            const trainYTensor = tf.tensor1d(trainTargetScaled);
            
            // Test data
            const testFeaturesScaled = xScaler.transform(testFeatures);
            const testTargetReshaped = testTarget.map(v => [v]);
            const testTargetScaled = yScaler.transform(testTargetReshaped).map(r => r[0]);
            
            const testXTensor = tf.tensor2d(testFeaturesScaled);
            const testYTensor = tf.tensor1d(testTargetScaled);
            
            // Custom callback for training progress
            const epochs = parseInt(numEpochs, 10) || 50;
            const batchSize = 32;
            
            console.log("Starting model training...");
            // Train the model with callbacks to update UI
            await model.fit(trainXTensor, trainYTensor, {
                epochs: epochs,
                batchSize: batchSize,
                validationData: [testXTensor, testYTensor],
                shuffle: true,
                callbacks: {
                    onEpochEnd: async (epoch, logs) => {
                        console.log(`Epoch ${epoch+1}/${epochs}, loss: ${logs.loss}`);
                        console.log('Epoch logs object:', logs); // <-- Add this line
                        setCurrentEpoch(epoch + 1);
                        // Use the correct keys from the logs object ('mae', 'mse')
                        setEpochLogs(prevLogs => [...prevLogs, {
                            epoch: epoch + 1,
                            loss: logs.loss,
                            mae: logs.mae, // Corrected key
                            mse: logs.mse, // Corrected key
                            val_loss: logs.val_loss,
                            val_mae: logs.val_mae, // Corrected key
                            val_mse: logs.val_mse // Corrected key
                        }]);
                        
                        // Yield to UI thread
                        await tf.nextFrame();
                    }
                }
            });
            
            console.log("Model training complete, making predictions...");
            // After training, make predictions on test data
            const predsTensor = model.predict(testXTensor);
            const predsScaled = await predsTensor.array(); // This will be 2D: [samples, 1]
            
            // Flatten predictions to 1D
            const predsFlat = predsScaled.flat(); 

            // Inverse transform to original scale
            // Use the 1D flattened predictions
            const preds2d = predsFlat.map(v => [v]); 
            // Use the 1D testTargetScaled defined earlier
            const actual2d = testTargetScaled.map(v => [v]); 
            
            const predsOrigScale = yScaler.inverseTransform(preds2d).map(r => r[0]);
            const actualOrigScale = yScaler.inverseTransform(actual2d).map(r => r[0]);
            
            console.log("Setting state with predictions...");
            // Set state for display
            setPredsOrig(predsOrigScale);
            setActualOrig(actualOrigScale);
            
            // Calculate cumulative values
            let cumReal = 0;
            let cumPred = 0;
            const cumRealArr = [];
            const cumPredArr = [];
            
            for (let i = 0; i < predsOrigScale.length; i++) {
                cumReal += actualOrigScale[i];
                cumPred += predsOrigScale[i];
                cumRealArr.push(cumReal);
                cumPredArr.push(cumPred);
            }
            
            setCumulativeReal(cumRealArr);
            setCumulativePred(cumPredArr);
            
            // Calculate final metrics on scaled data for consistent interpretation
            // Compare the 1D testTargetScaled with the 1D flattened predictions (predsFlat)
            const testLossTensor = tf.losses.absoluteDifference(testTargetScaled, predsFlat);
            const testMAETensor = tf.metrics.meanAbsoluteError(testTargetScaled, predsFlat);
            const testMSETensor = tf.metrics.meanSquaredError(testTargetScaled, predsFlat);
            
            // Get tensor values as numbers
            const testLossVal = await testLossTensor.array();
            const testMAEVal = await testMAETensor.array();
            const testMSEVal = await testMSETensor.array();
            
            console.log("Final Test Metrics (Scaled):", { loss: testLossVal, mae: testMAEVal, mse: testMSEVal });

            setFinalMetrics({
                loss: testLossVal,
                mae: testMAEVal,
                mse: testMSEVal
            });
            
            // Store the trained model
            setModelLoaded(model);
            console.log("Stored newly trained model in state."); // <-- Add this log
            
            alert("Model training completed successfully!");
            
            // Clean up tensors
            trainXTensor.dispose();
            trainYTensor.dispose();
            testXTensor.dispose();
            testYTensor.dispose();
            predsTensor.dispose();
            testLossTensor.dispose(); // Dispose metric tensors
            testMAETensor.dispose();
            testMSETensor.dispose();
            
        } catch (error) {
            console.error("Error during model training:", error);
            alert(`An error occurred during training: ${error.message}`);
        } finally {
            setIsTraining(false);
        }
    };

    // Model loading and training
    const handleModelOptionChange = (e) => {
        setUseExistingModel(e.target.value === "upload");
    };

    // We'll store the user-selected JSON file
    const handleJsonFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setJsonFile(e.target.files[0]);
        }
    };

    // We'll store the user-selected BIN file
    const handleBinFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setBinFile(e.target.files[0]);
        }
    };

    // This function attempts to load the JSON+BIN model
    const handleLoadUploadedModel = async () => {
        if (!jsonFile || !binFile) {
            alert("Please select both the JSON file and the BIN file.");
            return;
        }

        // Dispose of the existing model first, if any
        if (modelLoaded) {
            try {
                console.log("Disposing previously loaded model...");
                modelLoaded.dispose();
                setModelLoaded(null); // Clear the state as well
                console.log("Previous model disposed.");
            } catch (err) {
                console.error("Error disposing existing model:", err);
                // Continue loading attempt anyway
            }
        }

        try {
            console.log("Attempting to load new model...");
            const loadedModel = await tf.loadLayersModel(
                tf.io.browserFiles([jsonFile, binFile])
            );
            setModelLoaded(loadedModel);
            console.log("New model loaded successfully!");
            alert("Model loaded successfully!");
        } catch (err) {
            console.error("Failed to load model:", err);
            alert("Failed to load model. Check console for details.");
            setModelLoaded(null); // Ensure model state is null on failure
        }
    };

    const handleDownloadTrainedModel = async (model) => {
        if (!model) {
            alert("No model available to download.");
            return;
        }
        try {
            // Generate a unique filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `fuel_model_${carID || 'unknown'}_${timestamp}`;
    
            // Trigger download with the unique filename
            await model.save(`downloads://${filename}`);
            alert(`Model downloaded as ${filename}.json and ${filename}.weights.bin`);
        } catch (err) {
            console.error("Error downloading model:", err);
            alert("Error downloading model. See console.");
        }
    };
    
    // Function to handle file uploads for prediction
    const handleProcessUploadedFile = () => {
        if (!uploadedFile) {
            alert("Please select a file.");
            return;
        }
        setIsProcessingUpload(true);
        setPredictionResultLPer100KM(null);
        setPredictedMomentaryFuel([]);
        setActualMomentaryFuel([]);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                let parsedData = [];
                if (uploadedFile.name.endsWith(".csv")) {
                    const result = Papa.parse(e.target.result, { header: true, skipEmptyLines: true });
                    if (result.errors.length > 0) {
                        console.error("CSV Parsing Errors:", result.errors);
                        alert(`Error parsing CSV: ${result.errors[0].message}. Check console for details.`);
                        setIsProcessingUpload(false);
                        return;
                    }
                    parsedData = result.data;
                } else if (uploadedFile.name.endsWith(".xlsx") || uploadedFile.name.endsWith(".xls")) {
                    const workbook = XLSX.read(e.target.result, { type: "binary" });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    parsedData = XLSX.utils.sheet_to_json(worksheet);
                } else {
                    alert("Unsupported file type. Please upload CSV or Excel.");
                    setIsProcessingUpload(false);
                    return;
                }

                if (parsedData.length === 0) {
                    alert("File is empty or could not be parsed.");
                    setIsProcessingUpload(false);
                    return;
                }

                // Get available columns for mapping
                const availableColumns = Object.keys(parsedData[0]);
                
                // Reset column mappings and let user pick from available columns
                setColumnMappings({
                    [COL_SPEED]: "",
                    [COL_GEAR]: "",
                    [COL_MILEAGE]: "",
                    [COL_FUEL]: "", // <-- Reset fuel column
                });
                
                // Try to find matching columns automatically
                const newMappings = { ...columnMappings };
                availableColumns.forEach(column => {
                    // Check for exact matches
                    if (column === COL_SPEED) newMappings[COL_SPEED] = column;
                    if (column === COL_GEAR) newMappings[COL_GEAR] = column;
                    if (column === COL_MILEAGE) newMappings[COL_MILEAGE] = column;
                    if (column === COL_FUEL) newMappings[COL_FUEL] = column; // <-- Check for fuel column
                    
                    // Check for partial matches if exact match not found
                    if (!newMappings[COL_SPEED] && column.toLowerCase().includes('speed')) 
                        newMappings[COL_SPEED] = column;
                    if (!newMappings[COL_GEAR] && column.toLowerCase().includes('gear')) 
                        newMappings[COL_GEAR] = column;
                    if (!newMappings[COL_MILEAGE] && (
                        column.toLowerCase().includes('mile') || 
                        column.toLowerCase().includes('distance') ||
                        column.toLowerCase().includes('odometer')
                    )) newMappings[COL_MILEAGE] = column;
                    if (!newMappings[COL_FUEL] && column.toLowerCase().includes('fuel')) // <-- Partial match for fuel
                        newMappings[COL_FUEL] = column;
                });
                
                setColumnMappings(newMappings);
                setUploadedFileData(parsedData); // Keep full data
                
                // --- Add Preview Logic --- 
                const previewRows = parsedData.slice(0, 20); // Get first 20 rows for preview
                setPreviewData(previewRows);
                setShowPreview(true); // Show preview by default after processing
                // --- End Preview Logic --- 

                // Check if we found mileage column
                if (newMappings[COL_MILEAGE]) {
                    // Calculate distance from mileage if present
                    const mileageValues = parsedData
                        .map(r => parseFloat(r[newMappings[COL_MILEAGE]]))
                        .filter(v => !isNaN(v));
                        
                    if (mileageValues.length >= 2) {
                        const startMileage = mileageValues[0];
                        const endMileage = mileageValues[mileageValues.length - 1];
                        const distance = (endMileage - startMileage); // Assume input is already KM
                        setUploadedFileDistance(distance.toFixed(2));
                        setNeedsDistanceInput(false);
                    } else {
                        // Not enough data points for mileage calculation
                        setNeedsDistanceInput(true);
                    }
                } else {
                    setNeedsDistanceInput(true);
                }
                
                alert(`File processed successfully. Found ${parsedData.length} rows. Preview available.`);

            } catch (error) {
                console.error("Error processing file:", error);
                alert(`An error occurred while processing the file: ${error.message}`);
                setPreviewData([]); // Clear preview on error
                setShowPreview(false);
            } finally {
                setIsProcessingUpload(false);
            }
        };

        reader.onerror = (error) => {
            console.error("Error reading file:", error);
            alert("Error reading file.");
            setIsProcessingUpload(false);
        };

        if (uploadedFile.name.endsWith(".csv")) {
            reader.readAsText(uploadedFile); // Read as text for PapaParse
        } else {
            reader.readAsBinaryString(uploadedFile); // Read as binary for XLSX
        }
    };
    
    // Function to predict file data
    const handlePredictUploadedFile = async () => {
        if (!modelLoaded) {
            alert("No model loaded or trained. Please load a model first.");
            return;
        }
        if (uploadedFileData.length === 0) {
            alert("No processed file data available. Please process a file first.");
            return;
        }
        
        // Check if required column mappings are set
        if (!columnMappings[COL_SPEED] || !columnMappings[COL_GEAR]) {
            alert("Please map the required Speed and Gear columns before prediction.");
            return;
        }
        
        if (needsDistanceInput && !uploadedFileDistance) {
            alert(`Please enter the total distance traveled for this file.`);
            return;
        }
        const distanceKM = parseFloat(uploadedFileDistance);
        if (isNaN(distanceKM) || distanceKM <= 0) {
            alert("Invalid distance entered. Please enter a positive number for KM.");
            return;
        }

        setIsProcessingUpload(true);
        setPredictionResultLPer100KM(null);
        setPredictedMomentaryFuel([]);
        setActualMomentaryFuel([]);

        try {
            // --- Get and Validate Row Indices ---
            let startIndex = null;
            let endIndex = null;
            let useFullRange = true;
            let isRangePrediction = false; // Flag if a valid sub-range is used

            if (predictStartIndex !== "" && predictEndIndex !== "") {
                startIndex = parseInt(predictStartIndex, 10);
                endIndex = parseInt(predictEndIndex, 10);

                if (isNaN(startIndex) || isNaN(endIndex)) {
                    alert("Invalid start/end index. Please enter numbers.");
                    return;
                }
                if (startIndex < 0 || endIndex <= startIndex || endIndex > uploadedFileData.length) {
                    alert(`Invalid range: Start must be >= 0, End must be > Start, and End must be <= ${uploadedFileData.length}.`);
                    return;
                }
                useFullRange = false;
                isRangePrediction = true; // Valid range selected
                console.log(`Predicting range: Index ${startIndex} to ${endIndex - 1}`);
            } else if (predictStartIndex !== "" || predictEndIndex !== "") {
                // Only one index entered
                alert("Please enter both Start and End Index or leave both blank to predict the full file.");
                return;
            } else {
                console.log("Predicting full file.");
            }
            // --- End Index Validation ---

            // --- Slice Data if Range Specified ---
            const dataToProcess = useFullRange ? uploadedFileData : uploadedFileData.slice(startIndex, endIndex);
            if (dataToProcess.length === 0) {
                alert("Selected range resulted in zero rows to process.");
                return;
            }
            // --- End Slice Data ---

            // --- Distance Calculation Adjustment ---
            let finalDistanceKM = parseFloat(uploadedFileDistance); // Use the value from state/input
            if (isNaN(finalDistanceKM) || finalDistanceKM <= 0) {
                alert("Invalid distance entered or calculated. Please check mileage column or manual input.");
                return;
            }

            // Recalculate distance ONLY if a sub-range was selected AND distance was originally calculated from mileage
            if (isRangePrediction && !needsDistanceInput && columnMappings[COL_MILEAGE]) {
                console.log("Recalculating distance for selected range...");
                const mileageCol = columnMappings[COL_MILEAGE];
                const rangeMileageValues = dataToProcess
                    .map(r => parseFloat(r[mileageCol]))
                    .filter(v => !isNaN(v));

                if (rangeMileageValues.length >= 2) {
                    const rangeStartMileage = rangeMileageValues[0];
                    const rangeEndMileage = rangeMileageValues[rangeMileageValues.length - 1];
                    const rangeDistance = (rangeEndMileage - rangeStartMileage); // Assume KM input
                    finalDistanceKM = rangeDistance; // Update the distance to use for L/100KM
                    console.log(`Recalculated distance for range: ${finalDistanceKM.toFixed(2)} KM`);
                    if (finalDistanceKM <= 0) {
                        alert(`Calculated distance for the selected range is zero or negative (${finalDistanceKM.toFixed(2)} KM). Cannot calculate L/100KM accurately.`);
                        // Optionally return or just proceed and show N/A later
                        // return;
                    }
                } else {
                    console.warn("Not enough mileage data points in the selected range to recalculate distance.");
                    // Keep the original distance? Or warn user? Let's warn and proceed with original.
                    alert("Warning: Could not recalculate distance for the selected range due to insufficient mileage data points. Using original distance for L/100KM.");
                }
            }
            // --- End Distance Adjustment ---

            setIsProcessingUpload(true);
            setPredictionResultLPer100KM(null);
            setPredictedMomentaryFuel([]);
            setActualMomentaryFuel([]); // Clear previous results

            try {
                // --- Process the selected data (dataToProcess) ---
                const mappedData = dataToProcess.map(row => { // Use dataToProcess
                    const newRow = {};
                    // Map required features
                    if (columnMappings[COL_SPEED]) newRow[COL_SPEED] = row[columnMappings[COL_SPEED]];
                    if (columnMappings[COL_GEAR]) newRow[COL_GEAR] = row[columnMappings[COL_GEAR]];
                    // Map optional columns
                    // IMPORTANT: Only map fuel column if it was selected by the user
                    if (columnMappings[COL_FUEL]) newRow[COL_FUEL] = row[columnMappings[COL_FUEL]];
                    // We don't need mileage here for prediction itself, only for distance recalc above
                    return newRow;
                });

                const mappedFuelColName = columnMappings[COL_FUEL] || null; // Pass null if not mapped

                const processedData = preprocessForPrediction(mappedData, mappedFuelColName); // Use mappedData

                if (processedData.length === 0) {
                    alert("No valid rows remaining after preprocessing the selected data range.");
                    setIsProcessingUpload(false);
                    return;
                }

                // --- Extract features and actual fuel from processedData ---
                const features = processedData.map(r => [
                    r[COL_SPEED],
                    r[COL_GEAR],
                    r[COL_JERK]
                ]);

                if (mappedFuelColName && processedData[0]?.[COL_MOM_FUEL] !== undefined) {
                    const actualFuel = processedData
                        .map(r => r[COL_MOM_FUEL])
                        .filter(v => v !== null && !isNaN(v));
                    console.log(`Extracted ${actualFuel.length} actual momentary fuel values from processed range.`);
                    setActualMomentaryFuel(actualFuel);
                }
                // ---

                // --- Scaling ---
                let currentXScaler = window.xScaler;
                let currentYScaler = window.yScaler;
                // ... (rest of the scaler logic: check if they exist, create/fit temporary ones if needed) ...
                if (!currentXScaler || !currentYScaler) {
                    alert("Scalers from training phase not found. Prediction might be inaccurate. Fitting temporary scalers to uploaded data.");
                    console.warn("Using temporary scalers fitted on test data.");

                    currentXScaler = new StandardScaler();
                    currentYScaler = new StandardScaler();

                    currentXScaler.fit(features);

                    if (actualMomentaryFuel.length > 0) {
                        currentYScaler.fit(actualMomentaryFuel.map(v => [v]));
                    } else {
                        console.warn("Cannot fit temporary Y scaler without actual fuel data. Using dummy fit.");
                        currentYScaler.fit([[0], [1]]);
                    }
                } else {
                    console.log("Using scalers from training phase.")
                }
                // --- End Scaling ---

                const Xscaled = currentXScaler.transform(features);
                const Xtensor = tf.tensor2d(Xscaled);

                // --- Predict ---
                console.log("Predicting with input shape:", Xtensor.shape);
                const predsScaledTensor = modelLoaded.predict(Xtensor);
                const predsScaled = await predsScaledTensor.array();
                const predsFlat = predsScaled.flat();
                // --- End Predict ---

                // --- Inverse Transform & State Update ---
                const preds2d = predsFlat.map(v => [v]);
                const predsOrigScale = currentYScaler.inverseTransform(preds2d).map(r => r[0]);
                setPredictedMomentaryFuel(predsOrigScale);
                // Note: actualMomentaryFuel was set earlier from processedData
                // --- End Inverse Transform ---


                // --- Final L/100KM Calculation ---
                const totalPredictedFuel_uL = predsOrigScale.reduce((sum, val) => sum + val, 0);
                const totalPredictedFuel_L = totalPredictedFuel_uL / 1000000;

                if (finalDistanceKM > 0) { // Use the potentially adjusted distance
                    const l_per_100km = (totalPredictedFuel_L / finalDistanceKM) * 100;
                    setPredictionResultLPer100KM(l_per_100km.toFixed(2));
                    alert(`Prediction Complete for range. Estimated Fuel Consumption: ${l_per_100km.toFixed(2)} L/100KM`);
                } else {
                    alert("Prediction Complete for range, but cannot calculate L/100KM as distance is zero or negative.");
                    setPredictionResultLPer100KM("N/A (Distance <= 0)");
                }
                // --- End L/100KM Calculation ---

                // Dispose tensors
                Xtensor.dispose();
                predsScaledTensor.dispose();

            } catch (error) {
                console.error("Error during prediction:", error);
                alert(`An error occurred during prediction: ${error.message}`);
                setActualMomentaryFuel([]); // Clear actual fuel on error
            } finally {
                setIsProcessingUpload(false);
            }
        } catch (error) {
            console.error("Error during prediction:", error);
            alert(`An error occurred during prediction: ${error.message}`);
            setIsProcessingUpload(false);
        }
    };

    const handleRunSimulation = async () => {
        if (!modelLoaded) {
            alert("Please load or train a model first (in Train or Test Trips section).");
            return;
        }
        if (!window.xScaler || !window.yScaler) {
             alert("Scalers from training phase not found. Please train or load a model again in the current session.");
             return;
        }
        
        setIsProcessingUpload(true);
        setPredictionResultLPer100KM(null);
        setPredictedMomentaryFuel([]);
        // No actual fuel in this mode
        setActualMomentaryFuel([]); 
        
        try {
            let cycleData = [];
            let cycleDistance = 0; // KM
            let cycleFilePath = "";

            if (selectedCycle === "NEDC") {
                cycleFilePath = "/NEDC_1000_slope_added_with_gear.csv"; // Path relative to public folder
                cycleDistance = 11; // Specified distance for NEDC
            } else if (selectedCycle === "WLTC") {
                // Placeholder for future WLTC implementation
                alert("WLTC cycle data not yet implemented.");
                setIsProcessingUpload(false);
                return;
            } else {
                 alert("Invalid cycle selected.");
                 setIsProcessingUpload(false);
                 return;
            }

            console.log(`Fetching cycle data from: ${cycleFilePath}`);
            
            // Fetch and parse the CSV data using PapaParse
            const response = await new Promise((resolve, reject) => {
                Papa.parse(cycleFilePath, {
                    download: true,
                    header: true,
                    skipEmptyLines: true,
                    dynamicTyping: true, // Automatically convert numbers
                    complete: (results) => resolve(results),
                    error: (error) => reject(error),
                });
            });

            if (response.errors.length > 0) {
                 console.error("CSV Parsing Errors:", response.errors);
                 alert(`Error parsing cycle CSV: ${response.errors[0].message}`);
                 setIsProcessingUpload(false);
                 return;
            }

            cycleData = response.data;
            console.log(`Loaded ${cycleData.length} rows from ${selectedCycle} cycle.`);

            if (cycleData.length === 0) {
                alert(`No data loaded for the ${selectedCycle} cycle.`);
                setIsProcessingUpload(false);
                return;
            }

            // Preprocess the cycle data (no actual fuel column provided)
            // Need to ensure the column names match COL_SPEED, COL_GEAR
             const mappedCycleData = cycleData.map(row => ({
                [COL_SPEED]: row.Speed, // Map CSV 'Speed' to COL_SPEED
                [COL_GEAR]: row.gear     // Map CSV 'gear' to COL_GEAR
                // No fuel or mileage mapping needed
            }));
            
            console.log("Preprocessing cycle data...");
            const processedData = preprocessForPrediction(mappedCycleData, null); // Pass null for fuel col
            
            if (processedData.length === 0) {
                alert("No valid rows remaining after preprocessing cycle data.");
                setIsProcessingUpload(false);
                return;
            }

            // Extract features for the model
            const features = processedData.map(r => [
                r[COL_SPEED],
                r[COL_GEAR],
                r[COL_JERK]
            ]);
            
            // Apply scaling using the globally stored scalers
            const currentXScaler = window.xScaler;
            const currentYScaler = window.yScaler;
            
            console.log("Applying scaling...");
            const Xscaled = currentXScaler.transform(features);
            
            // Create 2D tensor
            const Xtensor = tf.tensor2d(Xscaled);
            
            // Predict
            console.log("Predicting with input shape:", Xtensor.shape);
            const predsScaledTensor = modelLoaded.predict(Xtensor); 
            const predsScaled = await predsScaledTensor.array();
            const predsFlat = predsScaled.flat();
            
            // Inverse transform predictions
            const preds2d = predsFlat.map(v => [v]);
            const predsOrigScale = currentYScaler.inverseTransform(preds2d).map(r => r[0]);
            
            setPredictedMomentaryFuel(predsOrigScale); // Only predicted fuel is available
            
            // Calculate L/100KM using the fixed cycle distance
            const totalPredictedFuel_uL = predsOrigScale.reduce((sum, val) => sum + val, 0);
            const totalPredictedFuel_L = totalPredictedFuel_uL / 1000000; // Convert uL to L
            
            if (cycleDistance > 0) {
                const l_per_100km = (totalPredictedFuel_L / cycleDistance) * 100;
                setPredictionResultLPer100KM(l_per_100km.toFixed(2));
                alert(`${selectedCycle} Simulation Complete. Estimated Fuel Consumption: ${l_per_100km.toFixed(2)} L/100KM`);
            } else {
                 alert(`${selectedCycle} Simulation Complete, but cannot calculate L/100KM as cycle distance is zero or invalid.`);
                 setPredictionResultLPer100KM("N/A (Invalid Distance)");
            }
            
            // Clean up tensor
            Xtensor.dispose();
            predsScaledTensor.dispose();

        } catch (error) {
            console.error("Error during simulation:", error);
            alert(`An error occurred during the simulation: ${error.message}`);
        } finally {
            setIsProcessingUpload(false);
        }
    };

    // ----------------------------------------------------------------
    // Home View
    // ----------------------------------------------------------------
    const renderHomeView = () => {
        return (
            <Box 
                display="flex" 
                flexDirection="column" 
                alignItems="center" 
                justifyContent="center" 
                sx={{ minHeight: "70vh", p: 2 }}
            >
                <Typography variant="h4" gutterBottom sx={{ mb: 4, fontWeight: "bold", textAlign: "center" }}>
                    Car Fuel Consumption AI
                </Typography>
                
                <Grid container spacing={3} sx={{ maxWidth: 800 }}>
                    <Grid item xs={12} md={4}>
                        <Card 
                            sx={{ 
                                height: '100%', 
                                display: 'flex', 
                                flexDirection: 'column',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                cursor: 'pointer',
                                '&:hover': {
                                    transform: 'translateY(-5px)',
                                    boxShadow: '0 8px 16px 0 rgba(0,0,0,0.2)',
                                }
                            }}
                            onClick={goToTrainModel}
                        >
                            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                                <Typography variant="h6" component="h2" gutterBottom sx={{ textAlign: 'center' }}>
                                    Train New Model
                                </Typography>
                                <Typography sx={{ textAlign: 'center', color: 'text.secondary', mb: 2 }}>
                                    Create a new AI model using your vehicle data
                                </Typography>
                                {/* Icon or image could go here */}
                                <Button variant="contained" sx={{ mt: 'auto' }}>Start</Button>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                        <Card 
                            sx={{ 
                                height: '100%', 
                                display: 'flex', 
                                flexDirection: 'column',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                cursor: 'pointer',
                                '&:hover': {
                                    transform: 'translateY(-5px)',
                                    boxShadow: '0 8px 16px 0 rgba(0,0,0,0.2)',
                                }
                            }}
                            onClick={goToTestTrips}
                        >
                            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                                <Typography variant="h6" component="h2" gutterBottom sx={{ textAlign: 'center' }}>
                                    Test Trips
                                </Typography>
                                <Typography sx={{ textAlign: 'center', color: 'text.secondary', mb: 2 }}>
                                    Upload trip data and test with trained model
                                </Typography>
                                {/* Icon or image could go here */}
                                <Button variant="contained" sx={{ mt: 'auto' }}>Start</Button>
                            </CardContent>
                        </Card>
                    </Grid>
                    
                    <Grid item xs={12} md={4}>
                        <Card 
                            sx={{ 
                                height: '100%', 
                                display: 'flex', 
                                flexDirection: 'column',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                cursor: 'pointer',
                                '&:hover': {
                                    transform: 'translateY(-5px)',
                                    boxShadow: '0 8px 16px 0 rgba(0,0,0,0.2)',
                                }
                            }}
                            onClick={goToTestRoom}
                        >
                            <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                                <Typography variant="h6" component="h2" gutterBottom sx={{ textAlign: 'center' }}>
                                    Test Room Simulator
                                </Typography>
                                <Typography sx={{ textAlign: 'center', color: 'text.secondary', mb: 2 }}>
                                    Run predefined driving cycles
                                </Typography>
                                {/* Icon or image could go here */}
                                <Button variant="contained" sx={{ mt: 'auto' }}>Start</Button>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Box>
        );
    };

    // ----------------------------------------------------------------
    // Render Methods for Each Mode
    // ----------------------------------------------------------------
    const renderMainContent = () => {
        switch (appMode) {
            case APP_MODE.HOME:
                return renderHomeView();
            case APP_MODE.TRAIN_MODEL:
                return renderTrainingWorkflow();
            case APP_MODE.TEST_TRIPS:
                return renderTestTripsView();
            case APP_MODE.TEST_ROOM:
                return renderTestRoomView();
            default:
                return renderHomeView();
        }
    };

    // Wrapper for the original training steps workflow
    const renderTrainingWorkflow = () => {
        return (
            <>
                <Box display="flex" alignItems="center" mb={2}>
                    <Button onClick={goToHome} variant="outlined" startIcon={<span>←</span>} sx={{ mr: 2 }}>
                        Back to Home
                    </Button>
                    <Typography variant="h5">Train New Model</Typography>
                </Box>
                
                <Stepper
                    activeStep={activeStep}
                    alternativeLabel
                    sx={{
                        "& .MuiStepLabel-label": {
                            color: "white",
                            "&.Mui-active": {color: "white"},
                            "&.Mui-completed": {color: "white"},
                        },
                    }}
                >
                    {trainingSteps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>

                <Box mt={4}>{renderTrainingStep()}</Box>

                <Box mt={2} display="flex" justifyContent="center">
                    {activeStep > 0 && (
                        <Button variant="outlined" onClick={handleBack} sx={{mr: 1, ml: 1}}>
                            Back
                        </Button>
                    )}
                    {(activeStep === 0 && rawData.length > 0 ||
                      activeStep === 1 && trainRows.length > 0 && testRows.length > 0 ||
                      activeStep === 2 && (trainHist || testHist) ||
                      activeStep === 3 && (modelLoaded || !useExistingModel) ||
                      activeStep === 4 && modelLoaded
                    ) && activeStep < trainingSteps.length - 1 && (
                        <Button variant="outlined" onClick={handleNext} sx={{mr: 1, ml: 1}}>
                            Next
                        </Button>
                    )}
                </Box>
            </>
        );
    };

    // Renamed from original renderStep() to avoid confusion
    const renderTrainingStep = () => {
        switch (activeStep) {
            case 0:
                return (
                    <Box justifyContent={"center"} alignItems={"center"} display={"flex"} flexDirection={"column"}>
                        <Typography variant="h6" gutterBottom>
                            Step 1: Download Data
                        </Typography>
                        <Grid container spacing={2} sx={{mb: 4, mt: 2, maxWidth: 400}}>
                            <Grid item xs={12} justifyContent={"center"} alignItems={"center"}>
                                <TextField
                                    fullWidth
                                    label="Start Date & Time"
                                    type="datetime-local"
                                    InputLabelProps={{
                                        shrink: true,
                                        style: { color: "white" },
                                    }}
                                    InputProps={{
                                        style: { color: "white" },
                                    }}
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </Grid>
                            <Grid item xs={12} justifyContent={"center"} alignItems={"center"}>
                                <TextField
                                    fullWidth
                                    label="End Date & Time"
                                    type="datetime-local"
                                    InputLabelProps={{
                                        shrink: true,
                                        style: { color: "white" },
                                    }}
                                    InputProps={{
                                        style: { color: "white" },
                                    }}
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </Grid>
                        </Grid>
                        <Button
                            variant="contained"
                            onClick={handleDownloadData}
                            disabled={isFetching}
                            sx={{mr: 2, ml: 2}}
                        >
                            {isFetching ? "Downloading..." : "Download"}
                        </Button>
                        <Typography sx={{mt: 1}}>Rows downloaded: {rawData.length}</Typography>
                        {rawData.length > 0 && (
                            <Button variant="outlined" onClick={handleNext} sx={{mt: 2}}>
                                Next
                            </Button>
                        )}
                    </Box>
                );

            case 1:
                return (
                    <Box justifyContent={"center"} alignItems={"center"} display={"flex"} flexDirection={"column"}>
                        <Typography variant="h6" gutterBottom>
                            Step 2: Preprocess & Split
                        </Typography>
                        <Grid container spacing={2} sx={{mb: 2, maxWidth: 400}}>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Test Start Index"
                                    value={testStartIndex}
                                    onChange={(e) => setTestStartIndex(e.target.value)}
                                    type="number"
                                    InputLabelProps={{
                                        shrink: true,
                                        style: { color: "white" },
                                    }}
                                    InputProps={{
                                        style: { color: "white" },
                                    }}
                                />
                            </Grid>
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth
                                    label="Test End Index"
                                    value={testEndIndex}
                                    onChange={(e) => setTestEndIndex(e.target.value)}
                                    type="number"
                                    InputLabelProps={{
                                        shrink: true,
                                        style: { color: "white" },
                                    }}
                                    InputProps={{
                                        style: { color: "white" },
                                    }}
                                />
                            </Grid>
                        </Grid>
                        <Button variant="contained" onClick={handlePreprocessAndSplit} sx={{mr: 2, ml: 2}}>
                            Preprocess & Split
                        </Button>
                        {trainRows.length > 0 && testRows.length > 0 && (
                            <>
                                <Typography sx={{mt: 1}}>
                                    Train: {trainRows.length} rows, Test: {testRows.length} rows
                                </Typography>
                                <Button variant="outlined" onClick={handleNext} sx={{mt: 2}}>
                                    Next
                                </Button>
                            </>
                        )}
                    </Box>
                );

            case 2:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom>
                            Step 3: Histograms
                        </Typography>
                        <Button variant="contained" onClick={handleBuildHistograms}>
                            Build Histograms
                        </Button>
                        {(trainHist || testHist) && (
                            <Box mt={2}>
                                <Typography variant="body1" gutterBottom>
                                    Training Histograms
                                </Typography>
                                {trainHist && (
                                    <Box display="flex" flexWrap="wrap" gap={2} mt={2} justifyContent={"center"}>
                                        {/* Speed */}
                                        <Card sx={{width: 300}}>
                                            <CardContent>
                                                <Typography>Train Speed</Typography>
                                                <Bar
                                                    data={{
                                                        labels: trainHist.speed.labels,
                                                        datasets: [
                                                            {
                                                                label: "Speed Dist",
                                                                data: trainHist.speed.counts,
                                                            },
                                                        ],
                                                    }}
                                                    options={{
                                                        responsive: true,
                                                        scales: { x: { display: false } },
                                                    }}
                                                    height={150}
                                                />
                                            </CardContent>
                                        </Card>
                                        {/* Gear */}
                                        <Card sx={{width: 300}}>
                                            <CardContent>
                                                <Typography>Train Gear</Typography>
                                                <Bar
                                                    data={{
                                                        labels: trainHist.gear.labels,
                                                        datasets: [
                                                            {
                                                                label: "Gear Dist",
                                                                data: trainHist.gear.counts,
                                                            },
                                                        ],
                                                    }}
                                                    options={{
                                                        responsive: true,
                                                        scales: { x: { display: false } },
                                                    }}
                                                    height={150}
                                                />
                                            </CardContent>
                                        </Card>
                                        {/* Jerk */}
                                        <Card sx={{width: 300}}>
                                            <CardContent>
                                                <Typography>Train Jerk</Typography>
                                                <Bar
                                                    data={{
                                                        labels: trainHist.jerk.labels,
                                                        datasets: [
                                                            {
                                                                label: "Jerk Dist",
                                                                data: trainHist.jerk.counts,
                                                            },
                                                        ],
                                                    }}
                                                    options={{
                                                        responsive: true,
                                                        scales: { x: { display: false } },
                                                    }}
                                                    height={150}
                                                />
                                            </CardContent>
                                        </Card>
                                        {/* Fuel */}
                                        <Card sx={{width: 300}}>
                                            <CardContent>
                                                <Typography>Train MomentaryFuel</Typography>
                                                <Bar
                                                    data={{
                                                        labels: trainHist.fuel.labels,
                                                        datasets: [
                                                            {
                                                                label: "Fuel Dist",
                                                                data: trainHist.fuel.counts,
                                                            },
                                                        ],
                                                    }}
                                                    options={{
                                                        responsive: true,
                                                        scales: { x: { display: false } },
                                                    }}
                                                    height={150}
                                                />
                                            </CardContent>
                                        </Card>
                                    </Box>
                                )}
                                <Typography variant="body1" sx={{mt: 3}}>
                                    Test Histograms
                                </Typography>
                                {testHist && (
                                    <Box display="flex" flexWrap="wrap" gap={2} mt={2} justifyContent={"center"}>
                                        {/* Speed */}
                                        <Card sx={{width: 300}}>
                                            <CardContent>
                                                <Typography>Test Speed</Typography>
                                                <Bar
                                                    data={{
                                                        labels: testHist.speed.labels,
                                                        datasets: [
                                                            {
                                                                label: "Speed Dist",
                                                                data: testHist.speed.counts,
                                                            },
                                                        ],
                                                    }}
                                                    options={{
                                                        responsive: true,
                                                        scales: { x: { display: false } },
                                                    }}
                                                    height={150}
                                                />
                                            </CardContent>
                                        </Card>
                                        {/* Gear */}
                                        <Card sx={{width: 300}}>
                                            <CardContent>
                                                <Typography>Test Gear</Typography>
                                                <Bar
                                                    data={{
                                                        labels: testHist.gear.labels,
                                                        datasets: [
                                                            {
                                                                label: "Gear Dist",
                                                                data: testHist.gear.counts,
                                                            },
                                                        ],
                                                    }}
                                                    options={{
                                                        responsive: true,
                                                        scales: { x: { display: false } },
                                                    }}
                                                    height={150}
                                                />
                                            </CardContent>
                                        </Card>
                                        {/* Jerk */}
                                        <Card sx={{width: 300}}>
                                            <CardContent>
                                                <Typography>Test Jerk</Typography>
                                                <Bar
                                                    data={{
                                                        labels: testHist.jerk.labels,
                                                        datasets: [
                                                            {
                                                                label: "Jerk Dist",
                                                                data: testHist.jerk.counts,
                                                            },
                                                        ],
                                                    }}
                                                    options={{
                                                        responsive: true,
                                                        scales: { x: { display: false } },
                                                    }}
                                                    height={150}
                                                />
                                            </CardContent>
                                        </Card>
                                        {/* Fuel */}
                                        <Card sx={{width: 300}}>
                                            <CardContent>
                                                <Typography>Test MomentaryFuel</Typography>
                                                <Bar
                                                    data={{
                                                        labels: testHist.fuel.labels,
                                                        datasets: [
                                                            {
                                                                label: "Fuel Dist",
                                                                data: testHist.fuel.counts,
                                                            },
                                                        ],
                                                    }}
                                                    options={{
                                                        responsive: true,
                                                        scales: { x: { display: false } },
                                                    }}
                                                    height={150}
                                                />
                                            </CardContent>
                                        </Card>
                                    </Box>
                                )}
                                <Box mt={2}>
                                    <Button variant="outlined" onClick={handleNext}>
                                        Next
                                    </Button>
                                </Box>
                            </Box>
                        )}
                    </Box>
                );

            case 3:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom>
                            Step 4: Model Options
                        </Typography>
                        <Typography gutterBottom mb={4}>
                            Choose whether to train a new model or upload an existing one:
                        </Typography>
                        <FormControl sx={{ minWidth: 200 }}>
                            <InputLabel id="model-option-label" style={{ color: "white" }}>
                                Model Source
                            </InputLabel>
                            <Select
                                labelId="model-option-label"
                                label="Model Source"
                                value={useExistingModel ? "upload" : "train"}
                                onChange={handleModelOptionChange}
                                sx={{ color: "white" }}
                            >
                                <MenuItem value="train">Train New Model</MenuItem>
                                <MenuItem value="upload">Upload Existing Model</MenuItem>
                            </Select>
                        </FormControl>

                        {useExistingModel && (
                            <Box mt={2} display={"flex"} flexDirection={"column"} justifyContent={"center"} alignItems={"center"}>
                                <Typography>1) Select your model JSON file:</Typography>
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleJsonFileChange}
                                    style={{ marginBottom: 10 }}
                                />

                                <Typography>2) Select your model BIN file:</Typography>
                                <input
                                    type="file"
                                    accept=".bin"
                                    onChange={handleBinFileChange}
                                    style={{ marginBottom: 10 }}
                                />

                                <Button variant="contained" onClick={handleLoadUploadedModel}>
                                    Load Existing Model
                                </Button>

                                {modelLoaded ? (
                                    <Typography sx={{ color: "#3f51b5", mt: 2 }}>
                                        Model loaded successfully!
                                    </Typography>
                                ) : (
                                    <Typography sx={{ color: "orange", mt: 2 }}>
                                        No model uploaded yet
                                    </Typography>
                                )}
                            </Box>
                        )}

                        <Box mt={2}>
                            <Button variant="outlined" onClick={handleNext}>
                                Next
                            </Button>
                        </Box>
                    </Box>
                );

            case 4:
                return (
                    <Box display={"flex"} flexDirection={"column"} justifyContent={"center"} alignItems={"center"}>
                        <Typography variant="h6" gutterBottom>
                            Step 5: Train Model
                        </Typography>

                        {/* ASK USER FOR NUMBER OF EPOCHS */}
                        <Box mt={2} mb={2} display="flex" flexDirection="column" width="300px" >
                            <TextField
                                label="Number of epochs"
                                type="number"
                                value={numEpochs}
                                onChange={(e) => setNumEpochs(e.target.value)}
                                InputLabelProps={{
                                    shrink: true,
                                    style: { color: "white" },
                                }}
                                InputProps={{
                                    style: { color: "white" },
                                }}
                            />
                        </Box>

                        {modelLoaded ? (
                            <Box mt={2} display={"flex"} flexDirection={"column"} justifyContent={"center"} alignItems={"center"}>
                                <Typography>
                                    A model is already loaded. Training is optional. You can re-train or skip to the next step.
                                </Typography>

                                <Box display="flex" alignItems="center" gap={2} mt={2}>
                                    <Button
                                        variant="contained"
                                        onClick={handleTrainModel}
                                    >
                                        Re-Train / Fine-Tune
                                    </Button>

                                    <Button
                                        variant="outlined"
                                        onClick={handleNext}
                                    >
                                        Skip Training
                                    </Button>
                                </Box>
                            </Box>
                        ) : (
                            <>
                                {isTraining ? (
                                    <>
                                        <Typography>Training in progress ...</Typography>
                                        <Box sx={{ width: "100%", mt: 2 }}>
                                            <LinearProgress
                                                // progress is based on user's chosen epochs
                                                variant="determinate"
                                                value={(currentEpoch / numEpochs) * 100}
                                            />
                                            <Typography textAlign="center" mt={1}>
                                                Epoch {currentEpoch} / {numEpochs}
                                            </Typography>
                                        </Box>
                                    </>
                                ) : (
                                    <Button variant="contained" onClick={handleTrainModel}>
                                        Train Model
                                    </Button>
                                )}
                            </>
                        )}

                        {/* Show training logs in a table, if any */}
                        {epochLogs.length > 0 && (
                            <Paper sx={{ mt: 3, maxHeight: 250, overflow: "auto" }}>
                                <Table size="small">
                                    <TableHead sx={{ backgroundColor: "#303030" }}>
                                        <TableRow>
                                            <TableCell sx={{ color: "#fff" }}>Epoch</TableCell>
                                            <TableCell sx={{ color: "#fff" }}>Loss</TableCell>
                                            <TableCell sx={{ color: "#fff" }}>MAE</TableCell>
                                            <TableCell sx={{ color: "#fff" }}>MSE</TableCell>
                                            <TableCell sx={{ color: "#fff" }}>Val Loss</TableCell>
                                            <TableCell sx={{ color: "#fff" }}>Val MAE</TableCell>
                                            <TableCell sx={{ color: "#fff" }}>Val MSE</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody sx={{ backgroundColor: "#444" }}>
                                        {epochLogs.map((row, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell sx={{ color: "#fff" }}>{row.epoch}</TableCell>
                                                <TableCell sx={{ color: "#fff" }}>
                                                    {row.loss?.toFixed(4)}
                                                </TableCell>
                                                <TableCell sx={{ color: "#fff" }}>
                                                    {row.mae?.toFixed(4)}
                                                </TableCell>
                                                <TableCell sx={{ color: "#fff" }}>
                                                    {row.mse?.toFixed(4)}
                                                </TableCell>
                                                <TableCell sx={{ color: "#fff" }}>
                                                    {row.val_loss?.toFixed(4)}
                                                </TableCell>
                                                <TableCell sx={{ color: "#fff" }}>
                                                    {row.val_mae?.toFixed(4)}
                                                </TableCell>
                                                <TableCell sx={{ color: "#fff" }}>
                                                    {row.val_mse?.toFixed(4)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Paper>
                        )}

                        {/* Show final metrics, if training completed */}
                        {finalMetrics && (
                            <Box mt={2}>
                                <Typography>
                                    Test Loss (MAE): {finalMetrics.loss.toFixed(6)}
                                </Typography>
                                <Typography>
                                    Test MAE: {finalMetrics.mae.toFixed(6)}
                                </Typography>
                                <Typography>
                                    Test MSE: {finalMetrics.mse.toFixed(6)}
                                </Typography>

                                <Box mt={2}>
                                    {/* If we want to let them download the newly-trained or re-trained model */}
                                    {modelLoaded && (
                                        <Button
                                            variant="outlined"
                                            onClick={() => handleDownloadTrainedModel(modelLoaded)}
                                            sx={{ mr: 2 }}
                                        >
                                            Download Model
                                        </Button>
                                    )}
                                    <Button variant="outlined" onClick={handleNext}>
                                        Next
                                    </Button>
                                </Box>
                            </Box>
                        )}
                    </Box>
                );

            case 5:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom>
                            Step 6: Evaluate & Plots
                        </Typography>
                        {predsOrig.length === 0 || actualOrig.length === 0 ? (
                            <Typography>No predictions available.</Typography>
                        ) : (
                            <>
                                <Typography variant="subtitle1" sx={{mt: 2}}>
                                    Momentary Fuel: Actual vs Predicted
                                </Typography>
                                <Line
                                    data={{
                                        labels: actualOrig.map((_, i) => i),
                                        datasets: [
                                            {
                                                label: "Actual",
                                                data: actualOrig,
                                                pointRadius: 0,
                                                tension: 0.1,
                                            },
                                            {
                                                label: "Predicted",
                                                data: predsOrig,
                                                pointRadius: 0,
                                                tension: 0.1,
                                            },
                                        ],
                                    }}
                                    options={{
                                        responsive: true,
                                        scales: {
                                            x: {title: {display: true, text: "Time Steps (flattened)"}} ,
                                            y: {title: {display: true, text: "MomentaryFuel"}},
                                        },
                                    }}
                                    height={120}
                                />

                                <Typography variant="subtitle1" sx={{mt: 2}}>
                                    Cumulative Fuel: Actual vs Predicted
                                </Typography>
                                <Line
                                    data={{
                                        labels: cumulativeReal.map((_, i) => i),
                                        datasets: [
                                            {
                                                label: "Actual Cumulative",
                                                data: cumulativeReal,
                                                pointRadius: 0,
                                                tension: 0.1,
                                            },
                                            {
                                                label: "Predicted Cumulative",
                                                data: cumulativePred,
                                                pointRadius: 0,
                                                tension: 0.1,
                                            },
                                        ],
                                    }}
                                    options={{
                                        responsive: true,
                                        scales: {
                                            x: {title: {display: true, text: "Time Steps (flattened)"}} ,
                                            y: {title: {display: true, text: "Cumulative Fuel"}},
                                        },
                                    }}
                                    height={120}
                                />

                                <Typography variant="subtitle1" sx={{mt: 2}}>
                                    Scatter: Actual vs Predicted
                                </Typography>
                                <Scatter
                                    data={{
                                        datasets: [
                                            {
                                                label: "Data Points",
                                                data: actualOrig.map((val, i) => ({
                                                    x: val,
                                                    y: predsOrig[i],
                                                })),
                                                pointRadius: 3,
                                            },
                                            {
                                                label: "Ideal line",
                                                data: [
                                                    {
                                                        x: Math.min(...actualOrig),
                                                        y: Math.min(...actualOrig),
                                                    },
                                                    {
                                                        x: Math.max(...actualOrig),
                                                        y: Math.max(...actualOrig),
                                                    },
                                                ],
                                                borderColor: 'rgb(255, 205, 86)',
                                                borderDash: [5, 5],
                                                showLine: true,
                                                fill: false,
                                                pointRadius: 0
                                            },
                                        ],
                                    }}
                                    options={{
                                        responsive: true,
                                        scales: {
                                            x: {title: {display: true, text: "Actual"}},
                                            y: {title: {display: true, text: "Predicted"}},
                                        },
                                    }}
                                    height={200}
                                />
                            </>
                        )}
                    </Box>
                );

            default:
                return <div>Unknown step</div>;
        }
    };

    // Update the Test Trips view implementation
    const renderTestTripsView = () => {
        // Get columns from uploadedFileData if available
        const availableColumns = uploadedFileData.length > 0 
            ? Object.keys(uploadedFileData[0]) 
            : [];

        // Use actualCumulativeFuelData from state (calculated by useEffect)

        return (
            <>
                <Box display="flex" alignItems="center" mb={3}>
                    <Button onClick={goToHome} variant="outlined" startIcon={<span>←</span>} sx={{ mr: 2 }}>
                        Back to Home
                    </Button>
                    <Typography variant="h5">Test Trips with Trained Model</Typography>
                </Box>
                
                {!modelLoaded ? (
                    <Card sx={{ p: 4, mb: 4, maxWidth: 600, mx: 'auto', bgcolor: '#424242' }}>
                        {/* Load Model UI */}
                         <Typography variant="h6" align="center" gutterBottom>First, Load a Model</Typography>
                        <Typography align="center" paragraph>
                            You need to load a trained model before testing trip data.
                        </Typography>
                        
                        <Box mt={2} display={"flex"} flexDirection={"column"} justifyContent={"center"} alignItems={"center"}>
                            <Typography>1) Select your model JSON file:</Typography>
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleJsonFileChange}
                                style={{ marginBottom: 10 }}
                            />

                            <Typography>2) Select your model BIN file:</Typography>
                            <input
                                type="file"
                                accept=".bin"
                                onChange={handleBinFileChange}
                                style={{ marginBottom: 10 }}
                            />

                            <Button variant="contained" onClick={handleLoadUploadedModel}>
                                Load Existing Model
                            </Button>
                        </Box>
                    </Card>
                ) : (
                    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                        <Card sx={{ p: 3, mb: 4, bgcolor: '#424242' }}>
                            <Typography variant="h6" gutterBottom>Upload Trip Data</Typography>
                            
                            <Box sx={{ mb: 3 }}>
                                {/* Upload Button, File Name, Process Button */}
                                 <Button variant="contained" component="label" sx={{ mr: 2 }}>
                                    Select File (.csv, .xlsx, .xls)
                                    <input type="file" hidden accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={handleFileChange} />
                                </Button>
                                {uploadedFile && (
                                    <>
                                        <Typography component="span" sx={{ ml: 1 }}>
                                            {uploadedFile.name}
                                        </Typography>
                                        <Button 
                                            variant="outlined" 
                                            onClick={handleProcessUploadedFile} 
                                            disabled={isProcessingUpload}
                                            sx={{ ml: 2 }}
                                        >
                                            {isProcessingUpload ? "Processing..." : "Process File"}
                                        </Button>
                                    </>
                                )}
                            </Box>
                            
                            {uploadedFileData.length > 0 && (
                                <>
                                    <Typography variant="subtitle1" gutterBottom>
                                        Map Columns (Found {availableColumns.length} columns, {uploadedFileData.length} rows)
                                    </Typography>
                                    
                                    {/* Column Mapping Grid */}
                                    <Grid container spacing={2} sx={{ mb: 3 }}>
                                        <Grid item xs={12} sm={4}>
                                            <FormControl fullWidth>
                                                <InputLabel id="speed-column-label" sx={{ color: 'white' }}>
                                                    Speed Column *
                                                </InputLabel>
                                                <Select
                                                    labelId="speed-column-label"
                                                    value={columnMappings[COL_SPEED]}
                                                    onChange={(e) => setColumnMappings({...columnMappings, [COL_SPEED]: e.target.value})}
                                                    label="Speed Column"
                                                    sx={{ color: 'white' }}
                                                    required
                                                >
                                                    <MenuItem value=""><em>Select a column</em></MenuItem>
                                                    {availableColumns.map(col => (
                                                        <MenuItem key={col} value={col}>{col}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        
                                        <Grid item xs={12} sm={4}>
                                            <FormControl fullWidth>
                                                <InputLabel id="gear-column-label" sx={{ color: 'white' }}>
                                                    Gear Column *
                                                </InputLabel>
                                                <Select
                                                    labelId="gear-column-label"
                                                    value={columnMappings[COL_GEAR]}
                                                    onChange={(e) => setColumnMappings({...columnMappings, [COL_GEAR]: e.target.value})}
                                                    label="Gear Column"
                                                    sx={{ color: 'white' }}
                                                    required
                                                >
                                                    <MenuItem value=""><em>Select a column</em></MenuItem>
                                                    {availableColumns.map(col => (
                                                        <MenuItem key={col} value={col}>{col}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        
                                        <Grid item xs={12} sm={4}>
                                            <FormControl fullWidth>
                                                <InputLabel id="mileage-column-label" sx={{ color: 'white' }}>
                                                    Mileage Column (KM, optional)
                                                </InputLabel>
                                                <Select
                                                    labelId="mileage-column-label"
                                                    value={columnMappings[COL_MILEAGE]}
                                                    onChange={(e) => {
                                                        setColumnMappings({...columnMappings, [COL_MILEAGE]: e.target.value});
                                                        const needsInput = !e.target.value;
                                                        setNeedsDistanceInput(needsInput);
                                                        if (needsInput) {
                                                            setUploadedFileDistance("");
                                                        }
                                                    }}
                                                    label="Mileage Column (KM, optional)"
                                                    sx={{ color: 'white' }}
                                                >
                                                    <MenuItem value=""><em>Select a column</em></MenuItem>
                                                    {availableColumns.map(col => (
                                                        <MenuItem key={col} value={col}>{col}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>

                                        <Grid item xs={12} sm={4}>
                                            <FormControl fullWidth>
                                                <InputLabel id="fuel-column-label" sx={{ color: 'white' }}>
                                                    Fuel Column (µL, optional)
                                                </InputLabel>
                                                <Select
                                                    labelId="fuel-column-label"
                                                    value={columnMappings[COL_FUEL]}
                                                    onChange={(e) => setColumnMappings({...columnMappings, [COL_FUEL]: e.target.value})}
                                                    label="Fuel Column (µL, optional)"
                                                    sx={{ color: 'white' }}
                                                >
                                                    <MenuItem value=""><em>Select a column</em></MenuItem>
                                                    {availableColumns.map(col => (
                                                        <MenuItem key={col} value={col}>{col}</MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    </Grid>

                                    {/* --- Add Row Range Selection --- */}
                                    <Box mt={3}>
                                        <Typography variant="subtitle2" gutterBottom>
                                            Predict Specific Row Range (Optional):
                                        </Typography>
                                        <Grid container spacing={2}>
                                            <Grid item xs={6}>
                                                <TextField
                                                    fullWidth
                                                    label="Start Index (0-based)"
                                                    type="number"
                                                    value={predictStartIndex}
                                                    onChange={(e) => setPredictStartIndex(e.target.value)}
                                                    disabled={!uploadedFileData.length} // Disable until file is processed
                                                    InputLabelProps={{ shrink: true, style: { color: 'white' } }}
                                                    InputProps={{ style: { color: 'white' } }}
                                                    inputProps={{ min: "0" }} // Basic validation
                                                />
                                            </Grid>
                                            <Grid item xs={6}>
                                                <TextField
                                                    fullWidth
                                                    label="End Index (exclusive)"
                                                    type="number"
                                                    value={predictEndIndex}
                                                    onChange={(e) => setPredictEndIndex(e.target.value)}
                                                    disabled={!uploadedFileData.length} // Disable until file is processed
                                                    InputLabelProps={{ shrink: true, style: { color: 'white' } }}
                                                    InputProps={{ style: { color: 'white' } }}
                                                    inputProps={{ min: predictStartIndex ? String(parseInt(predictStartIndex, 10) + 1) : "1" }} // Basic validation
                                                />
                                            </Grid>
                                        </Grid>
                                    </Box>
                                    {/* --- End Row Range Selection --- */}

                                    {/* --- Preview Section --- */}
                                    <Box mt={3}>
                                        <Button 
                                            variant="outlined"
                                            onClick={() => setShowPreview(!showPreview)}
                                            sx={{ mb: 1 }}
                                        >
                                            {showPreview ? 'Hide' : 'Show'} Data Preview (First 20 Rows)
                                        </Button>
                                        {showPreview && previewData.length > 0 ? (
                                            <Paper sx={{ maxHeight: 300, overflow: 'auto', mt: 1 }}>
                                                <Table stickyHeader size="small">
                                                    <TableHead sx={{ backgroundColor: '#303030' }}>
                                                        <TableRow>
                                                            {Object.keys(previewData[0] || {}).map(key => (
                                                                <TableCell key={key} sx={{ color: '#fff', fontWeight: 'bold' }}>{key}</TableCell>
                                                            ))}
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody sx={{ backgroundColor: '#444' }}>
                                                        {previewData.map((row, idx) => (
                                                            <TableRow key={idx}>
                                                                {Object.values(row).map((value, cellIdx) => (
                                                                    <TableCell key={cellIdx} sx={{ color: '#eee', whiteSpace: 'nowrap' }}>
                                                                        {typeof value === 'number'
                                                                            ? value.toFixed(2)
                                                                            : String(value ?? '')}
                                                                    </TableCell>
                                                                ))}
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </Paper>
                                        ) : null}
                                    </Box>
                                    {/* --- End Preview Section --- */}

                                    {/* Distance Input/Display - Using Ternary */} 
                                    {needsDistanceInput ? (
                                        <TextField
                                            fullWidth
                                            label="Total Distance Traveled (KM)"
                                            type="number"
                                            value={uploadedFileDistance}
                                            onChange={(e) => setUploadedFileDistance(e.target.value)}
                                            sx={{ mt: 3, mb: 3, input: { color: 'white' } }} 
                                            InputLabelProps={{ shrink: true, style: { color: 'white' } }}
                                        />
                                    ) : null}

                                    {!needsDistanceInput && uploadedFileDistance ? (
                                        <Typography sx={{ mt:3, mb: 2 }}> 
                                            Calculated Distance: {uploadedFileDistance} KM
                                        </Typography>
                                    ) : null}
                                    
                                    {/* Predict Button */} 
                                    <Button 
                                        variant="contained" 
                                        color="primary" 
                                        onClick={handlePredictUploadedFile}
                                        disabled={isProcessingUpload || !columnMappings[COL_SPEED] || !columnMappings[COL_GEAR] || (needsDistanceInput && !uploadedFileDistance)}
                                        sx={{ mt: 1 }}
                                    >
                                        {isProcessingUpload ? "Predicting..." : "Predict Fuel Consumption"}
                                    </Button>
                                </> // Closing fragment for uploadedFileData.length > 0 condition
                            )}
                        </Card>
                        
                        {/* Card for L/100KM Result - Using Ternary */} 
                        {predictionResultLPer100KM ? (
                            <>
                                <Card sx={{ p: 3, mb: 4, bgcolor: '#2e7d32' }}>
                                    <Typography variant="h5" align="center">Prediction Result</Typography>
                                    <Typography variant="h4" align="center" sx={{ mt: 2, mb: 2, fontWeight: 'bold' }}>
                                        {predictionResultLPer100KM} L/100KM
                                    </Typography>
                                    <Typography align="center" variant="subtitle1">
                                        Estimated fuel consumption for this trip
                                    </Typography>
                                </Card>
                            </>
                        ) : null}
                        
                        {/* Updated Card for Fuel Consumption Analysis - Using Ternary */} 
                        {predictedMomentaryFuel.length > 0 ? (
                            <>
                                <Card sx={{ p: 3, mb: 4 }}> 
                                    <Typography variant="h6" gutterBottom>
                                        {actualMomentaryFuel.length > 0 
                                            ? "Fuel Consumption Analysis (Actual vs. Predicted)"
                                            : "Predicted Fuel Consumption Analysis"
                                        }
                                    </Typography>

                                    {/* Momentary Fuel Plot */} 
                                    <Box sx={{ height: 300, mb: 3 }}>
                                        <Typography variant="subtitle1" gutterBottom>Momentary Fuel (µL)</Typography>
                                        <Line
                                            data={{
                                                labels: predictedMomentaryFuel.map((_, i) => i),
                                                datasets: [
                                                    // Conditionally add Actual dataset
                                                    ...(actualMomentaryFuel.length > 0 ? [{
                                                        label: "Actual",
                                                        data: actualMomentaryFuel,
                                                        borderColor: 'rgb(255, 99, 132)',
                                                        backgroundColor: 'rgba(255, 99, 132, 0.3)',
                                                        pointRadius: 0,
                                                        tension: 0.1,
                                                        fill: false,
                                                    }] : []),
                                                    // Predicted dataset (always show if predictions exist)
                                                    {
                                                        label: "Predicted",
                                                        data: predictedMomentaryFuel,
                                                        borderColor: 'rgb(75, 192, 192)',
                                                        backgroundColor: 'rgba(75, 192, 192, 0.3)',
                                                        pointRadius: 0,
                                                        tension: 0.1,
                                                        fill: false,
                                                    },
                                                ],
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                scales: {
                                                    x: {title: {display: true, text: "Time Steps"}},
                                                    y: {title: {display: true, text: "Momentary Fuel Consumption (µL)"}},
                                                },
                                                plugins: { legend: { display: actualMomentaryFuel.length > 0 } } 
                                            }}
                                        />
                                    </Box>

                                    {/* Cumulative Fuel Plot */} 
                                    <Box sx={{ height: 300 }}>
                                        <Typography variant="subtitle1" gutterBottom>Cumulative Fuel (µL)</Typography>
                                        <Line
                                            data={{
                                                labels: predictedMomentaryFuel.map((_, i) => i),
                                                datasets: [
                                                    // Conditionally add Actual dataset
                                                    ...(actualCumulativeFuelData.length > 0 ? [{
                                                        label: "Actual Cumulative",
                                                        data: actualCumulativeFuelData, 
                                                        borderColor: 'rgb(255, 99, 132)',
                                                        backgroundColor: 'rgba(255, 99, 132, 0.3)',
                                                        pointRadius: 0,
                                                        tension: 0.1,
                                                        fill: false,
                                                    }] : []),
                                                    // Predicted dataset
                                                    {
                                                        label: "Predicted Cumulative",
                                                        data: predictedMomentaryFuel.reduce((acc, curr, i) => {
                                                            const sum = (acc[i-1] || 0) + curr;
                                                            acc.push(sum);
                                                            return acc;
                                                        }, []),
                                                        borderColor: 'rgb(75, 192, 192)',
                                                        backgroundColor: 'rgba(75, 192, 192, 0.3)',
                                                        pointRadius: 0,
                                                        tension: 0.1,
                                                        fill: false,
                                                    },
                                                ],
                                            }}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                scales: {
                                                    x: {title: {display: true, text: "Time Steps"}},
                                                    y: {title: {display: true, text: "Cumulative Fuel Consumption (µL)"}},
                                                },
                                                plugins: { legend: { display: actualCumulativeFuelData.length > 0 } } 
                                            }}
                                        />
                                    </Box>
                                </Card>
                            </>
                        ) : null}
                        {/* ---- End Updated Card ---- */}
                        
                        {/* Scatter Plot Card - Using Ternary */}
                        {actualMomentaryFuel.length > 0 && predictedMomentaryFuel.length > 0 && actualMomentaryFuel.length === predictedMomentaryFuel.length ? (
                             <Card sx={{ p: 3, mt: 4 }}>
                                <Typography variant="h6" gutterBottom>Actual vs. Predicted Fuel Consumption (Scatter)</Typography>
                                
                                <Typography variant="subtitle1" sx={{mt: 2}}>
                                    Scatter: Actual vs Predicted (µL)
                                </Typography>
                                <Box sx={{ height: 300 }}>
                                    <Scatter 
                                        data={{
                                            datasets: [
                                                {
                                                    label: "Data Points (Actual vs Predicted)",
                                                    data: actualMomentaryFuel.map((val, i) => ({
                                                        x: val,
                                                        y: predictedMomentaryFuel[i],
                                                    })),
                                                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                                                    pointRadius: 3,
                                                },
                                                {
                                                    label: "Ideal line (y=x)",
                                                    data: [
                                                        {
                                                            x: Math.min(...actualMomentaryFuel, ...predictedMomentaryFuel),
                                                            y: Math.min(...actualMomentaryFuel, ...predictedMomentaryFuel),
                                                        },
                                                        {
                                                            x: Math.max(...actualMomentaryFuel, ...predictedMomentaryFuel),
                                                            y: Math.max(...actualMomentaryFuel, ...predictedMomentaryFuel),
                                                        },
                                                    ],
                                                    borderColor: 'rgb(255, 205, 86)',
                                                    borderDash: [5, 5],
                                                    showLine: true,
                                                    fill: false,
                                                    pointRadius: 0,
                                                },
                                            ],
                                        }}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            scales: {
                                                x: {title: {display: true, text: "Actual Momentary Fuel (µL)"}},
                                                y: {title: {display: true, text: "Predicted Momentary Fuel (µL)"}},
                                            },
                                        }}
                                    />
                                </Box>
                            </Card>
                        ) : null}
                    </Box> // Closing Box for modelLoaded condition
                )} 
            </> // Closing outer fragment
        ); // Closing return
    };

    // Implement the Test Room Simulator view
    const renderTestRoomView = () => {
        // ... (Keep the existing implementation of renderTestRoomView)
        return (
            <>
                <Box display="flex" alignItems="center" mb={3}>
                    <Button onClick={goToHome} variant="outlined" startIcon={<span>←</span>} sx={{ mr: 2 }}>
                        Back to Home
                    </Button>
                    <Typography variant="h5">Test Room Simulator</Typography>
                </Box>
                
                {!modelLoaded ? (
                    <Card sx={{ p: 4, mb: 4, maxWidth: 600, mx: 'auto', bgcolor: '#424242' }}>
                        <Typography variant="h6" align="center" gutterBottom>First, Load a Model</Typography>
                        <Typography align="center" paragraph>
                            You need to load a trained model to run the simulator.
                        </Typography>
                        
                        <Box mt={2} display={"flex"} flexDirection={"column"} justifyContent={"center"} alignItems={"center"}>
                            <Typography>1) Select your model JSON file:</Typography>
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleJsonFileChange}
                                style={{ marginBottom: 10 }}
                            />

                            <Typography>2) Select your model BIN file:</Typography>
                            <input
                                type="file"
                                accept=".bin"
                                onChange={handleBinFileChange}
                                style={{ marginBottom: 10 }}
                            />

                            <Button variant="contained" onClick={handleLoadUploadedModel}>
                                Load Existing Model
                            </Button>
                        </Box>
                    </Card>
                ) : (
                    <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                        <Card sx={{ p: 3, mb: 4, bgcolor: '#424242' }}>
                            <Typography variant="h6" gutterBottom>Select a Driving Cycle</Typography>
                            <Typography paragraph>
                                Choose a standardized driving cycle to simulate and predict fuel consumption.
                            </Typography>
                            
                            <Grid container spacing={2} sx={{ mb: 3 }}>
                                <Grid item xs={12} sm={6}>
                                    <Card 
                                        sx={{ 
                                            p: 2, 
                                            cursor: 'pointer',
                                            border: selectedCycle === 'NEDC' ? '2px solid #4fc3f7' : 'none',
                                            bgcolor: selectedCycle === 'NEDC' ? 'rgba(79, 195, 247, 0.1)' : 'rgba(66, 66, 66, 0.7)',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                bgcolor: 'rgba(79, 195, 247, 0.1)',
                                            }
                                        }}
                                        onClick={() => handleSelectCycle('NEDC')}
                                    >
                                        <Typography variant="h6" gutterBottom>NEDC</Typography>
                                        <Typography variant="body2">
                                            New European Driving Cycle - standard EU cycle until 2017
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            Duration: 1180 seconds | Distance: 11 km
                                        </Typography>
                                    </Card>
                                </Grid>
                                
                                <Grid item xs={12} sm={6}>
                                    <Card 
                                        sx={{ 
                                            p: 2, 
                                            cursor: 'pointer',
                                            border: selectedCycle === 'WLTC' ? '2px solid #4fc3f7' : 'none',
                                            bgcolor: selectedCycle === 'WLTC' ? 'rgba(79, 195, 247, 0.1)' : 'rgba(66, 66, 66, 0.7)',
                                            transition: 'all 0.2s',
                                            '&:hover': {
                                                bgcolor: 'rgba(79, 195, 247, 0.1)',
                                            }
                                        }}
                                        onClick={() => handleSelectCycle('WLTC')}
                                    >
                                        <Typography variant="h6" gutterBottom>WLTC</Typography>
                                        <Typography variant="body2">
                                            Worldwide harmonized Light vehicles Test Cycle - newer global standard
                                        </Typography>
                                        <Typography variant="body2" sx={{ mt: 1 }}>
                                            Duration: 1800 seconds | Distance: 23.25 km
                                        </Typography>
                                        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                                            (Coming soon)
                                        </Typography>
                                    </Card>
                                </Grid>
                            </Grid>
                            
                            <Button 
                                variant="contained"
                                color="primary"
                                onClick={handleRunSimulation}
                                disabled={isProcessingUpload || (selectedCycle === 'WLTC')}
                                fullWidth
                                sx={{ mt: 2 }}
                            >
                                {isProcessingUpload ? "Running Simulation..." : "Run Simulation"}
                            </Button>
                        </Card>
                        
                        {predictionResultLPer100KM && (
                            <Card sx={{ p: 3, mb: 4, bgcolor: '#2e7d32' }}>
                                <Typography variant="h5" align="center">{selectedCycle} Simulation Result</Typography>
                                <Typography variant="h4" align="center" sx={{ mt: 2, mb: 2, fontWeight: 'bold' }}>
                                    {predictionResultLPer100KM} L/100KM
                                </Typography>
                                <Typography align="center" variant="subtitle1">
                                    Estimated fuel consumption for this driving cycle
                                </Typography>
                            </Card>
                        )}
                        
                        {predictedMomentaryFuel.length > 0 && (
                            <>
                                <Card sx={{ p: 3, mb: 4 }}> {/* Adjusted margin */}
                                   {/* ... Card content ... */}
                                </Card>
                            </>
                        )}
                        {/* ---- End Updated Card ---- */}
                    </Box>
                )}
            </>
        );
    };

    // Effect to calculate cumulative actual fuel when actual momentary fuel changes
    useEffect(() => {
        // ... (Keep the existing implementation of this effect)
        if (actualMomentaryFuel && actualMomentaryFuel.length > 0) {
            console.log("Calculating actual cumulative fuel...");
            const cumulative = actualMomentaryFuel.reduce((acc, curr, i) => {
                const sum = (acc[i-1] || 0) + (curr || 0); // Handle potential nulls/NaNs
                acc.push(sum);
                return acc;
            }, []);
            setActualCumulativeFuelData(cumulative);
        } else {
            setActualCumulativeFuelData([]); // Clear if no momentary data
        }
    }, [actualMomentaryFuel]);

    // ----------------------------------------------------------------
    // Main Render Method
    // ----------------------------------------------------------------
    return (
        <Box
            sx={{
                p: 2,
                minHeight: "100vh",
                backgroundColor: "#56566c",
                color: "#fff",
            }}
        >
            {renderMainContent()}
        </Box>
    );
};

export default AI;
