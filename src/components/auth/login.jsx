import axios from 'axios';
import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import './form-style.css';
import { Link } from 'react-router-dom';

function Login() {
    let navigate = useNavigate();

    const [form, setForm] = useState({
        username: '',
        password: ''
    })

    const login = () => {
        axios.post('https://khodroai.com/api/rest-auth/login/', form).then(res => {
            if(res.status === 200) {
                //console.log(res.data)
                localStorage.setItem('user', JSON.stringify({
                    access_token: res.data.key,
                    // username: res.data.user.username
                    username : form.username
                }))
                navigate('/')
            }
        }).catch((e) => {
            console.log(e?.message)
            toast.error("نام کاربری یا رمز عبور اشتباه می باشد")
        })
    }

        return (
            <div className="container">
                    <div className="header">
                        <h3>ورود به حساب کاربری</h3>
                    </div>
                    <div className="form">
                        <div className="form-group">
                            <input type="text" onChange={(e) => setForm({...form, username: e.target.value})} name="username" placeholder="نام کاربری یا شماره موبایل"/>
                        </div>
                        <div className="form-group">
                            <input type="password" onChange={(e) => setForm({...form, password: e.target.value})} name="password" placeholder="رمز عبور"/>
                        </div>
                        <div class="btn" onClick={() => login()}>  
                            ورود   
                        </div>
                        <br/>
                        <Link to="/reset-password">فراموشی رمز عبور</Link>
                    </div>
            </div>

        );
}

export default Login;