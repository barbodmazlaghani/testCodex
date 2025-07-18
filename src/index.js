import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles.css';
import 'leaflet/dist/leaflet.css';
import reportWebVitals from './reportWebVitals';
import App from './App';
import './fonts/Vazir.ttf'
import 'react-toastify/dist/ReactToastify.css';
import { ToastContainer } from 'react-toastify';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <div>
    <App />
    <ToastContainer 
    position="top-left"/>
  </div>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
