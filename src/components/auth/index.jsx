import React, { useState } from 'react';

import Login from './login';
import Register from './register';
import './auth-page.css';


function AuthPage() {
    const [isLoginActive, setIsLoginActive] = useState(true)
    const getLoginInfoFromSidebar = data => setIsLoginActive(data)
    const isUser = localStorage.getItem("user")

    //if (isUser) return window.location = '/'
    
        return (
            <div className="page-container">          
                <div className="right-side">
                    {isLoginActive ? <Login /> : <Register />}
                </div>      
                <div className="left-side">
                    <LeftSide parentCallback={getLoginInfoFromSidebar}/>
                </div>    
            </div>
        );
}

class LeftSide extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            loginState: {
                title: 'خوش آمدید!',
                text: 'از این قسمت می‌توانید به حساب کاربری خود وارد شوید.',
                button: 'ورود به حساب کاربری'
            },
            registerState: {
                title: 'خوش آمدید!',
                text: "از این قسمت می‌توانید برای خود یک حساب کاربری ایجاد کنید.",
                button: 'ایجاد حساب کاربری'
            },
            inLoginState: false
        }
    }

    changeLoginState = () => {
        const isInLoginState = this.state.inLoginState;
        this.setState({
            inLoginState: !isInLoginState
        });
        this.props.parentCallback(this.state.inLoginState);
    }

    render() {
        let inState;
        if (this.state.inLoginState) {
            inState = {
                title: this.state.loginState.title,
                text: this.state.loginState.text,
                button: this.state.loginState.button
            }
        } else {
            inState = {
                title: this.state.registerState.title,
                text: this.state.registerState.text,
                button: this.state.registerState.button
            }
        }

        return(
            <div className="left-container">
                <div className="loggo">
                    <h2>سامانه مدیریت خودروی ایپکو</h2>
                </div>
                <div className="left-content">
                    <h2 className="left-title">
                        {inState.title}
                    </h2>
                    <p className="left-text">
                        {inState.text}
                    </p>
                    <button className="left-btn" onClick={this.changeLoginState}>
                        {inState.button}
                    </button>
                </div>
            </div>
        );
    }
}

export default AuthPage;