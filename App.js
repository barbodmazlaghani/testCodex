import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import useAuth from './hooks/useAuth'; // Import useAuth

import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordConfirmPage from './pages/ResetPasswordConfirmPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import ChatPage from './pages/ChatPage';
import LandingPage from './pages/LandingPage';
import NotFoundPage from './pages/NotFoundPage';

import './styles/global.css'; // Import global styles

// Component to handle redirection based on auth state for public routes
function PublicRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuth();
     if (isLoading) return <div>Loading...</div>; // Or a spinner
    return !isAuthenticated ? children : <Navigate to="/" replace />;
}


function App() {
    return (
        <AuthProvider>
            <Router>
                <Routes>
                    {/* Public Routes (remain the same) */}
                    <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
                    <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
                    <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
                    <Route path="/password/reset/confirm/:uid/:token" element={<PublicRoute><ResetPasswordConfirmPage /></PublicRoute>} />

                    {/* Protected Routes */}
                    <Route path="/" element={<ProtectedRoute />}>
                        {/* Landing page shown after login */}
                        <Route index element={<LandingPage />} />

                        {/* Route for specific chat sessions or starting a new one */}
                        <Route path="chat/:sessionId" element={<ChatPage />} />

                        {/* Other protected routes */}
                        <Route path="change-password" element={<ChangePasswordPage />} />
                    </Route>

                     {/* Fallback Route */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </Router>
        </AuthProvider>
    );
}

export default App;