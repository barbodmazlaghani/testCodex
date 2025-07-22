import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../services/api';
import AuthLayout from '../components/Auth/AuthLayout';
import InputField from '../components/Common/InputField';
import Button from '../components/Common/Button';
import '../components/Auth/AuthForm.css';

const ForgotPasswordPage = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState(''); // Keep error state though we might not use it directly
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');
        setLoading(true);
        try {
            await requestPasswordReset(email);
            // Always show the same message regardless of whether the email exists
            setMessage('اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی رمز عبور ارسال شد.');
        } catch (err) {
            console.error("Forgot password error:", err.response?.data || err.message);
            // Security best practice: Don't reveal if the email exists or not.
            setMessage('اگر حسابی با این ایمیل وجود داشته باشد، لینک بازیابی رمز عبور ارسال شد.');
            // Optionally log the specific error for debugging but don't show it to the user
            // setError('ارسال لینک بازیابی ناموفق بود. لطفاً دوباره تلاش کنید.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="فراموشی رمز عبور">
            <form onSubmit={handleSubmit} className="auth-form">
                <p style={{ textAlign: 'center', marginBottom: '1rem', fontSize: '0.9rem', color: '#555' }}>
                    آدرس ایمیل خود را وارد کنید تا لینک بازیابی رمز عبور برای شما ارسال شود.
                </p>
                {message && <div className="form-success-message">{message}</div>}
                {/* We typically don't show specific errors here for security */}
                {/* {error && <div className="form-error-message">{error}</div>} */}
                <InputField
                    label="آدرس ایمیل"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ایمیل خود را وارد کنید"
                    required
                    // Keep LTR for email
                    style={{ direction: 'ltr', textAlign: 'left' }}
                />
                <Button type="submit" disabled={loading}>
                    {loading ? 'در حال ارسال...' : 'ارسال لینک بازیابی'}
                </Button>
                <div className="form-link">
                    رمز عبور خود را به خاطر دارید؟ <Link to="/login">ورود</Link>
                </div>
            </form>
        </AuthLayout>
    );
};

export default ForgotPasswordPage;