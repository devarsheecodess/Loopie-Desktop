const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
const { getCMDDetails } = require('../modules/system');
const sendEmail = require('../modules/email').sendEmail;
const generateEmail = require('../modules/email').generateEmail;
const { exec } = require('child_process');
const { shell } = require('electron'); // To open browser URL
const { loadSavedCredentialsIfExist, authorize, listLabels, saveCredentials, readEmails } = require('../modules/email');
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

const addToContext = (role, text) => {
	geminiContext.push({ role, text });
	saveContext();
};

const detectCategory = async (prompt, apiKey) => {
	try {
		const ai = new GoogleGenAI({ apiKey });
		const promptTypes = ['system_cmd', 'question', 'email_snd', 'email_read'];

		const checkPrompt = `
			Prompt: ${prompt}
			prompt_types: ${promptTypes}
			Identify the type of prompt from the given array of prompt_types.
			Answer with only one value from the array.
			
			Descriptions:
			system_cmd: User will tell you to open some app.
			question: General queries or text which don’t come under other types.
			email_snd: User will tell you to write/send an email.
			email_read: User will ask to read, check, list, or count emails in their inbox.
		`;


		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: [{ role: 'user', parts: [{ text: checkPrompt }] }],
		});

		return response.text?.trim().toLowerCase() || 'question';
	} catch (err) {
		console.error('Error detecting category:', err);
		return 'question';
	}
};

const analyseEmails = async (emails, prompt, apiKey) => {
	try {
		const ai = new GoogleGenAI({ apiKey });

		const emailsText = emails.map((e, i) =>
			`Email ${i + 1}:\nFrom: ${e.from}\nSubject: ${e.subject}\nSnippet: ${e.snippet}\n`
		).join("\n\n");

		const checkPrompt = `
			Here are some emails:
			${emailsText}

			User request: ${prompt}

			Please fulfill the user request based on these emails. Remember these emails are in order!! Email 1 means latest email
		`;

		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: [{ role: 'user', parts: [{ text: checkPrompt }] }],
		});

		return response.text?.trim() || 'Error: no response';

	} catch (err) {
		console.error('Error in analyseEmails:', err);
		return 'Error: Failed to process emails.';
	}
};

const askGemini = async (prompt, apiKey) => {
	if (!apiKey) return 'Error: GEMINI API key not set.';

	const promptType = await detectCategory(prompt, apiKey);

	if (promptType === 'system_cmd') {
		addToContext('model', 'Executing action...');

		const cmdContent = await getCMDDetails(prompt, apiKey);
		const cleanedCmdContent = cmdContent
			.replace(/^```json\s*/, '')
			.replace(/```$/, '')
			.trim();

		let cmdObj;
		try {
			cmdObj = JSON.parse(cleanedCmdContent);
		} catch (err) {
			console.error('Failed to parse command JSON:', err);
			return 'Error: Generated command is not valid JSON.';
		}

		const appName = cmdObj.app_name;
		let browserURL = cmdObj.browserURL;

		return new Promise((resolve) => {
			const searchCmd = `powershell -Command "Get-StartApps | Where-Object { $_.Name -like '*${appName}*' } | Select-Object Name,AppID | ConvertTo-Json"`;

			exec(searchCmd, (err, stdout) => {
				if (err || !stdout || stdout.trim().length === 0) {
					if (browserURL) {
						if (!browserURL.startsWith('http')) browserURL = `https://${browserURL}`;
						shell.openExternal(browserURL);
						addToContext('model', `App not found. Opened URL: ${browserURL}`);
						resolve(`App not found. Opened URL: ${browserURL}`);
					} else {
						addToContext('model', `App "${appName}" not found and no URL provided.`);
						resolve(`App "${appName}" not found and no URL provided.`);
					}
					return;
				}

				let appData;
				try {
					appData = JSON.parse(stdout);
				} catch (parseErr) {
					console.error('Failed to parse PowerShell JSON:', parseErr);
					resolve(`Error parsing app data for ${appName}`);
					return;
				}

				const appId = Array.isArray(appData) ? appData[0].AppID : appData.AppID;

				if (!appId) {
					addToContext('model', `No valid AppID found for ${appName}`);
					resolve(`No valid AppID found for ${appName}`);
					return;
				}

				const launchCmd = `powershell -Command "Start-Process 'shell:AppsFolder\\${appId}'"`;

				exec(launchCmd, (openErr) => {
					if (!openErr) {
						addToContext('model', `${appName} opened successfully via Windows search.`);
						resolve(`${appName} opened successfully.`);
					} else {
						if (browserURL) {
							if (!browserURL.startsWith('http')) browserURL = `https://${browserURL}`;
							shell.openExternal(browserURL);
							addToContext('model', `App launch failed. Opened URL: ${browserURL}`);
							resolve(`App launch failed. Opened URL: ${browserURL}`);
						} else {
							addToContext('model', `Failed to open ${appName} and no URL provided.`);
							resolve(`Failed to open ${appName} and no URL provided.`);
						}
					}
				});
			});
		});
	}

	if (promptType === 'email_snd') {
		addToContext('model', 'Generating email...');

		const emailContent = await generateEmail(prompt, apiKey);

		console.log(emailContent)

		const cleanedEmailContent = emailContent
			.replace(/```json\s*/gi, '')
			.replace(/```/g, '')
			.trim();

		let emailObj;
		try {
			emailObj = JSON.parse(cleanedEmailContent);
		} catch (err) {
			console.error('Failed to parse email JSON:', cleanedEmailContent, err);
			return 'Error: Generated email is not valid JSON.';
		}

		await sendEmail(emailObj);

		addToContext('model', `${emailObj.text} sent to ${emailObj.to}`);
		return `Email sent to ${emailObj.to}!`;
	}

	if (promptType === 'email_read') {
		let client = await loadSavedCredentialsIfExist();
		if (!client) {
			client = await authorize();
			await saveCredentials(client);
		}

		// get the latest 5 emails
		const emails = await readEmails(client, 20);

		const response = await analyseEmails(emails, prompt, apiKey);
		addToContext('model', response);
		return response.trim();
	}

	addToContext('user', prompt);

	const contents = geminiContext.map(msg => ({
		role: msg.role,
		parts: [{ text: msg.text }],
	}));

	let output = '';
	try {
		const ai = new GoogleGenAI({ apiKey });
		const response = await ai.models.generateContentStream({
			model: 'gemini-2.5-flash',
			config: {
				thinkingConfig: { thinkingBudget: -1 },
				tools: [{ googleSearch: {} }],
			},
			contents,
		});

		for await (const chunk of response) {
			if (chunk.text) output += chunk.text;
		}
	} catch (err) {
		console.error('Gemini error:', err);
		return 'Error: Failed to get response from Gemini.';
	}

	addToContext('model', output.trim());
	return output.trim();
};

const analyseImage = async (base64Image, apiKey) => {
	if (!apiKey) return 'Error: GEMINI API key not set.';

	try {
		const ai = new GoogleGenAI({ apiKey });

		const contents = [
			{
				role: 'user',
				parts: [
					{
						inlineData: {
							mimeType: 'image/png',
							data: base64Image,
						},
					},
					{ text: 'Describe this image.' },
				],
			},
		];

		addToContext('user', 'Describe this image (from screenshot).');

		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents,
		});

		const description = response.text?.trim() || 'No description available.';
		addToContext('model', description);

		return description;
	} catch (err) {
		console.error('Error analysing image:', err);
		return 'Error: Failed to analyse image.';
	}
};

module.exports = { askGemini, analyseImage };