import React, { useState } from 'react';
import axios from 'axios';
import './form-style.css';
import { toast } from 'react-toastify';
import {useNavigate} from 'react-router-dom'

const PasswordChange = () => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword1, setNewPassword1] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const token = JSON.parse(localStorage.getItem('user')).access_token
  const navigate = useNavigate();

  const handleSubmit = async () => {
    try {
      await axios.post('https://khodroai.com/api/rest-auth/password/change/', {
        old_password: oldPassword,
        new_password1: newPassword1,
        new_password2: newPassword2,
      },
      {
        headers: {
            Authorization: `Token ${token}`
        }
      });
      // password changed successfully
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
            <h3>تغییر رمز عبور</h3>
        </div>
      <form className="form">
        <div className="form-group">
            <input type="password" name="old-password" placeholder="رمز عبور قبلی" value={oldPassword} onChange={e => setOldPassword(e.target.value)} />
        </div>
        <div className="form-group">
            <input type="password" name="password" placeholder="رمز عبور جدید" value={newPassword1} onChange={e => setNewPassword1(e.target.value)} />
        </div>
        <div className="form-group">
            <input type="password" name="confirm-password" placeholder="تکرار رمز عبور جدید" value={newPassword2} onChange={e => setNewPassword2(e.target.value)} />
        </div>
        <div class="btn" onClick={handleSubmit}>تایید</div>
      </form>
    </div>
  );
};

export default PasswordChange;
