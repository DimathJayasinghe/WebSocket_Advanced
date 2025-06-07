import { printERROR, printSUCCESS } from "./console_print.mjs";
import fs from "fs";
import path from "path";

export function saveAsFile(
  payloadArray,
  fileType = "text",
  filename = "output"
) {
  try {
    // Create output directory if it doesn't exist
    const outputDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Generate unique filename to prevent overwriting
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    let fullFilename;
    let content;

    // Handle different file types
    if (fileType === "text") {
      // For text files, convert the buffer to string
      content = Buffer.concat(payloadArray).toString("utf8");
      fullFilename = path.join(outputDir, `${timestamp}_${filename}.txt`);
    } else if (fileType === "binary") {
      // For binary files, keep as buffer and determine file extension
      content = Buffer.concat(payloadArray);

      // Try to detect file type from content
      const fileExtension = detectFileType(content);
      fullFilename = path.join(
        outputDir,
        `${timestamp}_${filename}${fileExtension}`
      );
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Write file to disk
    fs.writeFileSync(fullFilename, content);

    printSUCCESS(`File saved: ${fullFilename}`);
  } catch (error) {
    printERROR(`Failed to save file: ${error.message}`);
  }
}

// Helper function to detect file type from binary data
function detectFileType(buffer) {
  // Check for common file signatures (magic numbers)

  // JPEG: Starts with FF D8 FF
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return ".jpg";
  }

  // PNG: Starts with 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return ".png";
  }

  // PDF: Starts with %PDF- (25 50 44 46 2D)
  if (
    buffer.length >= 5 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return ".pdf";
  }

  // GIF: Starts with GIF87a (47 49 46 38 37 61) or GIF89a (47 49 46 38 39 61)
  if (
    buffer.length >= 6 &&
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return ".gif";
  }

  // MP3: Starts with ID3 (49 44 33)
  if (
    buffer.length >= 3 &&
    buffer[0] === 0x49 &&
    buffer[1] === 0x44 &&
    buffer[2] === 0x33
  ) {
    return ".mp3";
  }

  // WAV: Starts with RIFF (52 49 46 46) followed by 4 bytes, then WAVE (57 41 56 45)
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x41 &&
    buffer[10] === 0x56 &&
    buffer[11] === 0x45
  ) {
    return ".wav";
  }

  // ZIP, DOCX, XLSX, PPTX: Starts with PK (50 4B)
  if (buffer.length >= 2 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
    return ".zip"; // Default to .zip, though it could be a .docx, .xlsx, etc.
  }

  // Default: If we can't detect the file type, use .bin extension
  return ".bin";
}
