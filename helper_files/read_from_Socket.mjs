import {
  printERROR,
  printINFO,
  printSUCCESS,
  printFrameToClient,
} from "./console_print.mjs";
import { writeToSocket } from "./write_to_socket.mjs";
import fs from "fs";
import path from "path";
import { saveAsFile } from "./fileHandling.mjs";
import { closeSocket } from "./closeSocket_handler.mjs";

const OPCODE_CONTINUATION = 0x0;
const OPCODE_TEXT = 0x01;
const OPCODE_BINARY = 0x2;

const OPCODE_CONN_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;

const frameContent = {
  FIN_BIT_FLAG: 0, // 1 bit - FIN bit (0 or 1)
  RSV1: 0, // 1 bit
  RSV2: 0, // 1 bit
  RSV3: 0, // 1 bit
  OPCODE: null, // 4 bits (0x1 = text, 0x2 = binary, etc.)

  // Second byte (8 bits)
  mask_indicator: 0, // 1 bit (0 or 1)
  payload_length_indicator: null, // 7 bits (could be 7, 126, or 127)

  payload_length: null, // Actual payload length (number)
  masking_key: null, // 4-byte mask (array or buffer)
  payload: [], // Array of bytes or string
};

// Track processing state
let isProcessingFrame = false;
let continue_Frames = 0;

// collect fragmented payloads
let fragmented_payload_container = {
  payload_type: null,
  payload_buffer: [],
};

let pingInterval = null;
let timeoutInterval = null;
let pingTimerStarted = false;
let lastContactTime = Date.now(); // Track last activity time
let pingTimeout = 30; // seconds - send ping after this much inactivity
let connectionTimeout = 60; // seconds - close connection if no response after this much time

let frameCompletionTimer = null;
const FRAME_COMPLETION_TIMEOUT = 3000; // 3 seconds

export async function readFromSocket(socket) {
  if (!socket.readable || isProcessingFrame) return;
  // Update last contact time whenever we receive data
  lastContactTime = Date.now();
  pingTimerStart(socket);

  try {
    isProcessingFrame = true;
    // Get the frame
    await readTheFrame(socket);

    // Logic handling function
    await handleLogic(socket);

    // Send client the received frame
    printFrameToClient(frameContent, socket);

    // reset the framecontent buffer
    resetFrameContent();
  } catch (error) {
    // Handle socket ended gracefully
    if (
      error.message.includes("Socket ended") ||
      error.message.includes("ECONNRESET")
    ) {
      printINFO(`Connection closed while reading frame: ${error.message}`);

      // Check if we have partial data to save
      if (
        continue_Frames > 0 &&
        fragmented_payload_container.payload_buffer.length > 0
      ) {
        printINFO("Saving partially received file data");
        saveAsFile(
          fragmented_payload_container.payload_buffer,
          fragmented_payload_container.payload_type || "binary"
        );

        // Reset state
        continue_Frames = 0;
        fragmented_payload_container.payload_buffer = [];
        fragmented_payload_container.payload_type = null;
      }
    } else {
      // Other errors
      printERROR(error);
    }
  } finally {
    isProcessingFrame = false;
  }
}

async function readTheFrame(socket) {
  // Helper function to read from socket with timeout
  async function readBytes(length, timeout = 5000) {
    if (length === 0) {
      return Buffer.alloc(0);
    }
    return new Promise((resolve, reject) => {
      // Try to read immediately first
      const data = socket.read(length);
      if (data && data.length === length) {
        return resolve(data);
      }

      // If not enough data, set up event handlers
      const onReadable = () => {
        const data = socket.read(length);
        if (data && data.length === length) {
          cleanup();
          resolve(data);
        }
      };

      const onEnd = () => {
        cleanup();
        reject(new Error("Socket ended before enough bytes could be read"));
      };

      const onError = (err) => {
        cleanup();
        reject(err);
      };

      const onTimeout = () => {
        cleanup();
        reject(new Error("Timeout waiting for socket data"));
      };

      // Set up event listeners
      socket.on("readable", onReadable);
      socket.on("end", onEnd);
      socket.on("error", onError);
      const timeoutId = setTimeout(onTimeout, timeout);

      // Clean up function to remove listeners
      function cleanup() {
        socket.removeListener("readable", onReadable);
        socket.removeListener("end", onEnd);
        socket.removeListener("error", onError);
        clearTimeout(timeoutId);
      }
    });
  }

  //   printINFO("Starting to read the frame");
  try {
    // Read first byte
    const firstByteBuf = await readBytes(1);
    const firstByte = firstByteBuf[0];
    frameContent.FIN_BIT_FLAG = (firstByte & 0b10000000) >> 7;
    frameContent.RSV1 = (firstByte & 0b01000000) >> 6;
    frameContent.RSV2 = (firstByte & 0b00100000) >> 5;
    frameContent.RSV3 = (firstByte & 0b00010000) >> 4;
    frameContent.OPCODE = firstByte & 0b00001111;

    // Read second byte
    const secondByteBuf = await readBytes(1);
    const secondByte = secondByteBuf[0];
    frameContent.mask_indicator = (secondByte & 0b10000000) >> 7;
    frameContent.payload_length_indicator = secondByte & 0b01111111;

    // Check if we should ignore this frame (server response)
    if (frameContent.mask_indicator !== 1) {
      // Only client-to-server messages should be masked
      throw new Error("Ignoring unmasked frame (likely server response)");
    }

    // Handle payload length
    let flag = frameContent.payload_length_indicator;
    if (flag < 125) {
      frameContent.payload_length = flag;
    } else if (flag === 126) {
      const extLenBuf = await readBytes(2);
      frameContent.payload_length = (extLenBuf[0] << 8) | extLenBuf[1];
    } else if (flag === 127) {
      const extLenBuf = await readBytes(8);
      frameContent.payload_length = Number(extLenBuf.readBigUInt64BE());
    } else {
      throw new Error("Invalid payload length flag");
    }

    // Read masking key
    frameContent.masking_key = await readBytes(4);

    // Read and unmask payload
    const maskedPayload = await readBytes(frameContent.payload_length);
    frameContent.payload = Buffer.alloc(frameContent.payload_length);

    // Unmask the payload
    for (let i = 0; i < frameContent.payload_length; i++) {
      frameContent.payload[i] =
        maskedPayload[i] ^ frameContent.masking_key[i % 4];
    }
  } catch (error) {
    // Check if this is a "maybe server response" error we can safely ignore
    if (error.message.includes("unmasked frame")) {
      printINFO("Skipped processing server response frame");
    } else {
      throw error; // Re-throw all other errors
    }
  }
}

