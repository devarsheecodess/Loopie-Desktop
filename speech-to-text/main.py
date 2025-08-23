import speech_recognition as sr
import win32com.client
import sounddevice as sd
import numpy as np
import scipy.io.wavfile
import io

try:
    speaker = win32com.client.Dispatch("SAPI.SpVoice")
except Exception as e:
    print(f"Error initializing TTS engine: {e}")


def record_device_audio(duration=3, fs=44100):
    """Record device playback (loopback) audio if 'Stereo Mix' is enabled."""
    try:
        # List available devices and print to find device index for loopback
        # Uncomment next lines to debug device names and indices
        # devices = sd.query_devices()
        # for i, dev in enumerate(devices):
        #     print(i, dev['name'], dev['hostapi'])
        
        # On Windows, device index for Stereo Mix may vary; adjust as needed
        device_index = None
        devices = sd.query_devices()
        for i, dev in enumerate(devices):
            if 'Stereo Mix' in dev['name'] or 'loopback' in dev['name'].lower():
                device_index = i
                break
        if device_index is None:
            print("No Stereo Mix or loopback device found.")
            return None
        
        print(f"Recording device audio from device #{device_index}: {devices[device_index]['name']}")

        recording = sd.rec(int(duration * fs), samplerate=fs, channels=2, dtype='int16', device=device_index)
        sd.wait()  # Wait until recording is finished
        
        # Save to a WAV in-memory buffer
        wav_io = io.BytesIO()
        scipy.io.wavfile.write(wav_io, fs, recording)
        wav_io.seek(0)
        return wav_io
    except Exception as e:
        print(f"Error recording device audio: {e}")
        return None


def listen_mic():
    r = sr.Recognizer()
    with sr.Microphone() as source:
        speaker.Speak("Listening...")
        audio = r.listen(source, timeout=2, phrase_time_limit=2)
    try:
        command = r.recognize_google(audio, language='en-in')
        return command
    except sr.UnknownValueError:
        return "Sorry, I could not understand."
    except sr.RequestError:
        return "Sorry, the speech service is unavailable."


def listen_device_audio():
    wav_io = record_device_audio(duration=3)
    if wav_io is None:
        return "No device audio captured."
    
    r = sr.Recognizer()
    with sr.AudioFile(wav_io) as source:
        audio = r.record(source)
    try:
        command = r.recognize_google(audio, language='en-in')
        return command
    except sr.UnknownValueError:
        return "Sorry, could not understand device audio."
    except sr.RequestError:
        return "Sorry, the speech service is unavailable."


if __name__ == '__main__':
    mic_command = listen_mic()
    print(f"Microphone command: {mic_command}")

    device_command = listen_device_audio()
    print(f"Device audio command: {device_command}")
