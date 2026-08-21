# Raw HTTP/1.1 Protocol Engine 🚀

A full-featured HTTP/1.1 client and server engine built entirely from scratch using raw TCP sockets in Node.js. This project bypasses standard HTTP libraries to demonstrate a deep understanding of network protocols, byte stream parsing, and concurrent socket management.

## 🧠 Technical Architecture

The system is divided into three core modules, built on top of Node.js's native `net` module:

### 1. The TCP Server (`/server`)
A robust HTTP server capable of handling concurrent connections via pure TCP sockets.
* **Dynamic Routing:** Custom implementation of an Express-like router with parameterized routes (e.g., `/dogs/:id`) supporting GET, POST, PUT, and DELETE methods.
* **Stream Parsing:** Manages TCP buffering, extracts headers, and parses JSON payloads directly from the raw byte stream.
* **Security & Auth:** Features a global native middleware requiring an `x-api-key` header, returning HTTP 401 Unauthorized for invalid requests.

### 2. The HTTP Client Library (`/client`)
A custom-built HTTP client that manually constructs HTTP/1.1 packets.
* **Packet Construction:** Automatically formats `Host`, `Content-Length`, and `Content-Type` headers, correctly appending carriage returns.
* **Response Parsing:** Reads raw TCP chunks from the server, decodes the status line, and auto-formats the JSON body once the `Content-Length` is reached.

### 3. Interactive CLI 
A persistent command-line interface that allows continuous HTTP requests without restarting the application, featuring guided prompts and automatic JSON pretty-printing.

## 🚀 Getting Started

    # Start the Server on port 3000
    node server/index.js --port 3000

    # Start with Authentication Middleware enabled
    node server/index.js --port 3000 --api-key [YOUR_KEY]

    # Launch the Interactive CLI Client (in a new terminal)
    node client/cli.js

## 👥 Team & Contributors

This project was developed collaboratively, demonstrating strong teamwork, Git flow integration, and architectural delegation.

* **Zintradev** - https://github.com/Zintradev
* **javier** - https://github.com/javier-hernaez
* **Juan Iznardo** - https://github.com/JuanIzn
* **nicolasbecas** - https://github.com/NicolasBecasAzagra
* **YeryCintru** - https://github.com/YeryCintru
* **alexrecasens18** - https://github.com/alexrecasens18
