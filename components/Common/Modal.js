// --- START OF FILE src/components/Common/Modal.js ---
import React from 'react';
import './Modal.css'; // Create corresponding CSS file

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    {title && <h2 className="modal-title">{title}</h2>}
                    <button className="modal-close-button" onClick={onClose} aria-label="Close modal">
                        × {/* Unicode multiplication sign for 'X' */}
                    </button>
                </div>
                <div className="modal-body">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default Modal;
// --- END OF FILE src/components/Common/Modal.js ---