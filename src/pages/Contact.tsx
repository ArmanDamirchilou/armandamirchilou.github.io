import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Reveal } from '../components/Reveal';
import { PageFooter } from '../components/PageFooter';
import { Seo } from '../components/Seo';

const EMAIL = 'armandamirchilou@gmail.com';

const SOCIALS = [
  { label: 'GitHub', mark: 'GH', markColor: 'ink', href: 'https://github.com/ArmanDamirchilou' },
  { label: 'LinkedIn', mark: 'in', markColor: 'blue', href: 'https://www.linkedin.com/in/arman-damirchilou-a98322369/' },
  { label: 'X / Twitter', mark: 'X', markColor: 'coral', href: 'https://x.com/ArmanDamir5923' },
  { label: 'Telegram', mark: 'TG', markColor: 'azure', href: 'https://t.me/armandamirchilou' },
];

const ArrowRight = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
    <path d="M4 12h16m-6-6 6 6-6 6" />
  </svg>
);

export function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

  // No mail backend on this site — the form composes the email in the
  // visitor's own mail app, so it works on any static host.
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const subject = `Message from ${name.trim() || 'your website'} — via your site`;
    const body = `${message.trim()}\n\n— ${name.trim()}${email.trim() ? ` (${email.trim()})` : ''}`;
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const copyEmail = () => {
    navigator.clipboard?.writeText(EMAIL).then(() => setCopied(true)).catch(() => {});
  };

  return (
    <main>
      <Seo
        title="Contact Arman Damirchilou — AI Software Engineer"
        description="Get in touch with Arman Damirchilou for AI, machine learning and full-stack engineering work. Based in Tehran, Iran, working with teams worldwide."
        path="/contact"
      />
      <Navbar />

      <section className="contact-hero container">
        <Reveal>
          <h1>Got a question or an idea?<br /><span className="chip azure">Let's talk.</span></h1>
          <p>
            Research collaborations, internships, project ideas, or plain
            curiosity — my inbox is open. Pick whichever channel suits you, or
            ask my twin and get an answer right now.
          </p>
        </Reveal>
      </section>

      <section className="container contact-grid">
        <Reveal>
          <div className="contact-form-card">
            <h2>Send me a message</h2>
            <p>Fill this in and hit send — it opens in your email app with everything ready to go.</p>
            <form className="contact-form" onSubmit={handleSubmit}>
              <div className="contact-field">
                <label htmlFor="contact-name">Your name</label>
                <input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div className="contact-field">
                <label htmlFor="contact-email">Your email (optional)</label>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="contact-field">
                <label htmlFor="contact-message">Your message</label>
                <textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="What are you working on?"
                  required
                />
              </div>
              <button type="submit" className="btn-solid">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path d="m3 11 18-8-8 18-2.5-7.5L3 11Z" />
                </svg>
                Send message
              </button>
              <span className="contact-form-hint">Prefer plain email? Copy my address from the card on the right.</span>
            </form>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <aside className="contact-side">
            <div className="contact-channel">
              <a className="contact-channel-main" href={`mailto:${EMAIL}`}>
                <span className="contact-channel-icon azure" aria-hidden>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                    <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
                    <path d="m3 7 9 6 9-6" />
                  </svg>
                </span>
                <span className="contact-channel-info">
                  <h3>Email</h3>
                  <p>{EMAIL}</p>
                </span>
              </a>
              <button
                type="button"
                className={`contact-copy ${copied ? 'copied' : ''}`}
                onClick={copyEmail}
                aria-label="Copy email address"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <a
              className="contact-channel"
              href="https://t.me/armandamirchilou"
              target="_blank"
              rel="noopener"
            >
              <span className="contact-channel-icon green" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="m21 4-18 7.5 5.5 2L10 19l3-3.5 5 3L21 4Z" />
                </svg>
              </span>
              <span className="contact-channel-info">
                <h3>Telegram</h3>
                <p>@armandamirchilou — fastest reply</p>
              </span>
              <span className="contact-channel-arrow" aria-hidden>{ArrowRight}</span>
            </a>

            <Link className="contact-channel" to="/twin">
              <span className="contact-channel-icon coral" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                  <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.38-4.1-1.05L3 20l1.05-5.4A8.5 8.5 0 1 1 21 11.5Z" />
                </svg>
              </span>
              <span className="contact-channel-info">
                <h3>Ask my AI twin</h3>
                <p>Instant answers, in my own voice</p>
              </span>
              <span className="contact-channel-arrow" aria-hidden>{ArrowRight}</span>
            </Link>

            <div className="contact-socials">
              <h2>Find me online</h2>
              <div className="contact-social-grid">
                {SOCIALS.map((s) => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener" className="contact-social">
                    <span className={`contact-social-mark ${s.markColor}`} aria-hidden>{s.mark}</span>
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </Reveal>
      </section>

      <PageFooter />
    </main>
  );
}
