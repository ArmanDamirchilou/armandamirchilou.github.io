import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { LINKS } from './content';

const Arrow = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M5 12h14m-6-6 6 6-6 6" />
  </svg>
);

const CHANNELS = [
  {
    label: 'Telegram',
    note: 'Fastest reply',
    value: '@armandamirchilou',
    href: LINKS.telegram,
    icon: <path d="M21 3 3 10.5l6.5 2.5L12 21l3.2-7.2L21 3ZM9.5 13 21 3" />,
  },
  {
    label: 'LinkedIn',
    note: 'Professional',
    value: 'Arman Damirchilou',
    href: LINKS.linkedin,
    icon: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="4" />
        <path d="M8 10.5V17M8 7.5v.01M11.5 17v-3.8c0-1.6 1-2.7 2.4-2.7s2.1 1 2.1 2.7V17M11.5 10.5V17" />
      </>
    ),
  },
  {
    label: 'GitHub',
    note: 'Code',
    value: 'ArmanDamirchilou',
    href: LINKS.github,
    icon: <path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />,
  },
  {
    label: 'X',
    note: 'Updates',
    value: '@ArmanDamir5923',
    href: LINKS.x,
    icon: <path d="M4 4l16 16M20 4 4 20" />,
  },
];

/**
 * Everything needed to reach Arman: a message form, the email address with a
 * copy button, the other channels and a shortcut to the twin. Used as a
 * section on the homepage and as the whole of /contact.
 *
 * There's no mail backend on a static host, so the form composes the email
 * in the visitor's own mail app with everything filled in.
 */
export function ContactPanel({ headingLevel = 2 }: { headingLevel?: 1 | 2 }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const Heading = headingLevel === 1 ? 'h1' : 'h2';

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(id);
  }, [copied]);

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
    <>
      <header className="v2-contact-head v2-rise">
        <Heading className="v2-h2" id="contact-title">
          Say hello.
        </Heading>
        <p>Research, collaborations, internships, admissions questions or plain curiosity. My inbox is open.</p>
      </header>

      <div className="v2-contact-grid">
        <form className="v2-form lg lg-strong v2-rise" onSubmit={handleSubmit}>
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
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required />
          </label>
          <div className="v2-form-foot">
            <button type="submit" className="v2-btn v2-btn-accent lg lg-pill lg-accent lg-press">
              Send message {Arrow}
            </button>
            <span className="v2-meta">Opens your email app with everything filled in.</span>
          </div>
        </form>

        <aside className="v2-channels" aria-label="Other ways to reach me">
          <div className="v2-channel v2-channel-mail lg v2-rise">
            <span className="v2-meta">Email</span>
            <a href={`mailto:${LINKS.email}`}>{LINKS.email}</a>
            <button type="button" className="v2-copy" onClick={copyEmail} aria-live="polite">
              {copied ? 'Copied' : 'Copy address'}
            </button>
          </div>
          {CHANNELS.map((c) => (
            <a key={c.label} className="v2-channel lg lg-press v2-rise" href={c.href} target="_blank" rel="noopener noreferrer">
              <svg className="v2-channel-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {c.icon}
              </svg>
              <span className="v2-meta">{c.note}</span>
              <span className="v2-channel-name">{c.label}</span>
              <span className="v2-channel-value">{c.value}</span>
              <span className="v2-channel-arrow">{Arrow}</span>
            </a>
          ))}
          <Link className="v2-channel v2-channel-twin lg lg-press v2-rise" to="/twin">
            <span className="v2-meta">Right now</span>
            <span className="v2-channel-name">Ask my digital twin</span>
            <span className="v2-channel-value">It answers out loud, any time of day.</span>
            <span className="v2-channel-arrow">{Arrow}</span>
          </Link>
        </aside>
      </div>
    </>
  );
}
