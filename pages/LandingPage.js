import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getChatbotInfo } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import './LandingPage.css';

// A more modern color palette
const colors = ['#FF8A65', '#4DB6AC', '#9575CD', '#F06292', '#BA68C8', '#7986CB'];

const LandingPage = () => {
  const [sections, setSections] = useState([]); // all sections from API
  const [pmoSections, setPmoSections] = useState([]); // sections starting with 'پروژه'
  const [mainSections, setMainSections] = useState([]); // main list shown by default
  const [showPmo, setShowPmo] = useState(false); // whether PMO subsections are shown
  const [selected, setSelected] = useState(null);
  const navigate = useNavigate();
  const { t, language, switchLanguage } = useLanguage();

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    getChatbotInfo()
      .then(res => {
        if (res.data?.sections) {
          const all = res.data.sections;
          const pmo = all.filter(s => s.includes('پروژه'));
          const main = all.filter(s => !s.includes('پروژه'));
          setSections(all);
          setPmoSections(pmo);
          setMainSections([...main, 'PMO']);
        }
      })
      .catch(() => {});

    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const radius = windowWidth < 450 ? (showPmo ? 135 : 150) : (showPmo ? 180 : 200);
  const circleSize = windowWidth < 450 ? (showPmo ? 112.5 : 90) : (showPmo ? 150 : 120); // Adjust circle size
  console.log("RADIUS",radius,circleSize)
  const handleSelect = (section) => {
    setSelected(section);
    localStorage.setItem('selectedChatSections', JSON.stringify([section]));
    navigate('/chat/new');
  };

  const handleAll = () => {
    setSelected(null);
    localStorage.setItem('selectedChatSections', JSON.stringify(sections));
    navigate('/chat/new');
  };

  return (
    <div className="landing-container">
      <div className="language-switch">
        <button
          onClick={() => switchLanguage('fa')}
          disabled={language==='fa'}
          className={language==='fa' ? 'active' : ''}
        >
          {t('language_fa')}
        </button>
        <button
          onClick={() => switchLanguage('en')}
          disabled={language==='en'}
          className={language==='en' ? 'active' : ''}
        >
          {t('language_en')}
        </button>
      </div>
      <h2>{t('landing_title')}</h2>
      <div
        className="circle-container"
        onMouseLeave={() => setShowPmo(false)} // Reset PMO mode when mouse leaves
      >
        {(showPmo ? pmoSections : mainSections).map((section, idx) => {
          const list = showPmo ? pmoSections : mainSections;
          const angle = (360 / list.length) * idx;
          const style = {
            backgroundColor: colors[idx % colors.length],
            transform: `rotate(${angle}deg) translate(${radius}px) rotate(-${angle}deg)`,
            width: circleSize + 'px', // Dynamic circle size
            height: circleSize + 'px', // Dynamic circle size
          };
          const isPmo = section === 'PMO';
          return (
            <div
              key={section}
              className={`section-circle ${selected === section ? 'selected' : ''}`}
              style={style}
              onClick={() => (isPmo ? setShowPmo(true) : handleSelect(section))}
              onMouseEnter={() => isPmo && setShowPmo(true)}
            >
              {section}
            </div>
          );
        })}
        <button className="center-button" onClick={handleAll}>{t('know_all')}</button>
      </div>
    </div>
  );
};

export default LandingPage;
