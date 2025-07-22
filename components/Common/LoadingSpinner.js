import React from 'react';
import './LoadingSpinner.css'; // Create this CSS file

const LoadingSpinner = ({ size = 'medium' }) => { // size can be 'small', 'medium', 'large'
    return (
        <div className={`spinner-container spinner-${size}`}>
            <div className="spinner"></div>
        </div>
    );
};

export default LoadingSpinner;