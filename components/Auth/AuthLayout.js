import React from 'react';
import './AuthLayout.css'; // Create this CSS file

const AuthLayout = ({ children, title }) => {
    return (
        <div className="auth-container">
            <div className="auth-box">
                <img
                    src={'/LOGO.png'}
                    alt="App Logo" // <-- Important for accessibility
                    className="auth-icon"
                />
                <h1 className="auth-title">{title}</h1>
                {children}
            </div>
        </div>
    );
};

export default AuthLayout;