import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useNavigate } from "react-router-dom";
import { toast } from 'react-toastify';
import ActivationForm from './activation-form';

import './form-style.css';

const Register = () => {
    let navigate = useNavigate();

    const [data, setData] = useState({
        username: '',
        password1: '',
        password2: '',
        phone_number: ''
    })


    const [output, setOutput] = useState({isRegisterForm : true})


    const sendData2 = () => {
        axios.post('https://khodroai.com/api/rest-auth/registration/', data).then(res => {
            console.log(data);
            if(res.status === 201) {            
                console.log('code sent:', data);
                toast.success('کد فعال سازی حساب کاربری برای شما ارسال شد')
                setOutput({isRegisterForm:false})
            }
        }).catch((e) => {
            console.log(data);
            toast.error(e?.message)

        })
    }


    return (
            <div className="container">
                    <div className="header">
                        { output.isRegisterForm ? <h3>ایجاد حساب کاربری</h3>
                        : <h3>فعال سازی حساب کاربری</h3>}
                    </div>

                    { output.isRegisterForm ?
                    <form className="form" id="form1">
                        
                        <div className="form-group">
                            <input type="text" name="username" placeholder="نام کاربری" onChange={(e) => setData({
                                ...data,
                                username: e.target.value
                            })}/>
                        </div>
                        <div className="form-group">
                            <input type="text" name="phone" placeholder="شماره موبایل" onChange={(e) => setData({
                                ...data,
                                phone_number: e.target.value
                            })}/>
                        </div>
                        <div className="form-group">
                            <input type="password" name="password" placeholder="رمز عبور" onChange={(e) => setData({
                                ...data,
                                password1: e.target.value
                            })}/>
                        </div>
                        <div className="form-group">
                            <input type="password" name="confirm-password" placeholder="تکرار رمز عبور" onChange={(e) => setData({
                                ...data,
                                password2: e.target.value
                            })}/>
                        </div>
                        <div class="btn" onClick={() => sendData2()}>  
                            ایجاد حساب کاربری   
                        </div>
                    </form>
        
                    : 
                    <ActivationForm phone_number={data.phone_number} isRegister={true}/> }   
            </div>
        );
}

export default Register;