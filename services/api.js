// --- START OF FILE api.js ---

import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000'; // Fallback

const api = axios.create({
    baseURL: API_URL + '/api/',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Add JWT token to headers for authenticated requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('accessToken');
        // Add token if it exists and the request isn't for login/refresh
        if (token && !config.url.includes('/auth/jwt/create') && !config.url.includes('/auth/jwt/refresh')) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response Interceptor: Handle token refresh
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Check if it's a 401 error, not for login/refresh paths, and not already retried
        // Also check if the URL is part of our protected API (not external/auth specific refresh)
        if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/auth/jwt/')) {
            originalRequest._retry = true; // Mark as retried
            const refreshToken = localStorage.getItem('refreshToken');

            if (refreshToken) {
                try {
                    console.log('Attempting token refresh...');
                    // Use axios directly to avoid interceptor loop if refresh itself fails with 401
                    const response = await axios.post(`${API_URL}/api/auth/jwt/refresh/`, { refresh: refreshToken });
                    const { access } = response.data;

                    localStorage.setItem('accessToken', access);
                    console.log('Token refreshed successfully.');

                    // Update the header of the original request and retry with the 'api' instance
                    originalRequest.headers['Authorization'] = `Bearer ${access}`;
                    return api(originalRequest); // Retry the original request

                } catch (refreshError) {
                    console.error('Token refresh failed:', refreshError);
                    // If refresh fails, clear tokens and redirect to login
                    localStorage.removeItem('accessToken');
                    localStorage.removeItem('refreshToken');
                     window.location.href = '/login'; // Force redirect
                    return Promise.reject(refreshError);
                }
            } else {
                 console.log('No refresh token found, redirecting to login.');
                 localStorage.removeItem('accessToken'); // Clear potentially expired access token too
                 window.location.href = '/login'; // Force redirect
                 return Promise.reject(error); // Reject the original error after redirect attempt
            }
        }
        // For other errors, just reject them
        return Promise.reject(error);
    }
);


// --- Authentication API Calls ---
export const loginUser = (credentials) => api.post('auth/jwt/create/', credentials);
export const refreshAccessToken = (refreshToken) => api.post('auth/jwt/refresh/', { refresh: refreshToken });
export const registerUser = (userData) => api.post('auth/users/', userData);
export const requestPasswordReset = (email) => api.post('auth/users/reset_password/', { email });
export const confirmPasswordReset = (uid, token, new_password) => api.post('auth/users/reset_password_confirm/', { uid, token, new_password });
export const changePassword = (passwords) => api.post('auth/users/set_password/', passwords); // Requires auth
export const getUserInfo = () => api.get('auth/users/me/'); // Requires auth

// --- Chatbot General Info ---
export const getChatbotInfo = () => api.get('info/'); // Requires auth

// --- Chat Session API Calls ---
export const createChatSession = () => api.post('chat/sessions/'); // Creates a new session for the user
export const listChatSessions = () => api.get('chat/sessions/'); // Lists user's sessions
export const getChatMessages = (sessionId) => api.get(`chat/sessions/${sessionId}/messages/`); // Gets messages for a specific session

// --- Chat Message Feedback ---
export const sendMessageFeedback = (messageId, isLiked) => {
    // isLiked should be true, false, or null
    return api.patch(`chat/messages/${messageId}/feedback/`, { is_liked: isLiked });
};

export const getMessageTTS = (messageId) => {
    return api.get(`chat/messages/${messageId}/read_aloud/`, {
        responseType: 'blob', // Tell Axios to return binary data
    });
};

export const exportMessage = (messageId) => {
    return api.get(`chat/messages/${messageId}/export/`, {
        responseType: 'blob', // We expect a file blob in response
    });
};


// --- File Management API Calls ---
// API endpoint: path('files/', FileListView.as_view(), name='file-list'),
export const getFileList = () => {
    return api.get('files/');
};

// API endpoint: path('files/upload/', FileUploadView.as_view(), name='file-upload'),
export const uploadFile = (formData) => {
    // Need to set Content-Type to multipart/form-data for file uploads
    return api.post('files/upload/', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
};

// API endpoint: path('files/<uuid:id>/', FileDetailView.as_view(), name='file-detail'),
export const deleteFile = (fileId) => {
    return api.delete(`files/${fileId}/`);
};


// --- Chat Streaming API Call (Using Fetch for SSE) ---
export const streamChatMessage = async (sessionId, messageContent, selectedSections, signal, attachments = [], audioData = null) => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
        // Handle missing token case early, perhaps redirect or throw specific error
        console.error("No access token found for streaming.");
        window.location.href = '/login'; // Or throw an error handled by the caller
        throw new Error("Authentication token missing.");
    }
    if (!sessionId) {
        throw new Error("Session ID is required for streaming.");
    }

    const payload = { content: [{"type": "text","text": messageContent}], sections: selectedSections };
    attachments.forEach(att => {
        if (att.type.startsWith('image/')) {
            payload.content.push({
                "type": "image_url",
                "file_name": att.name,
                "image_url": { "url": `data:${att.type};base64,${att.base64}` }
            });
        } else {
            payload.content.push({
                "type": att.type,
                "file_name": att.name,
                "file_data": att.base64
            });
        }
    });
    if (audioData) {
        payload.content.push({
            "type": "input_audio",
            "input_audio": {
              "data": audioData,
              "format": "wav"
            }
          });
      
    }
    

    const response = await fetch(`${API_URL}/api/chat/sessions/${sessionId}/stream/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        signal: signal, // Pass the AbortSignal
    });

    // Check for non-OK status codes BEFORE trying to read the body as a stream
    if (!response.ok) {
        let errorData;
        try {
            // Try to parse backend error message if available
            errorData = await response.json();
        } catch (e) {
            // Fallback if response is not JSON
            errorData = { error: `HTTP error! status: ${response.status} ${response.statusText}` };
        }
        // Throw an error with details from backend or a generic HTTP error
        throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
    }

    // Check specifically for SSE content type, although backend should guarantee this on success
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("text/event-stream")) {
        console.warn("Received non-SSE response, but status was OK. Content-Type:", contentType);
        // Decide how to handle this - maybe try reading as text or throw an error
        // For now, let's throw an error as we expect SSE
        throw new Error("Expected text/event-stream response but received: " + contentType);
    }


    if (!response.body) {
        throw new Error("Response body is null");
    }

    return response.body.getReader(); // Return the ReadableStreamDefaultReader
};


export default api;
// --- END OF FILE api.js ---