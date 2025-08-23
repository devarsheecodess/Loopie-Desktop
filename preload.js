const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
	sendPrompt: (text) => ipcRenderer.invoke("send-prompt", text),
	captureScreen: () => ipcRenderer.invoke('capture-screen'),
	deleteContext: () => ipcRenderer.invoke('delete-context'),
	onSpeechResult: (callback) => ipcRenderer.on('speech-result', (event, data) => callback(data)),
	setGeminiKey: (key) => ipcRenderer.send('set-gemini-key', key),
});