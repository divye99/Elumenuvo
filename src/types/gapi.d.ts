/** Google's platform.js globals, used by the Customer Reviews opt-in on the
 *  order-confirmed screen. */
declare global {
  interface Window {
    gapi?: {
      load: (lib: string, cb: () => void) => void;
      surveyoptin?: { render: (opts: Record<string, unknown>) => void };
    };
    /** onload callback name referenced in the platform.js script URL. */
    renderOptIn?: () => void;
  }
}

export {};
