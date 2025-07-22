import React from 'react';
import './ChatMessage.css'; // Styles are here

const TypingIndicator = () => {
    return (
        <div className="message-row bot-row"> {/* Align like a bot message */}
            <div className="message-bubble bot-bubble typing-indicator">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    );
};

export default TypingIndicator;