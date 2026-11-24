#!/usr/bin/env python3
"""Synthesize Trap Forge's original one-shot cues, offline.

Only Python's standard library and a local ffmpeg with libvorbis are required
to regenerate. Foundry consumes the checked-in Ogg files without either tool.
All timings below are seconds. No recordings, samples, or external assets.
"""

import argparse
import array
import hashlib
import math
from pathlib import Path
import random
import shutil
import subprocess
import sys
import tempfile
import wave

RATE = 32000
TAU = 2 * math.pi


def envelope(t, d, attack=.008, release=.080, decay=0.):
    """Short raised-cosine edges with an optional exponential decay."""
    if t < attack:
        edge = .5 - .5 * math.cos(math.pi * t / attack)
    elif d - t < release:
        edge = .5 - .5 * math.cos(math.pi * (d - t) / release)
    else:
        edge = 1.
    return edge * math.exp(-decay * t / d)


class Cue:
    def __init__(self, name, duration):
        self.name = name
        self.samples = array.array("d", [0.]) * round(RATE * duration)
        self.rng = random.Random(int.from_bytes(hashlib.sha256(name.encode()).digest()[:8], "big"))

    def tone(self, at, d, f0, f1=None, g=.1, a=.006, r=.09, decay=1.8,
             partials=((1., 1.),), vibrato=0., rate=7.):
        n = min(round(d * RATE), len(self.samples) - round(at * RATE))
        offset = round(at * RATE)
        f1 = f0 if f1 is None else f1
        phase = 0.
        for i in range(max(0, n)):
            t = i / RATE
            f = f0 * (f1 / f0) ** (t / d)
            f += vibrato * math.sin(TAU * rate * t)
            phase += TAU * f / RATE
            s = sum(w * math.sin(h * phase) for h, w in partials)
            self.samples[offset + i] += g * envelope(t, d, a, r, decay) * s

    def noise(self, at, d, g=.2, low=100., high=4500., a=.008, r=.08,
              decay=1.8, high_end=None, flutter=0., flutter_rate=24.):
        n = min(round(d * RATE), len(self.samples) - round(at * RATE))
        offset = round(at * RATE)
        f, l = 0., 0.
        la = 1 - math.exp(-TAU * low / RATE)
        ha = 1 - math.exp(-TAU * high / RATE)
        ha_end = 1 - math.exp(-TAU * (high_end if high_end is not None else high) / RATE)
        for i in range(max(0, n)):
            t = i / RATE
            x = self.rng.uniform(-1, 1)
            f += (ha + (ha_end - ha) * t / d) * (x - f)
            l += la * (f - l)
            pulse = 1. - flutter * (.5 + .5 * math.sin(TAU * flutter_rate * t))
            self.samples[offset + i] += 1.6 * g * (f - l) * pulse * envelope(t, d, a, r, decay)

    def hit(self, at, g, size=1., material="stone"):
        if material == "stone":
            self.noise(at, .18 * size, .42*g, 110, 2000, high_end=620, r=.06)
            self.tone(at, .22 * size, 112/size, 43/size, .57*g, r=.055, decay=3.0,
                      partials=((1, 1), (2.13, .19)))
        elif material == "metal":
            self.noise(at, .10 * size, .36*g, 800, 5600, r=.04)
            self.tone(at, .29 * size, 548/size, 496/size, .60*g, r=.10, decay=3.0,
                      partials=((1, 1), (2.13, .25), (3.58, .10), (5.08, .04)))
        elif material == "wood":
            self.noise(at, .11 * size, .36*g, 220, 5400, high_end=990, r=.04)
            self.tone(at, .16 * size, 228/size, 105/size, .56*g, r=.05, decay=3.5,
                      partials=((1, 1), (1.83, .31)))
        elif material == "glass":
            self.noise(at, .08 * size, .41*g, 1250, 7400, high_end=4700, r=.04)
            self.tone(at, .25 * size, 1397/size, 1380/size, .60*g, r=.10, decay=3.4,
                      partials=((1, 1), (1.62, .28), (2.44, .11)))

    def bubbles(self, at, duration, count, strength, lo=120., hi=480., rise=True):
        for _ in range(count):
            q = at + self.rng.uniform(0., duration)
            d = self.rng.uniform(.045, .14)
            f = self.rng.uniform(lo, hi)
            self.tone(q, d, f, f*(self.rng.uniform(1.15, 1.53) if rise else .7),
                      strength*self.rng.uniform(.32, 1.), a=.010, r=.027,
                      decay=1.4, partials=((1, 1), (2, .16)))

    def write(self, path):
        """Bound both transients and overall loudness without normalizing quiet cues up."""
        values = self.samples
        peak = max(abs(v) for v in values)
        rms = math.sqrt(sum(v*v for v in values)/len(values))
        if peak <= 0. or rms <= 0.:
            raise ValueError(f"{self.name}: silent sound")
        gain = min(1., .36 / peak, .074 / rms)
        pcm = array.array("h", (round(32767*gain*s) for s in values))
        if sys.byteorder != "little":
            pcm.byteswap()
        with wave.open(str(path), "wb") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(RATE)
            handle.writeframes(pcm.tobytes())


