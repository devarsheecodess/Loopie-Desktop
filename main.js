require("electron-reload")(__dirname, {
	electron: require(`${__dirname}/node_modules/electron`)
});

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { askGemini } = require("./gemini.js");
const { spawn } = require('child_process');
let win;

function createWindow() {
	win = new BrowserWindow({
		width: 500,
		height: 500,
		alwaysOnTop: true,
		frame: false,
		transparent: true,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			nodeIntegration: false,
			contextIsolation: true
		},
		resizable: true
	});

	win.loadFile("index.html");
}

ipcMain.handle("send-prompt", async (event, text) => {
	try {
		const reply = await askGemini(text);
		return reply;
	} catch (err) {
		console.error("Gemini error:", err);
		return "⚠️ Error: Could not fetch response.";
	}
});


ipcMain.handle('start-listen', async (event) => {
	return new Promise((resolve, reject) => {
		const pythonProcess = spawn('python', ['./speech-to-text/main.py']);

		let result = '';

		pythonProcess.stdout.on('data', (data) => {
			result += data.toString();
		});

		pythonProcess.stderr.on('data', (data) => {
			console.error('Python error:', data.toString());
		});

		pythonProcess.on('close', (code) => {
			if (code === 0) {
				resolve(result.trim());
			} else {
				reject(new Error(`Python process exited with code ${code}`));
			}
		});
	});
});

app.whenReady().then(() => {
	createWindow();
});