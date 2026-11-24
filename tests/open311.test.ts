import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { submitServiceRequest, getServiceRequestStatus, Open311Error } from "@/lib/open311/client";

const config = { endpointUrl: "https://example-authority.test/open311/v2", jurisdictionId: "example.test" };

describe("Open311 GeoReport v2 client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("submits a service request and parses the GeoReport v2 array response", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toContain("/requests.json");
      expect(url).toContain("jurisdiction_id=example.test");
      expect(init?.method).toBe("POST");
      const body = new URLSearchParams(init?.body as string);
      expect(body.get("service_code")).toBe("POTHOLE");
      expect(body.get("lat")).toBe("13.05");
      return new Response(JSON.stringify([{ service_request_id: "SR-123", service_notice: "Thanks" }]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitServiceRequest(config, {
      serviceCode: "POTHOLE",
      lat: 13.05,
      lon: 80.25,
      description: "Pothole near the signal",
    });

    expect(result.serviceRequestId).toBe("SR-123");
    expect(result.serviceNoticeOrToken).toBe("Thanks");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("handles a plain object (non-array) success response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ service_request_id: 456, token: "tok-1" }), { status: 200 }))
    );
    const result = await submitServiceRequest(config, {
      serviceCode: "GARBAGE",
      lat: 13.05,
      lon: 80.25,
      description: "Garbage not collected",
    });
    expect(result.serviceRequestId).toBe("456");
    expect(result.serviceNoticeOrToken).toBe("tok-1");
  });

  it("throws Open311Error with the agency's error description on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ code: 400, description: "Invalid service_code" }]), { status: 400 }))
    );
    await expect(
      submitServiceRequest(config, { serviceCode: "BAD", lat: 0, lon: 0, description: "x" })
    ).rejects.toThrow(Open311Error);
  });

  it("fetches service request status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        expect(url).toContain("/requests/SR-123.json");
        return new Response(JSON.stringify([{ status: "closed", status_notes: "Fixed", updated_datetime: "2026-01-01T00:00:00Z" }]), {
          status: 200,
        });
      })
    );
    const status = await getServiceRequestStatus(config, "SR-123");
    expect(status.status).toBe("closed");
    expect(status.statusNotes).toBe("Fixed");
  });

  it("includes the api_key when configured", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toContain("api_key=secret-key");
      return new Response(JSON.stringify([{ status: "open" }]), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    await getServiceRequestStatus({ ...config, apiKey: "secret-key" }, "SR-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
