import Script from "next/script";

/**
 * Google tag (gtag.js) - loads once, site-wide, after hydration so it never
 * competes with page paint. Page views are automatic; the purchase event
 * fires on /order-confirmed with the real order value (see lib/gtag.ts).
 */
const GTAG_ID = "GT-K8FCVR7R";

export default function GoogleTag() {
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GTAG_ID}`} strategy="afterInteractive" />
      <Script id="gtag-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GTAG_ID}');`}
      </Script>
    </>
  );
}
