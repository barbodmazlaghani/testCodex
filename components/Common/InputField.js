import React from 'react';

const InputField = ({ label, type = 'text', name, value, onChange, placeholder, error, required = false }) => {
    return (
        <div className="input-group">
            {label && <label htmlFor={name}>{label}{required && '*'}</label>}
            <input
                type={type}
                id={name}
                name={name}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                className={error ? 'input-error' : ''}
            />
            {error && <span className="error-message">{error}</span>}
        </div>
    );
};

export default InputField;

// Add basic styling in global.css or a dedicated file
/*
.input-group {
    margin-bottom: 1rem;
    width: 100%;
}

.input-group label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: bold;
    color: #333;
}

.input-group input {
    width: 100%;
    padding: 0.8rem 1rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 1rem;
    box-sizing: border-box;
    transition: border-color 0.2s ease;
}

.input-group input:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.input-group .input-error {
    border-color: #dc3545;
}

.input-group .input-error:focus {
     box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.25);
}

.error-message {
    color: #dc3545;
    font-size: 0.85rem;
    margin-top: 0.25rem;
    display: block;
}
*/