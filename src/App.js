import logo from './logo.svg';
import './App.css';
import CarApp from "./CarApp";
import React from 'react';
import {BrowserRouter, Route, Routes} from 'react-router-dom';
import AuthPage from './components/auth/index';
import PasswordReset from './components/auth/password-reset';
import SideBar from "./components/sidebar/sidebar";
import Monitoring from "./Monitoring";
import Summary from "./Summary";
import PasswordChange from './components/auth/change-password';
import AI from "./components/AI/AI";


// function App() {
//   return (
//     <div className="App">
//       <header className="App-header">
//         <CarApp/>
//       </header>
//     </div>
//   );
// }


function App() {
    return (
        <BrowserRouter>
            <div className="App">
                <Routes>
                    <Route path="/" exact element={
                        <CarApp/>
                    }/>
                    <Route path="/monitoring" element={<Monitoring/>}/>
                    <Route path="/summary" element={<Summary/>}/>
                    <Route path="/login-register" element={<AuthPage/>}/>
                    <Route path="/reset-password" element={<PasswordReset/>}/>
                    <Route path="/change-password" element={<PasswordChange/>}/>
                    <Route path="/ai" element={<AI/>}/>
                </Routes>
            </div>
        </BrowserRouter>
    );
}

export default App;
