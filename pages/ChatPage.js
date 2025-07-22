// --- START OF FILE src/pages/ChatPage.js (Restored & Feedback Fixed) ---

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import {
    getChatbotInfo,
    createChatSession,
    getChatMessages,
    streamChatMessage,
    sendMessageFeedback,
    getFileList,
    uploadFile,
    deleteFile,
    getUserInfo
} from '../services/api';
import ChatMessage from '../components/Chat/ChatMessage'; // Assuming path is correct
import ChatInput from '../components/Chat/ChatInput';
import TypingIndicator from '../components/Chat/TypingIndicator';
import Button from '../components/Common/Button';
import Modal from '../components/Common/Modal';
import { FaInfoCircle, FaPlus, FaListUl, FaFileAlt, FaTrash, FaDownload, FaBars, FaGoogleDrive } from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';
import './ChatPage.css';

const STREAM_TIMEOUT_MS = 120000; // 120 seconds timeout for stream inactivity

const ChatPage = () => {
    // --- State Variables ---
    const [messages, setMessages] = useState([]); // {id, sender, text, is_liked, isIdFinal, chartData}
    const [isLoading, setIsLoading] = useState(false); // Waiting for stream response chunk
    const [isInitializing, setIsInitializing] = useState(true); // Initial session load/creation
    const [error, setError] = useState(''); // General errors
    const [chatInfo, setChatInfo] = useState(null); // Chatbot metadata
    const [currentSessionId, setCurrentSessionId] = useState(null); // Active session ID
    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false); // About modal visibility
    const [selectedSections, setSelectedSections] = useState([]); // For selected sections
    const [isGoogleDriveInputVisible, setIsGoogleDriveInputVisible] = useState(false);
    const [googleDriveUrl, setGoogleDriveUrl] = useState('');

    // --- New State for File Management Modal ---
    const [isFileModalOpen, setIsFileModalOpen] = useState(false);
    const [files, setFiles] = useState([]); // To store the list of files
    const [isFilesLoading, setIsFilesLoading] = useState(false); // Loading state for files
    const [selectedUploadSection, setSelectedUploadSection] = useState(null); // State for the selected section for upload
    const [fileModalError, setFileModalError] = useState(''); // State for errors within the file modal

    // --- Header Menu and User Info ---
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [username, setUsername] = useState('');

    // --- Hooks ---
    const { logout } = useAuth();
    const navigate = useNavigate();
    const { t } = useLanguage();
    const { sessionId: sessionIdFromUrl } = useParams();
    const messagesEndRef = useRef(null);
    const abortControllerRef = useRef(null);
    const timeoutRef = useRef(null);
    const realIdForCurrentStreamRef = useRef(null); // Stores the real UUID when received

    // --- Utility Functions ---
    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        });
    };

    const getSelectedSectionsLabel = () => {
        if (chatInfo?.sections && selectedSections.length === chatInfo.sections.length) {
            return t('know_all');
        }
        return selectedSections.join(', ');
    };

    const handleGoogleDriveUpload = async () => {
        if (!googleDriveUrl.trim()) {
            setFileModalError("لطفاً لینک گوگل درایو را وارد کنید.");
            return;
        }

        if (chatInfo?.sections && chatInfo.sections.length > 0 && !selectedUploadSection) {
            setFileModalError("لطفاً بخشی را برای بارگذاری فایل انتخاب کنید.");
            return;
        }

        setFileModalError(''); // Clear previous errors
        console.log(`Attempting to upload from Google Drive URL: ${googleDriveUrl} to section: ${selectedUploadSection}`);

        const formData = new FormData();
        // IMPORTANT: The API expects the field 'google_drive_url'
        formData.append('google_drive_url', googleDriveUrl);

        // Append the selected section if it exists
        if (selectedUploadSection) 
        {
            formData.append('section', selectedUploadSection);
        }

        try {
            // Use the existing uploadFile API endpoint
            const response = await uploadFile(formData);
            console.log("Google Drive upload initiated successfully:", response.data);

            // After successful upload, refresh the file list and reset inputs
            fetchFiles();
            setSelectedUploadSection(null); // Reset section dropdown
            setGoogleDriveUrl(''); // Clear URL input
            setIsGoogleDriveInputVisible(false); // Hide the input form

        } catch (err) {
            console.error("Google Drive upload failed:", err);
            const errorMessage = err.response?.data?.detail || err.message || "بارگذاری از گوگل درایو ناموفق بود.";
            setFileModalError(errorMessage);
        }
    };

    // Effect to scroll to bottom on new messages
    useEffect(() => {
        if (messages.length > 0) {
             scrollToBottom();
        }
    }, [messages]);

