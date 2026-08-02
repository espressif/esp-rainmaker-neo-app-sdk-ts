/*
 * SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
 *
 * SPDX-License-Identifier: Apache-2.0
 */

// utils/awsSigv4Utils.ts

export interface GenerateSigV4AuthHeaderParams {
  accessKey: string;
  secretKey: string;
  timestamp: string;
  dateStamp: string;
  region: string;
  service: string;
  method: string;
  canonicalURI: string;
  canonicalQueryString: string;
  requestHeaders: Record<string, string>;
  signedHeaders: string;
  payloadHash: string;
}

/**
 * Generates the full AWS SigV4 Authorization header for HTTP requests.
 * Consolidates canonical request, string-to-sign, signature calculation, and header building.
 */
export function generateSigV4AuthHeader(
  params: GenerateSigV4AuthHeaderParams
): string {
  const {
    accessKey,
    secretKey,
    timestamp,
    dateStamp,
    region,
    service,
    method,
    canonicalURI,
    canonicalQueryString,
    requestHeaders,
    signedHeaders,
    payloadHash,
  } = params;

  const canonicalRequest = buildCanonicalRequest(
    method,
    canonicalURI,
    canonicalQueryString,
    requestHeaders,
    signedHeaders,
    payloadHash
  );

  const stringToSign = buildStringToSign(
    timestamp,
    dateStamp,
    region,
    service,
    canonicalRequest
  );

  const signature = calculateSignature(
    secretKey,
    dateStamp,
    region,
    service,
    stringToSign
  );

  return createAuthorizationHeader(
    accessKey,
    dateStamp,
    region,
    service,
    signature,
    signedHeaders
  );
}

function buildCanonicalRequest(
  httpMethod: string,
  canonicalURI: string,
  canonicalQueryString: string,
  canonicalHeaders: Record<string, string>,
  signedHeaders: string,
  payloadHash: string
): string {
  const sortedHeaders = Object.entries(canonicalHeaders).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  const canonicalHeadersString = sortedHeaders
    .map(([key, value]) => `${key}:${value}\n`)
    .join("");
  return [
    httpMethod,
    canonicalURI,
    canonicalQueryString,
    canonicalHeadersString,
    signedHeaders,
    payloadHash,
  ].join("\n");
}

function buildStringToSign(
  timestamp: string,
  dateStamp: string,
  regionName: string,
  serviceName: string,
  canonicalRequest: string
): string {
  const scope = `${dateStamp}/${regionName}/${serviceName}/aws4_request`;
  const hashedRequest = (crypto as any)
    .createHash("sha256")
    .update(canonicalRequest)
    .digest("hex");
  return ["AWS4-HMAC-SHA256", timestamp, scope, hashedRequest].join("\n");
}

function calculateSignature(
  secretKey: string,
  dateStamp: string,
  regionName: string,
  serviceName: string,
  stringToSign: string
): string {
  const kSecret = `AWS4${secretKey}`;
  const kDate = hmac(kSecret, dateStamp) as Buffer;
  const kRegion = hmac(kDate, regionName) as Buffer;
  const kService = hmac(kRegion, serviceName) as Buffer;
  const kSigning = hmac(kService, "aws4_request") as Buffer;
  return hmac(kSigning, stringToSign, "hex") as string;
}

/**
 * Builds the AWS Signature Version 4 Authorization header value for HTTP requests.
 */
