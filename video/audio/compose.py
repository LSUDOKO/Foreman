#!/usr/bin/env python3
"""Foreman film score: an original music bed + SFX, synthesised from scratch (numpy/scipy, no samples).

Contract (video/STORY.md): 136 BPM, 4/4, bar = 240/136 s, 108 bars = 190.588 s, key G minor.
Drops land exactly on bars 18, 60, 88; a one-beat hard silence precedes each. The music ducks
-12 dB (0.3 s raised-cosine ramps) for the real call audio at bars 38-41.5 and 48-50.5.
The hook motif (2 bars, A B A B') is identical at drop1, drop2, drop3 and the outro.

Run (any python with numpy, scipy, soundfile):
    /home/arpit/Desktop/hackathon_projects/boardloop-film/.venv/bin/python video/audio/compose.py
    # or: uv venv video/audio/.venv && uv pip install -p video/audio/.venv numpy scipy soundfile
Writes video/film/public/audio/{bed.wav, music-cues.json, sfx/*.wav} (48 kHz, 16-bit).
"""
import json
from functools import lru_cache
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy import signal
from scipy.ndimage import minimum_filter1d

SR = 48_000
BPM = 136
BAR = 240 / BPM
STEP = BAR / 16
BARS = 108
N = round(BARS * BAR * SR)  # 9_148_235 samples
OUT = Path(__file__).resolve().parents[1] / "film" / "public" / "audio"
TARGET_LUFS = -14.0
CEILING_DBTP = -1.5
DUCK_DB = -12.0
rng = np.random.default_rng(136)

SECTIONS = {
    "pickup": [0, 1], "hook": [1, 4], "problem": [4, 14], "question": [14, 16], "riser": [16, 17],
    "build": [17, 18], "drop1": [18, 30], "fill1": [30, 31], "product": [31, 58], "build2": [58, 60],
    "drop2": [60, 72], "calm": [72, 80], "lift": [80, 86], "riser3": [86, 87], "build3": [87, 88],
    "drop3": [88, 100], "outro": [100, 104], "tail": [104, 108],
}
DROPS = [18, 60, 88]
DUCK = [[38, 41.5], [48, 50.5]]

# voicings (MIDI) around G3-G4 for smooth voice leading, and bass roots (G1 = 31)
CH = {"Gm": (55, 58, 62, 67), "Eb": (55, 58, 63, 67), "Bb": (53, 58, 62, 65), "F": (53, 57, 60, 65),
      "Cm": (55, 60, 63, 67), "D": (54, 57, 62, 66), "Ab": (56, 60, 63, 68)}
ROOT = {"Gm": 31, "Eb": 27, "Bb": 34, "F": 29, "Cm": 36, "D": 38, "Ab": 32}
PROG = (["Gm"] + ["Gm", "Eb", "D"]                                        # 0 pickup, 1-3 hook
        + ["Gm", "Gm", "Eb", "Eb", "Gm", "Gm", "Cm", "Cm", "Eb", "D"]     # 4-13 problem
        + ["D", "D"] + ["Eb", "D"]                                        # 14-15 question, 16-17 riser/build
        + ["Gm", "Eb", "Bb", "F"] * 3 + ["Gm"]                            # 18-29 drop1, 30 fill1
        + ["Gm", "Eb", "Bb", "F", "Gm", "Eb", "F", "Gm", "Eb", "Bb", "F", "Gm"]  # 31-42 product
        + ["Cm", "Ab", "Cm", "D", "Cm", "Ab", "Gm", "D"]                  # 43-50 liar / scam
        + ["Eb", "Bb", "F", "Gm", "Eb", "Bb", "F"] + ["Eb", "D"]          # 51-57 confirm, 58-59 build2
        + ["Gm", "Eb", "Bb", "F"] * 3 + ["Eb", "Bb", "Cm", "F"] * 2       # 60-71 drop2, 72-79 calm
        + ["Gm", "Eb", "Bb", "F", "Gm", "Bb"] + ["Eb", "D"]               # 80-85 lift, 86-87 riser3/build3
        + ["Gm", "Eb", "Bb", "F"] * 3 + ["Gm", "Eb", "Bb", "F"] + ["Gm"] * 4)  # drop3, outro, tail

# the hook: (16th step, MIDI, length in steps); same pitches and rhythm on every return
HOOK = {
    "A": [(0, 67, 2), (3, 67, 1), (6, 70, 2), (8, 74, 3), (11, 72, 1), (12, 70, 2), (14, 69, 2)],
    "B": [(0, 67, 2), (3, 67, 1), (6, 70, 2), (8, 77, 2), (10, 74, 2), (12, 75, 4)],
    "B'": [(0, 67, 2), (3, 67, 1), (6, 70, 2), (8, 74, 2), (10, 77, 2), (12, 79, 4)],
}
PHRASE = ["A", "B", "A", "B'"]


# ---------------------------------------------------------------- basics

def at(bar, step=0.0):
    """Sample index of a bar (+16th step), always derived from the bar number."""
    return int(round((bar + step / 16) * BAR * SR))


def tt(n):
    return np.arange(n) / SR


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def place(buf, x, i, g=1.0):
    a, b = max(i, 0), min(len(buf), i + len(x))
    if a >= b:
        return
    seg = x[a - i:b - i] * g
    if buf.ndim == 2 and seg.ndim == 1:
        seg = seg[:, None]
    buf[a:b] += seg


def panl(x, p=0.0):
    return x if x.ndim == 2 else np.stack([x * np.sqrt((1 - p) / 2), x * np.sqrt((1 + p) / 2)], 1)


def fade_tail(x, ms=8):
    k = min(len(x), int(ms * SR / 1000))
    x = x.copy()
    x[-k:] *= np.linspace(1, 0, k)[:, None] if x.ndim == 2 else np.linspace(1, 0, k)
    return x


def _sos(kind, f, order=2):
    return signal.butter(order, f, kind, fs=SR, output="sos")


