import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth'; // Import useAuth
import { changePassword } from '../services/api';
import InputField from '../components/Common/InputField';
import Button from '../components/Common/Button';
import '../components/Auth/AuthForm.css';
import './ChatPage.css'; // Reuse chat page layout styles

const ChangePasswordPage = () => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const { logout } = useAuth(); // Get logout function from context
    const navigate = useNavigate();

    const validateForm = () => {
        setError('');
        if (!currentPassword) {
             setError('رمز عبور فعلی الزامی است.');
             return false;
         }
        if (!newPassword) {
            setError('رمز عبور جدید الزامی است.');
            return false;
        }
         if (newPassword.length < 8) {
             setError('رمز عبور جدید باید حداقل ۸ کاراکتر باشد.');
             return false;
         }
        if (newPassword !== confirmNewPassword) {
            setError('رمزهای عبور جدید مطابقت ندارند.');
            return false;
        }
        if (newPassword === currentPassword) {
            setError('رمز عبور جدید باید با رمز عبور فعلی متفاوت باشد.');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSuccessMessage('');
        if (!validateForm()) return;

        setLoading(true);
        try {
            await changePassword({
                current_password: currentPassword,
                new_password: newPassword,
                re_new_password: confirmNewPassword
            });
            setSuccessMessage('رمز عبور با موفقیت تغییر یافت! برای ادامه باید دوباره وارد شوید.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmNewPassword('');
            // Force logout after successful change for security
            setTimeout(() => {
                 logout(); // Call logout from context
                 navigate('/login'); // Redirect to login
            }, 2000); // Delay slightly so user can see the message

        } catch (err) {
            console.error("Change password error:", err.response?.data || err.message);
            const backendErrors = err.response?.data;
            if (backendErrors) {
                let errorMsg = 'تغییر رمز عبور ناموفق بود.';
                // Translate common Djoser set_password errors
                if (backendErrors.current_password) {
                    errorMsg = `رمز عبور فعلی: ${backendErrors.current_password.join ? backendErrors.current_password.join(' ') : backendErrors.current_password}`;
                    if (errorMsg.includes("Invalid password")) errorMsg = "رمز عبور فعلی نامعتبر است.";
                } else if (backendErrors.new_password) {
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
                    errorMsg = backendErrors.detail;
                }
                setError(errorMsg);
            } else {
                setError('خطای غیرمنتظره‌ای رخ داد. لطفاً دوباره تلاش کنید.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="chat-page-container">
             <header className="chat-header">
                <h1>تغییر رمز عبور</h1>
                 <Button onClick={() => navigate('/')} variant="secondary" className="back-button">بازگشت به چت</Button>
             </header>
             <main className="change-password-content">
                <div className="change-password-form-container">
                    <form onSubmit={handleSubmit} className="auth-form">
                         {error && <div className="form-error-message">{error}</div>}
                         {successMessage && <div className="form-success-message">{successMessage}</div>}
                        <InputField
                            label="رمز عبور فعلی"
                            type="password"
                            name="currentPassword"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            required
                             // Keep LTR for password
                             style={{ direction: 'ltr', textAlign: 'left' }}
                        />
                        <InputField
                            label="رمز عبور جدید"
                            type="password"
                            name="newPassword"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                             placeholder="حداقل ۸ کاراکتر"
                            required
                             // Keep LTR for password
                             style={{ direction: 'ltr', textAlign: 'left' }}
                        />
                        <InputField
                            label="تکرار رمز عبور جدید"
                            type="password"
                            name="confirmNewPassword"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            required
                             // Keep LTR for password
                             style={{ direction: 'ltr', textAlign: 'left' }}
                        />
                        <Button type="submit" disabled={loading || successMessage}> {/* Disable button after success too */}
                            {loading ? 'در حال تغییر...' : 'تغییر رمز عبور'}
                        </Button>
                    </form>
                 </div>
             </main>
        </div>
    );
};

export default ChangePasswordPage;