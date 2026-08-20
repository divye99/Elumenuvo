import type { MetadataRoute } from "next";

/** Web app manifest: one more consistent "Elume" brand string for Chrome and
 *  Google's site-name detection (next to the WebSite JSON-LD and the H1). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Elume - India's Premier Electrical Marketplace",
    short_name: "Elume",
    description: "Wires and cables, switchgear, lighting, fans and modular switches from 24+ brands at one transparent price list.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#161D2B",
    icons: [{ src: "/icon.png", sizes: "512x512", type: "image/png" }],
  };
}
