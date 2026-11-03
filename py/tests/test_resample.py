import numpy as np

from ops.transcribe import load_16k


def test_load_16k_resamples_24k_wav(tmp_path):
    import soundfile as sf

    t = np.arange(24000) / 24000
    sf.write(str(tmp_path / "a.wav"), (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32), 24000)
    audio = load_16k(str(tmp_path / "a.wav"))
    assert audio.dtype == np.float32 and audio.ndim == 1
    assert len(audio) == 16000
    spectrum = np.abs(np.fft.rfft(audio))
    assert abs(int(np.argmax(spectrum)) - 440) <= 1  # 1 s of audio -> 1 Hz bins
    assert 0.45 < float(np.max(np.abs(audio[100:-100]))) < 0.55


def test_load_16k_mixes_stereo_to_mono(tmp_path):
    import soundfile as sf

    stereo = np.zeros((16000, 2), dtype=np.float32)
    stereo[:, 0] = 0.4
    sf.write(str(tmp_path / "s.wav"), stereo, 16000)
    audio = load_16k(str(tmp_path / "s.wav"))
    assert audio.shape == (16000,)
    assert np.allclose(audio[100:-100], 0.2, atol=1e-3)
