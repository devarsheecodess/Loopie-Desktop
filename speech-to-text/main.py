import speech_recognition as sr
import win32com.client

try:
    speaker = win32com.client.Dispatch("SAPI.SpVoice")
except Exception as e:
    print(f"Error initializing TTS engine: {e}")

def listen():
    r = sr.Recognizer()
    with sr.Microphone() as source:
        speaker.Speak("Listening...")
        audio = r.listen(source, timeout=2, phrase_time_limit=2)
    try:
        command = r.recognize_google(audio, language='en-in')
        return command
    except sr.UnknownValueError:
        return "Sorry, I could not understand."
    except sr.RequestError as e:
        return "Sorry, the speech service is unavailable."
    
if __name__ == '__main__':
    command = listen()
    print(command)