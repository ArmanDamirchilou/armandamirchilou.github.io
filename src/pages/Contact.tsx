import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../styles/v2.css';
import { Seo } from '../components/Seo';
import { V2Backdrop, V2Footer, V2Nav, useV2Root } from '../v2/Chrome';
import { LINKS } from '../v2/content';

const Arrow = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M5 12h14m-6-6 6 6-6 6" />
  </svg>
);

const CHANNELS = [
  { label: 'Telegram', note: 'Fastest reply', value: '@armandamirchilou', href: LINKS.telegram },
  { label: 'LinkedIn', note: 'Professional', value: 'Arman Damirchilou', href: LINKS.linkedin },
  { label: 'GitHub', note: 'Code', value: 'ArmanDamirchilou', href: LINKS.github },
  { label: 'X', note: 'Updates', value: '@ArmanDamir5923', href: LINKS.x },
];

export function Contact() {
  useV2Root();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  // No mail backend on this site: the form composes the email in the
  // visitor's own mail app, so it works on any static host.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const who = name.trim();
    const subject = `Message from ${who || 'your website'} (via armandamirchilou.github.io)`;
    const body = `${message.trim()}\n\n${who}${email.trim() ? ` (${email.trim()})` : ''}`;
    window.location.href = `mailto:${LINKS.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const copyEmail = () => {
    navigator.clipboard?.writeText(LINKS.email).then(() => setCopied(true)).catch(() => {});
  };

  return (
    <div className="v2">
      <Seo
        title="Contact Arman Damirchilou"
        description="Get in touch with Arman Damirchilou about research, collaborations, internships or AI projects. Based in Tehran, Iran."
        path="/contact"
      />
      <V2Backdrop />
      <V2Nav />

      <main className="v2-contact v2-wrap">
        <header className="v2-contact-head">
          <h1 className="v2-h2">Say hello.</h1>
          <p>Research, collaborations, internships, admissions questions or plain curiosity. My inbox is open.</p>
        </header>

        <div className="v2-contact-grid">
          <form className="v2-form" onSubmit={handleSubmit}>
            <label>
              <span>Your name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
            </label>
            <label>
              <span>Your email (optional)</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </label>
            <label>
              <span>Message</span>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} required />
            </label>
            <div className="v2-form-foot">
              <button type="submit" className="v2-btn v2-btn-accent">
                Send message {Arrow}
              </button>
              <span className="v2-meta">Opens your email app with everything filled in.</span>
            </div>
          </form>

          <aside className="v2-channels" aria-label="Other ways to reach me">
            <div className="v2-channel v2-channel-mail">
              <span className="v2-meta">Email</span>
              <a href={`mailto:${LINKS.email}`}>{LINKS.email}</a>
              <button type="button" className="v2-copy" onClick={copyEmail} aria-live="polite">
                {copied ? 'Copied' : 'Copy address'}
              </button>
            </div>
            {CHANNELS.map((c) => (
              <a key={c.label} className="v2-channel" href={c.href} target="_blank" rel="noopener noreferrer">
                <span className="v2-meta">{c.note}</span>
                <span className="v2-channel-name">{c.label}</span>
                <span className="v2-channel-value">{c.value}</span>
                <span className="v2-channel-arrow">{Arrow}</span>
              </a>
            ))}
            <Link className="v2-channel v2-channel-twin" to="/twin">
              <span className="v2-meta">Right now</span>
              <span className="v2-channel-name">Ask my digital twin</span>
              <span className="v2-channel-value">It answers out loud, any time of day.</span>
              <span className="v2-channel-arrow">{Arrow}</span>
            </Link>
          </aside>
        </div>
      </main>

      <V2Footer />
    </div>
  );
}
