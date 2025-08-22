const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
	sendPrompt: (text) => ipcRenderer.invoke("send-prompt", text),
	startListen: () => ipcRenderer.invoke('start-listen'),
	stopListen: () => ipcRenderer.invoke('stop-listen'),
	onSpeechResult: (callback) => ipcRenderer.on('speech-result', (event, data) => callback(data)),
	captureScreen: () => ipcRenderer.invoke('capture-screen'),
	deleteContext: () => ipcRenderer.invoke('delete-context')
});