const { GoogleGenAI } = require('@google/genai');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const fs = require('fs').promises;
const path = require('path');
const { authenticate } = require('@google-cloud/local-auth');
const { google } = require('googleapis');

dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

async function loadSavedCredentialsIfExist() {
	try {
		const content = await fs.readFile(TOKEN_PATH);
		const credentials = JSON.parse(content);
		return google.auth.fromJSON(credentials);
	} catch (err) {
		return null;
	}
}

async function saveCredentials(client) {
	const content = await fs.readFile(CREDENTIALS_PATH);
	const keys = JSON.parse(content);
	const key = keys.installed || keys.web;
	const payload = JSON.stringify({
		type: 'authorized_user',
		client_id: key.client_id,
		client_secret: key.client_secret,
		refresh_token: client.credentials.refresh_token,
	});
	await fs.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
	let client = await loadSavedCredentialsIfExist();
	if (client) {
		return client;
	}
	client = await authenticate({
		scopes: SCOPES,
		keyfilePath: CREDENTIALS_PATH,
	});
	if (client.credentials) {
		await saveCredentials(client);
	}
	return client;
}

async function readEmails(auth, maxResults) {
	const gmail = google.gmail({ version: 'v1', auth });

	const res = await gmail.users.messages.list({
		userId: 'me',
		maxResults, // fetch up to N emails
		// remove labelIds filter for full inbox
	});

	if (!res.data.messages || res.data.messages.length === 0) {
		console.log('No emails found.');
		return [];
	}

	const emails = [];
	for (const msg of res.data.messages) {
		const message = await gmail.users.messages.get({
			userId: 'me',
			id: msg.id,
		});

		const headers = message.data.payload.headers;
		const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
		const from = headers.find(h => h.name === 'From')?.value || '(unknown sender)';
		const snippet = message.data.snippet || '';

		emails.push({ from, subject, snippet });
	}

	return emails;
}

const generateEmail = async (prompt, apiKey) => {
	if (!apiKey) return { error: 'Error: GEMINI API key not set.' };
	if (!prompt) return { error: 'Error: Prompt is empty.' };

	const emailPrompt = `
	prompt: ${prompt}

	Extract the email details and return the response strictly in JSON format:
	{
		"to": "Recipient's Gmail address reconstructed exactly as spelled in the prompt",
		"subject": "A concise subject line generated from the prompt",
		"text": "A polite email body text generated from the prompt"
	}
	`;

	try {
		const ai = new GoogleGenAI({ apiKey });
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: [{ role: 'user', parts: [{ text: emailPrompt }] }],
		});

		const raw = response.text?.trim();
		if (!raw) throw new Error("Empty response");
		return raw
	} catch (err) {
		console.error('Error generating email:', err);
		return { error: 'Failed to generate email.' };
	}
};

const sendEmail = async ({ to, subject, text }) => {
	if (!to || !subject || !text) {
		console.error('Missing parameters for sending email.');
		return 'Error: Missing parameters.';
	}

	try {
		const transporter = nodemailer.createTransport({
			service: 'Gmail',
			auth: {
				user: process.env.EMAIL_USER,
				pass: process.env.EMAIL_PASS,
			},
		});

		const mailOptions = { from: process.env.EMAIL_USER, to, subject, text };
		const info = await transporter.sendMail(mailOptions);

		console.log('Email sent:', info.response);
		return 'Email sent successfully.';
	} catch (err) {
		console.error('Error sending email:', err);
		return 'Error: Failed to send email.';
	}
};

module.exports = {
	generateEmail,
	sendEmail,
	saveCredentials,
	authorize,
	readEmails,
	loadSavedCredentialsIfExist,
};