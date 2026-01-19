/**
 * Skip to Content Link
 * Task 178: Accessibility improvements
 */

import { useTranslation } from 'react-i18next';

export function SkipLink() {
  const { t } = useTranslation();

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none"
    >
      {t('accessibility.skipToContent', 'Skip to main content')}
    </a>
  );
}
