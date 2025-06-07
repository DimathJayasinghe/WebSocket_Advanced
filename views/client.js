const host = window.location.hostname;
const PORT =
  window.location.port || (window.location.protocol === "https:" ? 433 : 1337);
const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";

const socket = new WebSocket(`${wsProtocol}//${host}:${PORT}`);

const log = (msg) => {
  document.getElementById("log").textContent += msg + "\n";
};

socket.binaryType = "arraybuffer";

socket.onopen = (event) => {
  log("WebSocket is Connected!");
};

socket.onmessage = (event) => {
  const data = event.data;

  // Check if this is a frame visualization
  if (typeof data === "string" && data.startsWith("FRAME_VISUALIZATION:")) {
    // Extract the frame visualization (remove the prefix)
    const frameVisualization = data.substring("FRAME_VISUALIZATION:".length);
    // Display in the frame element
    document.getElementById("frame").textContent = frameVisualization;
    // Also log that we received a frame visualization
    log("Received frame visualization");
  } else {
    // This is a regular message
    log("Message from server: " + data);
  }
};

socket.onerror = (error) => {
  log("WebSocket error: " + error);
};

socket.onclose = (event) => {
  log("WebSocket closed: " + JSON.stringify(event));
};

// Send text message
document.getElementById("sendTextBtn").onclick = () => {
  const msg = document.getElementById("msgInput").value;
  socket.send(msg);
  log("Sent text: " + msg);
};

// Send close frame
document.getElementById("sendCloseBtn").onclick = () => {
  socket.close(1000, "Client says bye!");
};

// Update the file input to accept both images and PDFs
document.addEventListener("DOMContentLoaded", () => {
  const imageInput = document.getElementById("imageInput");
  if (imageInput) {
    imageInput.setAttribute("accept", "image/*,.pdf");
  }
});

// Rename the button and related elements to be more generic
const sendFileBtn = document.getElementById("sendImageBtn");
if (sendFileBtn) {
  sendFileBtn.textContent = "Send File";
}

// Update the file upload function to simply send binary data
document.getElementById("sendImageBtn").onclick = () => {
  const fileInput = document.getElementById("imageInput");
  const file = fileInput.files[0];

  if (!file) {
    log("Please select a file first");
    return;
  }

  if (socket.readyState !== WebSocket.OPEN) {
    log("WebSocket is not connected");
    return;
  }

  // Setup progress tracking
  const progressBar = document.getElementById("progressBar");
  const fileInfo = document.getElementById("fileInfo");
  const progressContainer = document.getElementById("progressContainer");
  progressContainer.style.display = "block";
  progressBar.value = 0;

  // Log file info
  const fileType = file.type.startsWith("image/")
    ? "Image"
    : file.type === "application/pdf"
    ? "PDF"
    : "File";
  log(`Sending ${fileType}: ${file.name} (${formatFileSize(file.size)})`);
  fileInfo.textContent = `${file.name} - ${formatFileSize(file.size)}`;

  // Read the file and send it directly as binary data
  const reader = new FileReader();

  reader.onload = (e) => {
    // Let the browser handle the WebSocket framing
    socket.send(e.target.result);
    log(`Sent file: ${formatFileSize(file.size)}`);

    // Update UI
    progressBar.value = 100;
    fileInfo.textContent = `${file.name} - ${formatFileSize(
      file.size
    )} - 100% Complete`;
  };

  reader.onerror = (err) => {
    log(`Error reading file: ${err}`);
  };

  // Read the file as an ArrayBuffer which the browser will send as binary
  reader.readAsArrayBuffer(file);
};

// Helper function to format file size
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " bytes";
  else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  else return (bytes / 1048576).toFixed(1) + " MB";
}
