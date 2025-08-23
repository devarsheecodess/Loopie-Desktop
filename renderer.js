const micButton = document.getElementById('micButton');
const micIcon = document.getElementById('micIcon');
const textInput = document.getElementById('textInput');
const responseContent = document.getElementById('responseContent');
const closeButton = document.getElementById('closeButton');
const placeholder = document.getElementById('placeholder');
const captureBtn = document.getElementById('captureBtn');
const settingsButton = document.getElementById('settingsButton');
const settingsModal = document.getElementById('settingsModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const settingsForm = document.getElementById('settingsForm');
const geminiKeyInput = document.getElementById('geminiKeyInput');
const groqKeyInput = document.getElementById('groqKeyInput');
const BACKEND_URL = "http://localhost:3000";
let isActive = false;
let GEMINI_API_KEY = '';
let GROQ_API_KEY = '';
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

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
    </div>`;
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

function addMessage(sender, message, isListening = false, isLoader = false) {
	if (placeholder) {
		placeholder.style.display = 'none';
	}

	const messageDiv = document.createElement('div');
	messageDiv.classList.add('flex', 'mb-3');

	if (isLoader) {
		messageDiv.id = "transcribing-msg";
	}

	if (sender === 'user') {
		messageDiv.classList.add('justify-end');
		messageDiv.innerHTML = `
      <div class="bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg backdrop-blur-sm px-4 py-2 border border-blue-400 border-opacity-30 rounded-2xl rounded-br-md max-w-xs text-white">
        <p class="text-sm leading-relaxed">${message}</p>
      </div>`;
	} else {
		messageDiv.classList.add('justify-start');

		if (isListening) {
			messageDiv.innerHTML = `
        <div class="bg-gradient-to-r from-gray-700 to-gray-600 shadow-lg backdrop-blur-sm px-4 py-2 border border-gray-600 border-opacity-50 rounded-2xl rounded-bl-md max-w-xs text-blue-300">
          <p class="flex items-center text-sm leading-relaxed">
            <span class="mr-2 animate-pulse">🎤</span>
            ${message}
          </p>
        </div>`;
		} else {
			messageDiv.innerHTML = `
        <div class="bg-gradient-to-r from-gray-700 to-gray-600 shadow-lg backdrop-blur-sm px-4 py-2 border border-gray-600 border-opacity-50 rounded-2xl rounded-bl-md max-w-xs text-white">
          <p class="text-sm leading-relaxed">${message}</p>
        </div>`;
		}
	}

	responseContent.appendChild(messageDiv);
	responseContent.scrollTop = responseContent.scrollHeight;
}

closeButton.addEventListener('click', () => {
	window.close();
});

captureBtn.addEventListener('click', async () => {
	try {
		addMessage('user', 'Capturing screen...');
		showTypingIndicator();
		const filePath = await window.electronAPI.captureScreen();
		const response = await fetch(`${BACKEND_URL}/analyse`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ path: filePath, apiKey: GEMINI_API_KEY }),
		})
		const data = await response.json();
		addMessage('system', data.response);
	} catch (err) {
		console.error(err);
		addMessage('system', data.response);
		alert('Failed to capture screen');
	} finally {
		removeTypingIndicator();
	}
});

settingsButton.addEventListener('click', () => {
	isActive = !isActive;
	if (isActive) {
		settingsModal.classList.remove('hidden');
		settingsButton.classList.add('-translate-y-0.5', 'bg-opacity-20');
		geminiKeyInput.focus();
	} else {
		closeModal();
	}
});

geminiKeyInput.addEventListener('input', (e) => {
	e.stopPropagation();
	const apiKey = e.target.value;
	GEMINI_API_KEY = apiKey;
	window.electronAPI.setGeminiKey(apiKey);
	console.log('GEMINI_API_KEY updated:', apiKey);
});

function closeModal() {
	settingsButton.classList.remove('-translate-y-0.5');
	settingsButton.classList.remove('bg-opacity-20');
	settingsModal.classList.add('hidden');
	geminiKeyInput.value = '';
}

settingsModal.addEventListener('click', (e) => {
	if (e.target === settingsModal) {
		closeModal();
	}
});

document.addEventListener('keydown', (e) => {
	if (e.key === 'Escape' && !settingsModal.classList.contains('hidden')) {
		closeModal();
	}
});

settingsForm.addEventListener('submit', (e) => {
	e.preventDefault();
	const inputValue = geminiKeyInput.value.trim();

	if (inputValue) {
		console.log('Settings submitted:', inputValue);
		closeModal();
	}
});

async function toggleMic() {
	const GROQ_API_KEY = groqKeyInput.value.trim();

	if (!GROQ_API_KEY) {
		addMessage("system", "Please set your GROQ API key in the settings.");
		return;
	}

	if (!isRecording) {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
			mediaRecorder = new MediaRecorder(stream);

			mediaRecorder.ondataavailable = event => {
				audioChunks.push(event.data);
			};

			mediaRecorder.onstop = async () => {
				const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
				audioChunks = [];

				addMessage("user", "Transcribing audio...", false, true);

				const formData = new FormData();
				formData.append("file", audioBlob, "audio.wav");
				formData.append("model", "whisper-large-v3-turbo");
				formData.append("response_format", "verbose_json");

				try {
					const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
						method: "POST",
						headers: {
							"Authorization": `Bearer ${GROQ_API_KEY}`
						},
						body: formData
					});

					const data = await response.json();

					const loaderMsg = document.getElementById("transcribing-msg");
					if (loaderMsg) loaderMsg.remove();

					addMessage("user", data.text);
					showTypingIndicator();

					const geminiResponse = await window.electronAPI.sendPrompt(data.text);
					removeTypingIndicator();
					addMessage("system", geminiResponse);

				} catch (err) {
					console.error(err);
					addMessage("system", "Transcription failed: " + err.message);
				}
			};

			mediaRecorder.start();

			micButton.classList.remove('bg-gradient-to-br', 'from-blue-500', 'to-blue-600');
			micButton.classList.add('bg-gradient-to-br', 'from-red-500', 'to-red-600');
			micButton.innerHTML = '<i class="fa-solid fa-circle"></i>';
			micButton.style.boxShadow = '0 0 15px red';
			isRecording = true;

		} catch (err) {
			addMessage("system", "Could not access microphone.");
			alert("Could not access microphone!");
			console.error(err);
		}
	} else {
		mediaRecorder.stop();
		isRecording = false;

		micButton.classList.remove('bg-gradient-to-br', 'from-red-500', 'to-red-600');
		micButton.classList.add('bg-gradient-to-br', 'from-blue-500', 'to-blue-600');
		micButton.innerHTML = '<i class="fa-solid fa-microphone"></i>';
		micButton.style.boxShadow = "";
	}
}


micButton.addEventListener('click', toggleMic);
modalCloseBtn.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);