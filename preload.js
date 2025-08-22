const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
	sendPrompt: (text) => ipcRenderer.invoke("send-prompt", text),
	startRecording: () => ipcRenderer.invoke("start-recording"),
	stopRecording: () => ipcRenderer.invoke("stop-recording"),
	cleanupRecording: (filePath) => ipcRenderer.invoke("cleanup-recording", filePath) // Optional: for cleanup
});