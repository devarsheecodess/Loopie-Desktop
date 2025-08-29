// require("electron-reload")(__dirname, {
// 	electron: require(`${__dirname}/node_modules/electron`)
// });

const { app, BrowserWindow, ipcMain, globalShortcut } = require("electron");
const { askGemini, analyseImage } = require("./config/gemini.js");
const screenshot = require('screenshot-desktop');
const path = require("path");
const fs = require('fs')
let GEMINI_API_KEY = "";
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

	win.once('ready-to-show', () => {
		const close = globalShortcut.register('Escape', () => {
			if (win) {
				win.close();
				fs.unlinkSync(path.resolve(__dirname, './geminiContext.json'));
			}
		});

		const minimize = globalShortcut.register('Control+M', () => {
			if (win.isVisible()) {
				win.hide();
			} else {
				win.show();
			}
		});

		if (!close || !minimize) {
			console.log('Shortcut registration failed');
		}
	});
}

ipcMain.handle("send-prompt", async (event, text) => {
	try {
		const reply = await askGemini(text, GEMINI_API_KEY || process.env.GEMINI_API_KEY);
		return reply;
	} catch (err) {
		console.error("Gemini error:", err);
		return "Error: Could not fetch response.";
	}
});

ipcMain.handle("send-image", async (event, imgBuffer) => {
	try {
		const reply = await analyseImage(imgBuffer, GEMINI_API_KEY);
		return reply;
	} catch (err) {
		console.error("Gemini error:", err);
		return "Error: Could not fetch response.";
	}
});

ipcMain.handle('capture-screen', async () => {
	try {
		win.minimize();
		const filePath = path.join(app.getPath('desktop'), 'screenshot.png');
		await screenshot({ filename: filePath });
		win.restore();
		return filePath;
	} catch (err) {
		console.error(err);
		throw err;
	}
});

ipcMain.handle('delete-context', async () => {
	try {
		const contextFile = path.resolve(__dirname, '../geminiContext.json');
		fs.unlinkSync(contextFile);
		return { success: true };
	} catch (err) {
		console.error(err);
		return { success: false, error: err.message };
	}
});

ipcMain.on('set-gemini-key', (event, key) => {
	GEMINI_API_KEY = key || process.env.GEMINI_API_KEY;
});

ipcMain.handle('get-gemini-key', async () => GEMINI_API_KEY);

app.whenReady().then(() => { createWindow(); });

app.on('will-quit', () => {
	globalShortcut.unregisterAll();
	fs.unlinkSync(path.resolve(__dirname, './geminiContext.json'));
});