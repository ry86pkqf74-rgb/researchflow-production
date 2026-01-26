import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SUPPORTED_LANGUAGES, changeLanguage, type SupportedLanguage } from '@/i18n';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Language Selector Component (Task 22)
 *
 * Allows users to select their preferred language.
 * Persists choice to localStorage and syncs with backend preferences.
 */

interface LanguageSelectorProps {
  /** Variant style */
  variant?: 'default' | 'compact' | 'inline';
  /** Additional class name */
  className?: string;
  /** Show label */
  showLabel?: boolean;
}

export function LanguageSelector({
  variant = 'default',
  className,
  showLabel = true,
}: LanguageSelectorProps) {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language as SupportedLanguage;

  const handleChange = async (value: string) => {
    try {
      await changeLanguage(value as SupportedLanguage);
    } catch (error) {
      console.error('Failed to change language:', error);
    }
  };

  if (variant === 'compact') {
    return (
      <Select value={currentLanguage} onValueChange={handleChange}>
        <SelectTrigger
          className={cn('w-auto gap-2', className)}
          aria-label={t('settings.language.title')}
        >
          <Globe className="h-4 w-4" />
          <SelectValue>
            {SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage)?.nativeName || 'English'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((language) => (
            <SelectItem key={language.code} value={language.code}>
              <span className="flex items-center gap-2">
                <span>{language.nativeName}</span>
                <span className="text-xs text-muted-foreground">({language.name})</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Globe className="h-4 w-4 text-muted-foreground" />
        <Select value={currentLanguage} onValueChange={handleChange}>
          <SelectTrigger className="w-[140px]" aria-label={t('settings.language.title')}>
            <SelectValue>
              {SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage)?.nativeName}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((language) => (
              <SelectItem key={language.code} value={language.code}>
                {language.nativeName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Default variant with label
  return (
    <div className={cn('space-y-2', className)}>
      {showLabel && (
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-muted-foreground" />
          <label className="text-sm font-medium">{t('settings.language.title')}</label>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{t('settings.language.description')}</p>
      <Select value={currentLanguage} onValueChange={handleChange}>
        <SelectTrigger className="w-full max-w-xs" aria-label={t('settings.language.title')}>
          <SelectValue>
            {SUPPORTED_LANGUAGES.find(l => l.code === currentLanguage)?.nativeName}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LANGUAGES.map((language) => (
            <SelectItem key={language.code} value={language.code}>
              <span className="flex items-center gap-2">
                <span>{language.nativeName}</span>
                <span className="text-xs text-muted-foreground">({language.name})</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Language button for header/navbar
 */
export function LanguageButton({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const currentLanguage = SUPPORTED_LANGUAGES.find(l => l.code === i18n.language);

  return (
    <LanguageSelector
      variant="compact"
      className={className}
      showLabel={false}
    />
  );
}
