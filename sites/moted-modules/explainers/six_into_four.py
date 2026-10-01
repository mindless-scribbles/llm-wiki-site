from moted_style import *
import numpy as np


def P(x, y):
    return np.array([x, y, 0.0])


class SixIntoFour(Scene):
    def setup(self):
        self.cap = None

    def say(self, text):
        self.cap = caption(self, text, self.cap, font_size=28)

    # ---------- reusable FK limb driven by two angles ----------
    def fk_limb(self, S, a, b, u, l, col=BLUE):
        def build():
            uu, ll = u.get_value(), l.get_value()
            s = P(*S)
            e = s + a * P(np.cos(uu), np.sin(uu))
            w = e + b * P(np.cos(uu + ll), np.sin(uu + ll))
            g = VGroup(
                Line(s, e, color=col, stroke_width=9),
                Line(e, w, color=col, stroke_width=9),
                Dot(s, color=INK, radius=0.11), Dot(e, color=INK, radius=0.11),
                Dot(w, color=INK, radius=0.11),
            )
            return g
        return always_redraw(build)

    def construct(self):
        title_card(self, "Six Into Four", "the DOF ledger", hold=1.0)

        # ================= BEAT 1: FK = 6 =================
        S = (-4.6, 1.6)
        u, l = ValueTracker(-0.6), ValueTracker(-0.9)
        limb = self.fk_limb(S, 2.4, 2.2, u, l)
        fk_tag = Text("FK", font_size=40, color=BLUE, weight=BOLD).move_to(P(-4.6, 3.0))
        self.add(limb)
        self.play(FadeIn(fk_tag), FadeIn(limb))
        self.say("A two-bone limb in FK: two rotations to set.")

        def chips(y, name):
            hdr = Text(name, font_size=28, color=BLUE).move_to(P(2.2, y), aligned_edge=LEFT)
            hdr.set_x(1.2 + hdr.width / 2)
            cs = VGroup()
            for i, ax in enumerate(["X", "Y", "Z"]):
                r = RoundedRectangle(width=1.2, height=0.6, corner_radius=0.12, color=BLUE, stroke_width=3)
                t = Text("rot " + ax, font_size=22)
                cs.add(VGroup(r, t))
            cs.arrange(RIGHT, buff=0.25).next_to(hdr, DOWN, buff=0.25, aligned_edge=LEFT)
            return hdr, cs

        h1, c1 = chips(1.8, "upper bone rotation")
        h2, c2 = chips(-0.3, "lower bone rotation")
        cnt_tr = ValueTracker(0)
        cnt = always_redraw(lambda: Integer(int(round(cnt_tr.get_value())), font_size=80, color=BLUE)
                            .move_to(P(5.6, -1.8)))
        cnt_lab = Text("values", font_size=24, color=DIM).move_to(P(5.6, -2.6))
        self.play(FadeIn(h1))
        self.add(cnt)
        self.play(u.animate.set_value(-0.1), run_time=1.2)
        for i, ch in enumerate(c1):
            self.play(FadeIn(ch, shift=LEFT * 0.2), cnt_tr.animate.set_value(i + 1), run_time=0.5)
            self.wait(0.15)
        self.play(u.animate.set_value(-0.6), run_time=1.0)
        self.say("Three values in the upper bone, three in the lower.")
        self.play(FadeIn(h2), FadeIn(cnt_lab))
        self.play(l.animate.set_value(-0.1), run_time=1.2)
        for i, ch in enumerate(c2):
            self.play(FadeIn(ch, shift=LEFT * 0.2), cnt_tr.animate.set_value(4 + i), run_time=0.5)
            self.wait(0.15)
        self.play(l.animate.set_value(-0.9), run_time=1.0)
        eq = MathTex("3 + 3 = 6", font_size=56, color=BLUE).move_to(P(2.2, -2.15))
        self.play(Write(eq))
        self.say("FK carries six values.")
        self.wait(1.5)
        self.play(*[FadeOut(m) for m in [h1, c1, h2, c2, cnt, cnt_lab, eq, fk_tag, limb]])

        # ================= BEAT 2: IK = 4 =================
        ik_tag = Text("IK", font_size=40, color=YELLOW, weight=BOLD).move_to(P(-3.0, 3.0))
        Sp, Wp = P(-5.0, 0.2), P(-1.0, 0.2)
        a = b = 2.6
        half = 2.0
        R = np.sqrt(a * a - half * half)
        C = (Sp + Wp) / 2
        rx = 0.55
        th = ValueTracker(0.5)

        def elbow():
            t = th.get_value()
            return C + P(rx * np.sin(t), R * np.cos(t))

        eff = Dot(Wp, color=YELLOW, radius=0.16)
        shoulder = Dot(Sp, color=INK, radius=0.11)
        bones = always_redraw(lambda: VGroup(
            Line(Sp, elbow(), color=YELLOW, stroke_width=9),
            Line(elbow(), Wp, color=YELLOW, stroke_width=9),
            Dot(elbow(), color=INK, radius=0.11)))
        self.play(FadeIn(ik_tag), FadeIn(shoulder), FadeIn(bones), FadeIn(eff))
        self.say("In IK we place an effector: that is a position.")
        eff_lab = Text("effector position", font_size=28, color=YELLOW).move_to(P(3.2, 1.8))
        chs = VGroup(*[VGroup(RoundedRectangle(width=1.2, height=0.6, corner_radius=0.12, color=YELLOW, stroke_width=3),
                              Text(t, font_size=22)) for t in ["pos X", "pos Y", "pos Z"]])
        chs.arrange(RIGHT, buff=0.25).next_to(eff_lab, DOWN, buff=0.25)
        eff_lab.set_x(chs.get_center()[0])
        cnt_tr = ValueTracker(0)
        cnt = always_redraw(lambda: Integer(int(round(cnt_tr.get_value())), font_size=80, color=YELLOW)
                            .move_to(P(5.6, -1.8)))
        self.add(cnt)
        self.play(FadeIn(eff_lab), Indicate(eff, color=YELLOW, scale_factor=1.8))
        for i, ch in enumerate(chs):
            self.play(FadeIn(ch, shift=LEFT * 0.2), cnt_tr.animate.set_value(i + 1), run_time=0.5)
        self.wait(0.5)

        # derive the pole
        axis = DashedLine(Sp, Wp, color=DIM, stroke_width=4)
        self.say("Shoulder to wrist is now a fixed line.")
        self.play(Create(axis))
        self.wait(0.8)
        self.say("Bone lengths are fixed, so the elbow lies on a circle.")
        circ = Ellipse(width=2 * rx, height=2 * R, color=GREEN, stroke_width=4).move_to(C)
        self.play(Create(circ))
        self.wait(0.8)
        self.say("The elbow may sit anywhere on it, and only there.")
        self.play(th.animate.set_value(0.5 + TAU), run_time=4.5, rate_func=linear)
        arm = always_redraw(lambda: Line(C, elbow(), color=ORANGE, stroke_width=5))
        arc_lab = MathTex(r"\theta", font_size=44, color=ORANGE).move_to(C + P(0.0, -R - 0.4))
        pole_lab = Text("pole", font_size=28, color=ORANGE).move_to(P(3.2, -0.2))
        pole_ch = VGroup(RoundedRectangle(width=1.6, height=0.6, corner_radius=0.12, color=ORANGE, stroke_width=3),
                         Text("angle", font_size=22)).next_to(pole_lab, DOWN, buff=0.25)
        self.say("Choosing the point is one angle about that axis.")
        self.add(arm)
        self.play(FadeIn(arc_lab), FadeIn(pole_lab), FadeIn(pole_ch), cnt_tr.animate.set_value(4))
        self.play(th.animate.set_value(0.5 + TAU + 1.6), run_time=2.0)
        self.play(th.animate.set_value(0.5 + TAU - 1.4), run_time=2.5)
        self.play(th.animate.set_value(0.5 + TAU), run_time=1.5)
        eq = MathTex("3 + 1 = 4", font_size=56, color=YELLOW).move_to(P(2.6, -2.15))
        eq.shift(LEFT * 0.0)
        self.play(Write(eq))
        self.say("The pole is one value. IK carries four.")
        self.wait(1.8)
        self.play(*[FadeOut(m) for m in [eff_lab, chs, pole_lab, pole_ch, arc_lab, arm, eq, cnt, axis, circ,
                                         bones, eff, shoulder, ik_tag]])

        # ================= BEAT 3: two values with nowhere to live =================
        big = VGroup(Text("FK  6", font_size=60, color=BLUE, weight=BOLD),
                     Text("IK  4", font_size=60, color=YELLOW, weight=BOLD)).arrange(RIGHT, buff=1.4)
        big.move_to(P(0, 1.0))
        self.play(FadeIn(big))
        self.say("Six against four. Two values have nowhere to live.")
        self.wait(1.2)
        two = VGroup(Text("upper roll", font_size=44, color=ORANGE), Text("lower roll", font_size=44, color=RED)
                     ).arrange(RIGHT, buff=1.4).move_to(P(0, -1.0))
        self.play(FadeIn(two, shift=UP * 0.2))
        self.say("They are the upper roll and the lower roll.")
        self.wait(1.5)
        self.play(FadeOut(big), FadeOut(two))

        # --- 3a: lower roll invisible ---
        S3 = P(-5.0, 1.2)
        E3 = P(-2.3, 0.2)
        W3 = P(1.0, 0.2)
        tw = ValueTracker(0.0)
        low = VGroup(Line(S3, E3, color=BLUE, stroke_width=9), Line(E3, W3, color=BLUE, stroke_width=9),
                     Dot(S3, color=INK, radius=0.11), Dot(E3, color=INK, radius=0.11), Dot(W3, color=INK, radius=0.11))
        mid = (E3 + W3) / 2
        ring = Ellipse(width=0.7, height=1.6, color=RED, stroke_width=3).move_to(mid)
        marker = always_redraw(lambda: Dot(mid + P(0.35 * np.sin(tw.get_value()), 0.8 * np.cos(tw.get_value())),
                                           color=RED, radius=0.12))
        self.play(FadeIn(low))
        self.say("Twist the forearm about its own axis.")
        self.play(Create(ring), FadeIn(marker))
        self.play(tw.animate.set_value(TAU), run_time=2.5)
        mk_e = Text("elbow: same place", font_size=26, color=GREEN).move_to(P(-2.3, 1.6))
        mk_w = Text("wrist: same place", font_size=26, color=GREEN).move_to(P(1.4, 1.6))
        mk_w.shift(LEFT * 0.0)
        self.play(Indicate(low[3], color=GREEN, scale_factor=2), Indicate(low[4], color=GREEN, scale_factor=2),
                  FadeIn(mk_e), FadeIn(mk_w))
        self.say("Elbow and wrist both sit on that axis. Neither moves.")
        self.wait(1.5)
        lost = Text("lower roll: INVISIBLE to IK", font_size=36, color=RED).move_to(P(0, -1.8))
        self.play(FadeIn(lost))
        self.say("The solve cannot see it, so it is silently dropped.")
        self.wait(2.0)
        self.play(*[FadeOut(m) for m in [low, ring, marker, mk_e, mk_w, lost]])

        # --- 3b: upper roll substituted (end-on view) ---
        ctr = P(-2.5, 0.2)
        Rr = 1.8
        circle = Circle(radius=Rr, color=DIM, stroke_width=3).move_to(ctr)
        cross = Dot(ctr, color=INK, radius=0.1)
        cross_lab = Text("looking down shoulder to wrist", font_size=24, color=DIM).move_to(P(-2.5, -2.4))
        posed_ang = PI / 2
        posed = Line(ctr, ctr + Rr * P(0, 1), color=BLUE, stroke_width=8)
        posed.add_tip(tip_length=0.25)
        posed_lab = Text("plane the animator posed", font_size=26, color=BLUE).move_to(P(3.2, 1.8))
        self.play(Create(circle), FadeIn(cross), FadeIn(cross_lab))
        self.say("The upper roll is not dropped. It is made up.")
        self.play(GrowArrow(posed) if False else Create(posed), FadeIn(posed_lab))
        self.wait(1.0)
        phi = ValueTracker(0.0)
        derived = always_redraw(lambda: Arrow(ctr, ctr + Rr * P(-np.sin(phi.get_value()), np.cos(phi.get_value())),
                                              buff=0, color=RED, stroke_width=8, max_tip_length_to_length_ratio=0.2))
        der_lab = Text("plane the solver derives", font_size=26, color=RED).move_to(P(3.2, 0.9))
        self.say("Bend the forearm off its hinge axis...")
        self.wait(0.8)
        self.add(derived)
        self.play(FadeIn(der_lab), phi.animate.set_value(np.radians(25)), run_time=2.0)
        arc = always_redraw(lambda: Arc(radius=0.9, start_angle=PI / 2, angle=phi.get_value(), arc_center=ctr, color=ORANGE, stroke_width=5))
        self.add(arc)
        arc_t = MathTex(r"25^\circ", font_size=40, color=ORANGE).move_to(ctr + P(-1.2, 1.8))
        self.say("...and the wrist leaves the plane that was posed.")
        self.play(FadeIn(arc_t))
        self.wait(1.2)
        note = VGroup(
            Text("At the rest right angle,", font_size=26, color=DIM),
            Text("a 25° off-hinge bend becomes", font_size=26, color=DIM),
            Text("upper roll 25°", font_size=30, color=ORANGE),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.15).move_to(P(3.2, -0.9))
        self.play(FadeIn(note))
        self.say("The solver builds a roll from the new plane, every frame.")
        self.wait(2.0)
        sub = Text("upper roll: SUBSTITUTED", font_size=34, color=ORANGE).move_to(P(3.2, -2.3))
        self.play(FadeIn(sub))
        self.say("Not the one anyone authored. Nothing was lost to the solver.")
        self.wait(2.0)
        self.say("It was never given. No pole tuning can fix that.")
        self.wait(1.8)
        self.play(*[FadeOut(m) for m in [circle, cross, cross_lab, posed, posed_lab, derived, der_lab, arc, arc_t, note, sub]])

        # ================= BEAT 4: the ledger =================
        self.say("So carry the two rolls on channels, outside IK.")
        X1, X2 = -6.4, 0.6
        N1, N2 = -0.7, 6.5
        ys = [1.85, 1.25, 0.65, 0.05, -0.55]
        hdr_fk = Text("FK", font_size=34, color=BLUE, weight=BOLD).move_to(P(-3.5, 2.7))
        hdr_ik = Text("IK", font_size=34, color=YELLOW, weight=BOLD).move_to(P(3.5, 2.7))
        vsep = Line(P(0, 3.1), P(0, -1.9), color=DIM, stroke_width=2)

        def row(label, val, x, nx, y, col):
            t = Text(label, font_size=25, color=col)
            t.move_to(P(x, y), aligned_edge=LEFT)
            t.set_x(x + t.width / 2)
            n = Text(str(val), font_size=28, color=col)
            n.move_to(P(nx, y))
            return VGroup(t, n)

        r_fk = [row("upper bone rotation", 3, X1, N1, ys[0], BLUE),
                row("lower bone rotation", 3, X1, N1, ys[1], BLUE)]
        r_ik = [row("effector position", 3, X2, N2, ys[0], YELLOW),
                row("pole", 1, X2, N2, ys[1], YELLOW)]
        self.play(FadeIn(hdr_fk), FadeIn(hdr_ik), Create(vsep))
        self.play(*[FadeIn(r) for r in r_fk + r_ik])
        yt = -1.35
        tl = Line(P(-6.4, -1.0), P(6.5, -1.0), color=DIM, stroke_width=2)

        def total(v, x, nx, col):
            return VGroup(Text("total", font_size=25, color=DIM).move_to(P(x + 0.45, yt)),
                          Text(str(v), font_size=34, color=col, weight=BOLD).move_to(P(nx, yt)))
        t_fk = total(6, X1, N1, BLUE)
        t_ik = total(4, X2, N2, RED)
        self.play(Create(tl), FadeIn(t_fk), FadeIn(t_ik))
        self.wait(1.0)
        r_up = row("upper roll channel", 1, X2, N2, ys[2], GREEN)
        r_lo = row("lower roll channel", 1, X2, N2, ys[3], GREEN)
        self.play(FadeIn(r_up), FadeIn(r_lo))
        t_ik2 = total(6, X2, N2, GREEN)
        self.play(Transform(t_ik, t_ik2))
        eq4 = MathTex("4 + 2 = 6", font_size=44, color=GREEN).move_to(P(0, -2.25))
        self.play(Write(eq4))
        self.say("4 plus 2 is 6. The ledger closes.")
        self.wait(2.0)
        self.say("With stretch, each side gains two more.")
        r_sf = row("2 child translations", 2, X1, N1, ys[4], BLUE)
        r_si = row("2 segment scales", 2, X2, N2, ys[4], YELLOW)
        self.play(FadeOut(eq4), FadeIn(r_sf), FadeIn(r_si))
        self.wait(1.0)
        self.say("FK: two translations along the bone. IK: two scales.")
        t_fk3 = total(8, X1, N1, GREEN)
        t_ik3 = total(8, X2, N2, GREEN)
        self.play(Transform(t_fk, t_fk3), Transform(t_ik, t_ik3))
        eq8 = MathTex("8 = 8", font_size=48, color=GREEN).move_to(P(0, -2.25))
        self.play(Write(eq8))
        self.say("Eight against eight. The table balances.")
        self.wait(2.5)

        # ================= end card =================
        everything = Group(*[m for m in self.mobjects])
        self.play(FadeOut(everything))
        self.cap = None
        end = Text("It is a counting problem,\nnot a tuning problem.", font_size=48, weight=BOLD, line_spacing=1.1)
        self.play(FadeIn(end, shift=UP * 0.2))
        self.wait(3.0)
        self.play(FadeOut(end))
