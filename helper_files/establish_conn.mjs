import crypto from "crypto";
const WEBSOCKET_MAGIC_STRING_KEY = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export function establish(socket, webClientSocketKey) {
  const acceptKey = createSocketAccept(webClientSocketKey);
  const responseHeaders = [
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${acceptKey}`,
    "", //Empty line to signal the end of headers
  ]
    .map((line) => line.concat("\r\n"))
    .join("");

  socket.write(responseHeaders);

  return socket;
}

function createSocketAccept(webClientSocketKey) {
  const hash = crypto.createHash("sha1");
  hash.update(webClientSocketKey + WEBSOCKET_MAGIC_STRING_KEY);
  return hash.digest("base64");
}
