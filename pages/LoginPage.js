import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import { loginUser } from '../services/api';
import AuthLayout from '../components/Auth/AuthLayout';
import InputField from '../components/Common/InputField';
import Button from '../components/Common/Button';
import '../components/Auth/AuthForm.css';

const LoginPage = () => {
    const [email, setEmail] = useState(''); // Changed from username
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); // Clear previous error *before* request
        setLoading(true);
        try {
            // Use email for login as per Djoser's default with JWT
            // If your backend expects 'username', change 'email' back to 'username' here
            const response = await loginUser({ email, password });
            login(response.data.access, response.data.refresh);
            navigate('/'); // Navigate only on SUCCESS
        } catch (err) {
            console.error("Login error:", err.response?.data || err.message);
            // Error state will persist until the next submit attempt or component unmount
            setError(err.response?.data?.detail || 'ورود ناموفق بود. لطفاً اطلاعات خود را بررسی کنید.');
            // Do NOT navigate on error
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="ورود به سیستم">
            <form onSubmit={handleSubmit} className="auth-form">
                {error && <div className="form-error-message">{error}</div>}
                <InputField
                    label="ایمیل"
                    type="email"
                    name="email"
                    value={email}
                    // Keep LTR direction for email input
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ایمیل خود را وارد کنید"
                    required
                />
                <InputField
                    label="رمز عبور"
                    type="password"
                    name="password"
                    value={password}
                     // Keep LTR direction for password input
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="رمز عبور خود را وارد کنید"
                    required
                />
                <Button type="submit" disabled={loading}>
                    {loading ? 'در حال ورود...' : 'ورود'}
                </Button>
                <div className="form-link">
                    <Link to="/forgot-password">رمز عبور خود را فراموش کرده‌اید؟</Link>
                </div>
                <div className="form-link">
                    حساب کاربری ندارید؟ <Link to="/signup">ثبت نام کنید</Link>
                </div>
            </form>
        </AuthLayout>
    );
};

export default LoginPage;