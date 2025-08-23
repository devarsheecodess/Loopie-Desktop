const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');

const contextFile = path.resolve(__dirname, '../geminiContext.json');

let geminiContext = [];
try {
	if (fs.existsSync(contextFile)) {
		geminiContext = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
	}
} catch (err) {
	console.error('Failed to read Gemini context file:', err);
}

const saveContext = () => {
	try {
		fs.writeFileSync(contextFile, JSON.stringify(geminiContext, null, 2), 'utf8');
	} catch (err) {
		console.error('Failed to save Gemini context file:', err);
	}
};

const askGemini = async (prompt, apiKey) => {
	if (!apiKey) {
		return 'Error: GEMINI API key not set.';
	}

	geminiContext.push({ role: 'user', text: prompt });

	const ai = new GoogleGenAI({
		apiKey,
	});

	const tools = [{ googleSearch: {} }];
	const config = { thinkingConfig: { thinkingBudget: -1 }, tools };
	const model = 'gemini-2.5-flash';

	const contents = geminiContext.map(msg => ({
		role: msg.role,
		parts: [{ text: msg.text }]
	}));

	let output = '';
	try {
		const response = await ai.models.generateContentStream({ model, config, contents });
		for await (const chunk of response) {
			if (chunk.text) output += chunk.text;
		}
	} catch (err) {
		console.error('Gemini error:', err);
		return 'Error: Failed to get response from Gemini.';
	}

	geminiContext.push({ role: 'model', text: output.trim() });

	saveContext();

	if (geminiContext.length > 10) {
		geminiContext = geminiContext.slice(-10);
		saveContext();
	}

	return output.trim();
};

module.exports = { askGemini };