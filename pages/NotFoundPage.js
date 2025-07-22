import React from 'react';
import { Link } from 'react-router-dom';
import AuthLayout from '../components/Auth/AuthLayout';

const NotFoundPage = () => {
    return (
        <AuthLayout title="۴۰۴ - صفحه یافت نشد">
            <div style={{ textAlign: 'center' }}>
                <p>متأسفیم! صفحه‌ای که به دنبال آن بودید وجود ندارد.</p>
                <Link to="/" style={{ color: '#007bff', textDecoration: 'none', display: 'block', marginBottom: '10px' }}>
                    بازگشت به صفحه چت
                </Link>
                 <Link to="/login" style={{ color: '#007bff', textDecoration: 'none', fontSize: '0.9em' }}>
                    یا رفتن به صفحه ورود
                </Link>
            </div>
        </AuthLayout>
    );
};

export default NotFoundPage;