/**
 * Google's platform.js globals, declared once.
 *
 * Two components use it — the Customer Reviews opt-in on the order-confirmed
 * screen and the seller-rating badge in the layout — and TypeScript rejects
 * the same global being described differently in two files.
 */
declare global {
  interface Window {
    gapi?: {
      load: (lib: string, cb: () => void) => void;
      surveyoptin?: { render: (opts: Record<string, unknown>) => void };
      ratingbadge?: { render: (container: Element, opts: Record<string, unknown>) => void };
    };
    /** onload callback names referenced in the platform.js script URLs. */
    renderOptIn?: () => void;
    renderBadge?: () => void;
  }
}

export {};
