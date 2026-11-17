import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        title="Install app on this device"
        className="border border-black bg-white px-2.5 py-1 text-xs font-semibold text-black hover:bg-neutral-100 dark:border-white dark:bg-black dark:text-white dark:hover:bg-neutral-900 whitespace-nowrap shrink-0"
      >
        INSTALL
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          title="Install app on this device"
          className="border border-black bg-white px-2.5 py-1 text-xs font-semibold text-black hover:bg-neutral-100 dark:border-white dark:bg-black dark:text-white dark:hover:bg-neutral-900 whitespace-nowrap shrink-0"
        >
          INSTALL
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ios-install-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-mono"
          >
            <div className="w-full max-w-sm border-2 border-black bg-white p-5 text-black dark:border-white dark:bg-black dark:text-white">
              <h2 id="ios-install-title" className="text-sm font-bold">
                INSTALL ON IPHONE / IPAD
              </h2>
              <p className="mt-2.5 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300">
                1. Tap the <strong>Share</strong> button in Safari.
                <br />
                2. Scroll down and tap <strong>Add to Home Screen</strong>.
              </p>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-4 w-full border border-black bg-black py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 dark:border-white dark:bg-white dark:text-black dark:hover:bg-neutral-200"
              >
                CLOSE
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
