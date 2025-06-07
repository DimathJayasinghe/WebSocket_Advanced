import { writeToSocket } from "./write_to_socket.mjs";


export const printERROR = (x) => {
  console.log("🔴 [ERROR]", x);
};
export const printINFO = (x) => {
  console.log("🟨 [INFO]", x);
};
export const printSUCCESS = (x) => {
  console.log("🟩 [DONE]", x);
};

export function printFrameToClient(frameContent,socket) {
  const lines = [];
  const toBits = (value, length) => value.toString(2).padStart(length, "0");

  const FIN = toBits(frameContent.FIN_BIT_FLAG, 1);
  const RSV1 = toBits(frameContent.RSV1, 1);
  const RSV2 = toBits(frameContent.RSV2, 1);
  const RSV3 = toBits(frameContent.RSV3, 1);
  const OPCODE = toBits(frameContent.OPCODE ?? 0, 4);
  const MASK = toBits(frameContent.mask_indicator, 1);
  const LEN = toBits(frameContent.payload_length_indicator ?? 0, 7);
  // Define frame width constants for consistent alignment
  const FRAME_WIDTH = 63; // Total width of the frame
  // Helper function to create properly aligned frame lines
  const frameLine = (content, fill = "-") => {
    // Create a line with exact width of the frame
    const line = `     +${fill.repeat(FRAME_WIDTH - 2)}+`;

    // If content is provided, insert it at the right position
    if (content) {
      return (
        line.substring(0, 6) +
        content +
        line
          .substring(6 + content.length)
          .substring(0, FRAME_WIDTH - content.length)
      );
    }
    return line;
  };

  // Header section
  lines.push(
    "     0                   1                   2                   3"
  );
  lines.push(
    "      0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1"
  );
  lines.push(
    "     +-+-+-+-+-------+-+-------------+-------------------------------+"
  );

  // Construct first byte and second byte with proper spacing
  const byte1 = `|${FIN}|${RSV1}|${RSV2}|${RSV3}|${OPCODE}   |`;
  const byte2 = `${MASK}|${LEN}      |`;

  // Create the combined header line with dynamic padding
  const combinedLine = `     ${byte1}${byte2}  `;
  lines.push(combinedLine.padEnd(FRAME_WIDTH + 5, " ") + " " + "|");

  // Field labels
  lines.push(
    "     |I|V|V|V|       |S|             |                               |"
  );
  lines.push(
    "     |N|1|2|3|       |K|             |                               |"
  );
  lines.push(
    "     +-+-+-+-+-------+-+-------------+ - - - - - - - - - - - - - - - +"
  );

  // Extended payload length section if needed
  if (
    frameContent.payload_length_indicator === 126 ||
    frameContent.payload_length_indicator === 127
  ) {
    lines.push(
      "     |     Extended payload length (continued)...                    |"
    );
    lines.push(
      "     + - - - - - - - - - - - - - - - +-------------------------------+"
    );
  }

  // Masking key section if present
  if (frameContent.mask_indicator === 1 && frameContent.masking_key) {
    const mask = Array.from(frameContent.masking_key)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(" ");
    const maskPadded = `| Masking key: ${mask}`;
    lines.push(`     ${maskPadded.padEnd(FRAME_WIDTH, " ")} |`);
    lines.push(
      "     +-------------------------------+-------------------------------+"
    );
  }

  // Payload data section
  if (frameContent.payload && frameContent.payload.length > 0) {
    const payloadPreview = Array.from(frameContent.payload)
      .slice(0, 16)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join(" ");
    const payloadLine = `| Payload Data: ${payloadPreview}`;
    lines.push(`     ${payloadLine.padEnd(FRAME_WIDTH, " ")} |`);
  } else {
    lines.push(
      "     | No Payload                                                    |"
    );
  }
  // Bottom frame border
  lines.push(
    "     +---------------------------------------------------------------+"
  );
  lines.push(" ");
  // lines.push(`     Payload value: ${frameContent.payload}`);
  lines.push(`     Payload Length: ${frameContent.payload_length}`)
  const frame = lines.join("\n");
  writeToSocket(socket,frame)

}