export function createAuthorizationHeader(
  accessKey: string,
  dateStamp: string,
  regionName: string,
  serviceName: string,
  signature: string,
  signedHeaders: string
): string {
  return `AWS4-HMAC-SHA256 Credential=${accessKey}/${dateStamp}/${regionName}/${serviceName}/aws4_request, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

/** Parameters for AWS IoT Core MQTT-over-WebSocket presigned URL (SigV4, service `iotdevicegateway`). */
export interface IotDeviceGatewayMqttSignedUrlParams {
  accessKey: string;
  secretKey: string;
  sessionToken?: string;
  /** IoT endpoint hostname only, e.g. `xxxx-ats.iot.ap-south-1.amazonaws.com` */
  host: string;
  awsRegion: string;
  /** Presigned URL lifetime in seconds. Default 86400 (24h). */
  expiresSeconds?: number;
  /** MQTT WebSocket path; default `/mqtt`. */
  canonicalUri?: string;
}

function sha256HexUtf8(data: string): string {
  return (crypto as any).createHash("sha256").update(data, "utf8").digest("hex");
}

function awsUriEncodeComponent(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, (c) => {
    const code = c.charCodeAt(0);
    return `%${code.toString(16).toUpperCase().padStart(2, "0")}`;
  });
}

/**
 * Builds the SigV4 canonical query string from parsed query parameters: each
 * name and value URI-encoded (RFC 3986, including `!'()*`), pairs sorted by
 * encoded name then encoded value (code-point order, per the SigV4 spec).
 *
 * API Gateway canonicalizes the incoming query string this way before
 * verifying the signature, so signing the raw (unsorted) query string breaks
 * every request whose parameters are not already in sorted order.
 */
export function buildCanonicalQueryString(
  searchParams: URLSearchParams
): string {
  const pairs: [string, string][] = [];
  searchParams.forEach((value, name) => {
    pairs.push([awsUriEncodeComponent(name), awsUriEncodeComponent(value)]);
  });
  pairs.sort(([nameA, valueA], [nameB, valueB]) => {
    if (nameA !== nameB) return nameA < nameB ? -1 : 1;
    if (valueA !== valueB) return valueA < valueB ? -1 : 1;
    return 0;
  });
  return pairs.map(([name, value]) => `${name}=${value}`).join("&");
}

/**
 * Builds a presigned `wss://` URL for AWS IoT Core MQTT over WebSocket using
 * query-string SigV4 (service `iotdevicegateway`, signed headers: `host`).
 *
 * Same signing flow as HTTP SigV4 in this module (`calculateSignature`, canonical request layout).
 */
export function generateIotDeviceGatewayMqttSignedUrl(
  params: IotDeviceGatewayMqttSignedUrlParams
): string {
  const {
    accessKey,
    secretKey,
    sessionToken,
    host,
    awsRegion,
    expiresSeconds = 86400,
    canonicalUri = "/mqtt",
  } = params;

  const now = new Date();
  const amzdate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const datestamp = amzdate.slice(0, 8);
  const service = "iotdevicegateway";
  const credentialScope = `${datestamp}/${awsRegion}/${service}/aws4_request`;

  const queryPairs: [string, string][] = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${accessKey}/${credentialScope}`],
    ["X-Amz-Date", amzdate],
    ["X-Amz-Expires", String(expiresSeconds)],
    ["X-Amz-SignedHeaders", "host"],
  ];
  if (sessionToken) {
    queryPairs.push(["X-Amz-Security-Token", sessionToken]);
  }
  queryPairs.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalQuerystring = queryPairs
    .map(([k, v]) => `${awsUriEncodeComponent(k)}=${awsUriEncodeComponent(v)}`)
    .join("&");

  const canonicalHeaders = `host:${host}\n`;
  const signedHeaders = "host";
  const payloadHash = sha256HexUtf8("");

  const canonicalRequest = [
    "GET",
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzdate,
    credentialScope,
    sha256HexUtf8(canonicalRequest),
  ].join("\n");

  const signature = calculateSignature(
    secretKey,
    datestamp,
    awsRegion,
    service,
    stringToSign
  );

  return `wss://${host}${canonicalUri}?${canonicalQuerystring}&X-Amz-Signature=${signature}`;
}

function hmac(
  key: string | Buffer,
  data: string,
  encoding?: "hex"
): Buffer | string {
  const h = (crypto as any).createHmac("sha256", key).update(data);
  return encoding ? h.digest(encoding) : h.digest();
}
