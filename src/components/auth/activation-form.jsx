import React, { useState, useEffect } from 'react';
import './form-style.css';
import axios from 'axios';
import { toast } from 'react-toastify';
import {useNavigate} from 'react-router-dom'

function ActivationForm(props) {
    const [activationCode, setActivationCode] = useState('');
    const [timer, setTimer] = useState(60);
    const [isTimerRunning, setIsTimerRunning] = useState(true);

    const navigate = useNavigate();

    useEffect(() => {
        if (isTimerRunning) {
            const timeout = setTimeout(() => {
                setTimer(timer - 1);
            }, 1000);
            if (timer === 0) {
                setIsTimerRunning(false);
            }
            return () => clearTimeout(timeout);
        }
    }, [timer, isTimerRunning]);


    const sendData = () => {
        axios.post('https://khodroai.com/api/rest-auth/registration/phone/activate', {
            phone_number: props.phone_number,
            code: activationCode
        }).then(res => {
            console.log(activationCode);    
                if(res.status === 200) {
                toast.success(props.isRegister?' حساب کاربری شما با موفقیت فعال شد': 'عملیات با موفقیت انجام شد')
                setTimeout( function() { navigate(0); }, 4000);
                
            }
        }).catch((e) => {
            console.log(activationCode);
            toast.error('مشکلی پیش آمده است')
        })
    }

    const resendCode = () => {
        // Code to resend the activation code to the user's phone number
        axios.post('https://khodroai.com/api/rest-auth/registration/phone/send-activation-code', {
            phone_number: props.phone_number
        }).then(res => {  
                if(res.status === 200) {
                toast.success('کد برای شماره تلفن شما ارسال شد')
            }
        }).catch((e) => {
            //toast.error(e?.message)
            toast.error('مشکلی پیش آمده است')
        })

        setIsTimerRunning(true);
        setTimer(60);
    }

    return (
        <form className="form" id="form2">
            <div >
                <p>کد فعال سازی برای شماره موبایل زیر ارسال شد </p>
                {props.phone_number} 
            </div>
            <div className="form-group">
                <input type="text" name="codeInput" placeholder="کد دریافتی" value={activationCode} id="codeInput" 
                    onChange={(e) => setActivationCode( e.target.value)}/>
            </div>
            <div className="btn" onClick={() => sendData()}>  
                تایید   
            </div> 
            <br/>
            {
                 !isTimerRunning ?
                <a href="#" onClick={() => resendCode()}>
                    <small>ارسال مجدد کد</small>
                </a>
                : <small>برای ارسال مجدد کد لطفا {timer} ثانیه صبر کنید</small>
            }
        </form>
    )
}

export default ActivationForm;
