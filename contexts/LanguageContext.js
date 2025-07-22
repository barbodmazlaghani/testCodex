import React, { createContext, useContext, useState, useEffect } from 'react';

const LanguageContext = createContext();

export const translations = {
  fa: {
    landing_title: 'دستیار هوشمند مورد نظر را انتخاب کنید',
    start_chat: 'شروع چت',
    know_all: 'همه چیز دان',
    language_fa: 'فارسی',
    language_en: 'English'
  },
  en: {
    landing_title: 'Select the desired smart assistant',
    start_chat: 'Start Chat',
    know_all: 'Know-it-all',
    language_fa: 'Persian',
    language_en: 'English'
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('fa');

  useEffect(() => {
    const stored = localStorage.getItem('language');
    if (stored) setLanguage(stored);
  }, []);

  useEffect(() => {
    document.documentElement.dir = language === 'fa' ? 'rtl' : 'ltr';
  }, [language]);

  const switchLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key) => translations[language][key] || key;

  return (
    <LanguageContext.Provider value={{ language, switchLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
