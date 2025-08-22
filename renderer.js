const micButton = document.getElementById('micButton');
const micIcon = document.getElementById('micIcon');
const textInput = document.getElementById('textInput');
const responseContent = document.getElementById('responseContent');
const closeButton = document.getElementById('closeButton');
const placeholder = document.getElementById('placeholder');

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

// Voice feature
const { ipcRenderer } = require('electron');

micButton.addEventListener('click', () => {
	micButton.innerText = "Recording"
	responseContent.textContent = "Recording..."
	ipcRenderer.send('start-listen');
});

ipcRenderer.on('speech-result', (event, data) => {
	responseContent.textContent = data;
});