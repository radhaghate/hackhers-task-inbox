const URL_PATTERN = /https?:\/\/[^\s<>()]+/gi;
const TRACKING_QUERY_PARAM_PREFIXES = ["utm_", "mc_", "vero_", "trk", "ref"];

/**
 * Strips tracking query parameters (utm_*, mailchimp mc_*, etc.) from URLs
 * and collapses obviously long click-tracking redirect URLs down to their
 * bare host, so the model isn't burning tokens on marketing-tracking noise
 * while still seeing that a link was present.
 */
export function stripTrackingLinks(body: string): string {
  return body.replace(URL_PATTERN, (rawUrl) => {
    try {
      const url = new URL(rawUrl);
      for (const key of [...url.searchParams.keys()]) {
        if (TRACKING_QUERY_PARAM_PREFIXES.some((prefix) => key.toLowerCase().startsWith(prefix))) {
          url.searchParams.delete(key);
        }
      }
      // Long opaque tracking-redirect paths (e.g. click.mailer.example.com/CL0/...)
      // carry no useful information for the model; keep just the host.
      if (url.pathname.length > 80 || /\/(click|track|CL0|wf)\//i.test(url.pathname)) {
        return `${url.protocol}//${url.host}/…`;
      }
      const query = url.searchParams.toString();
      return `${url.protocol}//${url.host}${url.pathname}${query ? `?${query}` : ""}`;
    } catch {
      return rawUrl;
    }
  });
}
