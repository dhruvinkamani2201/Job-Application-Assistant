export interface FetchJobResult {
  ok: boolean;
  text: string;
  error?: string;
}

const BLOCK_TAGS = /<(script|style|noscript|svg|header|footer|nav)[^>]*>[\s\S]*?<\/\1>/gi;

/**
 * Fetches a job posting URL and returns cleaned, readable text.
 * Handles common failure modes (network errors, non-HTML responses,
 * bot-blocked/login-walled pages) without throwing, so the caller can
 * store a clear "extraction_status" instead of crashing the request.
 */
export async function fetchJobPageText(url: string): Promise<FetchJobResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, text: "", error: "That doesn't look like a valid URL." };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { ok: false, text: "", error: "Only http/https URLs are supported." };
  }

  let response: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    response = await fetch(parsed.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; JobAppAssistant/1.0; +personal-use-tool)",
        Accept: "text/html,application/xhtml+xml"
      }
    });
    clearTimeout(timeout);
  } catch (err) {
    return {
      ok: false,
      text: "",
      error: `Could not reach that URL (${(err as Error).message}). The page may be down or blocking automated requests.`
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      text: "",
      error: `The page returned HTTP ${response.status}. It may require login or no longer exist.`
    };
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
    return {
      ok: false,
      text: "",
      error: `Unexpected content type (${contentType || "unknown"}) — this may not be a standard job posting page.`
    };
  }

  const html = await response.text();
  const text = htmlToText(html);

  if (text.length < 200) {
    return {
      ok: false,
      text,
      error:
        "Very little text was found on the page. It may render its content with JavaScript that this tool can't execute, or be behind a login wall. Try pasting the job description text manually instead."
    };
  }

  return { ok: true, text };
}

function htmlToText(html: string): string {
  const withoutBlocks = html.replace(BLOCK_TAGS, " ");
  const withoutTags = withoutBlocks.replace(/<[^>]+>/g, " ");
  const decoded = withoutTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  return decoded.replace(/\s+/g, " ").trim();
}
