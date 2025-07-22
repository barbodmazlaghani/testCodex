import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { confirmPasswordReset } from '../services/api';
import AuthLayout from '../components/Auth/AuthLayout';
import InputField from '../components/Common/InputField';
import Button from '../components/Common/Button';
import '../components/Auth/AuthForm.css';

const ResetPasswordConfirmPage = () => {
    const { uid, token } = useParams();
    const navigate = useNavigate();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const validateForm = () => {
        if (!newPassword) {
            setError('رمز عبور جدید الزامی است.');
            return false;
        }
        if (newPassword.length < 8) {
             setError('رمز عبور جدید باید حداقل ۸ کاراکتر باشد.');
             return false;
         }
        if (newPassword !== confirmPassword) {
            setError('رمزهای عبور جدید مطابقت ندارند.');
            return false;
        }
        setError('');
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        if (!validateForm()) return;

        setLoading(true);
        try {
            await confirmPasswordReset(uid, token, newPassword);
            setSuccessMessage('رمز عبور شما با موفقیت تغییر یافت! اکنون می‌توانید وارد شوید.');
             setNewPassword('');
             setConfirmPassword('');
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            console.error("Reset password confirm error:", err.response?.data || err.message);
            const backendErrors = err.response?.data;
             if (backendErrors) {
                let errorMsg = 'بازیابی رمز عبور ناموفق بود.';
                 // Translate common Djoser reset errors
                 if (backendErrors.token || backendErrors.uid || (backendErrors.detail && backendErrors.detail.includes("Invalid token"))) {
                     errorMsg = 'لینک بازیابی نامعتبر یا منقضی شده است. لطفاً دوباره درخواست دهید.';
                 } else if (backendErrors.new_password) {
                     // Try to translate password errors (might need more specific checks)
                     let pwErrors = Array.isArray(backendErrors.new_password) ? backendErrors.new_password : [String(backendErrors.new_password)];
                     errorMsg = pwErrors.map(msg => {
                         if (msg.includes("too common")) return "رمز عبور جدید بیش از حد رایج است.";
                         if (msg.includes("too short")) return "رمز عبور جدید باید حداقل ۸ کاراکتر باشد.";
                         // Add more specific password policy errors if needed
                         return msg; // Fallback
                     }).join(' ');
                     errorMsg = `خطای رمز عبور جدید: ${errorMsg}`;
                 } else if (backendErrors.non_field_errors) {
                     errorMsg = backendErrors.non_field_errors.join(' ');
                 } else if (backendErrors.detail) {
                     errorMsg = backendErrors.detail; // Use detail if available
                 }
                setError(errorMsg);
            } else {
                 setError('خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید یا لینک جدیدی درخواست دهید.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <AuthLayout title="بازیابی رمز عبور">
            <form onSubmit={handleSubmit} className="auth-form">
                {error && <div className="form-error-message">{error}</div>}
                {successMessage && <div className="form-success-message">{successMessage}</div>}
                {!successMessage && (
                    <>
                        <InputField
                            label="رمز عبور جدید"
                            type="password"
                            name="newPassword"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="رمز عبور جدید را وارد کنید (حداقل ۸ کاراکتر)"
                            required
                            // Keep LTR for password
                            style={{ direction: 'ltr', textAlign: 'left' }}
                        />
                        <InputField
                            label="تکرار رمز عبور جدید"
                            type="password"
                            name="confirmPassword"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="رمز عبور جدید را تکرار کنید"
                            required
                             // Keep LTR for password
                             style={{ direction: 'ltr', textAlign: 'left' }}
                        />
                        <Button type="submit" disabled={loading}>
                            {loading ? 'در حال تغییر...' : 'تغییر رمز عبور'}
                        </Button>
                    </>
                )}
                 {successMessage && (
                     <div className="form-link">
                         <Link to="/login">رفتن به صفحه ورود</Link>
                     </div>
                 )}
            </form>
        </AuthLayout>
    );
};

export default ResetPasswordConfirmPage;