def lp(x, f, order=2):
    return signal.sosfilt(_sos("low", min(f, 0.45 * SR), order), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(_sos("high", f, order), x, axis=0)


def bp(x, lo, hi, order=2):
    return signal.sosfilt(_sos("band", [lo, min(hi, 0.45 * SR)], order), x, axis=0)


def vlp(x, fc, kind="low", block=256):
    """Time-varying 2nd-order filter, state carried across blocks (no clicks). fc: Hz array or scalar."""
    fc = np.broadcast_to(np.asarray(fc, float), (len(x),))
    out, zi = np.empty(len(x)), np.zeros((1, 2))
    for k in range(0, len(x), block):
        out[k:k + block], zi = signal.sosfilt(_sos(kind, float(np.clip(fc[k], 30, 0.45 * SR))), x[k:k + block], zi=zi)
    return out


def adsr(n, a=0.005, d=0.1, s=0.0, r=0.05, gate=None):
    t = tt(n)
    e = np.where(t < a, t / a, s + (1 - s) * np.exp(-(t - a) / d))
    if gate is not None and int(gate * SR) < n:
        g = int(gate * SR)
        e[g:] = e[g] * np.exp(-(t[g:] - t[g]) / r)
    return e


def saw(f, n, ph=0.0):
    """Band-limited (polyBLEP) saw."""
    dt = f / SR
    p = (ph + np.arange(n) * dt) % 1.0
    y = 2 * p - 1
    m = p < dt
    x = p[m] / dt
    y[m] -= 2 * x - x * x - 1
    m = p > 1 - dt
    x = (p[m] - 1) / dt
    y[m] -= x * x + 2 * x + 1
    return y


def harm(f, n, fc, shape="saw", kmax=40, order=2):
    """Additive saw/square through a (time-varying) low-pass: alias-free filter envelopes."""
    w = 2 * np.pi * f * tt(n)
    out = np.zeros(n)
    for k in range(1, int(min(kmax, 18000 // f)) + 1):
        if shape == "square" and k % 2 == 0:
            continue
        out += np.sin(k * w) / k / np.sqrt(1 + (k * f / fc) ** (2 * order))
    return out


# ---------------------------------------------------------------- instruments

HAT_F = (205.3, 304.4, 369.6, 522.7, 540.0, 800.0)


def metal(n, ratio=1.0, ph=0.0):
    t = tt(n)
    return sum(np.sign(np.sin(2 * np.pi * f * ratio * t + i + ph)) for i, f in enumerate(HAT_F)) / 6


def kick(hard=True):
    t = tt(int(0.5 * SR))
    f = 47 + (150 if hard else 95) * np.exp(-t / 0.03) + 240 * np.exp(-t / 0.004)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.32 if hard else 0.2))
    click = bp(rng.standard_normal(len(t)), 1800, 9000) * np.exp(-t / 0.0025) * (0.55 if hard else 0.12)
    x = np.tanh((body + click) * (2.4 if hard else 1.3))
    return fade_tail(x / np.abs(x).max(), 20)


def snare():
    t = tt(int(0.4 * SR))
    body = np.sin(2 * np.pi * np.cumsum(188 + 70 * np.exp(-t / 0.012)) / SR) * np.exp(-t / 0.075)
    noise = bp(rng.standard_normal(len(t)), 1300, 11000) * np.exp(-t / 0.12)
    x = np.tanh(1.7 * (0.9 * body + 1.1 * noise))
    return fade_tail(x / np.abs(x).max())


def clap():
    t = tt(int(0.45 * SR))
    x = bp(rng.standard_normal(len(t)), 900, 5200)
    e = sum((t >= d) * np.exp(-np.maximum(t - d, 0) / 0.009) for d in (0, 0.01, 0.021)) * 0.7
    e = e + (t >= 0.03) * np.exp(-np.maximum(t - 0.03, 0) / 0.13)
    x = x * e
    return fade_tail(x / np.abs(x).max())


def hat(open_=False):
    n = int((0.42 if open_ else 0.08) * SR)
    x = hp(0.6 * metal(n) + 0.5 * rng.standard_normal(n), 7200, 4) * np.exp(-tt(n) / (0.2 if open_ else 0.02))
    return fade_tail(x / np.abs(x).max())


def tick():
    t = tt(int(0.04 * SR))
    x = np.sin(2 * np.pi * 3100 * t) * np.exp(-t / 0.003) * 0.6 + hp(rng.standard_normal(len(t)), 6000) * np.exp(-t / 0.0015) * 0.5
    return fade_tail(x / np.abs(x).max())


def rim():
    t = tt(int(0.08 * SR))
    x = np.sin(2 * np.pi * 830 * t) * np.exp(-t / 0.012) + bp(rng.standard_normal(len(t)), 2000, 7000) * np.exp(-t / 0.006) * 0.8
    return fade_tail(x / np.abs(x).max())


def shaker():
    t = tt(int(0.07 * SR))
    x = hp(rng.standard_normal(len(t)), 6000, 2) * np.minimum(1, t / 0.006) * np.exp(-t / 0.025)
    return fade_tail(x / np.abs(x).max())


def crash(sec=2.4):
    n = int(sec * SR)
    t = tt(n)
    ch = [hp(0.5 * metal(n, 1.47, c) + rng.standard_normal(n), 4200) * np.exp(-t / 0.7) * np.minimum(1, t / 0.002) for c in (0, 1)]
    x = np.stack(ch, 1)
    return fade_tail(x / np.abs(x).max(), 50)


def tom(f0):
    t = tt(int(0.35 * SR))
    x = np.tanh(1.6 * np.sin(2 * np.pi * np.cumsum(f0 * 0.65 + f0 * 0.35 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.15))
    return fade_tail(x)


@lru_cache(None)
def bass808(m, steps, glide=0):
    sec = steps * STEP * 0.94
    n = int(sec * SR) + int(0.05 * SR)
    t = tt(n)
    f = hz(m) + (hz(m + glide) - hz(m)) * np.exp(-t / 0.05) if glide else np.full(n, hz(m))
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.tanh(2.0 * (np.sin(ph) + 0.15 * np.sin(2 * ph))) / np.tanh(2.0)  # harmonics for small speakers
    return x * adsr(n, 0.003, 0.7, 0.7, 0.025, gate=sec)


@lru_cache(None)
def reese(m, steps):
    sec = steps * STEP * 0.92
    n = int(sec * SR) + int(0.04 * SR)
    x = lp(saw(hz(m), n) + saw(hz(m) * 1.008, n, 0.37), 750, 2)
    return x * adsr(n, 0.004, 0.25, 0.55, 0.02, gate=sec) * 0.5


@lru_cache(None)
def pad(notes, sec, fc=2200.0, attack=0.25, release=0.35):
    n = int((sec + release * 2) * SR)
    L, R = np.zeros(n), np.zeros(n)
    for m in notes:
        for v, det in enumerate((-0.011, -0.004, 0.0, 0.005, 0.012)):
            x = saw(hz(m) * (1 + det), n, ph=rng.random())
            p = (v - 2) / 2 * 0.8
            L += x * np.sqrt((1 - p) / 2)
            R += x * np.sqrt((1 + p) / 2)
    st = hp(lp(np.stack([L, R], 1) / (len(notes) * 5), fc, 2), 140)
    return fade_tail(st * adsr(n, attack, 10, 1.0, release / 3, gate=sec)[:, None], 20)


@lru_cache(None)
def lead(m, steps):
    sec = steps * STEP * 0.9
    n = int((sec + 0.12) * SR)
    t = tt(n)
    f = hz(m)
    fc = 1100 + 4600 * np.exp(-t / 0.09)
    x = 0.55 * harm(f, n, fc, "saw") + 0.45 * harm(f * 1.006, n, fc, "square") + 0.3 * np.sin(np.pi * f * t)
    x = x * adsr(n, 0.002, 0.16, 0.6, 0.04, gate=sec)
    return fade_tail(np.tanh(1.8 * x) / np.tanh(1.8))


@lru_cache(None)
def bell(m, sec=0.7):
    n = int(sec * SR)
    t = tt(n)
    f = hz(m)
    x = np.sin(2 * np.pi * f * t + 1.5 * np.exp(-t / 0.12) * np.sin(2 * np.pi * 3 * f * t)) * np.exp(-t / 0.28)
    return fade_tail(x * np.minimum(1, t / 0.001))


@lru_cache(None)
def pluck(m, bright=1600, sec=0.2):
    n = int((sec + 0.06) * SR)
    t = tt(n)
    x = harm(hz(m), n, 220 + bright * np.exp(-t / 0.03), "saw", kmax=30)
    return fade_tail(x * np.exp(-t / (sec * 0.4)) * np.minimum(1, t / 0.0015))


@lru_cache(None)
def epiano(m, sec):
    n = int((sec + 0.7) * SR)
    t = tt(n)
    f = hz(m)
    x = np.sin(2 * np.pi * f * t + 1.1 * np.exp(-t / 0.5) * np.sin(2 * np.pi * f * t)) \
        + 0.1 * np.sin(2 * np.pi * f * 7 * t) * np.exp(-t / 0.015)
    e = np.exp(-t / 1.6) * np.minimum(1, t / 0.003)
    g = int(sec * SR)
    e[g:] *= np.exp(-(t[g:] - t[g]) / 0.18)
    return fade_tail(x * e)


def riser(sec, f0=300.0, f1=10000.0):
    n = int(sec * SR)
    u = tt(n) / sec
    nz = np.stack([vlp(rng.standard_normal(n), f0 * (f1 / f0) ** (u ** 1.6)) for _ in range(2)], 1)
    tone = np.sin(2 * np.pi * np.cumsum(hz(55) * 2 ** (2.5 * u)) / SR)
    return (nz * 0.6 + tone[:, None] * 0.12) * (u ** 2.2)[:, None]


def downlifter(sec):
    n = int(sec * SR)
    t = tt(n)
    u = t / sec
    nz = np.stack([vlp(rng.standard_normal(n), 9000 * (150 / 9000) ** (u ** 0.7)) for _ in range(2)], 1)
    tone = np.sin(2 * np.pi * np.cumsum(hz(79) * 2 ** (-4 * u)) / SR)
    env = (1 - u) ** 1.8 * np.minimum(1, t / 0.004)
    return (nz * 0.55 + tone[:, None] * 0.18) * env[:, None]


def impact(sec=3.0):
    t = tt(int(sec * SR))
    boom = np.tanh(1.8 * np.sin(2 * np.pi * np.cumsum(30 + 80 * np.exp(-t / 0.05)) / SR) * np.exp(-t / 0.9))
    x = boom[:, None] * 0.8 + crash(sec) * 0.3
    return fade_tail(x, 60)


# ---------------------------------------------------------------- arrangement

def compose():
    f32 = np.float32
    drums, pads, mus, fx, send = (np.zeros((N, 2), f32) for _ in range(5))
    bass, ld = np.zeros(N, f32), np.zeros(N, f32)
    kicks = []
    KH, KS, SN, CL, HO, TK, RM, SH = kick(True), kick(False), snare(), clap(), hat(True), tick(), rim(), shaker()
    HC = [hat() for _ in range(4)]
    CR, IMP = crash(2.4), impact()
    TOMS = [tom(f) for f in (200, 155, 118)]

    def D(x, bar, step, g, p=0.0, rev=0.0):
        i = at(bar, step)
        place(drums, panl(x, p), i, g)
        if rev:
            place(send, panl(x, p), i, g * rev)

    def K(bar, step, g, hard=True, depth=0.0):
        D(KH if hard else KS, bar, step, g)
        if depth:
            kicks.append((at(bar, step), depth))

    def HH(bar, step, g, open_=False):
        D(HO if open_ else HC[int(step * 2) % 4], bar, step, g, p=0.25 if int(step) % 2 else -0.15)

    def SNR(bar, step, g, clap_=True):
        D(SN, bar, step, g, rev=0.12)
        if clap_:
            D(CL, bar, step + 0.05, g * 0.7, p=0.1, rev=0.2)

    def BS(bar, step, m, steps, g, glide=0, mid=0.0):
        place(bass, bass808(m, steps, glide), at(bar, step), g)
        if mid:
            place(bass, reese(m + 12, steps), at(bar, step), mid)

    def PAD(bar, chord, bars=1.0, g=0.3, fc=2200.0, attack=0.25, rev=0.25, extra=()):
        x = pad(CH[chord] + tuple(extra), bars * BAR, float(fc), attack)
        place(pads, x, at(bar), g)
        place(send, x, at(bar), g * rev)

    def PL(bar, step, m, g, bright=1600, sec=0.2, rev=0.25):
        x = panl(pluck(m, bright, sec), 0.35 if int(step) % 4 < 2 else -0.35)
        place(mus, x, at(bar, step), g)
        place(send, x, at(bar, step), g * rev)

    def HOOKBAR(bar, which, g, bell_g=0.35, low=0.0):
        for step, m, ln in HOOK[which]:
            i = at(bar, step)
            place(ld, lead(m, ln), i, g)
            if low:
                place(ld, lead(m - 12, ln), i, g * low)
            b = panl(bell(m + 12), 0.2)
            place(mus, b, i, g * bell_g)
            place(send, b, i, g * bell_g * 0.5)

    def FX(x, bar, g, step=0.0):
        place(fx, panl(x), at(bar, step), g)
        place(send, panl(x), at(bar, step), g * 0.3)

    def ROLL(bar, g0, g1, eighths_to=8, sixteenths_to=12):
        """Snare build: 8ths, then 16ths, then 32nds up to step 12 (the gap starts at step 12)."""
        steps = list(np.arange(0, eighths_to, 2)) + list(np.arange(eighths_to, sixteenths_to, 1))
        steps += list(np.arange(sixteenths_to, 12, 0.5))
        for j, s in enumerate(steps):
            D(SN, bar, s, g0 + (g1 - g0) * j / max(1, len(steps) - 1), p=0.1 * (-1) ** j, rev=0.15)

    # ---- pickup + hook + problem: one continuous low drone (G1/D2/G2 pedal) bars 0-14
    n_dr = at(14) + int(0.25 * SR)
    t = tt(n_dr)
    dr = 0.5 * saw(hz(31), n_dr) + 0.35 * saw(hz(38), n_dr, 0.3) + 0.3 * saw(hz(43) * 1.003, n_dr, 0.6)
    dr = vlp(dr, 240 + 130 * np.sin(2 * np.pi * t / (2 * BAR)), block=512) + 0.55 * np.sin(2 * np.pi * hz(31) * t)
    env = np.clip(t / BAR, 0, 1) ** 2
    env[at(14):] *= np.exp(-(t[at(14):] - t[at(14)]) / 0.06)
    place(mus, panl(dr * env), 0, 0.3)
    rc = crash(BAR * 0.75)[::-1] * np.linspace(0, 1, int(BAR * 0.75 * SR))[:, None] ** 2  # reverse swell into bar 1
    place(fx, rc, at(1) - len(rc), 0.25)

    # ---- hook (1-4): slams on 1.0, 2.0, 3.0 (+ the NO-SHOW stamp at 3.5), clock ticks
    for bar in (1, 2, 3):
        ch = PROG[bar]
        K(bar, 0, 1.0)
        D(CL, bar, 0.05, 0.6, rev=0.3)
        place(fx, CR, at(bar), 0.22 if bar > 1 else 0.3)
        BS(bar, 0, ROOT[ch], 14, 0.85, glide=12)
        PAD(bar, ch, 0.25, 0.5, fc=5000, attack=0.003, rev=0.5)
    FX(IMP, 1, 0.5)
    K(3, 8, 0.9)
    SNR(3, 8, 0.6)
    PAD(3, "D", 0.2, 0.35, fc=4000, attack=0.003, rev=0.5)
    for bar in (1, 2, 3):
        for s in range(0, 16, 2):
            D(TK, bar, s, 0.14 if s % 4 else 0.24, p=0.3)

    # ---- problem (4-14): muted plucks, ticking hats, sub kick; tension grows from bar 8 and 11
    PLUCK_PAT = [0, 3, 6, 8, 11, 14]
    for bar in range(4, 14):
        ch, k = PROG[bar], bar - 4
        notes = CH[ch]
        for j, s in enumerate(PLUCK_PAT):
            PL(bar, s, notes[(j + k) % 4] - (12 if j % 3 == 0 else 0), 0.75 + 0.1 * (bar >= 11),
               bright=700 + 120 * k, sec=0.16)
        for s in range(16):
            D(TK, bar, s, 0.32 if s % 4 == 0 else 0.15, p=0.35)
        K(bar, 0, 0.85, hard=False)
        if bar >= 8:
            K(bar, 10, 0.65, hard=False)
            D(RM, bar, 8, 0.45, p=-0.1, rev=0.3)
        if bar >= 11:
            for s in range(2, 16, 4):
                HH(bar, s, 0.14)
            for s in range(0, 16, 2):
                BS(bar, s, ROOT[ch] + 12, 1, 0.45)
        if bar >= 10:
            PAD(bar, ch, 1.0, 0.28, fc=650, attack=0.6)

    # ---- question (14-16): near-silence, one held D5
    n_q = at(16.25) - at(14)
    t = tt(n_q)
    q = (np.sin(2 * np.pi * hz(74) * t) + 0.2 * np.sin(4 * np.pi * hz(74) * t)) * (1 + 0.05 * np.sin(2 * np.pi * 4.8 * t))
    q *= np.minimum(1, t / 0.5) * np.where(t > 2 * BAR, np.exp(-(t - 2 * BAR) / 0.12), 1)
    place(mus, panl(fade_tail(q)), at(14), 0.05)
    place(send, panl(fade_tail(q)), at(14), 0.05)

    # ---- riser (16-17) + build (17-18) -> silence 17.75 -> DROP 18.0
    def build_into(drop, two_bars=False):
        r0 = drop - (2 if two_bars else 2)
        FX(riser(1.75 * BAR), r0, 0.55)
        if two_bars:
            pass
        for s in (0, 4, 8, 12):
            D(SN, r0, s, 0.25 + 0.03 * s, rev=0.2)
        PAD(r0, PROG[r0], 1.0, 0.16, fc=900, attack=0.5)
        b1 = drop - 1
        K(b1, 0, 0.9, depth=0.0)
        place(fx, CR, at(b1), 0.18)
        for s in (4, 8):
            K(b1, s, 0.75)
        ROLL(b1, 0.35, 0.85)
        PAD(b1, PROG[b1], 0.75, 0.22, fc=3500, attack=0.4)
        BS(b1, 0, ROOT[PROG[b1]], 12, 0.5)

    build_into(18)

    # ---- drops
    def drop(b0, inten):
        FX(IMP, b0, 0.7)
        PAD(b0, "Gm", 0.3, 0.4, fc=6500, attack=0.002, rev=0.4)  # downbeat stab
        for k in range(12):
            bar, ch = b0 + k, PROG[b0 + k]
            last = k == 11
            kp = [0, 6] if last else ([0, 6, 10] if k % 2 == 0 else [0, 6, 10, 13])
            for s in kp:
                K(bar, s, 1.0, depth=0.8)
            for s in (4, 12):
                SNR(bar, s, 0.85)
            if k % 2 == 1 and not last:
                D(SN, bar, 7, 0.12)
            if k % 4 == 2:
                D(SN, bar, 15, 0.14)
            for s in range(8 if last else 16):
                o = (s == 14 and k % 2 == 1) or (inten == 3 and s % 4 == 2)
                HH(bar, s, (0.2 if o else 0.24) * [1, 0.42, 0.68, 0.42][s % 4], open_=o)
            if k % 4 == 0:
                place(fx, CR, at(bar), 0.3 if k == 0 else 0.2)
            if last:  # fill
                for j, s in enumerate(range(8, 12)):
                    D(SN, bar, s, 0.4 + 0.1 * j, rev=0.15)
                for j, s in enumerate((12, 13, 14, 15)):
                    D(TOMS[min(j, 2)], bar, s, 0.7 + 0.05 * j, p=0.3 - 0.2 * j, rev=0.2)
            r = ROOT[ch]
            bp_ = [(0, 6), (6, 10)] if last else ([(0, 6), (6, 4), (10, 6)] if k % 2 == 0 else [(0, 6), (6, 4), (10, 3)])
            for s, ln in bp_:
                BS(bar, s, r, ln, 0.9, glide=12 if (k == 0 and s == 0) else 0, mid=0.5)
            if k % 2 == 1 and not last:
                BS(bar, 13, r + 12, 3, 0.7, mid=0.3)
            PAD(bar, ch, 1.0, 0.27, fc={1: 2800, 2: 3300, 3: 4200}[inten], attack=0.02)
            HOOKBAR(bar, PHRASE[k % 4], 0.5, bell_g=0.3 + 0.1 * (inten == 3), low=0.45 if inten == 3 else 0.0)
            if inten >= 2:  # money sparkle: 16th bell arpeggio high up
                for s in range(16):
                    m = CH[ch][[0, 1, 2, 3, 2, 1, 3, 2][s % 8]] + 24
                    b = panl(bell(m, 0.25), 0.6 if s % 2 else -0.6)
                    place(mus, b, at(bar, s), 0.045 * (1.2 if s % 4 == 0 else 1.0))
                    place(send, b, at(bar, s), 0.03)

    def downlift(bar, g=0.5):
        FX(downlifter(BAR), bar, g)

    drop(18, 1)

    # ---- fill1 (30): downlifter, ringing Gm, snare pickup into the product
    downlift(30)
    K(30, 0, 0.95, depth=0.5)
    place(fx, CR, at(30), 0.25)
    BS(30, 0, 31, 16, 0.75)
    PAD(30, "Gm", 0.9, 0.22, fc=1500, attack=0.01)
    for j, s in enumerate((12, 13, 14, 15)):
        D(SN, 30, s, 0.3 + 0.08 * j, rev=0.15)

    # ---- product (31-58): mid groove; light in the duck windows; tense for the liar and the scam
    def in_duck(bar, step=0.0):
        b = bar + step / 16
        return any(lo <= b < hi for lo, hi in DUCK)

    def mode_of(bar, step):
        b = bar + step / 16
        if in_duck(bar, step):
            return "duck"
        if 43 <= b < 48 or 50.5 <= b < 51:
            return "tense"
        return "bright" if b >= 51 else "groove"

    for bar in range(31, 60):
        ch = PROG[bar]
        notes, r = CH[ch], ROOT[ch]
        if bar >= 58:  # build2 handled below; keep a light groove under bar 58
            pass
        for s in range(16):
            md = mode_of(bar, s)
            odd = bar % 2 == 1
            if bar >= 59:
                break
            # drums
            if md in ("groove", "bright"):
                if s in (0, 10) or (odd and s == 7):
                    K(bar, s, 0.72, depth=0.45)
                if s in (4, 12):
                    SNR(bar, s, 0.42)
                if s % 2 == 0:
                    HH(bar, s, 0.15 if s % 4 == 0 else 0.11)
                elif md == "bright" or s % 4 == 3:
                    HH(bar, s, 0.05)
                if md == "bright" and s in (2, 10) and odd:
                    HH(bar, s + 0.0, 0.07, open_=True)
            elif md == "duck":
                if s == 0:
                    K(bar, s, 0.7, hard=False)
                if s % 2 == 0:
                    HH(bar, s, 0.15)
            else:  # tense
                if s in (0, 10):
                    K(bar, s, 0.6, depth=0.35)
                if s in (4, 12):
                    D(RM, bar, s, 0.3, rev=0.3)
                D(TK, bar, s, 0.13 if s % 4 == 0 else 0.06, p=0.35)
            # bass
            if md in ("groove", "bright") and s in (0, 10) or (md in ("groove", "bright") and odd and s == 7):
                BS(bar, s, r, {0: 6, 7: 3, 10: 6}[s], 0.7)
            elif md == "duck" and s == 0:
                BS(bar, 0, r, 8, 0.6)
            elif md == "tense" and s in (0, 8):
                BS(bar, s, r, 6, 0.6)
            # plucked chord arpeggio on 8ths
            if s % 2 == 0:
                j = s // 2
                m = notes[[0, 2, 1, 3, 2, 1, 3, 2][j]]
                g = {"groove": 0.2, "bright": 0.22, "duck": 0.22, "tense": 0.18}[md]
                PL(bar, s, m - (12 if md == "tense" else 0), g, bright={"tense": 800, "duck": 1000}.get(md, 1700), sec=0.18)
            if md == "bright" and s % 2 == 1:
                b = panl(bell(notes[(s // 2) % 4] + 12, 0.3), 0.5 if s % 4 == 1 else -0.5)
                place(mus, b, at(bar, s), 0.035)
        if bar < 58:
            md0 = mode_of(bar, 0)
            PAD(bar, ch, 1.0, {"duck": 0.11, "tense": 0.1, "groove": 0.11, "bright": 0.13}[md0],
                fc={"tense": 700, "duck": 900, "groove": 1300, "bright": 1900}[md0], attack=0.3)

    # build2 (58-60): riser into money
    FX(riser(1.75 * BAR), 58, 0.55)
    for s in (0, 4, 8, 12):
        D(SN, 58, s, 0.25 + 0.03 * s, rev=0.2)
    PAD(58, "Eb", 1.0, 0.16, fc=1200, attack=0.4)
    K(59, 0, 0.9)
    place(fx, CR, at(59), 0.18)
    for s in (4, 8):
        K(59, s, 0.75)
    ROLL(59, 0.35, 0.85)
    PAD(59, "D", 0.75, 0.22, fc=3500, attack=0.4)
    BS(59, 0, ROOT["D"], 12, 0.5)

    drop(60, 2)

    # ---- calm (72-80): downlifter, e-piano + warm pad + sub, a shaker late on
    downlift(72, 0.45)
    for bar in range(72, 80):
        ch, k = PROG[bar], bar - 72
        notes = CH[ch]
        for m in notes[:3]:
            place(mus, panl(epiano(m, BAR * 0.95), -0.2), at(bar), 0.2)
            place(send, panl(epiano(m, BAR * 0.95)), at(bar), 0.1)
        for s, j in ((6, 3), (10, 1), (14, 2)):
            x = panl(epiano(notes[j] + 12, BAR * 0.3), 0.3)
            place(mus, x, at(bar, s), 0.11)
            place(send, x, at(bar, s), 0.08)
        PAD(bar, ch, 1.0, 0.16, fc=900, attack=0.5, rev=0.4)
        BS(bar, 0, ROOT[ch], 15, 0.5)
        if k >= 4:
            for s in range(0, 16, 2):
                D(SH, bar, s, 0.09 if s % 4 else 0.06, p=0.4)

    # ---- lift (80-86): four-on-the-floor returns, filter opens, 16th arp climbs
    for bar in range(80, 86):
        ch, k = PROG[bar], bar - 80
        notes, r = CH[ch], ROOT[ch]
        for s in (0, 4, 8, 12):
            K(bar, s, 0.65 + 0.05 * k, depth=0.6)
        if k >= 2:
            for s in (4, 12):
                SNR(bar, s, 0.35 + 0.04 * k)
        for s in range(2, 16, 4):
            HH(bar, s, 0.11 + 0.01 * k, open_=k >= 3)
        if k >= 3:
            for s in range(16):
                if s % 4 != 2:
                    HH(bar, s, 0.05 + 0.04 * (s % 2 == 0))
        for s in (2, 6, 10, 14):
            BS(bar, s, r + (12 if s == 14 else 0), 2, 0.6, mid=0.25)
        PAD(bar, ch, 1.0, 0.13 + 0.02 * k, fc=600 * (4500 / 600) ** (k / 5), attack=0.2)
        for s in range(16):
            PL(bar, s, notes[[0, 1, 2, 3][s % 4]] + (12 if s >= 8 and k >= 3 else 0), 0.1 + 0.015 * k,
               bright=900 + 500 * k, sec=0.14)

    # riser3 (86) + build3 (87) -> DROP 88
    build_into(88)
    drop(88, 3)

    # ---- outro (100-104): downlifter, last full statement of the hook in half-time
    downlift(100, 0.4)
    for k in range(4):
        bar, ch = 100 + k, PROG[100 + k]
        K(bar, 0, 0.85, depth=0.6)
        K(bar, 10, 0.6, depth=0.4)
        SNR(bar, 8, 0.6)
        for s in range(0, 16, 2):
            HH(bar, s, 0.12 if s % 4 == 0 else 0.08)
        BS(bar, 0, ROOT[ch], 10, 0.75, mid=0.3)
        BS(bar, 10, ROOT[ch], 6, 0.6)
        PAD(bar, ch, 1.0, 0.2, fc=2600, attack=0.05)
        HOOKBAR(bar, PHRASE[k], 0.42, bell_g=0.45)

    # ---- tail (104-108): final Gm(add9) rings out
    FX(IMP, 104, 0.6)
    K(104, 0, 1.0)
    place(fx, CR, at(104), 0.25)
    fin = pad((55, 58, 62, 67, 69, 74), 3.5 * BAR, 2600.0, 0.01, 1.2)
    fin = fin * np.exp(-tt(len(fin)) / 2.6)[:, None]
    place(pads, fin, at(104), 0.45)
    place(send, fin, at(104), 0.35)
    BS(104, 0, 31, 40, 0.7)
    for m, d in ((79, 0.0), (86, 0.05)):
        b = panl(bell(m, 3.0), 0.2)
        place(mus, b, at(104) + int(d * SR), 0.15)
        place(send, b, at(104) + int(d * SR), 0.15)

    # ---- mix
    sc = np.ones(N, f32)
    rel = int(0.25 * SR)
    shape_t = tt(rel)
    for i, depth in kicks:
        j = min(N, i + rel)
        sc[i:j] = np.minimum(sc[i:j], 1 - depth * np.exp(-shape_t[: j - i] / 0.075))
    ldst = pingpong(ld.astype(float))
    place(send, ldst, 0, 0.25)
    wet = reverb(send.astype(float))
    mix = (drums + panl(lp(bass.astype(float), 2500) * sc) * 1.0 + pads * sc[:, None] + mus + ldst + fx + wet * 0.9)
    del drums, pads, mus, fx, send, wet
    mix = hp(mix.astype(float), 30)
    # mono below 120 Hz (sub and kick stay centred)
    lo = lp(mix.mean(1), 120, 4)
    mix = mix - lp(mix, 120, 4) + lo[:, None]
    return mix


def pingpong(x, d_steps=3, fb=0.36, taps=5):
    d = int(round(d_steps * STEP * SR))
    L, R, tap = x.copy(), x.copy(), x.copy()
    for k in range(1, taps + 1):
        tap = lp(np.concatenate([np.zeros(d), tap[:-d]]), 4500) * fb
        if k % 2:
            R += tap
        else:
            L += tap
    return np.stack([L, R], 1) * 0.707


def reverb(x, sec=2.3, pre=0.018, damp=5500):
    n = int(sec * SR)
    t = tt(n)
    ir = lp(rng.standard_normal((n, 2)) * np.exp(-t * 6.9 / sec)[:, None], damp)
    ir = np.concatenate([np.zeros((int(pre * SR), 2)), ir])
    ir /= np.sqrt((ir ** 2).sum(0))
    x = hp(x, 300)
    return np.stack([signal.oaconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)


# ---------------------------------------------------------------- master + measurement

def envelopes():
    duck = np.ones(N)
    lo = 10 ** (DUCK_DB / 20)
    r = int(0.3 * SR)
    ramp = 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, r))
    for b0, b1 in DUCK:
        i0, i1 = at(b0), at(b1)
        duck[i0 - r:i0] = 1 - (1 - lo) * ramp
        duck[i0:i1] = lo
        duck[i1:i1 + r] = lo + (1 - lo) * ramp
    gap = np.ones(N)
    f = int(0.006 * SR)
    for d in DROPS:
        i0, i1 = at(d - 0.25), at(d)
        gap[i0 - f:i0] = np.linspace(1, 0, f)
        gap[i0:i1] = 0
    i0 = at(105)
    tail = np.ones(N)
    tail[i0:] = np.cos(np.linspace(0, np.pi / 2, N - i0)) ** 2
    return duck, gap, tail


def true_peak(x):
    return max(np.abs(signal.resample_poly(x[:, c], 4, 1)).max() for c in range(2))


def limiter(x, ceiling_db=CEILING_DBTP, look_ms=1.5, release_ms=90):
    """Stereo-linked look-ahead brickwall on the 4x-oversampled peak (true peak)."""
    c = 10 ** (ceiling_db / 20)
    pk = np.maximum(*(np.abs(signal.resample_poly(x[:, ch], 4, 1))[: 4 * len(x)].reshape(-1, 4).max(1) for ch in range(2)))
    req = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    A = int(look_ms * 1e-3 * SR)
    h = minimum_filter1d(req, 2 * A + 1)
    cs = np.concatenate([[0.0], np.cumsum(np.concatenate([np.full(A, h[0]), h]))])
    s = (cs[A + 1:] - cs[: -A - 1]) / (A + 1)  # trailing box: s[p] <= req[p] at every peak
    blk = 16
    nb = -(-len(s) // blk)
    sd = np.pad(s, (0, nb * blk - len(s)), constant_values=1.0).reshape(nb, blk).min(1)
    a = np.exp(-blk / SR / (release_ms * 1e-3))
    g = np.empty(nb)
    cur = 1.0
    for i in range(nb):  # instant attack (already look-ahead smoothed), exponential release
        cur = min(sd[i], 1 - (1 - cur) * a)
        g[i] = cur
    g = minimum_filter1d(g, 3)
    gi = np.interp(np.arange(len(s)), np.arange(nb) * blk + blk / 2, g)
    gain = np.minimum(gi, s)
    return x * gain[:, None], gain


def kweight(x):
    x = signal.lfilter([1.53512485958697, -2.69169618940638, 1.19839281085285], [1.0, -1.69065929318241, 0.73248077421585], x, axis=0)
    return signal.lfilter([1.0, -2.0, 1.0], [1.0, -1.99004745483398, 0.99007225036621], x, axis=0)


def hops(x):
    """Channel-summed K-weighted mean square per 100 ms hop."""
    y = kweight(x)
    h = SR // 10
    n = len(y) // h
    return (y[: n * h] ** 2).reshape(n, h, 2).mean(1).sum(1)


def lufs(ms):
    return -0.691 + 10 * np.log10(np.maximum(ms, 1e-20))


def integrated(z):
    b = np.convolve(z, np.ones(4) / 4, "valid")
    l = lufs(b)
    keep = l > -70
    if not keep.any():
        return -np.inf
    rel = lufs(b[keep].mean()) - 10
    return float(lufs(b[keep & (l > rel)].mean()))


def short_term(z):
    return lufs(np.convolve(z, np.ones(30) / 30, "valid"))  # st[i] covers [0.1 i, 0.1 i + 3) s


def master(mix):
    duck, gap, tail = envelopes()
    mix = mix * gap[:, None]
    g = 10 ** ((TARGET_LUFS - integrated(hops(mix * duck[:, None]))) / 20)
    for it in range(6):
        y, gain = limiter(mix * g)
        y = y * (duck * tail)[:, None]
        L = integrated(hops(y))
        print(f"  master pass {it}: gain {20 * np.log10(g):+.2f} dB -> {L:.2f} LUFS, max GR {-20 * np.log10(gain.min()):.2f} dB")
        if abs(L - TARGET_LUFS) < 0.08:
            break
        g *= 10 ** ((TARGET_LUFS - L) / 20)
    return y, gain


def report(y, gain):
    z = hops(y)
    st = short_term(z)
    secs = lambda b: b * BAR
    print(f"integrated {integrated(z):.2f} LUFS, true peak {20 * np.log10(true_peak(y)):.2f} dBTP, "
          f"sample peak {20 * np.log10(np.abs(y).max()):.2f} dBFS, DC {y.mean(0)}")
    groups = {"pickup+hook": (0, 4), "problem": (4, 14), "question": (14, 16), "riser+build": (16, 18),
              "drop1": (18, 30), "fill1": (30, 31), "product": (31, 58), "build2": (58, 60), "drop2": (60, 72),
              "calm": (72, 80), "lift": (80, 86), "riser3+build3": (86, 88), "drop3": (88, 100),
              "outro": (100, 104), "tail": (104, 108)}
    duck_hops = np.zeros(len(z), bool)
    for lo, hi in DUCK:
        duck_hops[int(secs(lo) * 10) - 3: int(secs(hi) * 10) + 3] = True
    res = {}
    for name, (a, b) in groups.items():
        h0, h1 = int(np.ceil(secs(a) * 10)), int(secs(b) * 10)
        w = np.arange(h0, max(h0, h1 - 30))
        if name == "product":
            w = np.array([i for i in w if not duck_hops[i:i + 30].any()])
        stv = st[w] if len(w) else np.array([integrated(z[h0:h1])])
        gr = -20 * np.log10(gain[at(a):at(b)].min())
        res[name] = np.nanmedian(stv)
        print(f"  {name:14s} bars {a:>3}-{b:<3} I {integrated(z[h0:h1]):6.1f}  ST median {np.nanmedian(stv):6.1f}  "
              f"ST max {np.nanmax(stv):6.1f}  limiter GR {gr:4.1f} dB")
    for lo, hi in DUCK:
        before = lufs(z[int(secs(lo) * 10) - 14: int(secs(lo) * 10) - 4].mean())
        inside = lufs(z[int(secs(lo) * 10) + 2: int(secs(hi) * 10) - 2].mean())
        print(f"  duck {lo}-{hi}: 1 s before {before:.1f}, inside {inside:.1f} LUFS ({inside - before:+.1f} dB)")
    drops = np.mean([res["drop1"], res["drop2"], res["drop3"]])
    print(f"  drops vs problem {drops - res['problem']:+.1f} LU, vs product {drops - res['product']:+.1f} LU, "
          f"vs calm {drops - res['calm']:+.1f} LU")


# ---------------------------------------------------------------- SFX

def write_sfx(d):
    d.mkdir(parents=True, exist_ok=True)

    def save(name, x, peak_db=-1.0):
        x = np.asarray(x, float)
        x = panl(x) if x.ndim == 1 else x
        x = fade_tail(x - x.mean(0), 5)
        x *= 10 ** (peak_db / 20) / np.abs(x).max()
        sf.write(d / f"{name}.wav", x, SR, subtype="PCM_16")

    def noise(n):
        return rng.standard_normal(n)

    # whooshes: band-limited air peaking mid-way, panning L -> R
    for name, sec, f0, f1 in (("whoosh", 0.6, 400, 7000), ("whoosh-long", 1.2, 250, 6000)):
        n = int(sec * SR)
        u = tt(n) / sec
        bell_ = np.sin(np.pi * u) ** 2.5
        fc = f0 * (f1 / f0) ** np.sin(np.pi * u) ** 1.5
        x = np.stack([vlp(noise(n), fc, "low") for _ in range(2)], 1) * bell_[:, None]
        x += np.stack([vlp(noise(n), fc * 1.6, "high") for _ in range(2)], 1) * bell_[:, None] * 0.25
        p = np.linspace(-0.7, 0.7, n)
        x[:, 0] *= np.sqrt((1 - p) / 2) * 1.4
        x[:, 1] *= np.sqrt((1 + p) / 2) * 1.4
        save(name, x)
    k = KICK_FOR_SFX = kick(True)
    imp = impact(2.5)
    imp[: len(k)] += panl(k) * 0.9
    save("impact", imp)
    t = tt(int(0.35 * SR))  # slam: paper slap + body thud
    slap = bp(noise(len(t)), 700, 5500) * np.exp(-t / 0.018)
    thud = np.sin(2 * np.pi * np.cumsum(55 + 60 * np.exp(-t / 0.02)) / SR) * np.exp(-t / 0.07)
    save("slam", np.tanh(1.5 * (0.8 * slap + thud)))
    t = tt(int(0.07 * SR))  # click: crisp press + tiny release
    c = hp(noise(len(t)), 2500, 2) * np.exp(-t / 0.0012) + 0.6 * np.sin(2 * np.pi * 4300 * t) * np.exp(-t / 0.0025)
    i = int(0.035 * SR)
    c[i:] += (hp(noise(len(t) - i), 3000, 2) * np.exp(-t[: len(t) - i] / 0.0008)) * 0.35
    save("click", c)
    t = tt(int(0.11 * SR))  # type: one keystroke (clack + bottom-out thock)
    ks = bp(noise(len(t)), 1200, 7000) * np.exp(-t / 0.006) + 0.5 * np.sin(2 * np.pi * 320 * t) * np.exp(-t / 0.014)
    i = int(0.028 * SR)
    ks[i:] += bp(noise(len(t) - i), 2000, 8000) * np.exp(-t[: len(t) - i] / 0.003) * 0.3
    save("type", ks)
    t = tt(int(1.3 * SR))  # ding: two-note success chime C6 -> G6

    def chime(f, n):
        tt_ = tt(n)
        return sum(a * np.sin(2 * np.pi * f * r * tt_) * np.exp(-tt_ / dd) for r, a, dd in ((1, 1, 0.7), (2.0, 0.25, 0.35), (3.01, 0.08, 0.15))) * np.minimum(1, tt_ / 0.001)
    x = np.zeros(len(t))
    x += chime(1046.5, len(t))
    i = int(0.09 * SR)
    x[i:] += chime(1568.0, len(t) - i) * 0.9
    save("ding", np.stack([x, np.roll(x, 40)], 1), -3.0)
    t = tt(int(0.4 * SR))  # stamp: rubber thunk with a little rattle
    th = np.sin(2 * np.pi * np.cumsum(80 + 70 * np.exp(-t / 0.015)) / SR) * np.exp(-t / 0.07)
    mf = lp(noise(len(t)), 1400, 2) * np.exp(-t / 0.03)
    i = int(0.016 * SR)
    th[i:] += 0.3 * lp(noise(len(t) - i), 2500) * np.exp(-t[: len(t) - i] / 0.02)
    save("stamp", np.tanh(1.8 * (th + 0.6 * mf)))
    n = int(0.5 * SR)  # tear: crackling grains over ripping noise
    t = tt(n)
    u = t / t[-1]
    grains = np.zeros(n)
    for g0 in np.sort(rng.uniform(0, 0.47, 260)):
        j = int(g0 * SR)
        L_ = int(rng.uniform(0.001, 0.004) * SR)
        grains[j:j + L_] += rng.uniform(0.3, 1.0) * np.exp(-np.arange(min(L_, n - j)) / (L_ / 3))
    rip = vlp(noise(n), 1800 + 2600 * u, "high") * (grains * 0.9 + 0.25)
    env = np.minimum(1, t / 0.02) * np.where(u > 0.8, (1 - u) / 0.2, 1.0) ** 1.5
    save("tear", np.stack([rip * env, np.roll(rip, 60) * env], 1))
    rz = riser(BAR * 1.0)  # exactly one bar
    rz = np.concatenate([np.zeros((at(1) - len(rz), 2)), rz])
    assert len(rz) == 84706, len(rz)
    save("riser", rz)
    t = tt(int(0.36 * SR))  # error: two low buzzes, falling slightly
    bz = np.zeros(len(t))
    for j0, f in ((0.0, 116.0), (0.18, 104.0)):
        j = int(j0 * SR)
        L_ = int(0.15 * SR)
        tb = tt(L_)
        b_ = (saw(f, L_) + saw(f * 1.012, L_, 0.3)) * np.minimum(1, tb / 0.004) * np.minimum(1, (tb[-1] - tb) / 0.01)
        bz[j:j + L_] += b_
    save("error", lp(np.tanh(1.5 * bz), 2200, 2), -3.0)
    t = tt(int(0.9 * SR))  # coin: ka-ching (metal tick, then a bright bell cluster)
    x = hp(noise(len(t)), 3000) * np.exp(-t / 0.004) * 0.6
    x += sum(np.sin(2 * np.pi * f * t) * np.exp(-t / 0.05) for f in (2600, 3900)) * 0.3
    i = int(0.065 * SR)
    t2 = t[: len(t) - i]
    x[i:] += sum(a * np.sin(2 * np.pi * f * t2) * np.exp(-t2 / dd) for f, a, dd in
                 ((2093, 0.6, 0.35), (3136, 0.5, 0.3), (4186, 0.35, 0.22), (5274, 0.2, 0.15))) * (1 + 0.15 * np.sin(2 * np.pi * 24 * t2))
    save("coin", np.stack([x, np.roll(x, 30)], 1), -3.0)
    t = tt(int(1.5 * SR))  # phone-ring: marimba ringtone phrase, ~1.5 s
    x = np.zeros(len(t))
    for j, m in enumerate((84, 88, 91, 88, 84, 88, 91, 96)):
        i = int(j * 0.095 * SR)
        tn = t[: len(t) - i]
        f = hz(m)
        x[i:] += (np.sin(2 * np.pi * f * tn) + 0.3 * np.sin(2 * np.pi * 4 * f * tn) * np.exp(-tn / 0.02)) * np.exp(-tn / (0.18 if j < 7 else 0.5)) * np.minimum(1, tn / 0.001)
    save("phone-ring", np.stack([x, np.roll(x, 25)], 1), -3.0)
    t = tt(int(0.06 * SR))  # tick: woody clock tick
    x = bp(noise(len(t)), 2000, 6000) * np.exp(-t / 0.002) + 0.5 * np.sin(2 * np.pi * 3200 * t) * np.exp(-t / 0.004) + 0.3 * np.sin(2 * np.pi * 900 * t) * np.exp(-t / 0.006)
    save("tick", x)


# ---------------------------------------------------------------- main

def main():
    assert N == 9_148_235 and len(PROG) == BARS
    assert [at(d) for d in DROPS] == [round(d * BAR * SR) for d in DROPS]
    assert all(k in SECTIONS for k in ("drop1", "drop2", "drop3")) and [SECTIONS[f"drop{i}"][0] for i in (1, 2, 3)] == DROPS
    OUT.mkdir(parents=True, exist_ok=True)
    print("composing ...")
    mix = compose()
    print("mastering ...")
    y, gain = master(mix)
    assert len(y) == N and np.abs(y).max() < 1.0 and np.all(y[at(DROPS[0] - 0.25) + 10: at(DROPS[0])] == 0)
    sf.write(OUT / "bed.wav", y, SR, subtype="PCM_16")
    report(y, gain)
    cues = {"bpm": BPM, "bar": round(BAR, 8), "drops": DROPS, "duck": DUCK, "sections": SECTIONS,
            "duration": round(N / SR, 3), "duck_db": DUCK_DB, "duck_ramp_s": 0.3,
            "silence_before_drops_beats": 1, "hook_bars": {"drop1": [18, 30], "drop2": [60, 72], "drop3": [88, 100], "outro": [100, 104]}}
    (OUT / "music-cues.json").write_text(json.dumps(cues, indent=2) + "\n")
    write_sfx(OUT / "sfx")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
