import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { registerUser } from '../services/api';
import AuthLayout from '../components/Auth/AuthLayout';
import InputField from '../components/Common/InputField';
import Button from '../components/Common/Button';
import '../components/Auth/AuthForm.css';

const SignupPage = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const navigate = useNavigate();

    const validateForm = () => {
        const newErrors = {};
        if (!username) newErrors.username = 'نام کاربری الزامی است.';
        if (!email) newErrors.email = 'ایمیل الزامی است.';
        else if (!/\S+@\S+\.\S+/.test(email)) newErrors.email = 'ایمیل معتبر نیست.';
        if (!password) newErrors.password = 'رمز عبور الزامی است.';
        else if (password.length < 8) newErrors.password = 'رمز عبور باید حداقل ۸ کاراکتر باشد.';
        if (password !== confirmPassword) newErrors.confirmPassword = 'رمزهای عبور مطابقت ندارند.';
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrors({});
        setSuccessMessage('');
        if (!validateForm()) return;

        setLoading(true);
        try {
            await registerUser({ username, email, password, re_password: confirmPassword });
            setSuccessMessage('ثبت نام موفقیت آمیز بود! لطفاً برای فعال سازی ایمیل خود را بررسی کنید یا وارد شوید.');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            console.error("Signup error:", err.response?.data || err.message);
            const backendErrors = err.response?.data;
            if (backendErrors) {
                const formattedErrors = {};
                // Translate common Djoser errors (add more as needed)
                for (const key in backendErrors) {
                    let messages = Array.isArray(backendErrors[key]) ? backendErrors[key] : [String(backendErrors[key])];
                    let translatedMessage = messages.map(msg => {
                        if (msg.includes("user with this email already exists")) return "کاربری با این ایمیل قبلاً ثبت نام کرده است.";
                        if (msg.includes("user with this username already exists")) return "کاربری با این نام کاربری قبلاً ثبت نام کرده است.";
                        if (msg.includes("Enter a valid email address")) return "لطفاً یک ایمیل معتبر وارد کنید.";
                        if (msg.includes("Ensure this field has no more than")) return `این فیلد نمی‌تواند بیشتر از ${msg.split(' ').pop().replace('.','')} کاراکتر باشد.`; // Example extraction
                        if (msg.includes("password is too common")) return "رمز عبور بیش از حد رایج است.";
                        if (msg.includes("passwords do not match")) return "رمزهای عبور مطابقت ندارند."; // Should be caught by frontend validation too
                        return msg; // Fallback to original error
                    }).join(' ');
                    formattedErrors[key] = translatedMessage;
                }
                 if (formattedErrors.non_field_errors) {
                   setErrors({ general: formattedErrors.non_field_errors });
                   delete formattedErrors.non_field_errors;
                }
                setErrors(prev => ({ ...prev, ...formattedErrors }));

            } else {
                setErrors({ general: 'ثبت نام ناموفق بود. لطفاً دوباره تلاش کنید.' });
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="ثبت نام">
            <form onSubmit={handleSubmit} className="auth-form">
                {errors.general && <div className="form-error-message">{errors.general}</div>}
                {successMessage && <div className="form-success-message">{successMessage}</div>}
                <InputField
                    label="نام کاربری"
                    type="text"
                    name="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="یک نام کاربری انتخاب کنید"
                    error={errors.username}
                    required
                    // Ensure text input is RTL
                    style={{ direction: 'rtl', textAlign: 'right' }}
                />
                <InputField
                    label="ایمیل"
                    type="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ایمیل خود را وارد کنید"
                    error={errors.email}
                    required
                     // Keep LTR for email
                     style={{ direction: 'ltr', textAlign: 'left' }}
                />
                <InputField
                    label="رمز عبور"
                    type="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="یک رمز عبور ایجاد کنید (حداقل ۸ کاراکتر)"
                    error={errors.password}
                    required
                     // Keep LTR for password
                     style={{ direction: 'ltr', textAlign: 'left' }}
                />
                <InputField
                    label="تکرار رمز عبور"
                    type="password"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="رمز عبور خود را تکرار کنید"
                    error={errors.confirmPassword}
                    required
                     // Keep LTR for password
                     style={{ direction: 'ltr', textAlign: 'left' }}
                />
                <Button type="submit" disabled={loading}>
                    {loading ? 'در حال ثبت نام...' : 'ثبت نام'}
                </Button>
                <div className="form-link">
                    قبلاً ثبت نام کرده‌اید؟ <Link to="/login">وارد شوید</Link>
                </div>
            </form>
        </AuthLayout>
    );
};

export default SignupPage;