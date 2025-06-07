export function writeToSocket(socket, message) {
  // Check if this is a frame visualization (starts with frame marker)
  const isFrameVisualization =
    typeof message === "string" &&
    message.includes(
      "0                   1                   2                   3"
    );

  // If this is a frame visualization, send it with a special prefix
  if (isFrameVisualization) {
    const framePrefix = "FRAME_VISUALIZATION:";
    const prefixedMessage = framePrefix + message;
    sendTextMessage(socket, prefixedMessage);
    return;
  }

  // Otherwise, extract actual message from frameContent and echo it back
  sendTextMessage(socket, message);
}






function sendTextMessage(socket, message) {
  const payload = Buffer.from(message, "utf-8");
  const payloadLength = payload.length;

  let frameSize = 2; // Start with 2 bytes for header
  let payloadOffset = 2;

  if (payloadLength > 125 && payloadLength < 65536) {
    frameSize += 2; // 2 extra bytes for 16-bit length
    payloadOffset = 4;
  } else if (payloadLength >= 65536) {
    frameSize += 8; // 8 extra bytes for 64-bit length
    payloadOffset = 10;
  }

  const frame = Buffer.alloc(frameSize + payloadLength);

  // Set first byte: FIN bit (1) + RSV bits (000) + Opcode (0001 for text)
  frame[0] = 0x81;

  // Set second byte: Mask bit (0) + Length or length indicator
  if (payloadLength <= 125) {
    frame[1] = payloadLength;
  } else if (payloadLength < 65536) {
    frame[1] = 126;
    frame.writeUInt16BE(payloadLength, 2);
  } else {
    frame[1] = 127;
    // Write 64-bit length
    frame.writeBigUInt64BE(BigInt(payloadLength), 2);
  }

  // Copy payload to frame
  payload.copy(frame, payloadOffset);
  socket.write(frame);
}
