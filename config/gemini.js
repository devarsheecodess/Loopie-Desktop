const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// --- Persistent context setup ---
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
// --- End of persistent context setup ---

const askGemini = async (prompt) => {
	// Add user prompt to context
	geminiContext.push({ role: 'user', text: prompt });

	const ai = new GoogleGenAI({
		apiKey: process.env.GEMINI_API_KEY,
	});

	const tools = [{ googleSearch: {} }];
	const config = { thinkingConfig: { thinkingBudget: -1 }, tools };
	const model = 'gemini-2.5-flash';

	// Send the full context (user + model messages) to Gemini
	const contents = geminiContext.map(msg => ({
		role: msg.role, // "user" or "model"
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

	// Add AI reply to context
	geminiContext.push({ role: 'model', text: output.trim() });

	// Save full context to file
	saveContext();

	// Optional: trim to last 10 messages to prevent unbounded growth
	if (geminiContext.length > 10) {
		geminiContext = geminiContext.slice(-10);
		saveContext(); // save trimmed context
	}

	return output.trim();
};

module.exports = { askGemini };
