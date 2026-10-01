"""Shared look for the Moted explainer videos (3Blue1Brown-style).

Import this in every scene file:  `from moted_style import *`
It gives you the palette, a minimal TexTemplate that works on this machine (the
TeX Live here lacks manim's default preamble packages), and two helpers.
Render with:  uv run manim -qh --disable_caching <file>.py <SceneClass>
"""
from manim import *

# Palette: 3b1b dark navy stage, blue/yellow leads, one red for "wrong".
BG       = "#0b1120"
INK      = "#e6e9ef"   # default text
DIM      = "#8b93a7"   # secondary text, grids
BLUE     = "#58c4dd"   # FK / the honest quantity
YELLOW   = "#ffd166"   # IK / the thing we are measuring
RED      = "#ff6b6b"   # wrong / the trap
GREEN    = "#7ad28c"   # correct / proof
ORANGE   = "#ff9f43"   # highlight

config.background_color = BG
Text.set_default(color=INK, font="DejaVu Sans")
MathTex.set_default(color=INK)
Tex.set_default(color=INK)

# Minimal preamble: only packages present on this machine.
TEX = TexTemplate(
    documentclass=r"\documentclass[preview]{standalone}",
    preamble=r"\usepackage{amsmath}\usepackage{amssymb}\usepackage{xcolor}",
)
config.tex_template = TEX
MathTex.set_default(tex_template=TEX)
Tex.set_default(tex_template=TEX)


def title_card(scene, title, subtitle=None, hold=1.2):
    """Opening card: big title, optional one-line subtitle, then fade out."""
    t = Text(title, font_size=56, weight=BOLD)
    g = VGroup(t)
    if subtitle:
        g.add(Text(subtitle, font_size=28, color=DIM).next_to(t, DOWN, buff=0.4))
    scene.play(FadeIn(g, shift=UP * 0.2))
    scene.wait(hold)
    scene.play(FadeOut(g))


def caption(scene, text, prev=None, font_size=30):
    """Bottom caption that replaces the previous one. Returns the new caption."""
    c = Text(text, font_size=font_size).to_edge(DOWN, buff=0.5)
    if prev is None:
        scene.play(FadeIn(c))
    else:
        scene.play(ReplacementTransform(prev, c))
    return c
