import { getConfigCell } from "./sheet-config";

/**
 * The Chat webhook is a secret, so it is kept outside the repository.
 * Hosted environments may provide it as GOOGLE_CHAT_WEBHOOK_URL; locally
 * (and on Netlify, where only five secrets are stored) it lives in a hidden
 * `_Config` tab of the same Google Sheet.
 */
export async function getGoogleChatWebhookUrl(): Promise<string | null> {
  return process.env.GOOGLE_CHAT_WEBHOOK_URL?.trim() || getConfigCell("A2");
}
