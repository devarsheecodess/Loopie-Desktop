const express = require('express');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const app = express();
app.use(express.json());
const askGemini = require('../config/gemini').askGemini;

app.post('/analyse', async (req, res) => {
	const { path, apiKey } = req.body;

	if (!fs.existsSync(path)) return res.status(400).json({ error: 'File not found' });

	try {
		const { data: { text } } = await Tesseract.recognize(path, 'eng');
		const prompt = "Analyse the context of the screen based on the extracted text from the screen\n Extracted text: " + text;
		const response = await askGemini(prompt, apiKey);
		res.json({ response });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
});

app.get('/', (req, res) => {
	res.send('OCR server is running!');
});

app.listen(3000, () => console.log('OCR server is running'));
