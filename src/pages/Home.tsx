import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Seo } from '../components/Seo';
import { Reveal } from '../components/Reveal';
import { AvatarScene } from '../components/AvatarScene';
import { PageFooter } from '../components/PageFooter';

const SKILLS = ['PYTHON', 'PYTORCH', 'COMPUTER VISION', 'NLP', 'REINFORCEMENT LEARNING', 'THREE.JS', 'VOICE AI', 'LLMs'];

const SERVICES = [
  {
    title: 'Machine learning systems',
    desc: 'End-to-end ML: from datasets and training loops to models that ship — optimization, evaluation, deployment.',
    color: 'var(--indigo)',
    icon: <path d="M12 3v4m0 10v4M3 12h4m10 0h4M6.3 6.3l2.8 2.8m5.8 5.8 2.8 2.8m0-11.4-2.8 2.8m-5.8 5.8-2.8 2.8" />,
  },
  {
    title: 'Computer vision',
    desc: 'Systems that see: live traffic analysis, object detection, and real-time video pipelines.',
    color: 'var(--blue)',
    icon: <><circle cx="12" cy="12" r="3.2" /><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /></>,
  },
  {
    title: 'Language & voice AI',
    desc: 'NLP, RAG pipelines, and voice cloning — like the twin on this site that talks in my own voice.',
    color: 'var(--coral)',
    icon: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
  },
  {
    title: 'Reinforcement learning',
    desc: 'Agents that teach themselves — navigation, pursuit, and control in simulated worlds.',
    color: 'var(--red)',
    icon: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" /></>,
  },
  {
    title: 'Full-stack & 3D web',
    desc: 'React, Node, and WebGL — research demos turned into real products people can click.',
    color: 'var(--green)',
    icon: <><path d="m8 6-5 6 5 6M16 6l5 6-5 6" /><path d="m13.5 4-3 16" /></>,
  },
];

const FEATURED = [
  {
    tag: 'Voice AI · LLM · 3D',
    title: 'Digital Twin — a version of me you can talk to',
    desc: 'A real-time avatar that answers with my cloned voice and my personality: local voice model, GPT-powered reasoning, streamed photoreal face. It is live on this site right now.',
    color: 'var(--indigo)',
    word: 'TALK TO ME',
    href: '/twin',
    linkLabel: 'Meet the twin',
    internal: true,
  },
  {
    tag: 'Python · NLP · Open Source',
    title: 'RAG-Eval — trust your retrieval pipeline',
    desc: 'An open-source evaluation harness for retrieval-augmented generation. Quantifies faithfulness, answer relevancy, and context precision so teams can trust their answers.',
    color: 'var(--blue)',
    word: 'RAG-EVAL',
    href: 'https://github.com/ArmanDamirchilou',
    linkLabel: 'View on GitHub',
    internal: false,
  },
];

const MORE_PROJECTS = [
  { tag: 'ML · Optimization', title: 'Smart Water Allocation', desc: 'Optimizes water distribution across scarce regions.' },
  { tag: 'Computer Vision', title: 'Intelligent Traffic Control', desc: 'Reads live traffic and adapts signal timing in real time.' },
  { tag: 'Generative AI', title: 'Emotion-to-Art', desc: 'Turns written emotion into generated visual art.' },
  { tag: 'Reinforcement Learning', title: 'RL Hunter', desc: 'An agent that learns to navigate and pursue in simulation.' },
];

const JOURNEY = [
  { period: '2025', medal: 'gold', medalLabel: '1st', title: 'Gold Medal — Innoverse Expo', desc: 'United States. International invention & innovation expo.' },
  { period: '2024', medal: 'silver', medalLabel: '2nd', title: '2nd Place — National AI Cup', desc: 'Iran. Nationwide artificial-intelligence competition.' },
  { period: '2024', medal: 'silver', medalLabel: 'HD', title: 'Honorary Diploma — Bright Expo', desc: 'France. International exhibition of inventions.' },
  { period: '2024', medal: 'bronze', medalLabel: '3rd', title: 'Bronze Medal — 1 Idea 1 World', desc: 'Turkey. International idea & invention olympiad.' },
  { period: '2023', medal: 'bronze', medalLabel: 'NC', title: 'National Computer Olympiad', desc: 'Iran. Where it all started — at thirteen.' },
];

