require("electron-reload")(__dirname, {
	electron: require(`${__dirname}/node_modules/electron`)
});

const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { askGemini } = require("./gemini.js"); // ✅ import your Gemini helper
const record = require("node-record-lpcm16"); // ✅ mic recording
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
		},
		resizable: true
	});

	win.loadFile("index.html");
}

// ✅ IPC handler to talk to Gemini
ipcMain.handle("send-prompt", async (event, text) => {
	try {
		const reply = await askGemini(text);
		return reply;
	} catch (err) {
		console.error("Gemini error:", err);
		return "⚠️ Error: Could not fetch response.";
	}
});

const fs = require("fs");
const filePath = path.join(__dirname, "recording.wav");

ipcMain.handle("start-recording", async () => {
	try {
		console.log("🎤 Starting microphone recording...");

		const file = fs.createWriteStream(filePath, { encoding: "binary" });

		const rec = record.start({
			sampleRate: 16000,
			threshold: 0,
			verbose: false,
			recordProgram: process.platform === "win32" ? "sox" : "rec", // use sox on Windows
			silence: "10.0", // auto stop after silence
		});

		rec.pipe(file);

		// stop after 5 sec for demo
		setTimeout(() => {
			record.stop();
			console.log("🛑 Recording stopped. File saved at", filePath);
		}, 5000);

		return "🎤 Recording started, saving to recording.wav";
	} catch (err) {
		console.error("Mic error:", err);
		return "⚠️ Error: Could not access microphone.";
	}
});

app.commandLine.appendSwitch("enable-speech-dispatcher");
app.commandLine.appendSwitch("enable-speech-recognition");

app.whenReady().then(() => {
	createWindow();
});
