import React from 'react';
import { FaMoon, FaSun } from 'react-icons/fa';
import { useTheme } from '../theme/ThemeContext';

const ThemeToggle = ({ className = '', buttonClassName = '' }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      className={`theme-toggle-button ${buttonClassName}`}
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? (
        <FaSun className="theme-toggle-icon" />
      ) : (
        <FaMoon className="theme-toggle-icon" />
      )}
    </button>
  );
};

export default ThemeToggle; 