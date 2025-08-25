const { GoogleGenAI } = require('@google/genai');

const getCMDDetails = async (prompt, apiKey) => {
	if (!apiKey) return 'Error: GEMINI API key not set.';
	if (!prompt) return 'Error: Prompt is empty.';

	const emailPrompt = `
		prompt: ${prompt}
		Extract the system command details and return in this JSON format

		{
			"app_name": "The name of the application",
			"browserURL": "the url where this app will be found"
		}
	`
	try {
		const ai = new GoogleGenAI({ apiKey });
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: [{ role: 'user', parts: [{ text: emailPrompt }] }],
		});
		return response.text?.trim() || 'Error: Failed to generate email.';
	} catch (err) {
		console.error('Error generating email:', err);
		return 'Error: Failed to generate email.';
	}
};

module.exports = { getCMDDetails };