const ArrowRight = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
    <path d="M4 12h16m-6-6 6 6-6 6" />
  </svg>
);

export function Home() {
  return (
    <main id="top">
      <Seo
        title="Arman Damirchilou — AI Software Engineer in Tehran"
        description="Arman Damirchilou is an AI software engineer from Tehran, Iran, building machine learning, computer vision and voice AI systems. Gold medalist at Innoverse Expo. Talk to his AI twin in his own cloned voice."
        path="/"
      />
      <Navbar />

      {/* ── Hero ── */}
      <section className="hero container">
        <div className="hero-grid">
          <Reveal>
            <span className="hero-eyebrow">
              <span className="dot" aria-hidden />
              Tehran, Iran — open to work
            </span>
            <h1>
              I'm <span className="chip coral">Arman</span>, an AI Software Engineer from{' '}
              <span className="chip blue">Tehran</span>
            </h1>
            <p className="hero-sub">
              I wrote my first Python at eleven and went deep into AI at
              thirteen. Now I build machine-learning systems that actually ship —
              and I built a digital twin of myself that you can talk to.
            </p>
            <div className="hero-actions">
              <Link to="/twin" className="btn-solid">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.38-4.1-1.05L3 20l1.05-5.4A8.5 8.5 0 1 1 21 11.5Z" />
                </svg>
                Talk to my AI twin
              </Link>
              <a href="#portfolio" className="btn-outline">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-10.5Z" />
                </svg>
                View portfolio
              </a>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <Link to="/twin" className="hero-card" aria-label="The AI twin — live, click to talk to it">
              <AvatarScene
                isSpeaking={false}
                isThinking={false}
                audioLevel={0}
                emotion="neutral"
                framing="closeup"
                offsetRight={false}
                decorative
              />
              <span className="hero-card-badge"><span className="dot" aria-hidden />THE AI TWIN</span>
              <span className="hero-card-cta">Click to talk →</span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Skills marquee — tilted black strip ── */}
      <div className="marquee-wrap" aria-hidden>
        <div className="marquee">
          <div className="marquee-track">
            {[...SKILLS, ...SKILLS, ...SKILLS, ...SKILLS].map((s, i) => (
              <span key={i}>{s}<i style={{ display: 'inline-block', marginLeft: 40 }} /></span>
            ))}
          </div>
        </div>
      </div>

      {/* ── What I build ── */}
      <section className="services container" id="services">
        <Reveal className="sec-head">
          <h2>My broad <span className="chip red">set of skills</span></h2>
          <p>
            Everything from training the model to shipping the product around
            it. These are the areas where I do my best work.
          </p>
        </Reveal>
        <div className="services-grid">
          {SERVICES.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.05}>
              <div className="service-card">
                <div className="service-card-art" style={{ background: s.color }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">{s.icon}</svg>
                </div>
                <div className="service-card-body">
                  <h3>{s.title}</h3>
                  <p>{s.desc}</p>
                </div>
              </div>
            </Reveal>
          ))}
          <Reveal delay={0.25}>
            <div className="service-card cta">
              <h3>Get in touch</h3>
              <p>Working on something interesting? There's a high chance I can help — or my twin can tell you more first.</p>
              <Link to="/contact" className="btn-solid">Get in touch</Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── About ── */}
      <section className="about container" id="about">
        <div className="about-grid">
          <Reveal>
            <div className="about-circle">
              <AvatarScene
                isSpeaking={false}
                isThinking={false}
                audioLevel={0}
                emotion="neutral"
                framing="closeup"
                offsetRight={false}
                decorative
              />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <h2>Who's behind all this <span className="chip blue">smart work?</span></h2>
            <p className="about-lede">
              Born in Tehran in 2010. I started writing Python at eleven and was
              deep into AI by thirteen, with one goal: build things that matter.
              My ambition is to found an AI lab that turns research into
              technology people rely on.
            </p>
            <div className="about-facts">
              <div className="about-fact">
                <span className="about-fact-mark indigo" aria-hidden />
                <div>
                  <h3>Medals on three continents</h3>
                  <p>Gold in the United States, bronze in Turkey, honorary diploma in France, 2nd place at Iran's National AI Cup.</p>
                </div>
              </div>
              <div className="about-fact">
                <span className="about-fact-mark coral" aria-hidden />
                <div>
                  <h3>Six shipped systems in three years</h3>
                  <p>Computer vision, NLP, reinforcement learning, generative AI — built end to end, not just notebooks.</p>
                </div>
              </div>
              <div className="about-fact">
                <span className="about-fact-mark blue" aria-hidden />
                <div>
                  <h3>A twin that speaks for me</h3>
                  <p>Cloned my own voice, wired it to an LLM with my personality, and gave it a face. Ask it anything.</p>
                </div>
              </div>
            </div>
            <Link to="/twin" className="btn-solid">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                <circle cx="12" cy="8" r="4" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
              </svg>
              More about me — ask my twin
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── Portfolio ── */}
      <section className="portfolio container" id="portfolio">
        <Reveal className="sec-head">
          <h2>Take a look at my <br /><span className="chip azure">AI portfolio</span></h2>
        </Reveal>

        <div className="folio-cards">
          {FEATURED.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <article className="folio-card">
                <div className="folio-card-text">
                  <span className="folio-tag">{p.tag}</span>
                  <h3>{p.title}</h3>
                  <p>{p.desc}</p>
                  {p.internal ? (
                    <Link to={p.href} className="folio-link">{p.linkLabel}{ArrowRight}</Link>
                  ) : (
                    <a href={p.href} target="_blank" rel="noopener" className="folio-link">{p.linkLabel}{ArrowRight}</a>
                  )}
                </div>
                <div className="folio-card-art" style={{ background: p.color }}>
                  <span className="art-word">{p.word}</span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>

        <div className="folio-mini-grid">
          {MORE_PROJECTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.05}>
              <div className="folio-mini">
                <span className="folio-mini-tag">{p.tag}</span>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <aside className="folio-more">
            <span className="folio-more-mark" aria-hidden />
            <div className="folio-more-text">
              <h3>More is on the way — and it lands in the open</h3>
              <p>
                I'm deep in a few larger systems right now. As each one becomes
                solid enough to stand on its own, it gets open-sourced here.
              </p>
            </div>
            <a
              href="https://github.com/ArmanDamirchilou"
              target="_blank"
              rel="noopener"
              className="btn-solid"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.69-.22.69-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.69-4.57 4.94.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
              </svg>
              Follow on GitHub
            </a>
          </aside>
        </Reveal>
      </section>

      {/* ── Journey — black section ── */}
      <section className="journey" id="journey">
        <div className="container journey-grid">
          <Reveal className="journey-intro">
            <h2>Take a look at my <span className="chip indigo">journey so far</span></h2>
            <p>
              Three years, five podiums, three continents. Every project taught me
              something new about turning research into working systems.
            </p>
            <Link to="/twin" className="btn-solid">Ask my twin about it</Link>
          </Reveal>
          <div className="journey-cards">
            {JOURNEY.map((j, i) => (
              <Reveal key={j.title} delay={i * 0.04}>
                <div className="journey-card">
                  <div className="journey-card-top">
                    <span className="period">{j.period}</span>
                    <span className={`journey-medal ${j.medal}`}>{j.medalLabel}</span>
                  </div>
                  <hr />
                  <div className="journey-card-body">
                    <h3>{j.title}</h3>
                    <p>{j.desc}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <PageFooter />
    </main>
  );
}