def build(name):
    duration = {
        "fire-blast": 1.36, "fire-jet": 1.52, "pit": 1.45,
        "stone": 1.02, "metal": .83, "darts": .73, "snare": .82,
        "water": 1.53, "ice": 1.11, "thunder": 1.58, "lightning": 1.16,
        "magic": 1.45, "poison": 1.32, "acid": 1.30, "organic": 1.26,
        "alarm": 1.48, "pulse": 1.07, "slash": .83, "cage": 1.16,
        "portal": 1.50, "spores": 1.24, "glass": .95, "steam": 1.31,
        "collapse": 1.61, "crystal": 1.22, "mimic": 1.37, "chime": 1.37,
    }[name]
    c = Cue(name, duration)
    n, t, h, b, rng = c.noise, c.tone, c.hit, c.bubbles, c.rng
    if name == "fire-blast":
        n(.02, .35, .60, 120, 6700, a=.024, high_end=760, decay=2.6)
        n(.04, 1.19, .39, 56, 1300, a=.029, r=.25, high_end=350, decay=2.2, flutter=.34)
        t(.02, .77, 177, 42, .30, a=.025, r=.19, decay=3.1)
        for at in (.09, .22, .31, .48, .51, .64, .75, .89, 1.01):
            n(at, .035, rng.uniform(.045, .115), 250, 7300, r=.014)
    elif name == "fire-jet":
        h(.012, .16, .57, "metal")
        n(.045, 1.12, .64, 160, 5000, a=.17, r=.24, decay=.6, high_end=2900, flutter=.48)
        n(.12, 1.23, .32, 70, 980, a=.09, r=.19, high_end=435, decay=.9)
        for at in (.22, .35, .64, .71, .89, 1.02, 1.15):
            n(at, .040, .10, 390, rng.uniform(3600, 5900), r=.018)
    elif name == "pit":
        h(.005, .18, .65, "metal")
        n(.08, .62, .57, 77, 1900, a=.052, r=.16, high_end=700, decay=1.1, flutter=.40, flutter_rate=12.)
        t(.16, .80, 128, 38, .24, a=.05, r=.20, decay=2.1)
        h(.26, .36, .98)
        for at,g,size in ((.37,.15,.50),(.52,.21,.68),(.69,.13,.45),(.89,.24,1.12),(1.10,.11,.65)):
            h(at,g,size)
    elif name == "stone":
        h(.01, .52, 1.46)
        n(.06, .72, .33, 43, 1050, a=.04, r=.17, high_end=285, decay=1.2, flutter=.26, flutter_rate=18.)
        h(.17,.29,.94); h(.31,.17,.64); h(.47,.12,.61); h(.58,.08,.42)
    elif name == "metal":
        h(.01,.47,1.17,"metal")
        h(.095,.29,.63,"metal")
        n(.14,.38,.23,680,3300,a=.019,r=.10,high_end=670,flutter=.61,flutter_rate=31.)
        h(.34,.13,.74,"metal"); h(.48,.09,.54,"metal")
    elif name == "darts":
        h(.009,.14,.40,"wood")
        for at, hz, d in ((.045,1200,.13),(.101,1640,.15),(.159,1400,.14),(.203,1770,.13)):
            n(at,d,.30,480,6200,a=.025,r=.053,decay=.5,high_end=2100)
            t(at+.006,d*.85,hz,hz*.34,.10,a=.016,r=.04,decay=1.5)
            h(at+d,.13,.49,"wood")
        n(.31,.29,.10,120,1700,a=.03,r=.08)
    elif name == "snare":
        h(.006,.22,.58,"wood")
        t(.07,.26,640,153,.41,a=.012,r=.085,decay=2.1,partials=((1,1),(2,.35),(3.04,.12),(4.06,.04)))
        n(.08,.38,.28,380,4750,a=.03,r=.065,high_end=650,decay=2.0,flutter=.45,flutter_rate=38)
        h(.33,.32,.75,"wood"); h(.54,.10,.48,"wood")
    elif name == "water":
        n(.03,1.37,.66,62,2250,a=.24,r=.31,decay=.7,high_end=590,flutter=.35,flutter_rate=7.)
        n(.20,.90,.55,460,7000,a=.11,r=.25,decay=.9,high_end=2800,flutter=.27,flutter_rate=17.)
        b(.29,.78,30,.094,150,710,False)
        n(.55,.65,.18,220,710,a=.12,r=.19)
    elif name == "ice":
        n(.02,.91,.26,1070,5600,a=.08,r=.15,high_end=2680,decay=.95)
        for at, sz in ((.115,.84),(.21,.79),(.29,.97),(.42,1.1),(.55,.87),(.62,.75)):
            h(at,.24,sz,"glass")
        t(.083,.7,317,730,.11,a=.08,r=.22,decay=1.35, vibrato=9)
    elif name == "thunder":
        n(.017,.63,.54,45,2900,a=.018,r=.16,high_end=420,decay=2.4)
        n(.074,1.37,.43,26,630,a=.054,r=.30,high_end=154,decay=.82,flutter=.67,flutter_rate=13.)
        for at,f,g in ((.04,141,.25),(.18,104,.19),(.34,83,.16),(.55,76,.11)):
            t(at,.58,f,44,g,a=.018,r=.11,decay=2.25)
    elif name == "lightning":
        n(.016,.27,.58,620,7300,a=.013,r=.07,high_end=1500,decay=2.4,flutter=.52,flutter_rate=72.)
        t(.019,.38,943,167,.19,a=.013,r=.09,decay=1.4,partials=((1,1),(2.4,.31),(4,.1)),vibrato=57,rate=57)
        for at in (.18,.21,.38,.41,.53,.56,.67,.78):
            n(at,.045,rng.uniform(.08,.22),480,6600,a=.006,r=.019,decay=2.5)
        n(.19,.84,.26,54,740,a=.02,r=.22,high_end=230,decay=1.65)
    elif name == "magic":
        n(.008,.68,.18,220,5000,a=.12,r=.18,high_end=1050,decay=1.05)
        for at, f, gain in ((.035,261.626,.11),(.144,391.995,.14),(.26,523.251,.19),(.36,659.255,.15),(.62,783.991,.09)):
            t(at,.77,f,f*1.011,gain,a=.035,r=.24,decay=2.,partials=((1,1),(2.014,.25),(3.99,.09)),vibrato=1.9)
    elif name == "poison":
        h(.012,.15,.57,"metal")
        n(.034,1.18,.42,430,6400,a=.13,r=.26,high_end=2200,decay=.8,flutter=.24,flutter_rate=9.)
        n(.21,.99,.21,99,1100,a=.19,r=.19,high_end=540,decay=1.2)
        b(.13,.76,13,.056,145,330)
    elif name == "acid":
        n(.02,.91,.39,475,6980,a=.04,r=.15,high_end=4650,decay=1.4,flutter=.37,flutter_rate=49.)
        b(.034,1.04,48,.11,260,1450)
        for at in (.14,.26,.35,.68,.79):
            n(at,.05,.21,1700,rng.uniform(4200,7800),r=.022,decay=2.9)
    elif name == "organic":
        n(.012,.62,.37,75,2150,a=.14,r=.14,high_end=960,decay=2.3,flutter=.47,flutter_rate=18.)
        t(.047,.53,267,99,.30,a=.074,r=.095,decay=1.4,partials=((1,1),(2.01,.4),(3.3,.18)),vibrato=24,rate=24)
        b(.25,.74,13,.075,100,337,False)
        h(.36,.19,.68,"wood"); h(.54,.11,.53,"wood")
    elif name == "alarm":
        for at in (.014,.34,.69):
            h(at,.13,1.0,"metal")
            t(at,.60,415,409,.17,a=.018,r=.18,decay=2.2,partials=((1,1),(1.48,.37),(2.06,.30),(3.4,.09),(4.8,.04)))
        n(.38,.58,.11,53,390,a=.09,r=.13,decay=.6)
    elif name == "pulse":
        for at,g in ((.035,.39),(.30,.17),(.52,.09)):
            t(at,.47,215,48,g,a=.026,r=.15,decay=2.6,partials=((1,1),(2.01,.26),(3.1,.10)))
            n(at,.25,.23*g,100,4100,a=.013,r=.067,high_end=600,decay=1.65)
    elif name == "slash":
        n(.015,.49,.56,270,7000,a=.13,r=.16,high_end=320,decay=1.25,flutter=.21,flutter_rate=26)
        t(.087,.35,951,183,.23,a=.052,r=.11,decay=2.1,partials=((1,1),(2.014,.46),(3.97,.16)))
        h(.27,.23,.53,"metal"); n(.35,.35,.11,570,2550,a=.04,r=.11,high_end=700)
    elif name == "cage":
        n(.01,.42,.34,210,2200,a=.048,r=.14,flutter=.62,flutter_rate=46)
        for at in (.035,.100,.161,.236,.294): h(at,.085,rng.uniform(.47,.70),"metal")
        h(.36,.68,1.47,"metal"); h(.37,.46,1.23)
        for at in (.46,.50,.54,.62,.70): h(at,.14,.57,"metal")
    elif name == "portal":
        n(.03,1.28,.39,90,4200,a=.25,r=.26,high_end=570,decay=.68,flutter=.40,flutter_rate=8.)
        for f0,f1,g in ((174,405,.17),(256,524,.12),(398,748,.11)):
            t(.07,1.21,f0,f1,g,a=.23,r=.28,decay=.79,partials=((1,1),(2.02,.17)),vibrato=11,rate=13)
        t(.58,.70,680,92,.20,a=.05,r=.15,decay=2.0)
    elif name == "spores":
        n(.05,.92,.40,240,4050,a=.21,r=.22,high_end=1810,decay=1.2,flutter=.56,flutter_rate=8.)
        for at in (.19,.25,.31,.36,.57,.63,.74):
            n(at,.078,.14,3200,7900,a=.009,r=.035); t(at,.10,rng.uniform(630,1180),350,.08,a=.014,r=.048)
        t(.22,.85,372,190,.085,a=.23,r=.15,decay=.7,vibrato=17,rate=11)
    elif name == "glass":
        h(.025,.47,.72,"glass"); n(.038,.33,.55,900,7600,a=.012,r=.13,high_end=2500,decay=2.1)
        for at in (.14,.16,.19,.22,.25,.28,.33,.38,.49,.53):
            h(at,rng.uniform(.065,.18),rng.uniform(.68,1.14),"glass")
    elif name == "steam":
        h(.009,.18,.68,"metal")
        n(.03,1.15,.55,1010,7200,a=.07,r=.22,high_end=4200,decay=1.,flutter=.24,flutter_rate=37.)
        t(.11,.92,1360,720,.13,a=.16,r=.21,decay=1.4, vibrato=31,rate=8.1)
        n(.06,.75,.19,150,1900,a=.082,r=.19,high_end=625)
    elif name == "collapse":
        h(.007,.22,.65,"wood"); h(.075,.19,.91)
        n(.07,1.41,.48,54,1980,a=.10,r=.20,high_end=530,decay=1.0,flutter=.37,flutter_rate=12.)
        for at,g,size in ((.13,.28,1.2),(.21,.38,1.58),(.32,.31,1.78),(.44,.32,1.33),(.54,.26,1.45),(.65,.19,1.02),(.72,.22,.84),(.87,.13,.68),(1.02,.09,.84),(1.19,.065,.76)):
            h(at,g,size)
    elif name == "crystal":
        for at,f,g in ((.03,622.25,.15),(.094,739.99,.15),(.19,1046.5,.16),(.28,933.0,.13)):
            t(at,.83,f,f*1.002,g,a=.022,r=.29,decay=1.64,partials=((1,1),(1.67,.32),(2.77,.21),(4.97,.06)))
        n(.054,.35,.11,1300,4600,a=.02,r=.14)
    elif name == "mimic":
        n(.035,.81,.39,62,2740,a=.09,r=.19,high_end=770,decay=1.2,flutter=.55,flutter_rate=15.)
        for i,(at, f, g) in enumerate(((.089,123,.17),(.34,149,.19),(.61,119,.15))):
            t(at,.51,f,f*.63,g,a=.04,r=.15,decay=1.9,partials=((1,1),(2.04,.51),(3.2,.35),(5.09,.14)),vibrato=17,rate=12+i*7)
        h(.365,.25,.63,"wood"); h(.648,.31,1.12,"wood"); b(.53,.63,15,.065,85,450,False)
    elif name == "chime":
        for at,f,g in ((.025,740,.18),(.22,554.37,.14),(.44,830.61,.13)):
            t(at,.80,f,f*.998,g,a=.018,r=.29,decay=2.1,partials=((1,1),(2.013,.33),(3.08,.085)))
        n(.03,.38,.089,500,4140,a=.02,r=.13)
    else:
        raise ValueError(name)
    return c


NAMES = ("fire-blast", "fire-jet", "pit", "stone", "metal", "darts", "snare", "water",
         "ice", "thunder", "lightning", "magic", "poison", "acid", "organic", "alarm",
         "pulse", "slash", "cage", "portal", "spores", "glass", "steam", "collapse",
         "crystal", "mimic", "chime")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parent.parent / "assets" / "audio")
    args = parser.parse_args()
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        parser.error("ffmpeg with libvorbis is required for regeneration")
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="trap-cues-") as scratch:
        for name in NAMES:
            wav = Path(scratch) / (name + ".wav")
            ogg = Path(scratch) / (name + ".ogg")
            cue = build(name)
            cue.write(wav)
            subprocess.run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
                            "-i", str(wav), "-map_metadata", "-1", "-c:a", "libvorbis",
                            "-q:a", "3", str(ogg)], check=True)
            dest = args.output / ogg.name
            shutil.copyfile(ogg, dest)
            print(f"{name:11} {len(cue.samples)/RATE:0.2f}s {dest.stat().st_size:6d} B")


if __name__ == "__main__":
    main()
