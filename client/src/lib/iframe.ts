/**
 * Iframe Detection Utility
 * 
 * Detects if the app is running inside an iframe (e.g., Mission Control / Agent Hub Portal)
 * and provides popup-based authentication support for embedded contexts.
 */

/**
 * Check if the current window is running inside an iframe
 * Returns true if embedded, false if running directly
 */
export function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch (e) {
    // If access to window.top is denied due to cross-origin restrictions,
    // we're definitely in a cross-origin iframe
    return true;
  }
}

/**
 * Open a popup window for OAuth authentication
 * Used when running inside an iframe since Google blocks OAuth redirects in iframes
 */
export function openAuthPopup(
  url: string = '/auth/google/popup',
  onSuccess?: () => void,
  onError?: (error: string) => void
): Window | null {
  const width = 500;
  const height = 600;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const popup = window.open(
    url,
    'oauth_popup',
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
  );

  if (!popup) {
    onError?.('Popup blocked. Please allow popups for this site.');
    return null;
  }

  // Listen for messages from the popup
  const handleMessage = (event: MessageEvent) => {
    // Verify the message origin matches our expected domain
    const expectedOrigins = [
      window.location.origin,
      // Add any additional trusted origins if needed
    ];

    if (!expectedOrigins.includes(event.origin)) {
      return;
    }

    if (event.data?.type === 'oauth_success') {
      window.removeEventListener('message', handleMessage);
      popup.close();
      onSuccess?.();
    } else if (event.data?.type === 'oauth_error') {
      window.removeEventListener('message', handleMessage);
      popup.close();
      onError?.(event.data.error || 'Authentication failed');
    }
  };

  window.addEventListener('message', handleMessage);

  // Also poll to check if popup was closed without completing auth
  const pollClosed = setInterval(() => {
    if (popup.closed) {
      clearInterval(pollClosed);
      window.removeEventListener('message', handleMessage);
    }
  }, 500);

  return popup;
}
