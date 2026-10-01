from moted_style import *
import numpy as np

# ---------- tiny quaternion + projection kit (w, x, y, z) ----------
X = np.array([1.0, 0, 0])


def qm(a, b):
    w1, x1, y1, z1 = a
    w2, x2, y2, z2 = b
    return np.array([w1*w2 - x1*x2 - y1*y2 - z1*z2,
                     w1*x2 + x1*w2 + y1*z2 - z1*y2,
                     w1*y2 - x1*z2 + y1*w2 + z1*x2,
                     w1*z2 + x1*y2 - y1*x2 + z1*w2])


def qa(axis, deg):
    ax = np.array(axis, float)
    ax /= np.linalg.norm(ax)
    h = np.radians(deg) / 2
    return np.array([np.cos(h), *(np.sin(h) * ax)])


def qc(q):
    return np.array([q[0], -q[1], -q[2], -q[3]])


def qr(q, v):
    return qm(qm(q, np.array([0, *v])), qc(q))[1:]


def qpow(q, t):
    if q[0] < 0:
        q = -q
    ang = 2 * np.arccos(np.clip(q[0], -1, 1))
    s = np.linalg.norm(q[1:])
    if s < 1e-9:
        return np.array([1.0, 0, 0, 0])
    return qa(q[1:] / s, np.degrees(ang) * t)


def swing_twist(q, axis):
    p = axis * np.dot(q[1:], axis)
    tw = np.array([q[0], *p])
    tw /= np.linalg.norm(tw)
    return qm(q, qc(tw)), tw


IDQ = np.array([1.0, 0, 0, 0])
YAW, PITCH = np.radians(-28), np.radians(20)


def view(v):
    x, y, z = v
    x, z = x*np.cos(YAW) + z*np.sin(YAW), -x*np.sin(YAW) + z*np.cos(YAW)
    y, z = y*np.cos(PITCH) - z*np.sin(PITCH), y*np.sin(PITCH) + z*np.cos(PITCH)
    return 1.4 * np.array([x, y, 0.0])


def bone(q, C, color=BLUE, L=3.2, child=None, ghost=False, edge=ORANGE):
    """A bone along local +X with a flat plate in its local XY plane."""
    C = np.array(C, float)
    P = lambda v: C + view(qr(q, v))
    op = 0.3 if ghost else 1.0
    g = VGroup()
    corners = [(.3*L, -.55, 0), (.8*L, -.55, 0), (.8*L, .55, 0), (.3*L, .55, 0)]
    plate = Polygon(*[P(c) for c in corners], color=color, stroke_width=2,
                    fill_color=color, fill_opacity=0.28*op, stroke_opacity=op)
    g.add(plate)
    g.add(Line(P((.3*L, .55, 0)), P((.8*L, .55, 0)), color=edge, stroke_width=5,
               stroke_opacity=op))
    g.add(Line(C, P((L, 0, 0)), color=color, stroke_width=8, stroke_opacity=op))
    if not ghost:
        g.add(Dot(C, radius=0.07, color=INK))
    if child:
        g.add(Dot(P((L, 0, 0)), radius=0.13, color=child))
    return g


def tip_at(q, C, L=3.2):
    return np.array(C, float) + view(qr(q, np.array([L, 0, 0])))


