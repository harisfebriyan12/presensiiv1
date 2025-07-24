import React from 'react';
import { Globe } from 'lucide-react';
import { useLanguage } from '../utils/languageContext';

const LanguageSelector = ({ className = '' }) => {
  const { language, changeLanguage, t } = useLanguage();

  return (
    <div className={`relative ${className}`}>
      <select
        value={language}
        onChange={(e) => changeLanguage(e.target.value)}
            className="appearance-none bg-white border border-gray-300 rounded-lg px-8 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-tosca-500 focus:border-transparent"
      >
        <option value="id">🇮🇩 Indonesia</option>
        <option value="en">🇺🇸 English</option>
      </select>
      <Globe className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
    </div>
  );
};

export default LanguageSelector;