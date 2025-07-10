import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './PidSelectorDropdown.css';
import { FaTools } from "react-icons/fa";

// Helper to get the auth token (replace with your actual token retrieval logic)
const getAuthToken = () => {
  return localStorage.getItem('authToken') || JSON.parse(localStorage.getItem('user'))?.access_token; // Example: try authToken first, then from 'user' object
};

const API_BASE_URL = 'https://khodroai.com/api'; // Adjust if your API is hosted elsewhere

const PidSelectorDropdown = ({ carID, carName }) => { // Expect carID and optional carName
  const [isOpen, setIsOpen] = useState(false);
  const [availablePids, setAvailablePids] = useState([]); // [{ pid: '030a', name: 'Battery Voltage' }]
  const [currentSelectedPids, setCurrentSelectedPids] = useState([]); // ['030a', '0356']
  const [presets, setPresets] = useState({}); // State for presets, e.g., { default: ['...'] }
  const [selectedPreset, setSelectedPreset] = useState(''); // State for the currently selected preset name
  const [isLoadingPids, setIsLoadingPids] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const dropdownRef = useRef(null);

  // Memoized fetchPids function to get available, selected, and preset PIDs
  const fetchPids = useCallback(() => {
    if (carID) {
      setIsLoadingPids(true);
      setError('');
      setSuccessMessage('');
      axios.get(`${API_BASE_URL}/cars/${carID}/select-pids/`, {
        headers: { Authorization: `Token ${getAuthToken()}` }
      })
      .then(response => {
        setAvailablePids(response.data.available_ecu_pids || []);
        setCurrentSelectedPids(response.data.selected_ecu_pids || []);
        setPresets(response.data.presets || {}); // Set presets from the API response
      })
      .catch(err => {
        console.error(`Error fetching PIDs for car ${carID}:`, err);
        setError(`Failed to load PIDs for ${carName || carID}.`);
        setAvailablePids([]);
        setCurrentSelectedPids([]);
        setPresets({}); // Clear presets on error
      })
      .finally(() => setIsLoadingPids(false));
    } else {
      // Clear all data if no car is selected
      setAvailablePids([]);
      setCurrentSelectedPids([]);
      setPresets({});
    }
  }, [carID, carName]); // Dependencies for useCallback

  // Effect to fetch PIDs when carID changes or dropdown opens
  useEffect(() => {
    if (isOpen && carID) {
        fetchPids();
    }
  }, [isOpen, carID, fetchPids]);

  // useEffect to automatically determine and set the current preset based on selected PIDs
  useEffect(() => {
    // Create a sorted string from the current selection for reliable comparison
    const currentPidsSorted = [...currentSelectedPids].sort().toString();
    let matchedPreset = '';

    // Iterate through available presets to find a match
    for (const [presetName, presetPids] of Object.entries(presets)) {
        const presetPidsSorted = [...presetPids].sort().toString();
        if (currentPidsSorted === presetPidsSorted) {
            matchedPreset = presetName;
            break; // Exit loop once a match is found
        }
    }
    // If a match is found, update the state. Otherwise, it defaults to '' (Custom)
    setSelectedPreset(matchedPreset);
  }, [currentSelectedPids, presets]);


  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  const handleToggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const handlePidChange = (pid) => {
    setCurrentSelectedPids(prev =>
      prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
    );
  };

  // Handler for when the user selects a different preset from the dropdown
  const handlePresetChange = (e) => {
    const presetName = e.target.value;
    setSelectedPreset(presetName); // Update the select input

    // If a valid preset is chosen (not 'Custom'), apply its PID list
    if (presetName && presets[presetName]) {
      setCurrentSelectedPids(presets[presetName]);
    }
  };

  const handleSelectAll = () => {
    setCurrentSelectedPids(availablePids.map(p => p.pid));
  };

  const handleDeselectAll = () => {
    setCurrentSelectedPids([]);
  };

  const handleSaveChanges = () => {
    if (!carID) return;
    setIsSaving(true);
    setError('');
    setSuccessMessage('');

    axios.patch(`${API_BASE_URL}/cars/${carID}/select-pids/`,
      { pids: currentSelectedPids },
      { headers: { Authorization: `Token ${getAuthToken()}` } }
    )
    .then(response => {
      setSuccessMessage('PIDs updated successfully!');
      setCurrentSelectedPids(response.data.selected_ecu_pids || []);
      setTimeout(() => setSuccessMessage(''), 3000);
    })
    .catch(err => {
      console.error("Error saving PIDs:", err.response?.data || err.message);
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to save PIDs.');
      setTimeout(() => setError(''), 5000);
    })
    .finally(() => setIsSaving(false));
  };

  // If no carID is provided, render a disabled button
  if (!carID) {
    return (
        <button className="pid-dropdown-toggle-disabled" disabled title="Select a car first">
            <FaTools/>
        </button>
    );
  }

  return (
    <div className="pid-selector-dropdown-container" ref={dropdownRef}>
      <button onClick={handleToggleDropdown} className="pid-dropdown-toggle">
        <FaTools/> {isOpen ? '▲' : '▼'}
      </button>
      {isOpen && (
        <div className="pid-dropdown-menu">
          {error && <p className="pid-error-message">{error}</p>}
          {successMessage && <p className="pid-success-message">{successMessage}</p>}

          {isLoadingPids && <p>Loading variables...</p>}
          {!isLoadingPids && availablePids.length > 0 && (
            <div className="pid-list-container">
              {/* Preset Selector UI */}
              <div className="pid-preset-selector-container">
                  <label htmlFor="pid-preset-selector">Variables Preset</label>
                  <select
                    id="pid-preset-selector"
                    className="pid-preset-selector"
                    value={selectedPreset}
                    onChange={handlePresetChange}
                  >
                    <option value="">Custom</option>
                    {Object.keys(presets).map(name => (
                      <option key={name} value={name}>
                        {name.charAt(0).toUpperCase() + name.slice(1)}
                      </option>
                    ))}
                  </select>
              </div>

              <div className="pid-list-actions">
                <button onClick={handleSelectAll} className="pid-action-button">Select All</button>
                <button onClick={handleDeselectAll} className="pid-action-button">Deselect All</button>
              </div>
              <ul className="pid-list">
                {availablePids.map(param => (
                  <li key={param.pid}>
                    <label>
                      <input
                        type="checkbox"
                        checked={currentSelectedPids.includes(param.pid)}
                        onChange={() => handlePidChange(param.pid)}
                      />
                      {param.pid} - {param.name}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!isLoadingPids && availablePids.length === 0 && (
            <p>No configurable PIDs found for the ECU on this car, or car has no ECU.</p>
          )}

          <button
            onClick={handleSaveChanges}
            disabled={isSaving || isLoadingPids}
            className="pid-save-button"
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PidSelectorDropdown;
