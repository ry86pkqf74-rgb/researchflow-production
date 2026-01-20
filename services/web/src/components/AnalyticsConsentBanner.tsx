/**
 * Analytics Consent Banner
 *
 * Displays a banner requesting analytics consent when:
 * - Consent status has been loaded from server
 * - Analytics consent has not been granted
 *
 * PHI-safe: Analytics collects only IDs, counts, and feature identifiers.
 *
 * @module components/AnalyticsConsentBanner
 */

import React, { useEffect } from 'react';
import { useConsentStore } from '@/stores/consent-store';
import { X, BarChart2 } from 'lucide-react';

export const AnalyticsConsentBanner: React.FC = () => {
  const {
    analyticsGranted,
    loaded,
    loading,
    loadFromServer,
    grantAnalytics,
  } = useConsentStore();

  // Load consent status on mount
  useEffect(() => {
    if (!loaded) {
      loadFromServer();
    }
  }, [loaded, loadFromServer]);

  // Don't show banner if:
  // - Consent status not loaded yet
  // - Analytics already granted
  // - Loading in progress
  if (!loaded || analyticsGranted || loading) {
    return null;
  }

  const handleAllow = async () => {
    await grantAnalytics();
  };

  const handleDismiss = () => {
    // Just dismiss the banner - don't store anything
    // This keeps the banner from showing again until page refresh
    // User can re-enable in settings later
    useConsentStore.setState({ loaded: false });
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-lg dark:bg-gray-800 dark:border-gray-700">
      <div className="max-w-4xl mx-auto flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg dark:bg-blue-900">
          <BarChart2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            Help us improve ResearchFlow
          </h3>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            We collect anonymous usage events (no PHI or personal data) to improve the platform.
            This is completely optional and you can change your preference anytime in settings.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleDismiss}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            No thanks
          </button>
          <button
            onClick={handleAllow}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Allow analytics'}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            aria-label="Dismiss"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsConsentBanner;
