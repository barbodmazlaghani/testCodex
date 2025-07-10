import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import './sidebar.css';
import {useNavigate} from 'react-router-dom'
import { useEffect, useState } from 'react';
import axios from 'axios';
// import cats from './categories.json';

function SideBar() {
    const isUser = localStorage.getItem("user")
    const navigate = useNavigate()

    const logout = () => {
        localStorage.clear()
        navigate('/')
    }

        return (
            
            <div className="side-bar">
                <h2 className="main-page-loggo">
                    خبرها
                </h2>
                {isUser?(<>
                    <Link to="/profile" className="navigation-btn">
                    حساب کاربری
                    </Link>
                    <Link to="/new-post" className="navigation-btn">
                        ارسال خبر
                    </Link>
                    <div onClick={() => logout()} className="navigation-btn logout">
                        خروج از حساب کاربری
                    </div>
                </>)
                :(
                <Link to="/login-register" className="navigation-btn">
                ورود یا ثبت نام
                </Link>
                )}

                <br/>
                <Link to="/posts" className="navigation-btn" reloadDocument>
                    همه خبر ها
                </Link>
                {/*{cats.results && cats.results.map((cat) => (*/}
                {/*    <Link to={`/category/${cat.name}`} className="navigation-btn" reloadDocument >*/}
                {/*    {cat.faName}*/}
                {/*    </Link>*/}
                {/*))}*/}
            </div>
        );
}

export default SideBar;