from moted_style import *
import numpy as np

ROOT = np.array([-6.3, -0.3, 0.0])
S = 1.35            # segment length (four equal segments)
L = 4 * S
DELTA = 30 * DEGREES
N = 4


def chain(alphas):
    """Chain after joint k has turned by alphas[k] (about its own pivot)."""
    pts = [ROOT.copy()]
    th = 0.0
    for a in alphas:
        th += a
        pts.append(pts[-1] + S * np.array([np.cos(th), np.sin(th), 0]))
    lines = VGroup(*[Line(pts[i], pts[i + 1], stroke_width=7, color=BLUE) for i in range(4)])
    dots = VGroup(*[Dot(pts[i], radius=0.1, color=INK) for i in range(4)],
                  Dot(pts[4], radius=0.15, color=ORANGE))
    return VGroup(lines, dots), pts


def box(label, color, w=3.2):
    r = RoundedRectangle(corner_radius=0.12, width=w, height=0.9, color=color, stroke_width=3)
    t = Text(label, font_size=26).move_to(r)
    return VGroup(r, t)


class BendWeights(Scene):
    cap = None

    def say(self, text):
        fs = 30
        while Text(text, font_size=fs).width > 13.0:
            fs -= 2
        self.cap = caption(self, text, self.cap, font_size=fs)

    def bar_fill(self, frac, color, bar_left):
        r = Rectangle(width=max(frac, 1e-3) * 4.6, height=0.35, stroke_width=0,
                      fill_color=color, fill_opacity=0.9)
        r.align_to(bar_left, LEFT).move_to(bar_left.get_center() * [0, 1, 0] + r.get_center() * [1, 0, 0] * 0
                                           + np.array([bar_left.get_left()[0] + r.width / 2, 0, 0]))
        return r

    def play_turns(self, shares, color, bar_left, bar, factors, fill_color, terms=None):
        """Turn joints one by one with the given shares of DELTA."""
        alphas = [0, 0, 0, 0]
        cum = 0.0
        cur, _ = chain(alphas)
        for k in range(4):
            _, pts = chain(alphas)
            ring = Circle(radius=0.24, color=ORANGE, stroke_width=4).move_to(pts[k])
            alphas[k] = shares[k] * DELTA
            new, _ = chain(alphas)
            cum += shares[k] * (1 - k / 4)
            newbar = self.bar_fill(cum, fill_color, bar_left)
            anims = [Transform(self.chainm, new), Transform(bar, newbar)]
            if factors is not None:
                anims.append(FadeIn(factors[k], shift=UP * 0.1))
            self.play(Create(ring), run_time=0.35)
            self.play(*anims, run_time=1.1)
            self.play(FadeOut(ring), run_time=0.2)
            if terms is not None:
                self.play(Write(terms[k]), run_time=0.7)
                self.wait(0.3)
        return alphas

    def construct(self):
        title_card(self, "Bend Weights: Why Not 1/N",
                   "sharing a head swing across a neck chain", hold=1.0)

        # ---------- Beat 1: chain, chord, target, naive plan
        self.chainm, pts = chain([0, 0, 0, 0])
        rest = self.chainm
        # parts
        ray = DashedLine(ROOT, ROOT + (L + 0.35) * np.array([np.cos(DELTA), np.sin(DELTA), 0]),
                         color=YELLOW, stroke_width=4)
        tgt = ROOT + L * np.array([np.cos(DELTA), np.sin(DELTA), 0])
        target_box = Square(0.42, color=YELLOW, stroke_width=4).move_to(tgt).rotate(DELTA)
        box_lbl = Text("box", font_size=24, color=YELLOW).next_to(target_box, RIGHT, buff=0.2)
        arc = Arc(radius=1.1, start_angle=0, angle=DELTA, arc_center=ROOT, color=YELLOW, stroke_width=4)
        d_lbl = MathTex(r"\Delta", color=YELLOW, font_size=36).move_to(ROOT + 1.5 * np.array([np.cos(DELTA / 2), np.sin(DELTA / 2), 0]))
        root_lbl = Text("neck root", font_size=22, color=DIM).next_to(ROOT, DOWN, buff=0.25).align_to(ROOT + LEFT * 0.45, LEFT)
        head_lbl = Text("head", font_size=22, color=ORANGE).next_to(pts[4], DOWN, buff=0.25)
        Lline = DoubleArrow(ROOT + DOWN * 2.15, pts[4] + DOWN * 2.15, buff=0, color=DIM, stroke_width=3,
                            tip_length=0.18)
        L_lbl = MathTex("L", color=DIM, font_size=34).next_to(Lline, DOWN, buff=0.08)

        self.say("A neck of N joints, from the neck root to the head.")
        self.play(Create(rest[0]), FadeIn(rest[1]), FadeIn(root_lbl), FadeIn(head_lbl))
        self.play(GrowFromCenter(Lline), FadeIn(L_lbl))
        self.wait(0.6)
        self.say("The IK hold wants the head swung by Δ toward the box.")
        self.play(Create(ray), FadeIn(target_box), FadeIn(box_lbl))
        self.play(Create(arc), Write(d_lbl))
        self.wait(0.8)

        naive_h = Text("Naive plan", font_size=30, color=DIM)
        naive_1 = MathTex(r"w_i=\frac{1}{N}", font_size=54)
        naive_2 = MathTex(r"\text{joint } i \text{ turns } w_i\,\Delta=\frac{\Delta}{N}", font_size=38)
        naive = VGroup(naive_h, naive_1, naive_2).arrange(DOWN, buff=0.45).move_to([3.7, 0.7, 0])
        self.say("Naive plan: every joint takes an equal share, Δ/N.")
        self.play(FadeIn(naive_h))
        self.play(Write(naive_1))
        self.wait(0.5)
        self.play(Write(naive_2))
        self.wait(1.5)

        # ---------- Beat 2: own pivots
        self.say("But a joint turns about its own pivot, not the root.")
        self.play(FadeOut(naive))
        a_lbls = VGroup(*[MathTex(t, font_size=26, color=DIM).move_to(pts[i] + DOWN * 1.0)
                          for i, t in enumerate([r"a_1{=}0", r"a_2{=}L/4", r"a_3{=}L/2", r"a_4{=}3L/4"])])
        self.play(FadeIn(a_lbls), FadeOut(head_lbl))
        self.say("A joint at distance a_i moves only the chord beyond it.")
        pivot = Circle(radius=0.24, color=ORANGE, stroke_width=4).move_to(pts[2])
        tail = Line(pts[2], pts[4], color=ORANGE, stroke_width=11).set_opacity(0.55)
        self.play(Create(pivot), FadeIn(tail))
        self.wait(1.0)
        self.play(FadeOut(pivot), FadeOut(tail))

        formula = MathTex(r"\text{head turn}=\sum_i w_i\Bigl(1-\frac{a_i}{L}\Bigr)\Delta",
                          font_size=42).move_to([3.8, 3.15, 0])
        self.say("Its push on the head is scaled by (1 − a_i/L).")
        self.play(Write(formula[0][:10]))
        self.wait(0.3)
        self.play(Write(formula[0][10:]))
        self.wait(0.8)
        bar = Rectangle(width=4.6, height=0.35, color=DIM, stroke_width=3).move_to([4.3, 1.55, 0])
        bar_left = bar
        fill = self.bar_fill(0, BLUE, bar_left)
        b0 = MathTex("0", font_size=26, color=DIM).next_to(bar, DOWN, buff=0.12).align_to(bar, LEFT)
        bD = MathTex(r"\Delta", font_size=30, color=YELLOW).next_to(bar, DOWN, buff=0.12).align_to(bar, RIGHT)
        bT = Text("how far the head turns", font_size=24, color=DIM).next_to(bar, UP, buff=0.15)
        self.play(Create(bar), FadeIn(b0), FadeIn(bD), FadeIn(bT), FadeIn(fill))
        factors = VGroup(*[MathTex(t, font_size=30, color=BLUE).move_to(pts[i] + DOWN * 1.5)
                           for i, t in enumerate([r"\times 1", r"\times\tfrac34", r"\times\tfrac12", r"\times\tfrac14"])])
        self.say("Turn them one by one: the head falls short of Δ.")
        self.chainm = rest
        self.play_turns([0.25] * 4, BLUE, bar_left, fill, factors, BLUE)
        self.wait(1.0)
        chain_end = self.chainm

        # ---------- Beat 3: worked sum, term by term
        self.say("Worked case: four equal segments, a quarter each.")
        self.wait(1.2)
        rows = VGroup(
            MathTex(r"\tfrac14\cdot 1", font_size=40, color=BLUE),
            MathTex(r"+\ \tfrac14\cdot\tfrac34", font_size=40, color=BLUE),
            MathTex(r"+\ \tfrac14\cdot\tfrac12", font_size=40, color=BLUE),
            MathTex(r"+\ \tfrac14\cdot\tfrac14", font_size=40, color=BLUE),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.25).move_to([2.8, -0.35, 0])
        lbl_terms = VGroup(*[MathTex(f"w_{i+1}(1-a_{i+1}/L)", font_size=1) for i in range(0)])
        self.say("Sum the four terms, one joint at a time.")
        for k in range(4):
            ring = Circle(radius=0.24, color=ORANGE, stroke_width=4).move_to(
                chain([0.25 * DELTA] * k + [0] * (4 - k))[1][k])
            self.play(Create(ring), run_time=0.3)
            self.play(Write(rows[k]), run_time=0.7)
            self.play(FadeOut(ring), run_time=0.2)
            self.wait(0.3)
        rule = Line(LEFT * 1.4, RIGHT * 1.4, color=DIM, stroke_width=3).next_to(rows, DOWN, buff=0.25).align_to(rows, LEFT)
        total = MathTex(r"=0.625\,\Delta", font_size=52, color=RED).next_to(rule, DOWN, buff=0.3).align_to(rows, LEFT)
        self.play(Create(rule))
        self.play(Write(total))
        # gap marker on the picture
        ang_end = np.arctan2(*(np.array(chain([0.25 * DELTA] * 4)[1][4] - ROOT)[[1, 0]]))
        gap = Arc(radius=L - 0.3, start_angle=ang_end, angle=DELTA - ang_end, arc_center=ROOT,
                  color=RED, stroke_width=6)
        gap_t = Text("gap", font_size=26, color=RED).move_to(
            ROOT + (L + 0.55) * np.array([np.cos((ang_end + DELTA) / 2 + 0.12), np.sin((ang_end + DELTA) / 2 + 0.12), 0]))
        self.say("The head reaches only 0.625 of the way.")
        self.play(Create(gap), FadeIn(gap_t))
        self.wait(2.2)

        # ---------- Beat 4: the fix
        self.play(FadeOut(rows), FadeOut(rule), FadeOut(total), FadeOut(gap), FadeOut(gap_t),
                  FadeOut(factors), FadeOut(formula))
        self.say("The fix: measure the rest chain once, at construction.")
        fix = MathTex(r"w=\frac{1}{\sum_i\bigl(1-a_i/L\bigr)}", font_size=56, color=GREEN).move_to([3.8, 0.3, 0])
        self.play(Write(fix))
        self.wait(1.0)
        self.say("Then the weighted sum is exactly 1.")
        check = MathTex(r"\sum_i w\Bigl(1-\frac{a_i}{L}\Bigr)=1", font_size=44).next_to(fix, DOWN, buff=0.4)
        self.play(Write(check))
        self.wait(1.0)
        ex = MathTex(r"\text{four equal segments: }\ w=\frac{1}{2.5}=0.4", font_size=32).next_to(check, DOWN, buff=0.4)
        self.play(Write(ex))
        self.wait(1.0)

        self.say("Reset, and turn each joint by 0.4Δ instead of 0.25Δ.")
        self.play(Transform(chain_end, chain([0, 0, 0, 0])[0]),
                  Transform(fill, self.bar_fill(0, GREEN, bar_left)), run_time=1.2)
        self.chainm = chain_end
        self.play_turns([0.4] * 4, GREEN, bar_left, fill, None, GREEN)
        self.say("Now the head lands on the box.")
        self.play(Indicate(target_box, color=GREEN, scale_factor=1.25))
        self.wait(1.5)

        # character answers
        self.play(FadeOut(fix), FadeOut(check), FadeOut(ex), FadeOut(bar), FadeOut(fill),
                  FadeOut(b0), FadeOut(bD), FadeOut(bT))
        card1_h = Text("Guardian: five bones", font_size=28, color=DIM)
        card1_w = MathTex(r"w=0.399856", font_size=56, color=GREEN)
        card1_n = Text("not 0.4: one segment is 2.446,\nthe others 2.44", font_size=24, color=DIM)
        c1 = VGroup(card1_h, card1_w, card1_n).arrange(DOWN, buff=0.25)
        card2_h = Text("A one-segment neck", font_size=28, color=DIM)
        card2_w = MathTex(r"w=1.0", font_size=56, color=GREEN)
        card2_n = Text("exactly", font_size=24, color=DIM)
        c2 = VGroup(card2_h, card2_w, card2_n).arrange(DOWN, buff=0.25)
        both = VGroup(c1, c2).arrange(DOWN, buff=0.9).move_to([3.7, 0.4, 0])
        self.say("On one character with five bones, the weight is 0.399856.")
        self.play(FadeIn(c1, shift=UP * 0.2))
        self.wait(1.8)
        self.say("On a one-segment neck, exactly 1.0.")
        self.play(FadeIn(c2, shift=UP * 0.2))
        self.wait(1.2)
        self.say("One character's answers, not constants to copy.")
        self.wait(2.2)

        # ---------- Beat 5: feedback vs open chain
        self.play(*[FadeOut(m) for m in self.mobjects if m is not self.cap])
        self.say("One more lesson from the same build.")
        fk = box("FK controls", BLUE).move_to([-4.5, 1.3, 0])
        fwd = box("Forward FK", BLUE).move_to([0, 1.3, 0])
        bones = box("neck bones", ORANGE).move_to([4.5, 1.3, 0])
        ccd = box("CCD", RED).move_to([4.5, -1.5, 0])
        bwd = box("Backward FK", BLUE).move_to([-4.5, -1.5, 0])
        a1 = Arrow(fk.get_right(), fwd.get_left(), buff=0.1, color=INK)
        a2 = Arrow(fwd.get_right(), bones.get_left(), buff=0.1, color=INK)
        a3 = Arrow(bones.get_bottom(), ccd.get_top(), buff=0.1, color=INK)
        a4 = Arrow(ccd.get_left(), bwd.get_right(), buff=0.1, color=RED)
        a5 = Arrow(bwd.get_top(), fk.get_bottom(), buff=0.1, color=RED)
        self.play(FadeIn(VGroup(fk, fwd, bones)), Create(VGroup(a1, a2)))
        self.say("First try: CCD. It starts from the current pose.")
        self.play(FadeIn(ccd), Create(a3))
        self.wait(0.8)
        self.say("Backward FK wrote the FK controls; Forward FK read them back.")
        self.play(FadeIn(bwd), Create(a4))
        self.play(Create(a5))
        loop_t = Text("feeds back next tick", font_size=26, color=RED).move_to([0, -0.1, 0])
        self.play(FadeIn(loop_t))
        self.play(Indicate(VGroup(a1, a2, a3, a4, a5), color=RED, scale_factor=1.05), run_time=1.5)
        self.say("The correction piled up tick by tick: the neck wound up.")
        self.wait(2.0)

        self.play(FadeOut(ccd), FadeOut(a3), FadeOut(a4), FadeOut(a5), FadeOut(loop_t), FadeOut(bwd),
                  FadeOut(a1), FadeOut(fk), FadeOut(a2), FadeOut(fwd), FadeOut(bones))
        ik = box("IK controls", YELLOW).move_to([-4.5, 1.3, 0])
        sw = box("closed-form swing", GREEN, w=3.6).move_to([0, 1.3, 0])
        bn = box("neck bones", ORANGE).move_to([4.5, 1.3, 0])
        b1 = Arrow(ik.get_right(), sw.get_left(), buff=0.1, color=INK)
        b2 = Arrow(sw.get_right(), bn.get_left(), buff=0.1, color=INK)
        self.say("A closed-form swing reads only the IK controls: no loop.")
        self.play(FadeIn(ik), FadeIn(sw), FadeIn(bn), Create(b1), Create(b2))
        self.wait(1.5)
        bw = box("Backward FK", BLUE).move_to([4.5, -1.5, 0])
        fk2 = box("FK controls", BLUE).move_to([0, -1.5, 0])
        b3 = DashedLine(bn.get_bottom(), bw.get_top(), buff=0.1, color=GREEN)
        b4 = Arrow(bw.get_left(), fk2.get_right(), buff=0.1, color=GREEN)
        b4.set_stroke(width=4)
        flip = Text("only on the flip", font_size=26, color=GREEN).next_to(b3, LEFT, buff=0.25)
        self.say("So write the FK controls on the flip only.")
        self.play(FadeIn(bw), Create(b3), FadeIn(flip))
        self.play(Create(b4), FadeIn(fk2))
        self.wait(2.5)

        # ---------- End card
        self.play(*[FadeOut(m) for m in self.mobjects])
        self.cap = None
        end = VGroup(
            Text("Shares are not 1/N.", font_size=52, weight=BOLD),
            Text("Derive the weight from the rest chain,", font_size=36, color=GREEN),
            Text("then hand the pose over on the flip.", font_size=36, color=GREEN),
        ).arrange(DOWN, buff=0.4)
        self.play(FadeIn(end[0], shift=UP * 0.2))
        self.wait(0.8)
        self.play(FadeIn(end[1]), FadeIn(end[2]))
        self.wait(3.0)
