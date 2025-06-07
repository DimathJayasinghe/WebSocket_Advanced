import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  printERROR,
  printINFO,
  printSUCCESS,
} from "./helper_files/console_print.mjs";
import * as conn from "./helper_files/establish_conn.mjs";
import { readFromSocket } from "./helper_files/read_from_Socket.mjs";


export function setupWebSocket(server) {
  server.on("upgrade", (req, socket, head) => {
    try {
      const upgradeHeader = req.headers["upgrade"];
      if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
        printINFO("Websocket upgrade requested");
        const { "sec-websocket-key": webClientSocketKey } = req.headers;
        if (!webClientSocketKey) {
          throw new Error("No sec-websocket-key");
        }
        conn.establish(socket, webClientSocketKey);
        printSUCCESS("Websocket is connected!");

        socket.on("readable", () => {
          try {
            readFromSocket(socket);
          } catch (error) {
            printERROR(error);
          }
        });

        socket.on("error", (err) => {
          printERROR(`Socket error: ${err.message}`);
          try {
            socket.end(); // Attempt graceful shutdown
          } catch (e) {
            // If ending fails, force destroy
            socket.destroy();
          }
        });

        socket.on("close", () => {
          printINFO("Socket close req accept");
        });
      } else {
        throw new Error("Not a websocket upgrade header");
      }
    } catch (error) {
      printERROR(`${error}`);
      socket.destroy();
    }
  });
}
