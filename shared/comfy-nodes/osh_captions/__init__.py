"""Local speech transcription. MIT; uses MIT Whisper Tiny via faster-whisper."""
import importlib.util
import json
import os
import uuid
import folder_paths

MODEL_ROOT = os.path.join(folder_paths.models_dir, 'whisper')
MODELS = {f'Whisper {name.title()} · CPU': os.path.join(MODEL_ROOT, 'faster-whisper-' + name) for name in ['tiny', 'base', 'small', 'medium', 'large-v3']}

def installed_models():
    return [label for label, path in MODELS.items() if all(os.path.isfile(os.path.join(path, name)) for name in ['model.bin', 'config.json', 'tokenizer.json'])]


def available_devices():
    try:
        import ctranslate2
        import ctypes
        import sys
        # CTranslate2 can see a GPU even when its CUDA 12 libraries are missing.
        if sys.platform == 'win32':
            ctypes.WinDLL('cublas64_12.dll')
            ctypes.WinDLL('cudnn64_9.dll')
        else:
            ctypes.CDLL('libcublas.so.12')
            ctypes.CDLL('libcudnn.so.9')
        if ctranslate2.get_cuda_device_count() > 0 and 'float16' in ctranslate2.get_supported_compute_types('cuda'):
            return ['cpu', 'cuda']
    except Exception:
        pass
    return ['cpu']


class OSHWhisperCaptions:
    @classmethod
    def INPUT_TYPES(cls):
        ready = installed_models() if importlib.util.find_spec('faster_whisper') else []
        return {'required': {'audio': ('AUDIO',), 'model': (ready,)}, 'optional': {'device': (available_devices(), {'default': 'cpu'}), 'language': ('STRING', {'default': 'auto'})}}

    RETURN_TYPES = ()
    FUNCTION = 'transcribe'
    OUTPUT_NODE = True
    CATEGORY = 'Studio/Captions'

    def transcribe(self, audio, model, device='cpu', language='auto'):
        from faster_whisper.tokenizer import _LANGUAGE_CODES
        if language != 'auto' and language not in _LANGUAGE_CODES:
            raise ValueError('Choose a supported transcription language.')
        requested_language = None if language == 'auto' else language
        if device not in available_devices():
            raise ValueError('Choose an available caption processing device.')
        if model not in installed_models():
            raise ValueError('Choose an installed local Whisper model.')
        from faster_whisper import WhisperModel
        import torchaudio.functional
        import numpy as np
        wave = audio['waveform'][0].detach().cpu().float().mean(dim=0)
        rate = int(audio['sample_rate'])
        if rate != 16000:
            wave = torchaudio.functional.resample(wave, rate, 16000)
        samples = wave.numpy().astype(np.float32)
        duration = len(samples) / 16000
        if duration <= 0 or duration > 600:
            raise ValueError('Select audio between 0 and 600 seconds.')
        segments = []
        language = None
        if np.max(np.abs(samples)) > 0.001:
            # CPU remains the default; GPU is an explicit advanced choice.
            engine = WhisperModel(MODELS[model], device=device, compute_type='float16' if device == 'cuda' else 'int8', cpu_threads=4, local_files_only=True)
            stream, info = engine.transcribe(samples, language=requested_language, beam_size=5, temperature=0, vad_filter=False, word_timestamps=True,
                                              language_detection_segments=3, language_detection_threshold=0.8,
                                              condition_on_previous_text=False, no_speech_threshold=0.6)
            language = info.language
            for segment in stream:
                text = segment.text.strip()
                start, end = max(0, float(segment.start)), min(duration, float(segment.end))
                if text and end > start and segment.no_speech_prob < 0.6:
                    # Readable caption phrases using actual word timestamps, never evenly guessed timing.
                    words = segment.words or []
                    chunk = None
                    for word in words:
                        first, last = max(0, float(word.start)), min(duration, float(word.end))
                        if not word.word.strip() or last <= first:
                            continue
                        if chunk and (len(chunk['text'] + word.word) > 42 or last - chunk['start'] > 4):
                            segments.append(chunk)
                            chunk = None
                        if chunk is None:
                            chunk = {'start': first, 'end': last, 'text': word.word.strip()}
                        else:
                            chunk['text'] += word.word
                            chunk['end'] = last
                        if word.word.rstrip().endswith(('.', '!', '?')):
                            segments.append(chunk)
                            chunk = None
                    if chunk:
                        segments.append(chunk)
                    if not words:
                        segments.append({'start': start, 'end': end, 'text': text})
            del engine
        words = ' '.join(segment['text'] for segment in segments).lower().split()
        if len(words) >= 12 and len(set(words)) / len(words) < 0.2:
            raise ValueError('Transcription repeated the same words. Choose the spoken language in Advanced or a larger model.')
        payload = {'model': model, 'language': language, 'duration': duration, 'segments': segments}
        folder = os.path.join(folder_paths.get_output_directory(), 'osh_captions')
        os.makedirs(folder, exist_ok=True)
        filename = uuid.uuid4().hex + '.json'
        with open(os.path.join(folder, filename), 'x', encoding='utf-8') as output:
            json.dump(payload, output, ensure_ascii=False)
        return {'ui': {'text': [{'filename': filename, 'subfolder': 'osh_captions', 'type': 'output'}]}}


NODE_CLASS_MAPPINGS = {'OSHWhisperCaptions': OSHWhisperCaptions}
NODE_DISPLAY_NAME_MAPPINGS = {'OSHWhisperCaptions': 'Studio · Whisper captions'}