function resetFrameContent() {
  frameContent.FIN_BIT_FLAG = 0;
  frameContent.RSV1 = 0;
  frameContent.RSV2 = 0;
  frameContent.RSV3 = 0;
  frameContent.OPCODE = null;
  frameContent.mask_indicator = 0;
  frameContent.payload_length_indicator = null;
  frameContent.payload_length = null;
  frameContent.masking_key = null;
  frameContent.payload = [];
}

async function handleLogic(socket) {
  printINFO(`FIN: ${frameContent.FIN_BIT_FLAG} OPCODE: ${frameContent.OPCODE}`);
  // Update last contact time for any valid frame
  lastContactTime = Date.now();

  if (frameContent.FIN_BIT_FLAG == 0) {
    switch (frameContent.OPCODE) {
      case OPCODE_TEXT:
        fragmented_payload_container.payload_type = "text";
        break;
      case OPCODE_BINARY:
        fragmented_payload_container.payload_type = "binary";
        break;
    }
    fragmented_payload_container.payload_buffer.push(frameContent.payload);
    continue_Frames++;

    if (frameCompletionTimer) {
      clearTimeout(frameCompletionTimer);
    }

    // Set a timeout to save the file if no more frames arrive
    frameCompletionTimer = setTimeout(() => {
      if (
        continue_Frames > 0 &&
        fragmented_payload_container.payload_buffer.length > 0
      ) {
        printINFO(
          `Frame sequence timed out after ${continue_Frames} frames, saving partial file`
        );

        // Save what we've got so far
        saveAsFile(
          fragmented_payload_container.payload_buffer,
          fragmented_payload_container.payload_type
        );

        // Reset state
        continue_Frames = 0;
        fragmented_payload_container.payload_buffer = [];
        fragmented_payload_container.payload_type = null;
      }

      frameCompletionTimer = null;
    }, FRAME_COMPLETION_TIMEOUT);
  } else if (
    frameContent.FIN_BIT_FLAG == 1 &&
    frameContent.OPCODE == OPCODE_CONTINUATION
  ) {
    // Clear the timeout since we got the final frame
    if (frameCompletionTimer) {
      clearTimeout(frameCompletionTimer);
      frameCompletionTimer = null;
    }
    continue_Frames++;
    printSUCCESS(
      `Continue Frames: ${continue_Frames} File type: ${fragmented_payload_container.payload_type}`
    );
    //   Save the file
    saveAsFile(
      fragmented_payload_container.payload_buffer,
      fragmented_payload_container.payload_type
    );
    continue_Frames = 0;
    //Flush the buffer
    fragmented_payload_container.payload_buffer.length = 0;
    fragmented_payload_container.payload_type = null;
  } else {
    // Handls single frames
    switch (frameContent.OPCODE) {
      case OPCODE_CONN_CLOSE:
        printINFO("Received closing frame from client");
        closeSocket(socket);
        resetFrameContent();
        isProcessingFrame = false;
        break;
      case OPCODE_PONG:
        printINFO("Received a PONG signal from client");
        break;
    }
    continue_Frames = 0;
  }
}

// Functions for ping
export function pingTimerStart(socket) {
  // Only start the timer once
  if (pingTimerStarted) return;
  pingTimerStarted = true;

  // Mark contact for the current message
  lastContactTime = Date.now();

  // Set a single interval that checks regularly
  pingInterval = setInterval(() => {
    const now = Date.now();
    const secondsSinceLastContact = (now - lastContactTime) / 1000;

    // If we haven't heard from client in pingTimeout seconds, send a ping
    if (secondsSinceLastContact >= pingTimeout && socket.writable) {
      printINFO(
        `No activity for ${Math.floor(
          secondsSinceLastContact
        )} seconds, sending ping`
      );
      sendPing(socket);
    }

    // If we haven't heard from client in connectionTimeout seconds, close the connection
    if (secondsSinceLastContact >= connectionTimeout) {
      printINFO(
        `No activity for ${Math.floor(
          secondsSinceLastContact
        )} seconds, closing connection`
      );
      closeSocket(socket);
      clearPingTimers();
    }
  }, 5000); // Check every 5 seconds

  // Set up cleanup when socket closes
  socket.on("close", () => {
    clearPingTimers();
  });
}

function clearPingTimers() {
  if (pingInterval) {
    clearInterval(pingInterval);
    pingInterval = null;
  }
  pingTimerStarted = false;
}

function sendPing(socket) {
  const frameSize = 2;
  const frame = Buffer.alloc(frameSize);
  frame[0] = 0x89; // PING opcode with FIN=1
  frame[1] = 0; // No mask, zero length

  try {
    socket.write(frame);
    printINFO("Ping sent to client");
  } catch (err) {
    printERROR(`Error sending ping: ${err.message}`);
  }
}
