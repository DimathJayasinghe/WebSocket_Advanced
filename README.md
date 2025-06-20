# WebSocket_Advanced

## Overview

**WebSocket_Advanced** is a Node.js project that demonstrates a low-level, custom implementation of the WebSocket protocol. Unlike libraries such as `ws` or `socket.io`, this project manually handles the WebSocket handshake, frame parsing, masking/unmasking, and control frames (ping/pong/close), providing a deep dive into the protocol's internals.

The project includes:

- A Node.js WebSocket server that accepts connections, processes frames, and handles text, binary, and control messages.
- A browser-based client for sending/receiving text and binary (file/image/PDF) messages.
- Visualization of WebSocket frames for educational purposes.
- File upload support with automatic file type detection and saving on the server.

## Features

- **Manual WebSocket Protocol Handling:**  
  Implements the WebSocket handshake and frame parsing without third-party libraries.
- **Frame Visualization:**  
  Server sends a visual representation of received frames to the client for learning/debugging.
- **Text and Binary Messaging:**  
  Supports sending/receiving text and binary data (including images and PDFs).
- **File Uploads:**  
  Client can upload files; server saves them with type detection (e.g., `.jpg`, `.png`, `.pdf`).
- **Fragmented Frame Support:**  
  Handles fragmented frames and reassembles payloads.
- **Ping/Pong Heartbeat:**  
  Implements ping/pong frames to detect and close stale connections.
- **Graceful Connection Handling:**  
  Handles errors, connection closures, and timeouts robustly.

## Project Structure

```
websocket_AGAIN/
├── helper_files/
│   ├── closeSocket_handler.mjs
│   ├── console_print.mjs
│   ├── establish_conn.mjs
│   ├── fileHandling.mjs
│   ├── read_from_Socket.mjs
│   └── write_to_socket.mjs
├── uploads/                # Saved files (created automatically)
├── views/
│   ├── client.html         # Web client UI
│   └── client.js           # Web client logic
├── websocket.mjs           # Main WebSocket server logic
└── README.md
```

## How It Works

### Server

- Listens for HTTP upgrade requests and performs the WebSocket handshake.
- Parses incoming frames, including handling masking, fragmentation, and control frames.
- Saves uploaded files to the `uploads/` directory, detecting file type by magic number.
- Sends frame visualizations and regular messages back to the client.

### Client

- Connects to the server using the WebSocket API.
- Allows sending text messages and uploading files (images, PDFs, etc.).
- Displays received messages and frame visualizations.
- Shows upload progress and handles errors gracefully.

## Getting Started

### Prerequisites

- Node.js (v16+ recommended)
- Modern web browser

### Installation

1. Clone the repository:

   ```sh
   git clone <repo-url>
   cd websocket_AGAIN
   ```

2. Install dependencies (if any; this project uses only built-in Node.js modules).

3. Start the server:

   ```sh
   node websocket.mjs
   ```

4. Open the client:
   - Open `views/client.html` in your browser, or
   - If you have an HTTP server, serve the `views/` directory.

### Usage

- **Send Text:**  
  Enter a message and click "Send Text" to send a text frame.
- **Send File:**  
  Choose an image or PDF and click "Send File" to upload it as binary data.
- **Frame Visualization:**  
  After sending, the server responds with a visualization of the received WebSocket frame.
- **Close Connection:**  
  Click "Send Close" to gracefully close the WebSocket connection.

### File Uploads

- Uploaded files are saved in the `uploads/` directory with a timestamp and detected extension.
- Supported types: images (`.jpg`, `.png`, `.gif`), PDFs, ZIP, MP3, WAV, and generic binary files.

## Educational Value

This project is ideal for:

- Learning how WebSocket protocol works at the byte/frame level.
- Understanding masking, fragmentation, and control frames.
- Experimenting with file transfers over WebSockets.
- Debugging and visualizing WebSocket traffic.

## License

This project is for educational purposes. See [LICENSE](LICENSE) if provided.

## Author

Created by Dimath Jayasinghe.  
For questions or contributions, please open an issue or pull request.