class SwingTwist(Scene):
    cap_mob = None
    tag_mob = None

    def cap(self, text, wait=0.0):
        c = Text(text, font_size=30)
        if c.width > 12.4:
            c.scale_to_fit_width(12.4)
        c.to_edge(DOWN, buff=0.45)
        if self.cap_mob is None:
            self.play(FadeIn(c), run_time=0.5)
        else:
            self.play(ReplacementTransform(self.cap_mob, c), run_time=0.6)
        self.cap_mob = c
        self.wait(wait + 0.9)

    def tag(self, text):
        t = Text(text, font_size=26, color=DIM).to_corner(UL, buff=0.4)
        if self.tag_mob is None:
            self.add(t)
        else:
            self.play(ReplacementTransform(self.tag_mob, t), run_time=0.4)
        self.tag_mob = t

    def clear_stage(self, keep_cap=True):
        keep = [self.cap_mob, self.tag_mob]
        rest = [m for m in self.mobjects if m not in keep]
        for m in self.mobjects:
            m.clear_updaters()
        if rest:
            self.play(*[FadeOut(m) for m in rest], run_time=0.6)

    # ------------------------------------------------------------------
    def construct(self):
        title_card(self, "Swing-Twist Decomposition",
                   "How the capture pulls one number out of a rotation", hold=1.4)
        self.beat1()
        self.beat2()
        self.beat3()
        self.beat4()
        self.end_card()

    # ---------------- beat 1: swing times twist ------------------------
    def beat1(self):
        C = (-3.4, -0.4, 0)
        QS = qa((0, 0.45, 1), 50)
        QT = qa(X, 110)
        QTOT = qm(QS, QT)
        sw, tw = swing_twist(QTOT, X)          # the decomposition itself
        assert np.allclose(sw, QS, atol=1e-6) and np.allclose(tw, QT, atol=1e-6)

        W, S, U = ValueTracker(0), ValueTracker(0), ValueTracker(0)

        def qcur():
            return qm(qpow(QTOT, W.get_value()),
                      qm(qpow(QS, S.get_value()), qpow(QT, U.get_value())))

        self.tag("1 · Factor a rotation")
        ghost = bone(IDQ, C, DIM, ghost=True)
        live = always_redraw(lambda: bone(qcur(), C, BLUE))
        trail = always_redraw(lambda: self.trail(QS, S, C))
        plabel = Text("primary axis", font_size=24, color=BLUE).next_to(Point(C), LEFT, buff=0.35)
        plabel.shift(DOWN * 0.45)

        self.add(ghost, live, trail)
        self.play(FadeIn(plabel), FadeIn(ghost), run_time=0.5)
        self.cap("A bone, with a primary axis.", 1.0)

        eq = MathTex(r"q", r"=", r"q_{\mathrm{swing}}", r"\cdot", r"q_{\mathrm{twist}}",
                     font_size=60)
        eq[2].set_color(ORANGE)
        eq[4].set_color(GREEN)
        eq.move_to([4.0, 1.6, 0])

        self.cap("Apply any rotation, q.")
        self.play(W.animate.set_value(1), run_time=2.0)
        self.play(Write(eq[0]), run_time=0.6)
        self.wait(1.6)
        self.play(W.animate.set_value(0), run_time=1.4)
        self.wait(0.3)

        n1 = Text("swing: moves the axis", font_size=28, color=ORANGE).move_to([4.0, 0.5, 0])
        n2 = Text("twist: spins about it", font_size=28, color=GREEN).move_to([4.0, -0.2, 0])
        self.cap("The swing carries the axis to where it ends up.")
        self.play(Write(eq[1:3]), FadeIn(n1), run_time=0.8)
        self.play(S.animate.set_value(1), run_time=2.0)
        self.wait(1.6)
        self.cap("The twist then spins the bone about that axis.")
        self.play(Write(eq[3:5]), FadeIn(n2), run_time=0.8)
        self.play(U.animate.set_value(1), run_time=2.2)
        self.wait(1.6)
        self.cap("Same final pose: q is swing times twist, and the split is unique.")
        box = SurroundingRectangle(eq, color=INK, buff=0.25, stroke_width=2)
        self.play(Create(box), run_time=0.6)
        self.wait(2.8)
        self.clear_stage()

    def trail(self, QS, S, C):
        s = S.get_value()
        m = VMobject(color=ORANGE, stroke_width=4)
        if s < 1e-3:
            return m
        pts = [tip_at(qpow(QS, t), C) for t in np.linspace(0, s, 30)]
        m.set_points_as_corners(pts)
        return m

    # ---------------- beat 2: the delta --------------------------------
    def beat2(self):
        self.tag("2 · Decompose the difference")
        QA = qa((0, 0, 1), 28)
        q_ik = qm(QA, qa(X, 10))
        q_fk = qm(QA, qa(X, 52))
        q_dl = qa(X, 42)
        L = 1.9
        cols = [(-5.0, 0.7, 0), (-1.2, 0.7, 0), (2.6, 0.7, 0)]

        b_ik = bone(q_ik, cols[0], YELLOW, L=L)
        b_fk = bone(q_fk, cols[1], BLUE, L=L)
        gh = bone(q_ik, cols[1], YELLOW, L=L, ghost=True, edge=YELLOW)
        b_dl = bone(q_dl, cols[2], GREEN, L=L)
        gh_dl = bone(IDQ, cols[2], DIM, L=L, ghost=True)

        l_ik = VGroup(MathTex(r"R_{ik}", color=YELLOW, font_size=44),
                      Text("solver's rebuild", font_size=24, color=DIM)).arrange(DOWN, buff=0.12)
        l_fk = VGroup(MathTex(r"R_{fk}", color=BLUE, font_size=44),
                      Text("animator's pose", font_size=24, color=DIM)).arrange(DOWN, buff=0.12)
        l_dl = VGroup(MathTex(r"\delta", color=GREEN, font_size=44),
                      Text("the difference", font_size=24, color=DIM)).arrange(DOWN, buff=0.12)
        for l, c in zip([l_ik, l_fk, l_dl], cols):
            l.move_to([c[0] + L*1.4/2 + 0.2, -1.05, 0])

        self.cap("R_ik: aim the primary at the child, the secondary at the pole.")
        self.play(FadeIn(b_ik), FadeIn(l_ik), run_time=0.8)
        self.wait(2.2)
        self.cap("R_fk: whatever pose the animator made.")
        self.play(FadeIn(b_fk), FadeIn(l_fk), run_time=0.8)
        self.play(FadeIn(gh), run_time=0.6)
        self.wait(1.8)

        eq = MathTex(r"\delta", r"=", r"R_{ik}^{-1}", r"\cdot", r"R_{fk}", font_size=56)
        eq[0].set_color(GREEN); eq[2].set_color(YELLOW); eq[4].set_color(BLUE)
        eq.move_to([0, -2.35, 0])
        self.cap("The difference lives in the bone's own solved frame.")
        self.play(Write(eq[2:5]), run_time=1.0)
        self.play(Write(eq[0:2]), FadeIn(gh_dl), FadeIn(b_dl), FadeIn(l_dl), run_time=1.0)
        self.wait(2.8)
        self.cap("Only a twist about the primary axis is left.", 1.5)

        # bars: stacking
        self.cap("Why not decompose R_fk alone? The solver already adds its own roll.")
        self.play(*[FadeOut(m) for m in [b_ik, b_fk, gh, b_dl, gh_dl, l_ik, l_fk, l_dl]], run_time=0.6)
        self.play(eq.animate.move_to([0, 2.9, 0]).scale(0.8), run_time=0.7)
        x0, a, b = -1.6, 1.6, 4.0
        h = 0.5

        def rect(x, w, y, col):
            return Rectangle(width=w, height=h, color=col, fill_color=col,
                             fill_opacity=0.85, stroke_width=0).move_to([x + w/2, y, 0])

        def rowlabel(txt, y, col=INK):
            return Text(txt, font_size=24, color=col).move_to([x0 - 0.3, y, 0], aligned_edge=RIGHT)

        yA, yB, yC = 1.5, 0.3, -0.9
        rA = rowlabel("the solver already makes", yA)
        rB = rowlabel("store the TOTAL twist", yB)
        rC = rowlabel("store the DELTA twist", yC)
        for t in (rA, rB, rC):
            t.move_to([x0 - 0.3 - t.width/2 + 0.0, t.get_y(), 0])
        barA = rect(x0, a, yA, YELLOW)
        target = DashedLine([x0 + b, 2.1, 0], [x0 + b, -1.5, 0], color=INK, stroke_width=2)
        tlab = Text("FK pose", font_size=22, color=INK).next_to(target, UP, buff=0.1)
        self.play(FadeIn(rA), FadeIn(barA), Create(target), FadeIn(tlab), run_time=0.8)
        self.wait(0.6)
        barB = VGroup(rect(x0, a, yB, YELLOW), rect(x0 + a, b - a, yB, BLUE), rect(x0 + b, a, yB, RED))
        oB = Text("overshoots", font_size=24, color=RED).next_to(barB, RIGHT, buff=0.25)
        self.play(FadeIn(rB), FadeIn(barB), FadeIn(oB), run_time=1.0)
        self.wait(2.2)
        barC = VGroup(rect(x0, a, yC, YELLOW), rect(x0 + a, b - a, yC, GREEN))
        oC = Text("lands on FK", font_size=24, color=GREEN).next_to(barC, RIGHT, buff=0.25)
        self.play(FadeIn(rC), FadeIn(barC), FadeIn(oC), run_time=1.0)
        self.wait(1.8)
        self.cap("Zero now means the solver already got it right.")
        ident = MathTex(r"R_{ik}\cdot\delta = R_{fk}", font_size=44).move_to([0, -2.4, 0])
        self.play(Write(ident), run_time=1.0)
        self.wait(2.8)
        self.clear_stage()

    # ---------------- beat 3: child on the axis ------------------------
    def beat3(self):
        self.tag("3 · The child sits on the axis")
        C = (-3.4, -0.4, 0)
        QS = qa((0, 0.45, 1), 32)
        QT = qa(X, 120)
        S, U = ValueTracker(0), ValueTracker(0)

        def qcur():
            return qm(qpow(QS, S.get_value()), qpow(QT, U.get_value()))

        live = always_redraw(lambda: bone(qcur(), C, BLUE, child=YELLOW))
        ghost_dot = Circle(radius=0.17, color=DIM, stroke_width=3).move_to(tip_at(IDQ, C))
        ghost = bone(IDQ, C, DIM, ghost=True)
        disp = always_redraw(lambda: DashedLine(tip_at(IDQ, C), tip_at(qcur(), C), color=RED, stroke_width=4)
                             if np.linalg.norm(tip_at(IDQ, C) - tip_at(qcur(), C)) > 0.02 else VMobject())
        self.add(ghost, ghost_dot, live, disp)
        self.cap("The child joint sits ON the bone's primary axis.")
        self.play(FadeIn(ghost), FadeIn(ghost_dot), run_time=0.5)
        self.wait(2.2)

        r1 = Text("twist: the child stays put", font_size=30, color=GREEN).move_to([3.8, 1.4, 0])
        r2 = Text("swing: the child moves", font_size=30, color=RED).move_to([3.8, 0.4, 0])
        self.cap("A pure twist spins the bone and moves nothing the solver placed.")
        self.play(U.animate.set_value(1), run_time=2.2)
        self.play(FadeIn(r1), run_time=0.6)
        self.wait(1.8)
        self.play(U.animate.set_value(0), run_time=1.2)
        self.cap("Any swing drags the child off the spot the solver chose.")
        self.play(S.animate.set_value(1), run_time=2.0)
        self.play(FadeIn(r2), run_time=0.6)
        self.wait(2.2)
        self.play(S.animate.set_value(0), run_time=1.0)

        self.cap("So the swing of the delta must be identity.")
        proof = MathTex(r"q_{\mathrm{swing}}", r"=", r"\mathbf{1}", font_size=64)
        proof[0].set_color(ORANGE); proof[2].set_color(GREEN)
        proof.move_to([3.8, -1.0, 0])
        self.play(Write(proof), run_time=1.0)
        note = Text("a free correctness test", font_size=26, color=DIM).move_to([3.8, -1.9, 0])
        self.play(FadeIn(note), run_time=0.6)
        self.wait(1.8)
        self.cap("Guardian measured it: off-axis component 0.0000.", 2.0)
        self.clear_stage()

    # ---------------- beat 4: the sign trap ----------------------------
    def beat4(self):
        self.tag("4 · The sign trap")
        top = Text("looking down the primary axis, toward the viewer", font_size=26, color=DIM)
        top.move_to([0, 2.85, 0])
        self.cap("A twist can turn either way about the primary axis.")
        self.play(FadeIn(top), run_time=0.5)

        R = 1.1

        def panel(cx, sign, col):
            cy = 0.8
            circ = Circle(radius=R, color=DIM, stroke_width=2).move_to([cx, cy, 0])
            gh = Line([cx, cy - R, 0], [cx, cy + R, 0], color=DIM, stroke_width=3)
            ang = np.radians(50 * sign)
            d = np.array([-np.sin(np.pi/2*0 + ang), np.cos(ang), 0])  # fin direction after turn
            fin = Line([cx, cy, 0] - d * R, [cx, cy, 0] + d * R, color=ORANGE, stroke_width=6)
            arc = Arc(radius=R + 0.35, start_angle=PI/2, angle=np.radians(50 * sign),
                      arc_center=[cx, cy, 0], color=col, stroke_width=5)
            arc.add_tip(tip_length=0.2)
            return VGroup(circ, gh, fin, arc)

        def axis_sym(cx, toward, col):
            c = Circle(radius=0.3, color=col, stroke_width=4).move_to([cx, 0.8, 0])
            if toward:
                inner = Dot([cx, 0.8, 0], radius=0.07, color=col)
            else:
                s = 0.3 * 0.7071
                inner = VGroup(Line([cx - s, 0.8 - s, 0], [cx + s, 0.8 + s, 0], color=col, stroke_width=4),
                               Line([cx - s, 0.8 + s, 0], [cx + s, 0.8 - s, 0], color=col, stroke_width=4))
            return VGroup(c, inner)

        pl = panel(-4.3, +1, GREEN)
        pr = panel(1.9, -1, RED)
        # axis markers at the right of each panel
        al = axis_sym(-1.7, True, GREEN)
        ar = axis_sym(4.5, False, RED)
        tl = Text("axis = +primary", font_size=22, color=GREEN).move_to([-1.7, 0.1, 0])
        tr = Text("axis = −primary", font_size=22, color=RED).move_to([4.5, 0.1, 0])
        # node says
        hdr = Text("QuatToAxisAndAngle always returns a positive angle", font_size=26, color=INK)
        hdr.move_to([0, -1.0, 0])

        self.play(Create(pl), run_time=1.0)
        self.play(FadeIn(al), FadeIn(tl), run_time=0.6)
        self.wait(0.8)
        self.play(Create(pr), run_time=1.0)
        self.wait(0.6)
        self.cap("The node never returns a negative angle. It flips the axis instead.")
        self.play(FadeIn(ar), FadeIn(tr), run_time=0.8)
        self.play(FadeIn(hdr), run_time=0.6)
        self.wait(2.8)

        self.cap("Recover the sign from where the axis points.")
        fm = MathTex(r"\mathrm{signed}", r"=", r"\mathrm{angle}", r"\cdot",
                     r"\mathrm{dot}(\mathrm{axis},\,\mathrm{primary})", font_size=42)
        fm.move_to([0, -1.75, 0])
        fm[4].set_color(ORANGE)
        self.play(Write(fm), run_time=1.6)
        rl = MathTex(r"\mathrm{dot}=+1", r"\;\Rightarrow\;", r"+\mathrm{angle}", font_size=38, color=GREEN)
        rr = MathTex(r"\mathrm{dot}=-1", r"\;\Rightarrow\;", r"-\mathrm{angle}", font_size=38, color=RED)
        rl.move_to([-3.2, -2.5, 0])
        rr.move_to([3.2, -2.5, 0])
        self.play(FadeIn(rl), run_time=0.6)
        self.play(FadeIn(rr), run_time=0.6)
        self.wait(1.8)
        self.cap("Both vectors are unit and parallel, so the dot is exactly ±1.", 2.5)
        self.clear_stage()

    # ---------------- end card -----------------------------------------
    def end_card(self):
        for m in [self.cap_mob, self.tag_mob]:
            self.play(FadeOut(m), run_time=0.4)
        l1 = Text("Reconstruct, subtract, decompose.", font_size=48, weight=BOLD)
        l2 = Text("Keep the twist, assert the swing.", font_size=40, color=GREEN)
        g = VGroup(l1, l2).arrange(DOWN, buff=0.5)
        self.play(FadeIn(l1, shift=UP * 0.2), run_time=1.0)
        self.wait(0.6)
        self.play(FadeIn(l2, shift=UP * 0.2), run_time=1.0)
        self.wait(3.0)
        self.play(FadeOut(g), run_time=0.8)
