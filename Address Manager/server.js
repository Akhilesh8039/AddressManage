const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const root = __dirname;
const dataDir = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(root, "data");
const dataFile = path.join(dataDir, "addresses.json");
const port = process.env.PORT || 3000;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (url.pathname === "/api/addresses" && request.method === "GET") {
      return sendJson(response, 200, await readAddresses());
    }

    if (url.pathname === "/api/addresses" && request.method === "POST") {
      const payload = await readBody(request);
      const address = {
        id: crypto.randomUUID(),
        street: clean(payload.street),
        area: clean(payload.area),
        city: clean(payload.city),
        pin: clean(payload.pin),
        createdAt: new Date().toISOString(),
      };

      const validationError = validateAddress(address);
      if (validationError) {
        return sendJson(response, 400, { error: validationError });
      }

      const addresses = await readAddresses();
      addresses.unshift(address);
      await writeAddresses(addresses);
      return sendJson(response, 201, address);
    }

    if (url.pathname.startsWith("/api/addresses/") && request.method === "DELETE") {
      const id = decodeURIComponent(url.pathname.replace("/api/addresses/", ""));
      const addresses = await readAddresses();
      const nextAddresses = addresses.filter((address) => address.id !== id);

      if (nextAddresses.length === addresses.length) {
        return sendJson(response, 404, { error: "Address not found." });
      }

      await writeAddresses(nextAddresses);
      return sendJson(response, 200, { ok: true });
    }

    if (url.pathname.startsWith("/api/addresses/") && request.method === "PUT") {
      const id = decodeURIComponent(url.pathname.replace("/api/addresses/", ""));
      const payload = await readBody(request);
      const addresses = await readAddresses();
      const index = addresses.findIndex((address) => address.id === id);

      if (index === -1) {
        return sendJson(response, 404, { error: "Address not found." });
      }

      const updatedAddress = {
        ...addresses[index],
        street: clean(payload.street),
        area: clean(payload.area),
        city: clean(payload.city),
        pin: clean(payload.pin),
        updatedAt: new Date().toISOString(),
      };

      const validationError = validateAddress(updatedAddress);
      if (validationError) {
        return sendJson(response, 400, { error: validationError });
      }

      addresses[index] = updatedAddress;
      await writeAddresses(addresses);
      return sendJson(response, 200, updatedAddress);
    }

    return serveStatic(url.pathname, response);
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, { error: "Server error." });
  }
});

server.listen(port, () => {
  console.log(`Address Manager is running at http://localhost:${port}`);
});

async function serveStatic(urlPath, response) {
  const safePath = urlPath === "/" ? "/index.html" : urlPath;
  const filePath = path.normalize(path.join(root, safePath));

  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}

async function readAddresses() {
  try {
    const file = await fs.readFile(dataFile, "utf8");
    return JSON.parse(file);
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeAddresses([]);
      return [];
    }
    throw error;
  }
}

async function writeAddresses(addresses) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(addresses, null, 2));
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
  }
  return body ? JSON.parse(body) : {};
}

function validateAddress(address) {
  if (!address.street && !address.area && !address.city && !address.pin) {
    return "Street/Flat no. textfield cannot be empty";
  }

  if (!address.street) {
    return "Street/Flat no. textfield cannot be empty";
  }

  if (!address.area || !address.city || !address.pin) {
    return "All textfields must be filled before saving.";
  }

  if (!/^[a-zA-Z0-9 ]+$/.test(address.street)
    || !/^[a-zA-Z0-9 ]+$/.test(address.area)
    || !/^[a-zA-Z0-9 ]+$/.test(address.city)) {
    return "First three textfields can contain only alphanumeric characters.";
  }

  if (!/^\d{6}$/.test(address.pin)) {
    return "PIN code must contain exactly 6 digits.";
  }

  return "";
}

function clean(value) {
  return String(value || "").trim();
}

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}
