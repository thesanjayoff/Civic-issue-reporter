/**
 * Open311 GeoReport v2 client (http://wiki.open311.org/GeoReport_v2). Generic
 * on purpose — it isn't wired to any specific agency. Per the product
 * principles, this only ever talks to an authority's endpoint when that
 * authority has published one AND a human has set
 * open311_authorities.enabled = true for it with a documented permission
 * URL recorded alongside. As of this build no verified Chennai agency is
 * known to publish a GeoReport v2 endpoint — see README "Known limitations".
 */

export interface Open311Config {
  endpointUrl: string; // e.g. "https://example-authority.gov/open311/v2"
  jurisdictionId: string;
  apiKey?: string;
}

export interface Open311ServiceRequestInput {
  serviceCode: string;
  lat: number;
  lon: number;
  addressString?: string;
  description: string;
  mediaUrl?: string;
  email?: string;
  deviceId?: string; // sent as an extended attribute, never a phone number
}

export interface Open311SubmitResult {
  serviceRequestId: string | null;
  serviceNoticeOrToken: string | null;
  accountId: string | null;
}

export interface Open311StatusResult {
  serviceRequestId: string;
  status: "open" | "closed" | string;
  statusNotes: string | null;
  updatedDatetime: string | null;
}

export class Open311Error extends Error {
  constructor(
    message: string,
    public readonly code: string | number | null,
    public readonly raw: unknown
  ) {
    super(message);
    this.name = "Open311Error";
  }
}

function buildUrl(config: Open311Config, path: string, params: Record<string, string | undefined>): string {
  const url = new URL(path.replace(/^\//, ""), config.endpointUrl.endsWith("/") ? config.endpointUrl : `${config.endpointUrl}/`);
  url.searchParams.set("jurisdiction_id", config.jurisdictionId);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, v);
  }
  return url.toString();
}

async function parseJsonOrThrow(response: Response): Promise<unknown> {
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const firstError = Array.isArray(body) ? body[0] : body;
    throw new Open311Error(
      (firstError && typeof firstError === "object" && "description" in firstError && String((firstError as { description: unknown }).description)) ||
        `Open311 request failed with HTTP ${response.status}`,
      (firstError && typeof firstError === "object" && "code" in firstError ? (firstError as { code: unknown }).code : response.status) as string | number | null,
      body
    );
  }
  return body;
}

export async function submitServiceRequest(
  config: Open311Config,
  input: Open311ServiceRequestInput
): Promise<Open311SubmitResult> {
  const url = buildUrl(config, "requests.json", {});
  const form = new URLSearchParams({
    service_code: input.serviceCode,
    lat: String(input.lat),
    long: String(input.lon),
    description: input.description,
  });
  if (input.addressString) form.set("address_string", input.addressString);
  if (input.mediaUrl) form.set("media_url", input.mediaUrl);
  if (input.email) form.set("email", input.email);
  if (input.deviceId) form.set("attribute[OORU_KURAL_DEVICE_ID]", input.deviceId);
  if (config.apiKey) form.set("api_key", config.apiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const body = await parseJsonOrThrow(response);
  const first = Array.isArray(body) ? body[0] : body;
  const rec = (first ?? {}) as Record<string, unknown>;

  return {
    serviceRequestId: typeof rec.service_request_id === "string" ? rec.service_request_id : rec.service_request_id != null ? String(rec.service_request_id) : null,
    serviceNoticeOrToken: typeof rec.service_notice === "string" ? rec.service_notice : typeof rec.token === "string" ? rec.token : null,
    accountId: rec.account_id != null ? String(rec.account_id) : null,
  };
}

export async function getServiceRequestStatus(config: Open311Config, serviceRequestId: string): Promise<Open311StatusResult> {
  const url = buildUrl(config, `requests/${encodeURIComponent(serviceRequestId)}.json`, config.apiKey ? { api_key: config.apiKey } : {});
  const response = await fetch(url);
  const body = await parseJsonOrThrow(response);
  const first = Array.isArray(body) ? body[0] : body;
  const rec = (first ?? {}) as Record<string, unknown>;

  return {
    serviceRequestId,
    status: typeof rec.status === "string" ? rec.status : "unknown",
    statusNotes: typeof rec.status_notes === "string" ? rec.status_notes : null,
    updatedDatetime: typeof rec.updated_datetime === "string" ? rec.updated_datetime : null,
  };
}
