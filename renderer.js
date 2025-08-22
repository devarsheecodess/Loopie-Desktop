const micButton = document.getElementById('micButton');
const micIcon = document.getElementById('micIcon');
const textInput = document.getElementById('textInput');
const responseContent = document.getElementById('responseContent');
const closeButton = document.getElementById('closeButton');
const placeholder = document.getElementById('placeholder');
let isRecording = false;

function showTypingIndicator() {
	const typingDiv = document.createElement('div');
	typingDiv.classList.add('flex', 'justify-start', 'mb-3');
	typingDiv.id = 'typing-indicator';
	typingDiv.innerHTML = `
                <div class="bg-gradient-to-r from-gray-700 to-gray-600 shadow-lg backdrop-blur-sm px-4 py-2 border border-gray-600 border-opacity-50 rounded-2xl rounded-bl-md text-gray-300">
                    <div class="flex items-center space-x-1">
                        <div class="bg-gray-400 rounded-full w-2 h-2 animate-bounce"></div>
                        <div class="bg-gray-400 rounded-full w-2 h-2 animate-bounce" style="animation-delay: 0.1s"></div>
                        <div class="bg-gray-400 rounded-full w-2 h-2 animate-bounce" style="animation-delay: 0.2s"></div>
                    </div>
                </div>
            `;
	responseContent.appendChild(typingDiv);
}

function removeTypingIndicator() {
	const typingDiv = document.getElementById('typing-indicator');
	if (typingDiv) {
		typingDiv.remove();
	}
}

textInput.addEventListener('keypress', async (e) => {
	if (e.key === 'Enter' && textInput.value.trim()) {
		const userMessage = textInput.value.trim();

		addMessage('user', userMessage);
		textInput.value = '';
		showTypingIndicator();
		try {
			const reply = await window.electronAPI.sendPrompt(userMessage);
			removeTypingIndicator();
			addMessage('system', reply);
		} catch (err) {
			console.error('Error:', err);
			removeTypingIndicator();
			addMessage('system', 'Sorry, I encountered an error processing your request.');
		}
	}
});

function addMessage(sender, message, isListening = false) {
	if (placeholder) {
		placeholder.style.display = 'none';
	}

	const messageDiv = document.createElement('div');
	messageDiv.classList.add('flex', 'mb-3');

	if (sender === 'user') {
		messageDiv.classList.add('justify-end');
		messageDiv.innerHTML = `
                    <div class="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg backdrop-blur-sm px-4 py-2 border border-blue-400 border-opacity-30 rounded-2xl rounded-br-md max-w-xs text-white">
                        <p class="text-sm leading-relaxed">${message}</p>
                    </div>
                `;
	} else {
		messageDiv.classList.add('justify-start');

		if (isListening) {
			messageDiv.innerHTML = `
                        <div class="bg-gradient-to-r from-gray-700 to-gray-600 shadow-lg backdrop-blur-sm px-4 py-2 border border-gray-600 border-opacity-50 rounded-2xl rounded-bl-md max-w-xs text-blue-300">
                            <p class="flex items-center text-sm leading-relaxed">
                                <span class="mr-2 animate-pulse">🎤</span>
                                ${message}
                            </p>
                        </div>
                    `;
		} else {
			messageDiv.innerHTML = `
                        <div class="bg-gradient-to-r from-gray-700 to-gray-600 shadow-lg backdrop-blur-sm px-4 py-2 border border-gray-600 border-opacity-50 rounded-2xl rounded-bl-md max-w-xs text-white">
                            <p class="text-sm leading-relaxed">${message}</p>
                        </div>
                    `;
		}
	}

	responseContent.appendChild(messageDiv);
	responseContent.scrollTop = responseContent.scrollHeight;
}

// Speech Recognition Setup
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition;

if (SpeechRecognition) {
	recognition = new SpeechRecognition();
	recognition.lang = "en-IN";
	recognition.interimResults = false;
	recognition.maxAlternatives = 1;
	recognition.continuous = false; // Stop after one result

	recognition.onstart = () => {
		console.log("🎙️ Speech recognition started");
		addMessage("system", "🎙️ Listening...");
	};

	recognition.onresult = (event) => {
		const transcript = event.results[0][0].transcript;
		console.log("Transcript:", transcript);
		addMessage("user", transcript);

		// Send to your AI service
		sendToAI(transcript);
	};

	recognition.onerror = (event) => {
		console.error("Speech recognition error:", event.error);
		addMessage("system", `⚠️ Error: ${event.error}`);
		resetMicButton();
	};

	recognition.onend = () => {
		console.log("🛑 Speech recognition ended");
		resetMicButton();
	};
} else {
	console.warn("Speech Recognition not supported");
	addMessage("system", "⚠️ Speech Recognition API not supported in this browser.");
}

// Mic button event listener
micButton.addEventListener("click", () => {
	if (!recognition) {
		addMessage("system", "⚠️ Speech recognition not available");
		return;
	}

	if (!isRecording) {
		startRecording();
	} else {
		stopRecording();
	}
});

function startRecording() {
	isRecording = true;

	// Update button appearance
	micButton.classList.add("animate-pulse");
	micButton.classList.remove("from-blue-500", "to-blue-600");
	micButton.classList.add("from-red-500", "to-red-600");

	// Update icon to stop/circle icon
	micIcon.innerHTML = `<circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" fill="none"/>`;

	try {
		recognition.start();
		addMessage("system", "🎙️ Recording started. Speak now...");
	} catch (error) {
		console.error("Failed to start recording:", error);
		addMessage("system", "⚠️ Failed to start recording");
		resetMicButton();
	}
}

function stopRecording() {
	isRecording = false;
	recognition.stop();
	addMessage("system", "🛑 Processing...");
}

function resetMicButton() {
	isRecording = false;

	// Reset button appearance
	micButton.classList.remove("animate-pulse", "from-red-500", "to-red-600");
	micButton.classList.add("from-blue-500", "to-blue-600");

	// Reset icon to microphone
	micIcon.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"/>`;
}

// Function to send text to AI
async function sendToAI(text) {
	if (!text.trim()) return;

	try {
		addMessage("system", "🤖 Thinking...");

		// Use your Electron IPC if available, otherwise could use fetch to API
		if (window.electronAPI) {
			const response = await window.electronAPI.sendPrompt(text);
			if (response.success) {
				addMessage("ai", response.data);
			} else {
				addMessage("system", `⚠️ Error: ${response.error}`);
			}
		} else {
			// Fallback for web version
			addMessage("system", "⚠️ AI service not available");
		}
	} catch (error) {
		console.error("AI request failed:", error);
		addMessage("system", "⚠️ Failed to get AI response");
	}
}

// Text input handling
textInput.addEventListener('keypress', (e) => {
	if (e.key === 'Enter') {
		const text = textInput.value.trim();
		if (text) {
			addMessage('user', text);
			sendToAI(text);
			textInput.value = '';
		}
	}
});

closeButton.addEventListener('click', () => {
	window.close();
});