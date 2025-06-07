import { printERROR, printSUCCESS } from "./console_print.mjs";

export function closeSocket(socket) {
  const frameSize = 2;
  const frame = Buffer.alloc(frameSize);
  frame[0] = 0x88;
  frame[1] = 0;

  // Send the closing frame
  socket.write(frame);
  printSUCCESS("Closing Frame sent from the server");

  // Schedule socket end after a short delay to allow the frame to be sent
  setTimeout(() => {
    try {
      socket.end();
    } catch (error) {
      // Socket might already be closed, that's okay
    }
  }, 100);
}
