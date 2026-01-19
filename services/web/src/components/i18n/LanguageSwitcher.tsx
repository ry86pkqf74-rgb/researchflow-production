/**
 * Language Switcher Component
 * Task 162: Runtime language switcher
 */

import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { supportedLanguages } from '@/i18n';

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    i18n.changeLanguage(newLang);
  };

  return (
    <div className="relative inline-flex items-center">
      <Globe className="w-4 h-4 absolute left-2 pointer-events-none text-muted-foreground" />
      <select
        value={i18n.language}
        onChange={handleChange}
        className="pl-8 pr-3 py-1.5 text-sm bg-background border border-input rounded-md appearance-none cursor-pointer hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label={t('accessibility.languageSelect')}
      >
        {supportedLanguages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeName}
          </option>
        ))}
      </select>
    </div>
  );
}
