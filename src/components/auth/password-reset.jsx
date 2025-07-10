import React, { useState } from 'react';
import axios from 'axios';
import './form-style.css';
import { toast } from 'react-toastify';
import {useNavigate} from 'react-router-dom'

const PasswordReset = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [code, setCode] = useState('');
  const [newPassword1, setNewPassword1] = useState('');
  const [newPassword2, setNewPassword2] = useState('');

  const navigate = useNavigate();

  const handleSendCode = async () => {
    try {
      await axios.post('https://khodroai.com/api/rest-auth/registration/phone/send-activation-code', {
        phone_number: phoneNumber,
      });
      // code sent successfully
      toast.success('کد برای شماره تلفن شما ارسال شد')
    } catch (err) {
      console.log(err);
    }
  };

  const handleSubmit = async () => {
    try {
      await axios.post('https://khodroai.com/api/rest-auth/registration/phone/reset-password-confirm', {
        phone_number: phoneNumber,
        code: code,
        new_password1: newPassword1,
        new_password2: newPassword2,
      });
      // password reset successfully
      toast.success('رمز عبور جدید شما با موفقیت ثبت شد')
      navigate('/login-register')
    } catch (err) {
      console.log(err);
      toast.error('مشکلی پیش آمده است')
    }
  };

  return (
    <div className="container">
        <div className="header">
            <h3>ریست رمز عبور</h3>
        </div>
      <form className="form">
        <div className="form-group">
            <input type="text" name="phone" placeholder="شماره موبایل" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
        </div>
        <div class="btn" onClick={handleSendCode}>ارسال کد</div>
        <div className="form-group">
            <input type="text" placeholder="کد دریافتی" value={code} onChange={e => setCode(e.target.value)} />
        </div>
        <div className="form-group">
            <input type="password" name="password" placeholder="رمز عبور" value={newPassword1} onChange={e => setNewPassword1(e.target.value)} />
        </div>
        <div className="form-group">
            <input type="password" name="confirm-password" placeholder="تکرار رمز عبور" value={newPassword2} onChange={e => setNewPassword2(e.target.value)} />
        </div>
        <div class="btn" onClick={handleSubmit}>تایید</div>
      </form>
    </div>
  );
};

export default PasswordReset;
