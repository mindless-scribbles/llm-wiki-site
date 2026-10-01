from moted_style import *
import numpy as np


def P3(x, y, z=0.0):
    return np.array([x, y, 0.0])


def lab(text, mob, d=UP, size=24, color=INK, buff=0.15):
    return Text(text, font_size=size, color=color).next_to(mob, d, buff=buff)


def heading(text):
    return Text(text, font_size=30, color=DIM, weight=BOLD).to_corner(UL, buff=0.45)


def gloss(tex, note, color=INK):
    m = MathTex(tex, font_size=38, color=color)
    n = Text(note, font_size=19, color=DIM)
    return VGroup(m, n).arrange(DOWN, aligned_edge=LEFT, buff=0.1)


def fit_caption(scene, text, prev=None, font_size=30, maxw=12.6):
    probe = Text(text, font_size=font_size)
    if probe.width > maxw:
        font_size = font_size * maxw / probe.width
    return caption(scene, text, prev, font_size=font_size)


class PoleLoop(Scene):
    def construct(self):
        title_card(self, "Pole From Position, and the Loop",
                   "the UE5 Control Rig FK/IK match", hold=1.0)
        self.beat1()
        self.beat2()
        self.beat3()
        self.beat4()
        self.end_card()

    # ------------------------------------------------------------ beat 1
    def beat1(self):
        h = heading("1  Pole from position")
        self.play(FadeIn(h))
        A, C, E = P3(-5.2, -1.5), P3(0.8, -1.5), P3(-2.0, 0.6)
        Q = P3(-2.0, -1.5)
        off = 1.5
        dA, dC, dE = (Dot(p, radius=0.11, color=INK) for p in (A, C, E))
        b1 = Line(A, E, color=BLUE, stroke_width=7)
        b2 = Line(E, C, color=BLUE, stroke_width=7)
        axis = DashedLine(A, C, color=DIM, stroke_width=3)
        la, lc, le = lab("shoulder A", dA, DOWN), lab("wrist C", dC, DOWN), lab("elbow E", dE, LEFT)
        cap = fit_caption(self, "A two-bone limb: shoulder, elbow, wrist.")
        self.play(Create(axis), Create(b1), Create(b2), FadeIn(dA, dE, dC), FadeIn(la, le, lc))
        self.wait(1)

        cap = fit_caption(self, "Drop the elbow straight onto the shoulder-to-wrist line.", cap)
        dQ = Dot(Q, radius=0.11, color=YELLOW)
        drop = DashedLine(E, Q, color=YELLOW, stroke_width=3)
        lq = lab("Q", dQ, DOWN, color=YELLOW, size=28)
        eq1 = gloss(r"Q=\mathrm{proj}_{A\to C}(E)", "projection of the elbow onto the line", YELLOW)
        eq1.move_to(P3(4.0, 2.1))
        self.play(Create(drop), FadeIn(dQ), FadeIn(lq), FadeIn(eq1))
        self.wait(1.3)

        cap = fit_caption(self, "d is how far the bend juts the elbow out.", cap)
        d = Arrow(Q, E, buff=0.0, color=ORANGE, stroke_width=7, max_tip_length_to_length_ratio=0.15)
        ld = lab("d", d, RIGHT, color=ORANGE, size=28)
        eq2 = gloss(r"d=E-Q", "the jut, a vector with a direction", ORANGE)
        eq2.next_to(eq1, DOWN, buff=0.5, aligned_edge=LEFT)
        self.play(FadeOut(drop), GrowArrow(d), FadeIn(ld), FadeIn(eq2))
        self.wait(1.3)

        cap = fit_caption(self, "Pole = E, pushed along d by a chosen offset.", cap)
        pole = Dot(P3(-2.0, 0.6 + off), radius=0.14, color=GREEN)
        push = Arrow(E, pole.get_center(), buff=0.12, color=GREEN, stroke_width=7,
                     max_tip_length_to_length_ratio=0.3)
        lp = lab("Pole", pole, UP, color=GREEN, size=28)
        eq3 = gloss(r"\mathrm{Pole}=E+\mathrm{offset}\cdot\hat d", r"unit(d): only the direction of d is used", GREEN)
        eq3.next_to(eq2, DOWN, buff=0.5, aligned_edge=LEFT)
        self.play(GrowArrow(push), FadeIn(pole), FadeIn(lp), FadeIn(eq3))
        self.wait(1.8)

        cap = fit_caption(self, "Everything here comes from where the bones ARE. No rotation is read.", cap)
        self.wait(2.2)
        self.play(FadeOut(Group(*self.mobjects)))

    # ------------------------------------------------------------ beat 2
    def beat2(self):
        h = heading("2  The orientation-derived variant")
        cap = fit_caption(self, "A common template adds one step before that formula.")
        self.play(FadeIn(h))
        A0 = P3(-3.2, -1.4)
        R, r, off = 1.8, 0.75, 1.0
        E = A0 + P3(0, R, 0)
        axis_dot = Dot(A0, radius=0.12, color=DIM)
        l_axis = lab("shoulder-to-wrist axis (end-on)", axis_dot, DOWN, size=22, color=DIM)
        plane = DashedLine(A0, E + P3(0, 1.9, 0), color=DIM, stroke_width=3)
        l_plane = lab("limb plane", plane, LEFT, size=22, color=DIM, buff=0.1).shift(UP * 1.2)
        dE = Dot(E, radius=0.12, color=INK)
        lE = lab("E", dE, LEFT, size=26)
        orbit = DashedVMobject(Circle(radius=r, color=RED, stroke_width=3).move_to(E), num_dashes=40)
        view = Text("view down the limb axis, exaggerated", font_size=20, color=DIM).next_to(l_axis, DOWN, buff=0.15)
        self.play(FadeIn(axis_dot, l_axis, dE, lE, view), Create(plane), FadeIn(l_plane))
        self.wait(1)

        eq1 = gloss(r"P=E+R_E\,s", "one unit along its OWN secondary axis s", RED)
        eq1.move_to(P3(3.9, 1.6))
        eq2 = gloss(r"\text{then: }Q,\ d,\ \mathrm{Pole}\ \text{from }P", "same formula, started at P instead of E", INK)
        eq2.next_to(eq1, DOWN, buff=0.5, aligned_edge=LEFT)
        cap = fit_caption(self, "Step one unit off the elbow, along the elbow's own secondary axis.", cap)
        phi = ValueTracker(0.0)

        def Ppt():
            f = phi.get_value()
            return E + r * P3(np.sin(f), np.cos(f))

        P = always_redraw(lambda: Dot(Ppt(), radius=0.12, color=RED))
        step = always_redraw(lambda: Arrow(E, Ppt(), buff=0.0, color=RED, stroke_width=6,
                                           max_tip_length_to_length_ratio=0.25) if phi.get_value() > 0.02
                             else Line(E, Ppt(), color=RED, stroke_width=6))
        lP = always_redraw(lambda: lab("P", P, UR, size=26, color=RED, buff=0.05))
        self.play(Create(orbit), FadeIn(P, lP), Create(step), FadeIn(eq1), run_time=1.5)
        self.wait(0.6)
        self.play(FadeIn(eq2))
        self.wait(1.2)
        cap = fit_caption(self, "Goal: keep d from collapsing on a straight limb. A reasonable goal.", cap)
        self.wait(2.2)

        def pole_pt():
            p = Ppt()
            v = p - A0
            return p + off * v / np.linalg.norm(v)

        pole = always_redraw(lambda: Dot(pole_pt(), radius=0.14, color=GREEN))
        ray = always_redraw(lambda: Line(A0, pole_pt(), color=GREEN, stroke_width=3))
        lpole = always_redraw(lambda: lab("Pole", pole, UP, size=26, color=GREEN))

        def arc():
            f = phi.get_value()
            t = np.arctan2(Ppt()[0] - A0[0], Ppt()[1] - A0[1])
            if abs(t) < 0.01:
                return VGroup()
            return Angle(Line(A0, E), Line(A0, Ppt()), radius=0.9, color=ORANGE, other_angle=(t > 0))
        arcm = always_redraw(arc)
        self.play(FadeIn(pole, lpole), Create(ray))
        self.add(arcm)
        cap = fit_caption(self, "But P is stuck to the forearm. Twist the forearm, and P orbits the elbow.", cap)
        self.play(phi.animate.set_value(1.0), run_time=2.5)
        self.play(phi.animate.set_value(-0.8), run_time=3.0)
        self.play(phi.animate.set_value(1.0), run_time=2.0)
        cap = fit_caption(self, "The pole tilts, and the plane handed to the solver tilts with it.", cap)
        self.wait(1.0)

        # landed elbow
        tl = np.arctan2(Ppt()[0] - A0[0], Ppt()[1] - A0[1])
        E2 = A0 + R * P3(np.sin(tl), np.cos(tl))
        ghost = Circle(radius=0.12, color=INK, stroke_width=3).move_to(E)
        dE2 = Dot(E2, radius=0.12, color=ORANGE)
        l2 = lab("elbow lands here", dE2, RIGHT, size=22, color=ORANGE)
        self.play(FadeOut(orbit, step, P, lP, lpole, eq2), FadeIn(ghost), FadeIn(dE2), FadeIn(l2))
        res = VGroup(
            Text("Measured on one arm", font_size=26, color=DIM),
            MathTex(r"\text{tilt}=2.30^\circ", font_size=40, color=ORANGE),
            MathTex(r"\text{elbow }0.738\text{ off-plane}", font_size=40, color=ORANGE),
            MathTex(r"\text{shoulder, wrist: exact}", font_size=40, color=GREEN),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.3).move_to(P3(3.8, -0.4))
        self.play(FadeOut(eq1))
        res.move_to(P3(3.8, 0.4))
        for i in range(4):
            self.play(FadeIn(res[i]), run_time=0.8)
            self.wait(0.9)
        cap = fit_caption(self, "The tilt is a rotation about the shoulder-to-wrist axis.", cap)
        self.wait(2.2)
        self.play(FadeOut(Group(*self.mobjects)))

    # ------------------------------------------------------------ beat 3
    def beat3(self):
        h = heading("3  Why it is a loop, not an offset")
        cap = fit_caption(self, "Backward FK writes that moved pose back onto the FK controls.")
        self.play(FadeIn(h))
        bx1 = VGroup(RoundedRectangle(width=2.2, height=1.0, corner_radius=0.15, color=BLUE),
                     Text("FK pose", font_size=26, color=BLUE)).move_to(P3(-5.4, 2.0))
        bx2 = VGroup(RoundedRectangle(width=2.2, height=1.0, corner_radius=0.15, color=YELLOW),
                     Text("IK pose", font_size=26, color=YELLOW)).move_to(P3(-1.2, 2.0))
        a1 = Arrow(bx1.get_right() + UP * 0.25, bx2.get_left() + UP * 0.25, buff=0.1, color=INK, stroke_width=4)
        a2 = Arrow(bx2.get_left() + DOWN * 0.25, bx1.get_right() + DOWN * 0.25, buff=0.1, color=INK, stroke_width=4)
        l1 = Text("flip", font_size=22, color=INK).next_to(a1, UP, buff=0.1)
        l2 = Text("Backward FK", font_size=22, color=INK).next_to(a2, DOWN, buff=0.1)
        self.play(FadeIn(bx1, bx2))
        self.play(GrowArrow(a1), FadeIn(l1))
        self.play(GrowArrow(a2), FadeIn(l2))
        self.wait(1)
        cap = fit_caption(self, "The next flip starts from that pose. Each flip moves it less.", cap)

        ax = Axes(x_range=[0, 5, 1], y_range=[0, 1.1, 0.5], x_length=6.0, y_length=2.6,
                  axis_config={"color": DIM, "include_tip": False, "stroke_width": 2},
                  y_axis_config={"include_ticks": False}).move_to(P3(-3.0, -0.5))
        pass
        xl = Text("flips", font_size=22, color=DIM).next_to(ax.x_axis, DOWN, buff=0.1, aligned_edge=RIGHT)
        yl = Text("forearm twist", font_size=22, color=DIM).next_to(ax.y_axis, UP, buff=0.1).shift(RIGHT * 0.7)
        zero = Line(ax.c2p(0, 0), ax.c2p(5, 0), color=GREEN, stroke_width=4)
        lz = Text("untwisted pose", font_size=22, color=GREEN).next_to(zero, RIGHT, buff=0.2)
        note = Text("shape illustrative", font_size=18, color=DIM).next_to(ax, DOWN, buff=0.45, aligned_edge=LEFT)
        self.play(Create(ax), FadeIn(xl, yl), Create(zero), FadeIn(lz), FadeIn(note))
        vals = [1.0 * 0.5 ** k for k in range(6)]
        dots = []
        prev = None
        for k, v in enumerate(vals):
            dt = Dot(ax.c2p(k, v), radius=0.1, color=ORANGE)
            anims = [FadeIn(dt, scale=1.5)]
            if prev is not None:
                anims.append(Create(Line(prev.get_center(), dt.get_center(), color=ORANGE, stroke_width=3)))
                self.play(Indicate(bx2, color=YELLOW, scale_factor=1.08), run_time=0.45)
                self.play(Indicate(bx1, color=BLUE, scale_factor=1.08), run_time=0.45)
            self.play(*anims, run_time=0.7)
            prev = dt
            dots.append(dt)
        self.wait(0.8)
        cap = fit_caption(self, "It walks the pose a little every flip, and halts on the untwisted pose.", cap)
        self.wait(1.8)
        wrong = Text("settles on the wrong pose", font_size=28, color=RED).move_to(P3(3.9, 1.0))
        sub = Text("the animator's twist is gone", font_size=22, color=DIM).next_to(wrong, DOWN, buff=0.15)
        self.play(FadeIn(wrong), FadeIn(sub))
        self.wait(1.5)
        cap = fit_caption(self, "It converges, so it looks harmless.", cap, font_size=34)
        self.wait(3.0)
        self.play(FadeOut(Group(*self.mobjects)))

    # ------------------------------------------------------------ beat 4
    def beat4(self):
        h = heading("4  The straight limb: blend, don't branch")
        cap = fit_caption(self, "Straight limb: the elbow sits on the line, so d is zero.")
        self.play(FadeIn(h))
        A, C = P3(-6.4, -1.5), P3(-1.6, -1.5)
        ex = -4.0
        thr_h = 0.7
        hv = ValueTracker(1.5)

        def Epos():
            return P3(ex, -1.5 + hv.get_value())

        axis = DashedLine(A, C, color=DIM, stroke_width=3)
        b1 = always_redraw(lambda: Line(A, Epos(), color=BLUE, stroke_width=7))
        b2 = always_redraw(lambda: Line(Epos(), C, color=BLUE, stroke_width=7))
        dA, dC = Dot(A, radius=0.1, color=INK), Dot(C, radius=0.1, color=INK)
        dE = always_redraw(lambda: Dot(Epos(), radius=0.11, color=INK))
        dvec = always_redraw(lambda: Line(P3(ex, -1.5), Epos(), color=ORANGE, stroke_width=6))
        ld = always_redraw(lambda: lab("d", dvec, LEFT, size=26, color=ORANGE, buff=0.12))
        self.play(Create(axis), FadeIn(b1, b2, dA, dC, dE), FadeIn(dvec, ld))
        self.wait(0.8)
        self.play(hv.animate.set_value(0.0), run_time=2.5)
        nod = Text("|d| = 0: no direction to push along", font_size=24, color=RED).move_to(P3(-4.0, 1.9))
        self.play(FadeIn(nod))
        self.wait(1.5)
        self.play(FadeOut(nod), hv.animate.set_value(1.5), run_time=1.5)

        # graph: weight of the honest formula against |d|
        xmax = 1.5
        thr = thr_h
        ax = Axes(x_range=[0, xmax, 0.5], y_range=[0, 1.0, 0.5], x_length=5.0, y_length=2.3,
                  axis_config={"color": DIM, "include_tip": False, "stroke_width": 2},
                  x_axis_config={"include_ticks": False}, y_axis_config={"include_ticks": False})
        ax.move_to(P3(3.7, -1.0))
        xl = MathTex(r"|d|", font_size=30, color=ORANGE).next_to(ax.x_axis, RIGHT, buff=0.1)
        yl = Text("weight on honest formula", font_size=20, color=DIM).next_to(ax.y_axis, UP, buff=0.1).shift(LEFT * 0.3)
        y0 = MathTex(r"0", font_size=24, color=DIM).next_to(ax.c2p(0, 0), LEFT, buff=0.12)
        y1 = MathTex(r"1", font_size=24, color=DIM).next_to(ax.c2p(0, 1), LEFT, buff=0.12)
        self.play(Create(ax), FadeIn(xl, yl, y0, y1))

        cap = fit_caption(self, "An If would snap at the threshold. On the pole, a snap shows as both bones rolling.", cap)
        step = VGroup(Line(ax.c2p(0, 0), ax.c2p(thr, 0), color=RED, stroke_width=5),
                      Line(ax.c2p(thr, 0), ax.c2p(thr, 1), color=RED, stroke_width=5),
                      Line(ax.c2p(thr, 1), ax.c2p(xmax, 1), color=RED, stroke_width=5))
        ls = Text("If: snaps", font_size=24, color=RED).next_to(ax.c2p(thr, 0.5), LEFT, buff=0.2)
        self.play(Create(step, run_time=1.5), FadeIn(ls))
        self.wait(2.0)
        self.play(FadeOut(step, ls))

        cap = fit_caption(self, "Instead compute both poles every frame, and blend on |d|.", cap)
        w = lambda x: min(max(x / thr, 0.0), 1.0)
        ramp = ax.plot(w, x_range=[0, xmax], color=GREEN, stroke_width=5, use_smoothing=False)
        tick = Line(ax.c2p(thr, 0), ax.c2p(thr, -0.0) + UP * 0.12, color=INK, stroke_width=3)
        tl = Text("threshold", font_size=20, color=INK).next_to(ax.c2p(thr, 0), DOWN, buff=0.12)
        form = MathTex(r"\mathrm{Pole}=\mathrm{Lerp}\big(\text{fallback},\ \text{honest},\ w\big)",
                       font_size=34, color=INK).move_to(P3(3.2, 2.5))
        wdef = MathTex(r"w=\mathrm{clamp}\!\big(|d|/\mathrm{threshold}\big)", font_size=32, color=GREEN)
        wdef.next_to(form, DOWN, buff=0.25)
        self.play(Create(ramp), FadeIn(tick, tl), FadeIn(form), FadeIn(wdef))
        self.wait(1.2)

        # poles on the left picture
        off = 1.2
        F = P3(-2.7, 0.3)
        def honest():
            return P3(ex, -1.5 + hv.get_value() + off)
        def blended():
            wt = w(hv.get_value())
            return F + wt * (honest() - F)
        dF = Dot(F, radius=0.11, color=ORANGE)
        lF = lab("fallback", dF, RIGHT, size=22, color=ORANGE)
        dH = always_redraw(lambda: Dot(honest(), radius=0.11, color=BLUE))
        lH = always_redraw(lambda: lab("honest", dH, RIGHT, size=22, color=BLUE))
        dB = always_redraw(lambda: Dot(blended(), radius=0.16, color=GREEN))
        lB = always_redraw(lambda: lab("Pole", dB, UP, size=26, color=GREEN, buff=0.18))
        wd = always_redraw(lambda: Dot(ax.c2p(hv.get_value(), w(hv.get_value())), radius=0.1, color=YELLOW))
        cap = fit_caption(self, "Above the threshold the honest formula is at 100%. The fallback's side effects are absent.", cap)
        self.play(FadeIn(dF, lF, dH, lH, dB, lB, wd))
        self.wait(1.2)
        self.play(hv.animate.set_value(0.0), run_time=4.0)
        self.wait(0.6)
        cap = fit_caption(self, "Below it, lean on the fallback. The pole glides, never snaps.", cap)
        self.play(hv.animate.set_value(1.5), run_time=3.5)
        self.wait(0.8)
        cap = fit_caption(self, "Offset and threshold are world units, so the modules scale them by chain length.", cap)
        self.wait(3.0)
        self.play(FadeOut(Group(*self.mobjects)))

    # ------------------------------------------------------------ end
    def end_card(self):
        a = Text("A rotation encoded as a position", font_size=44, weight=BOLD)
        b = Text("is still a rotation.", font_size=44, weight=BOLD)
        c = Text("Read the pivot, not a point stuck to the bone.", font_size=32, color=YELLOW)
        g = VGroup(a, b).arrange(DOWN, buff=0.15)
        VGroup(g, c).arrange(DOWN, buff=0.7)
        self.play(FadeIn(g, shift=UP * 0.2))
        self.wait(1.0)
        self.play(FadeIn(c, shift=UP * 0.2))
        self.wait(3.0)
        self.play(FadeOut(VGroup(g, c)))
