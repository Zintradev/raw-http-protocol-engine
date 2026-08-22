"use strict";

const net = require("net");
const tls = require("tls");

// ─── URL PARSER ───────────────────────────────────────────────────────────────

function parseUrl(url) {
  const isHttps = url.startsWith("https://");
  const match = url.match(/^https?:\/\/([^/:]+)(?::(\d+))?(\/.*)?$/);
  if (!match) throw new Error(`Invalid URL: ${url}`);
  return {
    host: match[1],
    port: match[2] ? parseInt(match[2], 10) : isHttps ? 443 : 80,
    path: match[3] || "/",
    isHttps,
  };
}

// ─── MESSAGE BUILDER ──────────────────────────────────────────────────────────

function buildRequest(method, path, host, headers = {}, body = null) {
  const bodyStr = body ? JSON.stringify(body) : "";

  const allHeaders = {
    Host: host,
    "Content-Type": "application/json",
    ...headers,
  };

  if (bodyStr.length > 0) {
    allHeaders["Content-Length"] = Buffer.byteLength(bodyStr, "utf8");
  }

  let message = `${method} ${path} HTTP/1.1\r\n`;

  for (const [key, value] of Object.entries(allHeaders)) {
    message += `${key}: ${value}\r\n`;
  }

  message += "\r\n";

  if (bodyStr.length > 0) {
    message += bodyStr;
  }

  return message;
}

// ─── CHUNKED DECODER ──────────────────────────────────────────────────────────

function decodeChunked(raw) {
  let result = "";
  let i = 0;

  while (i < raw.length) {
    const crlfPos = raw.indexOf("\r\n", i);
    if (crlfPos === -1) break;

    const sizeLine = raw.substring(i, crlfPos).trim();
    const chunkSize = parseInt(sizeLine, 16);

    if (isNaN(chunkSize) || chunkSize === 0) break;

    const chunkStart = crlfPos + 2;
    result += raw.substring(chunkStart, chunkStart + chunkSize);
    i = chunkStart + chunkSize + 2;
  }

  return result;
}

// ─── RESPONSE PARSER ──────────────────────────────────────────────────────────

function parseResponse(rawResponse) {
  const headerEnd = rawResponse.indexOf("\r\n\r\n");

  const rawHeaders = rawResponse.substring(0, headerEnd);
  let body = rawResponse.substring(headerEnd + 4);

  const lines = rawHeaders.split("\r\n");

  const statusLine = lines[0];
  const statusParts = statusLine.split(" ");
  const statusCode = parseInt(statusParts[1], 10);
  const statusText = statusParts.slice(2).join(" ");

  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const separatorIdx = line.indexOf(":");
    if (separatorIdx !== -1) {
      const key = line.substring(0, separatorIdx).trim().toLowerCase();
      const value = line.substring(separatorIdx + 1).trim();
      headers[key] = value;
    }
  }

  if (headers["transfer-encoding"] === "chunked") {
    body = decodeChunked(body);
  }

  return { statusCode, statusText, headers, body };
}

// ─── MAIN REQUEST FUNCTION ────────────────────────────────────────────────────

function request({ method, url, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const { host, port, path, isHttps } = parseUrl(url); 
    const message = buildRequest(method, path, host, headers, body);

    const socket = isHttps
      ? tls.connect({ port, host, servername: host }, () =>
          socket.write(message),
        )
      : net.createConnection({ port, host }, () => socket.write(message));

    let responseChunks = [];

    socket.on("data", (chunk) => {
      responseChunks.push(chunk);
      const rawBuffer = Buffer.concat(responseChunks);

      const headerEnd = rawBuffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;

      const rawHeaders = rawBuffer.subarray(0, headerEnd).toString("utf8");
      const clMatch = rawHeaders.match(/content-length:\s*(\d+)/i);
      const isChunked = /transfer-encoding:\s*chunked/i.test(rawHeaders);

      if (clMatch) {
        const contentLength = parseInt(clMatch[1], 10);
        const bodyReceived = rawBuffer.length - (headerEnd + 4);

        if (bodyReceived >= contentLength) {
          socket.destroy(); 
          resolve(parseResponse(rawBuffer.toString("binary")));
        }
      } else if (isChunked) {
        if (rawBuffer.includes("0\r\n\r\n")) {
          socket.destroy(); 
          resolve(parseResponse(rawBuffer.toString("binary")));
        }
      }
    });

    socket.on("end", () => {
      const rawBuffer = Buffer.concat(responseChunks);
      if (rawBuffer.length > 0) {
        resolve(parseResponse(rawBuffer.toString("binary")));
      }
    });

    socket.on("error", (err) => {
      reject(new Error(`Socket error: ${err.message}`));
    });

    socket.setTimeout(10000);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("Request timed out after 10s"));
    });
  });
}

module.exports = { request, parseUrl, buildRequest, parseResponse };