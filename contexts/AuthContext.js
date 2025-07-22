import React, { createContext, useState, useEffect, useCallback } from 'react';
// Removed getUserInfo import

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'));
    const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'));
    const [user, setUser] = useState(null); // Simplified user state
    const [isLoading, setIsLoading] = useState(true);

    // Simplified check: if token exists, assume authenticated initially.
    // A proper check would involve verifying the token with the backend (e.g., /users/me/)
    const checkInitialAuth = useCallback(() => {
        const token = localStorage.getItem('accessToken');
        if (token) {
            // For simplicity, we assume the token is valid initially.
            // A robust implementation would verify it here.
            setUser({ isAuthenticated: true }); // Mark as authenticated
        } else {
            setUser(null);
        }
        setIsLoading(false);
    }, []); // No dependencies needed for this simplified check

    useEffect(() => {
        checkInitialAuth();
    }, [checkInitialAuth]);

    const login = (access, refresh) => {
        localStorage.setItem('accessToken', access);
        localStorage.setItem('refreshToken', refresh);
        setAccessToken(access);
        setRefreshToken(refresh);
        setUser({ isAuthenticated: true }); // Set user state immediately on login
        // No navigation here - let the calling component handle it
    };

    const logout = () => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        setAccessToken(null);
        setRefreshToken(null);
        setUser(null);
        // Navigation should be handled by the component calling logout
    };

    const value = {
        accessToken,
        refreshToken,
        isAuthenticated: !!user,
        user, // Keep user object if needed later, currently just {isAuthenticated: true}
        isLoading,
        login,
        logout,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;