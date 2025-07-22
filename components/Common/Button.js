import React from 'react';

const Button = ({ children, onClick, type = 'button', disabled = false, className = '', variant = 'primary' }) => {
    const baseStyle = "btn";
    const variantStyle = `btn-${variant}`; // e.g., btn-primary, btn-secondary

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled}
            className={`${baseStyle} ${variantStyle} ${className}`}
        >
            {children}
        </button>
    );
};

export default Button;

// Add basic styling in global.css or a dedicated file
/*
.btn {
    display: inline-block;
    font-weight: 400;
    text-align: center;
    vertical-align: middle;
    user-select: none;
    border: 1px solid transparent;
    padding: 0.6rem 1.2rem;
    font-size: 1rem;
    line-height: 1.5;
    border-radius: 0.25rem;
    transition: color 0.15s ease-in-out, background-color 0.15s ease-in-out, border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
    cursor: pointer;
    width: 100%; // Make buttons full width by default in forms 
    margin-top: 0.5rem; // Add some space above 
}

.btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
}

.btn-primary {
    color: #fff;
    background-color: #007bff;
    border-color: #007bff;
}

.btn-primary:hover {
    background-color: #0056b3;
    border-color: #0056b3;
}

.btn-primary:disabled {
    background-color: #007bff;
    border-color: #007bff;
}

.btn-secondary {
    color: #fff;
    background-color: #6c757d;
    border-color: #6c757d;
}
.btn-secondary:hover {
    background-color: #5a6268;
    border-color: #545b62;
}
// Add more variants as needed (danger, success, link) 
*/