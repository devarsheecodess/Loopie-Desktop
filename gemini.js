import { GoogleGenAI } from '@google/genai';
import { configDotenv } from 'dotenv';

configDotenv();

export const askGemini = async (prompt) => {
	const ai = new GoogleGenAI({
		apiKey: process.env.GEMINI_API_KEY,
	});

	const tools = [{ googleSearch: {} }];
	const config = {
		thinkingConfig: { thinkingBudget: -1 },
		tools,
	};
	const model = 'gemini-2.5-flash';
	const contents = [
		{
			role: 'user',
			parts: [
				{ text: prompt },   // ✅ remove extra braces
			],
		},
	];

	const response = await ai.models.generateContentStream({
		model,
		config,
		contents,
	});

	let output = "";
	for await (const chunk of response) {
		if (chunk.text) {
			output += chunk.text;
		}
	}

	return output.trim();
};
