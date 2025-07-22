// --- START OF FILE src/components/Chat/ChatMessage.js (Corrected based on your code) ---
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types'; // Import PropTypes
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FaThumbsUp, FaThumbsDown, FaRegThumbsUp, FaRegThumbsDown, FaCopy, FaCheck, FaFileAlt,
     FaVolumeUp, FaPause, FaSpinner, FaFileWord } from 'react-icons/fa';
import ChatChart from './ChatChart';
import './ChatMessage.css';
import { getMessageTTS, exportMessage } from '../../services/api';

// *** Add showFeedback to the destructured props ***
const ChatMessage = ({ message, onLikeDislike, onCopy, showFeedback }) => {
    // Destructure message properties, including the new isIdFinal flag
    const { id, sender, text, is_liked, isIdFinal, chartData, attachments = [], audioData } = message;
    const isUser = sender === 'user';
    const isBot = sender === 'bot';
    const isError = sender === 'error';

    const [copied, setCopied] = useState(false);

    const [isFetchingAudio, setIsFetchingAudio] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false); // <-- new: Tracks play/pause state
    const audioRef = useRef(null); // <-- new: Holds the Audio object instance
    const audioUrlRef = useRef(null); // <-- new: Holds the blob URL for cleanup
    const [isExporting, setIsExporting] = useState(false);

       // --- EFFECT FOR CLEANUP ---
    useEffect(() => {
        // This function runs when the component is unmounted
        return () => {
            if (audioRef.current) {
                audioRef.current.pause(); // Stop playback
            }
            if (audioUrlRef.current) {
                URL.revokeObjectURL(audioUrlRef.current); // Clean up the blob URL
            }
        };
    }, []); // Empty array ensures this runs only on mount and unmount



    const handleCopyClick = () => {
        // Your existing copy logic is fine
        if (navigator.clipboard && text) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                })
                .catch(err => console.error('Failed to copy text: ', err));
        }
    };

    // Handler for like/dislike clicks
    const handleFeedbackClick = (likedValue) => {
        // Check if handler exists and ID is final
        if (onLikeDislike && isIdFinal) {
            const feedbackToSend = is_liked === likedValue ? null : likedValue;
            onLikeDislike(id, feedbackToSend);
        } else {
            console.warn("Cannot send feedback: Message ID not final or handler missing.");
        }
    };

    // --- UPDATED AUDIO HANDLER WITH PLAY/PAUSE LOGIC ---
    const handleSpeakClick = async () => {
        if (isFetchingAudio) return; // Don't do anything if audio is currently being fetched

        // If audio is already playing, pause it
        if (audioRef.current && isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
            return;
        }

        // If audio is paused, resume it
        if (audioRef.current && !isPlaying) {
            audioRef.current.play();
            setIsPlaying(true);
            return;
        }

        // If no audio object exists, fetch, create, and play it
        setIsFetchingAudio(true);
        try {
            const response = await getMessageTTS(id);
            const audioBlob = response.data;
            const audioUrl = URL.createObjectURL(audioBlob);
            audioUrlRef.current = audioUrl; // Store URL for cleanup

            const audio = new Audio(audioUrl);
            audioRef.current = audio; // Store the Audio object instance

            audio.play();
            setIsPlaying(true);

            audio.onended = () => {
                setIsPlaying(false);
                // The URL is revoked in the main cleanup effect, but can also be done here
            };

        } catch (error) {
            console.error("Error playing TTS audio:", error);
            // Ensure state is reset on error
            audioRef.current = null;
            setIsPlaying(false);
        } finally {
            setIsFetchingAudio(false);
        }
    };

    const handleExportClick = async () => {
        if (isExporting) return; // Prevent multiple clicks
        setIsExporting(true);

        try {
            const response = await exportMessage(id);
            const blob = response.data;
            
            // Create a temporary URL and an anchor element to trigger the download
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `message-${id}.docx`; // Set the filename for download
            
            document.body.appendChild(a);
            a.click(); // Programmatically click the link to start download

            // Clean up the temporary URL and element
            window.URL.revokeObjectURL(url);
            a.remove();

        } catch (error) {
            console.error("Error exporting message:", error);
            alert(`Export failed: ${error.message}`); // Show error to the user
        } finally {
            setIsExporting(false); // Reset the loading state
        }
    };


    // Determine if feedback buttons should be enabled (used for the disabled attribute)
    // This depends only on the ID being final now, as rendering is controlled by showFeedback
    const feedbackEnabled = isIdFinal;

    return (
        <div className={`message-row ${isUser ? 'user-row' : isBot ? 'bot-row' : 'error-row'}`}>
            <div className={`message-bubble ${isUser ? 'user-bubble' : isBot ? 'bot-bubble' : 'error-bubble'}`}>
                {/* Message Content - Your logic is fine */}
                {isBot && text ? (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
                ) : (
                    <p>{text || (isBot && !isIdFinal ? '...' : '')}</p> // Show '...' if bot, no text, and not final
                )}

                {chartData && (
                    <div className="chat-chart-wrapper">
                        <ChatChart data={chartData} />
                    </div>
                )}

                {attachments.map((att, idx) => (
                    att.fileType && att.fileType.startsWith('image/') ? (
                        <img key={idx} className="message-image" src={`data:${att.fileType};base64,${att.fileData}`} alt={att.fileName || 'attachment'} />
                    ) : (
                        <a key={idx} className="file-attachment" href={`data:application/octet-stream;base64,${att.fileData}`} download={att.fileName || 'file'}>
                            <FaFileAlt /> {att.fileName}
                        </a>
                    )
                ))}
                {audioData && (
                    <audio controls className="audio-attachment" src={`data:audio/wav;base64,${audioData}`}></audio>
                )}

                {/* Action Buttons Container - Show for Bot or Error messages with text */}
                {/* Combine conditions for showing the actions container */}
                {(isBot || isError) && text && (
                    <div className="message-actions">

                        {/* *** Conditionally render feedback buttons based on showFeedback prop *** */}
                        {isBot && showFeedback && ( // Only show for bot messages AND when showFeedback is true
                            <> {/* Fragment to group feedback buttons */}
                                <button
                                    onClick={() => handleFeedbackClick(true)}
                                    className={`action-button like-button ${is_liked === true ? 'active' : ''}`}
                                    aria-label="Like message"
                                    title={feedbackEnabled ? "پسندیدم" : "در حال پردازش..."}
                                    // Disable button if feedback is not enabled (ID not final)
                                    disabled={!feedbackEnabled}
                                >
                                    {is_liked === true ? <FaThumbsUp /> : <FaRegThumbsUp />}
                                </button>
                                <button
                                    onClick={() => handleFeedbackClick(false)}
                                    className={`action-button dislike-button ${is_liked === false ? 'active' : ''}`}
                                    aria-label="Dislike message"
                                    title={feedbackEnabled ? "نپسندیدم" : "در حال پردازش..."}
                                    // Disable button if feedback is not enabled (ID not final)
                                    disabled={!feedbackEnabled}
                                >
                                    {is_liked === false ? <FaThumbsDown /> : <FaRegThumbsDown />}
                                </button>
                            </>
                        )}

                        {/* Copy Button - Always show for Bot/Error if text exists */}
                        <button
                            onClick={handleCopyClick}
                            className="action-button copy-button"
                            aria-label={isBot ? "Copy message text" : "Copy error text"}
                            title={copied ? "کپی شد!" : (isBot ? "کپی متن" : "کپی متن خطا")}
                        >
                            {copied ? <FaCheck /> : <FaCopy />}
                        </button>

                        {isBot && (
                           <button
                                onClick={handleSpeakClick}
                                className="action-button speak-button"
                                aria-label="Read message aloud"
                                title={isFetchingAudio ? "در حال بارگذاری..." : "خواندن متن"}
                                disabled={isFetchingAudio}
                            >
                                {isFetchingAudio ? <FaSpinner className="spin-animation" /> : <FaVolumeUp />}
                            </button>
                        )}

                        {isBot && (
                            <button
                                    onClick={handleExportClick}
                                    className="action-button export-button"
                                    aria-label="Export message to Word"
                                    title={isExporting ? "در حال استخراج..." : "خروجی Word"}
                                    disabled={isExporting}
                                >
                                    {isExporting ? <FaSpinner className="spin-animation" /> : <FaFileWord />}
                            </button>
                        )}

                    </div>
                )}
                 {/* Note: Removed the separate Error copy button block as it's now included above */}
            </div>
        </div>
    );
};

// *** Add PropTypes for the new prop and existing ones ***
ChatMessage.propTypes = {
    message: PropTypes.shape({
        id: PropTypes.string.isRequired,
        sender: PropTypes.oneOf(['user', 'bot', 'error']).isRequired,
        text: PropTypes.string.isRequired,
        is_liked: PropTypes.bool, // Can be null, true, or false
        isIdFinal: PropTypes.bool.isRequired,
        chartData: PropTypes.object,
        attachments: PropTypes.arrayOf(
            PropTypes.shape({
                fileData: PropTypes.string.isRequired,
                fileType: PropTypes.string,
                fileName: PropTypes.string,
            })
        ),
        audioData: PropTypes.string,
    }).isRequired,
    onLikeDislike: PropTypes.func, // Callback for feedback
    onCopy: PropTypes.func, // Callback for copy (though handled internally here)
    showFeedback: PropTypes.bool.isRequired, // Flag to control rendering of feedback buttons
};

export default ChatMessage;
// --- END OF FILE src/components/Chat/ChatMessage.js (Corrected based on your code) ---