// --- Effect to load selected sections from localStorage on mount ---
    // And to initialize/validate when chatInfo (with available sections) is loaded.
    useEffect(() => {
        const storedSectionsText = localStorage.getItem('selectedChatSections');
        let initialSections = [];

        if (storedSectionsText) {
            try {
                const parsed = JSON.parse(storedSectionsText);
                if (Array.isArray(parsed)) {
                    initialSections = parsed;
                }
            } catch (e) {
                console.error("Failed to parse stored sections on mount:", e);
                // localStorage.removeItem('selectedChatSections'); // Optionally clear invalid
            }
        }

        if (chatInfo?.sections && chatInfo.sections.length > 0) {
            const availableSections = chatInfo.sections;
            if (!storedSectionsText) {
                // No sections in localStorage, chatInfo is available: default to all sections selected
                initialSections = [...availableSections];
            } else {
                // Sections were in localStorage, validate them against available sections
                initialSections = initialSections.filter(s => availableSections.includes(s));
            }
            // Update state and localStorage if it's different from initial load or needs defaulting
            setSelectedSections(initialSections);
            // The effect below will save it if it changed
        } else if (storedSectionsText) {
             // chatInfo not yet loaded or has no sections, but LS has data. Use it for now.
             setSelectedSections(initialSections);
        } else {
             // No chatInfo.sections, no LS data. Default to empty.
             setSelectedSections([]);
        }

    }, [chatInfo]); // Re-run when chatInfo is fetched/updated

      // --- Effect to save selected sections to localStorage whenever they change ---
      useEffect(() => {
        // Only save if selectedSections is not the initial empty array before chatInfo might have defaulted it
        // Or if chatInfo is present (meaning initialization logic has likely run)
        if (selectedSections.length > 0 || (chatInfo?.sections && chatInfo.sections.length >= 0) ) {
             localStorage.setItem('selectedChatSections', JSON.stringify(selectedSections));
        }
    }, [selectedSections, chatInfo]);
    

    // --- Effect to fetch Chatbot Info (runs once) ---
    useEffect(() => {
        let isMounted = true;
        console.log("Fetching chat info...");
        getChatbotInfo()
            .then(response => {
                if (isMounted) {
                    console.log("Chat info fetched:", response.data);
                    setChatInfo(response.data);
                }
            })
            .catch(err => {
                console.error("Failed to fetch chat info:", err);
                // setError("اطلاعات چت‌بات بارگذاری نشد."); // Optional non-critical error
            });
        return () => { isMounted = false; };
    }, []);

    // --- Effect to fetch user information (runs once) ---
    useEffect(() => {
        getUserInfo()
            .then(res => {
                if (res.data?.username) {
                    setUsername(res.data.username);
                } else if (res.data?.email) {
                    setUsername(res.data.email);
                }
            })
            .catch(err => {
                console.error('Failed to fetch user info:', err);
            });
    }, []);

    // --- Effect for Session Initialization, Loading, and Welcome Message ---
    useEffect(() => {
        let isMounted = true;
        console.log(`[Session Effect] Triggered for URL ID: ${sessionIdFromUrl}`);

        // Reset states for the new session ID from URL or 'new'
        setIsInitializing(true);
        setError('');
        setMessages([]); // Clear messages explicitly at the start of this effect
        setCurrentSessionId(null); // Clear previous session ID

        // --- Define the async function to handle session logic ---
        const initializeOrLoadChat = async (sid) => {
            let sessionCreated = false; // Flag to know if we just created this session
            let loadedSessionId = null; // Store the ID obtained

            try {
                if (sid && sid !== 'new') {
                    // --- Load Existing Session ---
                    console.log(`[Session Effect] Attempting to load existing session: ${sid}`);
                    const historyResponse = await getChatMessages(sid);
                    if (isMounted) {
                        const formattedMessages = historyResponse.data.map(msg => {
                            // Initialize variables to hold parsed content
                            let textContent = '';
                            let attachments = [];
                            let audioData = null;
                            // Process the new 'content' array format
                            if (Array.isArray(msg.json_content)) {
                                msg.json_content.forEach(item => {
                                    switch (item.type) {
                                        case 'text':
                                            // Append text content, adding a newline if text already exists
                                            textContent += (textContent ? '\n' : '') + item.text;
                                            break;
                                        case 'image_url': {
                                            const urlParts = item.image_url.url.split(";base64,");
                                            if (urlParts.length === 2) {
                                                const mimeTypePart = urlParts[0].split("data:");
                                                if (mimeTypePart.length === 2) {
                                                    attachments.push({ fileData: urlParts[1], fileType: mimeTypePart[1], fileName: item.file_name || "image" });
                                                }
                                            }
                                            break; }
                                        case 'input_audio':
                                            if (item.input_audio && item.input_audio.data) {
                                                audioData = item.input_audio.data;
                                            }
                                            break;
                                        default:
                                            // You can log unhandled types for debugging
                                            console.warn("Unhandled message content type:", item.type);
                                            break;
                                    }
                                });
                            } else if (typeof msg.content === 'string') {
                                // Add a fallback for the old, simple text format to avoid breaking older messages
                                textContent = msg.content;
                            }
                        
                            // Return the flat message object that the ChatMessage component expects
                            return {
                                id: msg.id,
                                sender: msg.sender_type,
                                text: textContent,
                                is_liked: msg.is_liked,
                                isIdFinal: true, // Messages from history are always final
                                chartData: msg.chart_data || null,
                                // Add the newly parsed fields
                                attachments,
                                audioData,
                            };
                        });
                        setMessages(formattedMessages); // Set loaded messages
                        loadedSessionId = sid; // Store the valid ID
                        console.log(`[Session Effect] Session ${sid} loaded with ${formattedMessages.length} messages.`);
                    }
                } else {
                    // --- Create New Session ---
                    console.log("[Session Effect] Creating a new chat session via API...");
                    const sessionResponse = await createChatSession();
                    const newSessionId = sessionResponse.data.id;
                    if (isMounted) {
                        console.log(`[Session Effect] New session created with ID: ${newSessionId}`);
                        loadedSessionId = newSessionId; // Store the new ID
                        sessionCreated = true; // Mark that we just created it
                        console.log(`[Session Effect] Navigating to /chat/${newSessionId}`);
                        navigate(`/chat/${newSessionId}`, { replace: true });
                        // IMPORTANT: Navigation causes this effect to re-run with the new ID.
                    }
                }

                // --- Post-Load/Create Logic ---
                if (isMounted && loadedSessionId) {
                    setCurrentSessionId(loadedSessionId); // Set the confirmed session ID state

                    setMessages(prevMessages => {
                        if (prevMessages.length === 0) {
                             console.log(`[Session Effect] Adding welcome message for session ${loadedSessionId}.`);
                             return [{
                                id: `initial-bot-${Date.now()}`, // Keep unique initial ID
                                sender: 'bot',
                                text: "سلام! چطور می‌توانم امروز به شما کمک کنم؟",
                                is_liked: null,
                                isIdFinal: true // Mark as final immediately, ID identifies it
                            }];
                        }
                        return prevMessages;
                    });
                }

            } catch (err) {
                console.error("[Session Effect] Failed to initialize or load chat:", err);
                let errorMsg = "راه اندازی یا بارگذاری چت ناموفق بود.";
                if (err.response?.status === 404) {
                    errorMsg = "جلسه چت یافت نشد یا به شما تعلق ندارد.";
                    if (isMounted && !sessionCreated) { // Avoid redirect loop if creation failed
                         console.log("[Session Effect] Session not found, redirecting to /chat/new");
                         navigate('/chat/new', { replace: true });
                    }
                } else if (err.response?.data?.error) {
                    errorMsg = err.response.data.error;
                } else if (err.message) {
                    errorMsg = err.message;
                }
                if (isMounted) {
                    setError(errorMsg + " لطفاً صفحه را رفرش کنید یا یک چت جدید شروع کنید.");
                    setMessages([]); // Clear potentially partial messages on error
                    setCurrentSessionId(null);
                }
            } finally {
                if (isMounted) {
                    // Ensure the initialization loading state is turned off,
                    // only if we are not about to navigate (which triggers a re-run anyway)
                    if (!sessionCreated) {
                        setIsInitializing(false);
                        console.log("[Session Effect] Initialization finished.");
                    } else {
                        console.log("[Session Effect] Initialization pending navigation/re-run.");
                    }
                }
            }
        };
        // --- End of async function definition ---

        initializeOrLoadChat(sessionIdFromUrl); // Execute the session handling logic

        // Cleanup function for this effect
        return () => {
            isMounted = false;
            if (abortControllerRef.current) {
                abortControllerRef.current.abort("Component unmounted or session changed");
            }
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            console.log(`[Session Effect] Cleanup function ran for session effect: ${sessionIdFromUrl}`);
        };
    }, [sessionIdFromUrl, navigate]); // Effect Dependencies

    // --- New Function to Fetch Files ---
    const fetchFiles = async () => {
        setIsFilesLoading(true);
        setError(''); // Clear previous errors
        try {
            const response = await getFileList(); // Call the API function
            if (response.data && Array.isArray(response.data)) {
                setFiles(response.data);
                console.log("Files fetched:", response.data);
            } else {
                // Handle unexpected response format
                setFiles([]);
                console.error("API returned unexpected format for file list:", response.data);
                setError("فرمت لیست فایل‌ها از سرور غیرمنتظره بود.");
            }
        } catch (err) {
            console.error("Failed to fetch files:", err);
            setError("بارگذاری لیست فایل‌ها ناموفق بود.");
        } finally {
            setIsFilesLoading(false);
            console.log("Files fetched:", files);
        }
    };

    // --- Effect to Fetch Files when Modal Opens ---
    useEffect(() => {
        if (isFileModalOpen) {
            fetchFiles();
        }
    }, [isFileModalOpen]); // Dependency array includes isFileModalOpen

    // --- Effect to auto-select the upload section if only one is available ---
    useEffect(() => {
    // Check if there is exactly one section available in the chat context.
    if (selectedSections && selectedSections.length === 1) {
        // If so, automatically set it as the section for new uploads.
        // This prevents the user from having to select it when there's no choice.
        setSelectedUploadSection(selectedSections[0]);
    }
}, [selectedSections]); // Re-run this logic whenever the selectedSections change

     // --- Placeholder File Handling Functions ---
     const handleDeleteFile = async (fileId) => {
         console.log(`Attempting to delete file with ID: ${fileId}`);
         // TODO: Implement API call for deletion and update state
         // Need confirmation dialog?
         // Need error handling?
         try {
            await deleteFile(fileId);
            // If successful, remove the file from the state
            setFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));
            console.log(`File ${fileId} deleted successfully.`);
         } catch (err) {
            console.error(`Failed to delete file ${fileId}:`, err);
            setError("حذف فایل ناموفق بود.");
         }
     };

     const handleFileUpload = async (event) => {
         const file = event.target.files[0];
         if (!file) {
             // Clear modal error if no file is selected (e.g., user cancels file picker)
             setFileModalError('');
             return;
         }

         setFileModalError(''); // Clear previous modal errors on new upload attempt

         if (chatInfo?.sections && chatInfo.sections.length > 0 && !selectedUploadSection) {
            setFileModalError("لطفاً بخشی را برای بارگذاری فایل انتخاب کنید.");
            event.target.value = ''; // Clear the file input
            return;
         }

         console.log(`Attempting to upload file: ${file.name} to section: ${selectedUploadSection}`);
          // Note: We don't immediately add the file to the list with PENDING status here.
          // Instead, we'll refetch the list after successful upload,
          // which will get the actual status from the backend.

         const formData = new FormData();
         formData.append('file', file);

          // Append the selected section to the form data
         if (selectedUploadSection) 
         {
            formData.append('section', selectedUploadSection);
         }


          try {
             // Assuming uploadFile takes formData and maybe a section/session ID
             const response = await uploadFile(formData); // Adjust args as per your api.js
             console.log("File upload successful:", response.data);

             // After successful upload, refresh the file list
             fetchFiles();

             // Reset selected section and clear file input
             setSelectedUploadSection(null);
             event.target.value = '';

          } catch (err) {
             console.error("File upload failed:", err);
             // Use the error message from the API response if available, otherwise a generic one
             const errorMessage = err.response?.data?.detail || err.message || "بارگذاری فایل ناموفق بود.";
             setFileModalError(errorMessage);
              event.target.value = ''; // Clear the file input on error too
           }
     };

    // --- Mapping for Processing Status Translation ---
    const translateProcessingStatus = (status) => {
        switch (status) {
            case 'PENDING': return 'در انتظار';
            case 'PROCESSING': return 'در حال پردازش';
            case 'COMPLETED': return 'کامل شده';
            case 'FAILED': return 'خطا';
            case 'DELETING': return 'در حال حذف';
            default: return status; // Return original if unknown
        }
    };

    // --- Timeout Handler ---
    const handleTimeout = useCallback((botMessageId) => {
        console.error(`Timeout: No response chunk received for ${STREAM_TIMEOUT_MS}ms for message ID ${botMessageId}`);
        setError("پاسخی از سرور دریافت نشد (تایم اوت). لطفاً دوباره تلاش کنید.");
        setMessages(prev => prev.map(msg =>
            msg.id === botMessageId ? { ...msg, id: `error-${Date.now()}`, sender: 'error', text: 'خطا: زمان انتظار برای دریافت پاسخ به پایان رسید.', is_liked: null, isIdFinal: true } : msg
        ));
        setIsLoading(false);
        if (abortControllerRef.current) {
            abortControllerRef.current.abort("Timeout");
            abortControllerRef.current = null;
        }
        timeoutRef.current = null;
        realIdForCurrentStreamRef.current = null; // Clear ref on timeout
    }, []); // Keep dependencies minimal for useCallback if they aren't used inside

    // --- Send Message Handler ---
    const handleSendMessage = useCallback(async (query, options = {}) => {
        const { attachments = [], audioData = null } = options;
        if (!currentSessionId) {
            setError("خطا: شناسه جلسه چت نامعتبر است. لطفاً یک چت جدید شروع کنید.");
            return;
        }
        if (isLoading || isInitializing) {
            console.warn("Cannot send message while loading or initializing.");
            return;
        }

        setError('');
        let userText = query;
        if (!userText) {
            if (attachments.length > 0) {
                const names = attachments.map(f => f.name || f.fileName || 'file').join(', ');
                userText = `ارسال فایل: ${names}`;
            } else if (audioData) {
                userText = 'پیام صوتی';
            }
        }
        const newUserMessage = {
            id: `user-${Date.now()}`,
            sender: 'user',
            text: userText,
            isIdFinal: true,
            attachments,
            audioData,
        };
        const botMessageId = `bot-${Date.now()}`; // Temporary ID
        const botPlaceholderMessage = { id: botMessageId, sender: 'bot', text: '', is_liked: null, isIdFinal: false, chartData: null };

        setMessages(prevMessages => [...prevMessages, newUserMessage, botPlaceholderMessage]);
        setIsLoading(true);
        realIdForCurrentStreamRef.current = null; // Reset real ID ref

        if (abortControllerRef.current) {
            console.log("Aborting previous stream request...");
            abortControllerRef.current.abort("New request started");
        }
        if (timeoutRef.current) { clearTimeout(timeoutRef.current); }

        abortControllerRef.current = new AbortController();
        const signal = abortControllerRef.current.signal;
        timeoutRef.current = setTimeout(() => handleTimeout(botMessageId), STREAM_TIMEOUT_MS);

        try {
            const reader = await streamChatMessage(currentSessionId, query, selectedSections, signal, attachments, audioData);
            const decoder = new TextDecoder();
            let buffer = '';
            let accumulatedBotText = '';

            const processStream = async () => {
                 try {
                    while (true) {
                         if (signal.aborted) {
                             console.log("Stream processing aborted by signal:", signal.reason);
                             if (isLoading) setIsLoading(false);
                             realIdForCurrentStreamRef.current = null; // Clear ref on abort
                             break;
                         }

                        const { done, value } = await reader.read();

                        // --- Stream Finished ---
                        if (done) {
                            console.log("Stream finished.");
                            if (timeoutRef.current) clearTimeout(timeoutRef.current);
                            if (buffer.length > 0) processBuffer(); // Process any remaining buffer

                            // *** FIX: Only mark as final IF a real ID was received ***
                            const finalRealId = realIdForCurrentStreamRef.current; // Get the real ID (if any)
                            const messageIsTrulyFinal = !!finalRealId; // True only if we got a real ID

                            setMessages(prev => prev.map(msg =>
                                msg.id === botMessageId // Find using the consistent temporary ID
                                ? {
                                    ...msg,
                                    // Update ID to real one if available, otherwise keep temporary
                                    id: finalRealId || botMessageId,
                                    text: accumulatedBotText, // Ensure final text is set
                                    // *** Set isIdFinal based on whether we received a real ID ***
                                    isIdFinal: messageIsTrulyFinal
                                  }
                                : msg
                            ));
                            console.log(`Finalized message state for temp ID ${botMessageId}. Final ID: ${finalRealId || botMessageId}, Is truly final for feedback: ${messageIsTrulyFinal}`);

                            setIsLoading(false); // Stop loading on clean finish
                            realIdForCurrentStreamRef.current = null; // Clear ref
                            break; // Exit loop
                        }

                        // --- Received Chunk ---
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                        timeoutRef.current = setTimeout(() => handleTimeout(botMessageId), STREAM_TIMEOUT_MS);

                        buffer += decoder.decode(value, { stream: true });
                        processBuffer(); // Process potential complete messages in buffer
                    }
                 } catch (streamError) {
                     if (streamError.name === 'AbortError') {
                         console.log('Stream reading aborted.');
                          if (isLoading) setIsLoading(false);
                     } else {
                         console.error("Error reading stream:", streamError);
                         setError("خطایی هنگام دریافت پاسخ رخ داد.");
                         setMessages(prev => prev.map(msg =>
                              msg.id === botMessageId ? { ...msg, id: `error-${Date.now()}`, sender: 'error', text: 'خطا در دریافت پاسخ.', is_liked: null, isIdFinal: true } : msg // Error messages are final
                          ));
                          if (isLoading) setIsLoading(false); // Stop loading on stream read error
                     }
                     if (timeoutRef.current) clearTimeout(timeoutRef.current);
                     realIdForCurrentStreamRef.current = null; // Clear ref on error/abort
                 } finally {
                     console.log("Stream processing finally block.");
                     // Final catch-all to ensure loading is off and refs are cleared
                     if (isLoading) setIsLoading(false);
                     if (timeoutRef.current) clearTimeout(timeoutRef.current);
                     abortControllerRef.current = null;
                     timeoutRef.current = null;
                     // Don't clear realIdRef here, it's needed just before this in 'done'
                 }

                // --- Inner function to process buffered SSE messages ---
                function processBuffer() {
                    let boundary = buffer.indexOf('\n\n');
                    while (boundary !== -1) {
                        const message = buffer.substring(0, boundary);
                        buffer = buffer.substring(boundary + 2);

                        if (message.startsWith('data: ')) {
                            const jsonString = message.substring(6);
                            try {
                                const data = JSON.parse(jsonString);

                                // --- Process Text Chunk ---
                                if (data.type === 'text' && typeof data.content === 'string') {
                                    accumulatedBotText += data.content;
                                    // Update text using ONLY the temporary botMessageId
                                    setMessages(prev => prev.map(msg =>
                                        msg.id === botMessageId ? { ...msg, text: accumulatedBotText } : msg
                                    ));
                                }
                                // --- Process Real ID ---
                                else if (data.type === 'llm_message_id' && data.id) {
                                    console.log(`Received real message ID: ${data.id} for temp ID: ${botMessageId}`);
                                    // Store the real ID in the ref, DO NOT update state's ID yet
                                    realIdForCurrentStreamRef.current = data.id;
                                }
                                // --- Process Chart Data ---
                                else if (data.type === 'chart_data' && data.data) {
                                    const chartPayload = data.data;
                                    if (chartPayload.suggested_text_response) {
                                        if (accumulatedBotText) {
                                            accumulatedBotText += '\n' + chartPayload.suggested_text_response;
                                        } else {
                                            accumulatedBotText = chartPayload.suggested_text_response;
                                        }
                                    }
                                    setMessages(prev => prev.map(msg =>
                                        msg.id === botMessageId ? { ...msg, text: accumulatedBotText, chartData: chartPayload } : msg
                                    ));
                                }
                                // --- Process Error Event ---
                                else if (data.type === 'error' && data.content) {
                                    console.error("Error received in stream data:", data.content);
                                    setError(`خطا در پاسخ سرور: ${data.content}`);
                                    setMessages(prev => prev.map(msg =>
                                        msg.id === botMessageId ? { ...msg, id: `error-${Date.now()}`, sender: 'error', text: `خطا: ${data.content}`, is_liked: null, isIdFinal: true } : msg // Error messages are final
                                    ));
                                    if (abortControllerRef.current) abortControllerRef.current.abort("Stream error received");
                                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                                    setIsLoading(false); // Stop loading on stream error event
                                    realIdForCurrentStreamRef.current = null; // Clear ref
                                    // break; // Consider stopping buffer processing on error
                                } else {
                                    console.log("Received unhandled SSE event type:", data.type, data);
                                }
                            } catch (e) {
                                console.error("Failed to parse SSE JSON data:", jsonString, e);
                                // Consider how to handle parse errors - update UI?
                                setIsLoading(false); // Stop loading on parse error
                            }
                        } else if (message.trim()) {
                             console.warn("Received SSE line without 'data: ' prefix:", message);
                        }
                        boundary = buffer.indexOf('\n\n');
                    } // End while boundary loop
                } // --- End of processBuffer ---
            }; // --- End of processStream ---

            processStream(); // Start processing the stream data

        } catch (err) {
             // Handle errors occurring *before* the stream even starts
            if (err.name !== 'AbortError') {
                console.error("Failed to send message or initiate stream:", err);
                const errorMessage = err.message || "ارسال پیام ناموفق بود.";
                setError(errorMessage);
                 setMessages(prev => prev.map(msg =>
                      msg.id === botMessageId ? { ...msg, id: `error-${Date.now()}`, sender: 'error', text: `خطا: ${errorMessage}`, is_liked: null, isIdFinal: true } : msg // Error messages are final
                  ));
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                setIsLoading(false);
                abortControllerRef.current = null;
                timeoutRef.current = null;
                realIdForCurrentStreamRef.current = null; // Clear ref
            } else {
                 console.log("Stream initiation aborted:", err.message);
                 if (isLoading) setIsLoading(false); // Ensure loading stops if fetch aborted
                 realIdForCurrentStreamRef.current = null; // Clear ref
            }
        }
    }, [currentSessionId, handleTimeout, isLoading, isInitializing, selectedSections]); // Dependencies for send message

    // --- New Chat Handler ---
    const handleNewChat = () => {
        if (isLoading || isInitializing) {
             console.warn("Cannot start new chat while loading or initializing.");
             return;
        }
        console.log("Navigating to start a new chat.");
        setMessages([]);
        setCurrentSessionId(null);
        setError('');
        // Abort any ongoing stream before navigating
        if (abortControllerRef.current) {
           abortControllerRef.current.abort("Starting new chat");
           abortControllerRef.current = null;
        }
        if (timeoutRef.current) {
           clearTimeout(timeoutRef.current);
           timeoutRef.current = null;
        }
        realIdForCurrentStreamRef.current = null; // Clear ref
        navigate('/chat/new'); // Let the useEffect handle the creation logic
    };

    // --- Feedback Handler (Like/Dislike) ---
    const handleFeedback = useCallback(async (messageId, isLikedValue) => {
        console.log(`handleFeedback called for ID: ${messageId}, Value: ${isLikedValue}`);
        const currentMessageIndex = messages.findIndex(msg => msg.id === messageId);
        if (currentMessageIndex === -1) {
            console.warn(`Feedback ignored: Message ${messageId} not found in state.`);
            return;
        }
        const currentMessage = messages[currentMessageIndex];

        // --- Refined Checks ---
        // 1. Must be marked as final (which now implies a real ID was received)
        if (!currentMessage.isIdFinal) {
            console.warn(`Feedback ignored: Message ${messageId} is not final (no real ID received or still streaming).`);
            // Give user feedback - the button should be disabled, but this is a fallback.
             setError("لطفاً منتظر بمانید تا پاسخ کامل شود و سپس بازخورد دهید.");
             setTimeout(() => setError(prev => prev === "لطفاً منتظر بمانید تا پاسخ کامل شود و سپس بازخورد دهید." ? "" : prev), 3000);
            return;
        }
        // 2. Must NOT be the initial bot message
        if (messageId.startsWith('initial-bot-')) {
            console.warn(`Feedback ignored: Message ${messageId} is the initial welcome message.`);
            return; // Should be hidden by showFeedback, but double-check
        }
        // 3. Must NOT be an error message
        if (currentMessage.sender === 'error' || messageId.startsWith('error-')) {
            console.warn(`Feedback ignored: Message ${messageId} is an error message.`);
            return; // Should be hidden by showFeedback, but double-check
        }
        // 4. Redundant Check (now covered by isIdFinal): Must NOT be a temporary bot ID
        // if (messageId.startsWith('bot-')) {
        //     console.warn(`Feedback ignored: Message ${messageId} still has a temporary ID.`);
        //     return;
        // }
        // 5. Avoid redundant updates
        if (currentMessage.is_liked === isLikedValue) {
            console.log(`Feedback for ${messageId} already set to ${isLikedValue}.`);
            return;
        }

        // --- Optimistic Update ---
        const originalLikedState = currentMessage.is_liked;
        // Create a *new* array for the updated state
        const updatedMessages = messages.map((msg, index) =>
            index === currentMessageIndex ? { ...msg, is_liked: isLikedValue } : msg
        );
        setMessages(updatedMessages); // Update state with the new array

        // --- API Call ---
        try {
            console.log(`Sending feedback API call for message ${messageId}: ${isLikedValue}`);
            // The messageId here should now be the final UUID because isIdFinal was true
            await sendMessageFeedback(messageId, isLikedValue);
            console.log(`Feedback successfully updated via API for message ${messageId}`);
        } catch (err) {
            console.error(`Failed to send feedback API call for message ${messageId}:`, err);
            // Revert UI on error using the original state before API call
             setMessages(prev => prev.map(msg =>
                 msg.id === messageId ? { ...msg, is_liked: originalLikedState } : msg
             ));
            setError("ارسال بازخورد ناموفق بود. لطفاً دوباره تلاش کنید.");
            // Clear error after a delay
            setTimeout(() => setError(prev => prev === "ارسال بازخورد ناموفق بود. لطفاً دوباره تلاش کنید." ? "" : prev), 3000);
        }
    }, [messages]); // Depend on messages state

     // --- Copy Handler ---
     const handleCopy = useCallback((text) => {
         if (!navigator.clipboard) {
             console.error("Clipboard API not available");
             // Optionally show error to user
             return;
         }
         navigator.clipboard.writeText(text).then(() => {
             console.log("Text copied to clipboard");
             // Feedback (like a toast) could be triggered here
         }).catch(err => {
             console.error("Failed to copy text:", err);
              // Optionally show error to user
         });
     }, []); // No dependencies needed

    // --- Logout Handler ---
    const handleLogout = () => {
        // Abort any ongoing stream before logging out
        if (abortControllerRef.current) {
            abortControllerRef.current.abort("User logging out");
            abortControllerRef.current = null;
        }
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
        logout();
        navigate('/login');
    };

    /**
     * Downloads a file and **forces** the browser to treat it as an attachment,
     * even when the server (or blob) is marked text/plain. Works around the
     * WebKit/Safari quirk that ignores the download attribute for plain-text.
     */
    const handleDownloadFile = async (fileUrl, fileName) => {
        try {
            const token = localStorage.getItem('accessToken');
            const response = await fetch(fileUrl, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                credentials: 'include',
            });
            if (!response.ok) throw new Error('Network response was not ok');

            // Grab the blob and its MIME type
            let blob = await response.blob();
            const mime = (response.headers.get('Content-Type') || '').toLowerCase();

            /**
             * Safari (desktop & iOS) opens text/plain blobs in a new tab
             * instead of honouring download.  Re-wrap the data as a generic
             * binary stream so every browser is forced to download it.
             */
            if (mime.startsWith('text/plain') || /\.txt$/i.test(fileName)) {
                const text = await blob.text();                     // keep content
                blob = new Blob([text], { type: 'application/octet-stream' });
            }

            // --- cross-browser save helper -----------------------------------
            const saveBlob = (b, name) => {
                // Old Edge / IE
                if (window.navigator?.msSaveOrOpenBlob) {
                    window.navigator.msSaveOrOpenBlob(b, name);
                    return;
                }
                // Modern browsers
                const url = window.URL.createObjectURL(b);
                const link = document.createElement('a');
                link.href = url;
                link.download = name;
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                // Safari needs a tick before revoke
                setTimeout(() => window.URL.revokeObjectURL(url), 1000);
            };

            saveBlob(blob, fileName);
        } catch (err) {
            console.error('Download failed:', err);
            alert('دانلود فایل ناموفق بود.');
        }
    };

    // --- Render Logic ---
    // Show typing indicator if loading AND the last message is a bot message AND its ID is not final yet
    const showTypingIndicator = isLoading && messages.length > 0 && messages[messages.length - 1]?.sender === 'bot' && !messages[messages.length - 1]?.isIdFinal;

    // Show full-page loading only during initial effect run AND before session ID is confirmed
    if (isInitializing && !currentSessionId) {
         return <div className="loading-full-page">در حال بارگذاری جلسه چت...</div>;
    }

    // --- Main JSX Structure ---
    return (
        <div className="chat-page-container">
            {/* --- Header --- */}
             <header className="chat-header">
                 
                 <div className="title-container">
                    <img src={'/LOGO.png'} alt="App Icon" className="header-icon"/>
                <h3>
                دستیار هوشمند رساهوش آتیه {/* Always show default text */}
                {/* Conditionally add company name if available */}
                {chatInfo?.company_name ? ` - ${chatInfo.company_name}` : ''}
                </h3>
                {/* Conditionally show company logo if URL is available */}
                {chatInfo?.company_logo_url && (
                    <img
                        src={chatInfo.company_logo_url}
                        alt={chatInfo?.company_name || "Company Logo"} // Use company name as alt text if available
                        className="header-icon"
                        style={{ width: "60px", height: "50px" }} // Keep existing style
                    />
                )}
                </div>
                <div className="chat-info">
                    {username && <span>{username}</span>}
                    {selectedSections.length > 0 && (
                        <span>{getSelectedSectionsLabel()}</span>
                    )}
                </div>
                <Button
                    onClick={handleNewChat}
                    variant="secondary"
                    className="header-button new-chat-button"
                    disabled={isLoading || isInitializing}
                    title="شروع گفتگوی جدید"
                >
                    <FaPlus /> چت جدید
                </Button>
                <Button
                    onClick={() => navigate('/')}
                    variant="secondary"
                    className="header-button back-button"
                    title="بازگشت به دستیارها"
                >
                    بازگشت به دستیارها
                </Button>
                <button className="menu-toggle" onClick={() => setIsMenuOpen(prev => !prev)}>
                    <FaBars />
                </button>
            </header>

            {isMenuOpen && (
                <div className="header-menu">
                    <div className="header-buttons">
                    {/* File Management Button (Conditionally Rendered) */}
                    {chatInfo?.file_permission && (
                        <Button
                            onClick={() => setIsFileModalOpen(true)}
                            variant="secondary"
                            className="header-button"
                            title="مدیریت دانش"
                        >
                            {/* Add an appropriate icon, e.g., FaFileAlt or similar from react-icons */}
                            <FaFileAlt /> مدیریت دانش
                        </Button>
                    )}
                     <Button
                         onClick={() => setIsAboutModalOpen(true)}
                         variant="secondary"
                         className="header-button"
                         title="درباره ما"
                     >
                         <FaInfoCircle /> درباره ما
                     </Button>
                    <Button onClick={() => navigate('/change-password')} variant="secondary" className="header-button">تغییر رمز عبور</Button>
                    <Button onClick={handleLogout} variant="secondary" className="header-button">خروج</Button>
                    </div>
                </div>
            )}

             {/* --- Messages Area --- */}
            <main className="chat-messages-area">
                {messages.map((msg) => {
                    // Determine if feedback buttons should be shown for this message
                    const shouldShowFeedback =
                        msg.sender === 'bot' &&                // Must be a bot message
                        !msg.id.startsWith('initial-bot-') && // NOT the initial welcome message
                        !msg.id.startsWith('error-');         // NOT an error message

                    return (
                        <ChatMessage
                            // Key MUST be stable. Using msg.id is correct.
                            key={msg.id}
                            message={msg}
                            onLikeDislike={handleFeedback} // Pass the handler
                            showFeedback={shouldShowFeedback} // Pass the flag
                            onCopy={handleCopy} // Pass copy handler
                        />
                    );
                 })}
                {showTypingIndicator && <TypingIndicator />}
                <div ref={messagesEndRef} />
                {/* Display general errors not tied to a specific message */}
                 {error && !messages.some(m => m.sender === 'error' && m.text.includes(error)) && (
                    <div className="chat-general-error">{error}</div>
                 )}
                 {/* Add a message if initialization failed and resulted in an error */}
                 {!currentSessionId && !isInitializing && error && (
                      <div className="chat-general-error">{error}</div>
                  )}
            </main>

            {/* --- Footer Input Area --- */}
            <footer className="chat-footer">
                <ChatInput
                    onSendMessage={(text, options) => handleSendMessage(text, options)}
                    isLoading={isLoading || !currentSessionId || isInitializing}
                />
                 {/* Show specific message if init failed and no session ID and no other error shown */}
                 {!currentSessionId && !isInitializing && !error && (
                     <div className="chat-general-error">بارگذاری جلسه ناموفق بود. لطفاً صفحه را رفرش کنید یا چت جدیدی شروع کنید.</div>
                 )}
            </footer>

            {/* --- About Us Modal (Restored Full Text) --- */}
            <Modal isOpen={isAboutModalOpen} onClose={() => setIsAboutModalOpen(false)} title="درباره دستیار هوشمند رساهوش آتیه">
                <div style={{ textAlign: 'right', direction: 'rtl', lineHeight: '1.7' }}>
                      <p>
                        این چت‌بات هوشمند توسط تیم <strong>رساهوش آتیه</strong> توسعه داده شده است تا به سوالات شما در زمینه‌های مختلف پاسخ دهد.
                    </p>
                    <p>
                        ما از جدیدترین تکنولوژی‌های هوش مصنوعی و پردازش زبان طبیعی برای درک سوالات و ارائه پاسخ‌های دقیق و مفید استفاده می‌کنیم. هدف ما کمک به شما برای یافتن سریع و آسان اطلاعات مورد نیازتان است.
                    </p>
                    <hr style={{ margin: '1rem 0' }}/>
                    <p style={{ fontSize: '0.9em', color: '#555' }}>
                        <strong>نسخه فعلی:</strong> {chatInfo?.version || '1.0'}
                        <br/>
                        {/* Example of showing data update time if available */}
                        {/* <strong>آخرین بروزرسانی داده‌ها:</strong> {chatInfo?.data_update_time ? new Date(chatInfo.data_update_time).toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric'}) : 'نامشخص'} */}
                    </p>
                    <p style={{ marginTop: '1.5rem' }}>
                        از همراهی و بازخوردهای شما سپاسگزاریم!
                    </p>
                     <p>رساهوش آتیه، همراه شما در مسیر تحول دیجیتال</p>
                </div>
            </Modal>

            {/* --- File Management Modal --- */}
            {chatInfo?.file_permission && (
                <Modal
                    isOpen={isFileModalOpen}
                    onClose={() => { setIsFileModalOpen(false); setFileModalError(''); }}
                    title="مدیریت دانش"
                >
                    <div style={{ direction: 'rtl', textAlign: 'right', padding: '1rem' }}>
                        {/* Display modal-specific error */}
                        {fileModalError && (
                            <div className="file-modal-error">
                                {fileModalError}
                            </div>
                        )}

                        {isFilesLoading ? (
                            <div>در حال بارگذاری فایل‌ها...</div>
                        ) : (
                            <>

                                {/* File Upload Section */}
                                <div style={{ marginBottom: '1.5rem', borderBottom: '1px solid #eee', paddingBottom: '1.5rem' }}>
                                        <h4>بارگذاری فایل جدید</h4>
                                        {selectedSections?.length > 1 && (
                                        <div style={{ marginBottom: '1rem' }}>
                                            <label htmlFor="section-select" style={{ display: 'block', marginBottom: '0.5rem' }}>
                                                انتخاب بخش:
                                            </label>
                                            <select
                                                id="section-select"
                                                value={selectedUploadSection || ''}
                                                onChange={(e) => setSelectedUploadSection(e.target.value)}
                                                style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'inherit' }}
                                            >
                                                <option value="">-- بخش مورد نظر را انتخاب کنید --</option>
                                                {chatInfo?.sections?.map(section => (
                                                    <option key={section} value={section}>{section}</option>
                                                ))}
                                            </select>
                                        </div>)}

                                        <div className="upload-buttons-container">
                                            <label className="file-upload-label">
                                                <FaFileAlt style={{ marginInlineEnd: '8px' }}/> انتخاب فایل
                                                <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} />
                                            </label>

                                            <Button
                                                onClick={() => setIsGoogleDriveInputVisible(prev => !prev)}
                                                variant="secondary"
                                                className="header-button google-drive-btn"
                                            >
                                                <FaGoogleDrive style={{ marginInlineEnd: '8px' }}/> ورود لینک گوگل درایو
                                            </Button>
                                        </div>

                                        {isGoogleDriveInputVisible && (
                                            <div className="google-drive-input-container">
                                                <p>
                                                    لطفاً فایل یا فولدر مورد نظر را با ایمیل زیر در گوگل درایو خود به اشتراک بگذارید :
                                                    <br />
                                                    <strong>{chatInfo?.google_service_account_email || 'service account not available'}</strong>
                                                </p>
                                                <input
                                                    type="text"
                                                    value={googleDriveUrl}
                                                    onChange={(e) => setGoogleDriveUrl(e.target.value)}
                                                    placeholder="لینک گوگل درایو را اینجا وارد کنید"
                                                />
                                                <Button
                                                    onClick={handleGoogleDriveUpload}
                                                    className="header-button submit-link-btn"
                                                >
                                                    ارسال لینک
                                                </Button>
                                            </div>
                                        )}
                                    </div>

                                <h4>فایل‌های موجود:</h4>
                                {files.length === 0 ? (
                                    <p>فایلی یافت نشد.</p>
                                ) : (
                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                        {files.filter(file => !selectedSections || selectedSections.length === 0 || selectedSections.includes(file.section)).map(file => (
                                            <li key={file.id} style={{ borderBottom: '1px solid #eee', padding: '0.5rem 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <strong>{file.original_filename}</strong>
                                                    <br />
                                                    <small>بخش: {file.section} | وضعیت: {translateProcessingStatus(file.processing_status)} - بارگذاری: {new Date(file.uploaded_at).toLocaleDateString()} {new Date(file.uploaded_at).toLocaleTimeString()}</small>
                                                    {file.error_message && <small style={{ color: 'red' }}> خطا: {file.error_message}</small>}
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                    {/* Download Button (as button, not <a>) */}
                                                    <button
                                                        onClick={() => handleDownloadFile(file.file_url, file.original_filename)}
                                                        style={{ background: 'none', border: 'none', color: 'gray', cursor: 'pointer' }}
                                                        title="دانلود فایل"
                                                    >
                                                        <FaDownload />
                                                    </button>
                                                    {/* Delete Button with Confirmation */}
                                                    <button
                                                        onClick={() => {
                                                            if (window.confirm('آیا مطمئن هستید که می‌خواهید این فایل را حذف کنید؟')) {
                                                                handleDeleteFile(file.id);
                                                            }
                                                        }}
                                                        style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }}
                                                        title="حذف فایل"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                
                            </>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ChatPage;
// --- END OF FILE src/pages/ChatPage.js (Restored & Feedback Fixed) ---