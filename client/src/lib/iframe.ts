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

  // Track whether auth completed (success or error)
  let authCompleted = false;

  // Listen for messages from the popup
  const handleMessage = (event: MessageEvent) => {
    // Verify the message origin matches our expected domain
    if (event.origin !== window.location.origin) {
      return;
    }

    if (event.data?.type === 'oauth_success') {
      authCompleted = true;
      cleanup();
      onSuccess?.();
    } else if (event.data?.type === 'oauth_error') {
      authCompleted = true;
      cleanup();
      onError?.(event.data.error || 'Authentication failed');
    }
  };

  // Cleanup function to remove listeners and close popup
  const cleanup = () => {
    window.removeEventListener('message', handleMessage);
    clearInterval(pollClosedInterval);
    if (popup && !popup.closed) {
      popup.close();
    }
  };

  window.addEventListener('message', handleMessage);

  // Poll to check if popup was closed without completing auth
  // If closed without a success/error message, treat as user cancellation
  const pollClosedInterval = setInterval(() => {
    if (popup.closed) {
      clearInterval(pollClosedInterval);
      window.removeEventListener('message', handleMessage);
      // If popup closed without auth completing, treat as cancellation
      if (!authCompleted) {
        onError?.('Authentication cancelled');
      }
    }
  }, 500);

  return popup;
}
