import { useEffect, useState } from 'react';

const SOCIALS = [
  { label: 'GitHub', href: 'https://github.com/ArmanDamirchilou' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/arman-damirchilou-a98322369/' },
  { label: 'X / Twitter', href: 'https://x.com/ArmanDamir5923' },
  { label: 'Telegram', href: 'https://t.me/armandamirchilou' },
];

/** Live local time in Tehran — the reference site's "00:00 JST" detail. */
function useTehranTime() {
  const [time, setTime] = useState('--:--:--');
  useEffect(() => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Tehran',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

export function SiteFooter() {
  const time = useTehranTime();

  return (
    <footer className="site-footer" id="contact">
      <p className="footer-invite">For research collaborations, internships, and conversations —</p>
      <a href="mailto:armandamirchilou@gmail.com" className="footer-mail u-line">
        armandamirchilou[at]gmail[dot]com
      </a>

      <div className="footer-links">
        {SOCIALS.map((s) => (
          <a key={s.label} href={s.href} target="_blank" rel="noopener" className="u-line">
            {s.label}
          </a>
        ))}
      </div>

      <div className="footer-meta">
        <span>© {new Date().getFullYear()} Arman Damirchilou</span>
        <span className="footer-clock">{time} TEHRAN</span>
      </div>
    </footer>
  );
}
