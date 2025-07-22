import React, { useState, useRef, useEffect } from 'react';
import Button from '../Common/Button';
import { FaPaperclip, FaMicrophone, FaStop } from 'react-icons/fa';
import './ChatInput.css';

const ChatInput = ({ onSendMessage, isLoading }) => {
    const [message, setMessage] = useState('');
    const textareaRef = useRef(null);
    const fileInputRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);
    const [fileAttachment, setFileAttachment] = useState(null); // {base64, type, name}
    const [audioAttachment, setAudioAttachment] = useState(null); // {base64}

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            const scrollHeight = textarea.scrollHeight;
            // Consider max-height from CSS
            const maxHeight = 150; // Make sure this matches CSS
            textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
        }
    }, [message]);


    const handleInputChange = (e) => {
        setMessage(e.target.value);
    };

    const handleSend = () => {
        if ((message.trim() || fileAttachment || audioAttachment) && !isLoading) {
            onSendMessage(message.trim(), {
                fileData: fileAttachment?.base64 || null,
                fileType: fileAttachment?.type || '',
                fileName: fileAttachment?.name || '',
                audioData: audioAttachment?.base64 || null,
            });
            setMessage('');
            setFileAttachment(null);
            setAudioAttachment(null);
            if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'; // Reset height
            }
        }
    };

const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
    }
};

const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file || isLoading) return;

    const isImage = file.type.startsWith('image/');
    const isPdf = file.type === 'application/pdf';
    const isAudio = file.type === 'audio/wav' || file.type === 'audio/wave';

    if (!(isImage || isPdf || isAudio)) {
        alert('نوع فایل پشتیبانی نمی‌شود.');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
        const base64 = reader.result.split(',')[1];
        if (isAudio) {
            setAudioAttachment({ base64 });
        } else {
            setFileAttachment({ base64, type: file.type, name: file.name });
        }
        e.target.value = '';
    };
    reader.readAsDataURL(file);
};

const startRecording = async () => {
    if (isRecording || isLoading) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        const chunks = [];
        mediaRecorder.ondataavailable = (ev) => {
            if (ev.data.size > 0) chunks.push(ev.data);
        };
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'audio/wav' });
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                setAudioAttachment({ base64 });
            };
            reader.readAsDataURL(blob);
            stream.getTracks().forEach((t) => t.stop());
            setIsRecording(false);
        };
        mediaRecorder.start();
        setIsRecording(true);
    } catch (err) {
        console.error('Failed to start recording', err);
    }
};

const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
    }
};

    return (
        <div className="chat-input-area">
            <textarea
                ref={textareaRef}
                value={message}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={isLoading ? "در حال دریافت پاسخ..." : "پیام خود را اینجا بنویسید..."}
                rows="1"
                className="chat-textarea"
                disabled={isLoading}
                dir="rtl"
            />

            {fileAttachment && (
                <div className="attachment-preview">
                    {fileAttachment.type.startsWith('image/') ? (
                        <img src={`data:${fileAttachment.type};base64,${fileAttachment.base64}`} alt={fileAttachment.name} />
                    ) : (
                        <span className="file-name">{fileAttachment.name}</span>
                    )}
                    <button className="remove-attachment" onClick={() => setFileAttachment(null)}>×</button>
                </div>
            )}
            {audioAttachment && (
                <div className="attachment-preview">
                    <audio controls src={`data:audio/wav;base64,${audioAttachment.base64}`} />
                    <button className="remove-attachment" onClick={() => setAudioAttachment(null)}>×</button>
                </div>
            )}
            <div className="chat-input-buttons">
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                accept="image/*,application/pdf,audio/wav"
                onChange={handleFileChange}
            />
            <Button
                onClick={() => fileInputRef.current && fileInputRef.current.click()}
                disabled={isLoading}
                className="upload-button icon-button"
                variant="secondary"
            >
                <FaPaperclip />
            </Button>

            <Button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading}
                className="record-button icon-button"
                variant="secondary"
            >
                {isRecording ? <FaStop /> : <FaMicrophone />}
            </Button>

            <Button
                onClick={handleSend}
                disabled={isLoading || (!message.trim() && !fileAttachment && !audioAttachment)}
                className="send-button"
            >
                {isLoading ? '...' : 'ارسال'}
            </Button>
            </div>
        </div>
    );
};

export default ChatInput;