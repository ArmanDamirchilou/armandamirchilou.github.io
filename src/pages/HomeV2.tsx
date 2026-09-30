import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../styles/v2.css';
import { Seo } from '../components/Seo';
import { ProjectArt } from '../v2/ProjectArt';
import { gsap, ScrollTrigger, prefersReducedMotion, scrollToTarget, useSmoothScroll } from '../v2/scroll';
import { V2Backdrop, V2Footer, V2Nav, useV2Root } from '../v2/Chrome';
import { HERO_LINES, JOURNEY, MANIFESTO, PROFILE, PROJECTS, STATS } from '../v2/content';

// three.js is most of the page's JavaScript; loading it on its own lets the
// copy and layout paint first while the portrait streams in behind them.
const HeroAvatar = lazy(() => import('../v2/HeroAvatar').then((m) => ({ default: m.HeroAvatar })));

const Arrow = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M5 12h14m-6-6 6 6-6 6" />
  </svg>
);

export function HomeV2() {
  useSmoothScroll();
  useV2Root();
  const { hash } = useLocation();
  const root = useRef<HTMLDivElement>(null);
  const heroProgress = useRef(0);
  const [avatarReady, setAvatarReady] = useState(false);
  const onAvatarReady = useCallback(() => setAvatarReady(true), []);

  // Which project card is centred in the phone carousel.
  const cardsRef = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState(0);
  useEffect(() => {
    const el = cardsRef.current;
    if (!el) return;
    const onScroll = () => {
      const first = el.firstElementChild as HTMLElement | null;
      if (!first || el.scrollWidth <= el.clientWidth) return;
      setCard(Math.round(el.scrollLeft / (first.offsetWidth + 12)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useGSAP(
    () => {
      const reduce = prefersReducedMotion();
      const mm = gsap.matchMedia();

      // ── Hero: the camera and the three statements follow scroll ──────────
      ScrollTrigger.create({
        trigger: '.v2-hero',
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          heroProgress.current = self.progress;
        },
      });

      const lines = gsap.utils.toArray<HTMLElement>('.v2-hero-line');
      if (!reduce) {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: '.v2-hero', start: 'top top', end: 'bottom bottom', scrub: 0.6 },
          defaults: { ease: 'none' },
        });
        lines.forEach((line, i) => {
          if (i > 0) tl.fromTo(line, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.5 });
          tl.to({}, { duration: 0.6 });
          if (i < lines.length - 1) tl.to(line, { autoAlpha: 0, y: -40, duration: 0.5 });
        });
        tl.to('.v2-hero-cue', { autoAlpha: 0, duration: 0.3 }, 0);
      }

      // ── Manifesto: words light up as they're read ─────────────────────────
      if (!reduce) {
        gsap.fromTo(
          '.v2-manifesto .w',
          { opacity: 0.14 },
          {
            opacity: 1,
            stagger: 0.1,
            ease: 'none',
            scrollTrigger: { trigger: '.v2-manifesto', start: 'top 75%', end: 'bottom 45%', scrub: true },
          }
        );
      }

      // ── Stats count up once ───────────────────────────────────────────────
      gsap.utils.toArray<HTMLElement>('.v2-stat-num').forEach((el) => {
        const to = Number(el.dataset.to);
        if (reduce) {
          el.textContent = String(to);
          return;
        }
        const obj = { v: 0 };
        gsap.to(obj, {
          v: to,
          duration: 1.4,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 85%', once: true },
          onUpdate: () => {
            el.textContent = String(Math.round(obj.v));
          },
        });
      });

      // ── Journey: horizontal track on wide screens ─────────────────────────
      mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
        const track = document.querySelector<HTMLElement>('.v2-journey-track');
        if (!track) return;
        const distance = () => Math.max(0, track.scrollWidth - window.innerWidth + 64);
        const move = gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: '.v2-journey',
            start: 'top top',
            end: () => `+=${distance()}`,
            pin: true,
            scrub: 0.8,
            invalidateOnRefresh: true,
          },
        });
        gsap.to('.v2-journey-progress i', {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: '.v2-journey',
            start: 'top top',
            end: () => `+=${distance()}`,
            scrub: true,
            invalidateOnRefresh: true,
          },
        });
        return () => move.kill();
      });

      // ── Work: each card settles back as the next one slides over it ───────
      // Dimmed with an overlay, not opacity: a see-through card would show
      // the cards stacked beneath it.
      mm.add('(min-width: 901px) and (min-height: 720px) and (prefers-reduced-motion: no-preference)', () => {
        const cards = gsap.utils.toArray<HTMLElement>('.v2-card');
        cards.forEach((card, i) => {
          if (i === cards.length - 1) return;
          gsap.to(card.querySelector('.v2-card-inner'), {
            scale: 0.92,
            '--dim': 0.72,
            ease: 'none',
            scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 12%', scrub: true },
          });
        });
      });

      // ── Everything else: a quiet rise into place ──────────────────────────
      // Hidden up front, so a section already on screen at load (a /#profile
      // link) rises in once instead of flashing visible, hidden, visible.
      if (!reduce) {
        gsap.set('.v2-rise', { autoAlpha: 0, y: 36 });
        ScrollTrigger.batch('.v2-rise', {
          start: 'top 88%',
          once: true,
          onEnter: (els) => gsap.to(els, { autoAlpha: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.08 }),
        });
      }

      // Fonts shift line heights after first layout; re-measure once they land,
      // then honour a /#section link (pin spacers change where sections sit).
      document.fonts?.ready.then(() => {
        ScrollTrigger.refresh();
        if (hash) setTimeout(() => scrollToTarget(hash), 60);
      });
      return () => mm.revert();
    },
    { scope: root }
  );

  return (
    <div className="v2" ref={root}>
      <Seo
        title="Arman Damirchilou, AI engineer from Tehran"
        description="Arman Damirchilou is a sixteen-year-old AI engineer from Tehran building machine learning, computer vision and voice AI systems. Gold medalist at Innoverse Expo. Talk to his digital twin."
        path="/"
      />

      <V2Backdrop />
      <V2Nav />

      <main id="top">
        {/* ── Hero: pinned 3D portrait with three statements ───────────────── */}
        <section className="v2-hero" aria-label="Introduction">
          <div className="v2-hero-sticky">
            <div className={`v2-hero-stage ${avatarReady ? 'is-ready' : ''}`}>
              <Suspense fallback={null}>
                <HeroAvatar progress={heroProgress} onReady={onAvatarReady} />
              </Suspense>
            </div>
            <div className="v2-hero-copy">
              {HERO_LINES.map((l, i) => {
                const Heading = i === 0 ? 'h1' : 'p';
                return (
                  <div key={l.big} className="v2-hero-line" data-index={i}>
                    <Heading className="v2-hero-big">{l.big}</Heading>
                    <p className="v2-hero-small">{l.small}</p>
                    {i === HERO_LINES.length - 1 && (
                      <Link to="/twin" className="v2-btn v2-btn-accent lg lg-pill lg-accent lg-press">
                        Talk to my twin {Arrow}
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
            <span className="v2-hero-cue" aria-hidden>
              <i />
            </span>
          </div>
        </section>

        {/* ── Manifesto ────────────────────────────────────────────────────── */}
        <section className="v2-manifesto v2-wrap" aria-label="Why I build">
          <p>
            {MANIFESTO.split(' ').map((w, i) => (
              <span key={i} className="w">
                {w}{' '}
              </span>
            ))}
          </p>
        </section>

        {/* ── Stats ────────────────────────────────────────────────────────── */}
        <section className="v2-stats v2-wrap" aria-label="At a glance">
          {STATS.map((s) => (
            <div key={s.label} className="v2-stat lg v2-rise">
              <span className="v2-stat-num" data-to={s.value}>
                {s.value}
              </span>
              <span className="v2-stat-label">{s.label}</span>
            </div>
          ))}
        </section>

        {/* ── Work: stacked cards ──────────────────────────────────────────── */}
        <section className="v2-work v2-wrap" id="work" aria-labelledby="work-title">
          <h2 id="work-title" className="v2-h2 v2-rise">
            Things I've built.
          </h2>
          <div className="v2-cards" ref={cardsRef}>
            {PROJECTS.map((p, i) => (
              <article key={p.id} className="v2-card" style={{ '--i': i } as React.CSSProperties}>
                <div className="v2-card-inner lg lg-strong">
                  <div className="v2-card-text">
                    <span className="v2-meta">
                      {String(i + 1).padStart(2, '0')} / {p.field}
                    </span>
                    <h3>{p.title}</h3>
                    <p className="v2-card-line">{p.line}</p>
                    <p className="v2-card-detail">{p.detail}</p>
                    <ul className="v2-tags" aria-label="Built with">
                      {p.stack.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                    {p.href &&
                      (p.internal ? (
                        <Link to={p.href} className="v2-link">
                          {p.cta} {Arrow}
                        </Link>
                      ) : (
                        <a href={p.href} target="_blank" rel="noopener noreferrer" className="v2-link">
                          {p.cta} {Arrow}
                        </a>
                      ))}
                  </div>
                  <div className="v2-card-visual">
                    {p.image ? (
                      <img src={`${import.meta.env.BASE_URL}${p.image}`} alt={`${p.title} screenshot`} loading="lazy" />
                    ) : (
                      <ProjectArt id={p.id} />
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
          {/* Phones swipe through the projects; the dots say where you are. */}
          <div className="v2-cards-dots" aria-hidden>
            {PROJECTS.map((p, i) => (
              <i key={p.id} className={i === card ? 'is-on' : undefined} />
            ))}
          </div>
        </section>

        {/* ── Journey: horizontal timeline ─────────────────────────────────── */}
        <section className="v2-journey" id="journey" aria-labelledby="journey-title">
          <div className="v2-journey-head v2-wrap">
            <h2 id="journey-title" className="v2-h2">
              Five years, three continents.
            </h2>
            <span className="v2-journey-progress" aria-hidden>
              <i />
            </span>
          </div>
          <ol className="v2-journey-track">
            {JOURNEY.map((m) => (
              <li key={`${m.year}-${m.title}`} className={`v2-milestone lg ${m.medal ?? ''}`}>
                <span className="v2-milestone-year">{m.year}</span>
                <span className="v2-milestone-place">{m.place}</span>
                <h3>{m.title}</h3>
                <p>{m.note}</p>
                {m.medal && <span className={`v2-medal ${m.medal}`} aria-hidden />}
              </li>
            ))}
          </ol>
        </section>

        {/* ── Academic profile ─────────────────────────────────────────────── */}
        <section className="v2-profile v2-wrap" id="profile" aria-labelledby="profile-title">
          <div className="v2-profile-head v2-rise">
            <h2 id="profile-title" className="v2-h2">
              The short version.
            </h2>
            <p>Everything an admissions reader asks for, on one screen.</p>
          </div>
          <dl className="v2-profile-grid lg lg-strong">
            {PROFILE.map((g) => (
              <div key={g.label} className="v2-profile-row v2-rise">
                <dt>{g.label}</dt>
                <dd>
                  <ul>
                    {g.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ── Twin invitation ──────────────────────────────────────────────── */}
        <section className="v2-invite v2-wrap" aria-labelledby="invite-title">
          <div className="v2-invite-inner lg lg-strong v2-rise">
            <h2 id="invite-title">Don't take my word for it.</h2>
            <p>My digital twin knows my projects, my story and my plans. Ask it anything, out loud or by typing.</p>
            <Link to="/twin" className="v2-btn v2-btn-accent lg lg-pill lg-accent lg-press">
              Talk to my twin {Arrow}
            </Link>
          </div>
        </section>
      </main>

      <V2Footer />
    </div>
  );
}
