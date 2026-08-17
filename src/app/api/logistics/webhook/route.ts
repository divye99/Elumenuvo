/**
 * Alias for the Shiprocket status webhook. Shiprocket's panel rejects any
 * webhook URL containing "shiprocket", "kartrocket", "sr" or "kr", so the
 * canonical /api/shiprocket/webhook path can never be registered there.
 * Register THIS path instead:
 *   URL:   https://elumenuvo.com/api/logistics/webhook
 *   Auth:  x-api-key = SHIPROCKET_WEBHOOK_TOKEN env value
 * Handler logic lives in ../../shiprocket/webhook/route.ts.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export { POST } from "../../shiprocket/webhook/route";
