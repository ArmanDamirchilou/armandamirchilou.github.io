import { Link } from 'react-router-dom';
import '@fontsource-variable/geist';
import '@fontsource-variable/vazirmatn';
import '../styles/v2.css';
import '../styles/v2-fa.css';
import { Seo } from '../components/Seo';
import { V2Backdrop, V2Footer, V2Nav, useV2Root } from '../v2/Chrome';
import { LINKS } from '../v2/content';

// [before, English event name, after]: the English names are isolated so a
// name that starts with a digit ("1 Idea 1 World") keeps its own order
// inside right-to-left text.
const HONOURS: [string, string, string][] = [
  ['مدال طلای ', 'Innoverse Expo', '، آمریکا (۲۰۲۵)'],
  ['مقام دوم جام ملی هوش مصنوعی، ایران (۲۰۲۴)', '', ''],
  ['مدال برنز ', '1 Idea 1 World', '، ترکیه (۲۰۲۴)'],
  ['دیپلم افتخار ', 'Bright Expo', '، فرانسه (۲۰۲۴)'],
  ['رتبه در المپیاد کامپیوتر، ایران (۲۰۲۳)', '', ''],
];

const PROJECTS = [
  { title: 'همزاد دیجیتال', line: 'نسخه‌ای سه‌بعدی از خودم که با صدای خودم جواب می‌دهد.' },
  { title: 'کنترل هوشمند ترافیک', line: 'سیستمی که ترافیک را زنده می‌بیند و زمان چراغ‌ها را با آن تنظیم می‌کند.' },
  { title: 'تخصیص هوشمند آب', line: 'آب کمیاب را به جایی می‌رساند که بیشتر از همه لازم است.' },
  { title: 'تشخیص بیماری از روی صدا', line: 'از روی طرز صحبت کردن، نشانه‌های بیماری را پیدا می‌کند.' },
  { title: 'RAG-Eval', line: 'ابزاری متن‌باز برای سنجیدن اینکه یک سیستم بازیابی اطلاعات چقدر قابل اعتماد است.' },
];

const CHANNELS = [
  { label: 'ایمیل', value: LINKS.email, href: `mailto:${LINKS.email}` },
  { label: 'تلگرام', value: '@armandamirchilou', href: LINKS.telegram },
  { label: 'لینکدین', value: 'Arman Damirchilou', href: LINKS.linkedin },
  { label: 'گیت‌هاب', value: 'ArmanDamirchilou', href: LINKS.github },
];

/**
 * آرمان دمیرچیلو: the Persian page. It exists so a search in Persian finds
 * the site at all (a page can only rank for words it contains), and so a
 * Persian-speaking visitor gets the story in their own language. Laid out
 * right to left in Vazirmatn; links back to the English site.
 */
export function Fa() {
  useV2Root();
  return (
    <div className="v2">
      <Seo
        title="آرمان دمیرچیلو | مهندس هوش مصنوعی از تهران"
        description="آرمان دمیرچیلو (Arman Damirchilou)، مهندس هوش مصنوعی ۱۶ ساله از تهران. سازنده‌ی سیستم‌های یادگیری ماشین، بینایی کامپیوتر و هوش مصنوعی صوتی و برنده‌ی مدال طلای Innoverse Expo آمریکا."
        path="/fa"
      />
      <V2Backdrop />
      <V2Nav />

      <main className="v2-fa v2-wrap" lang="fa" dir="rtl">
        <header className="v2-fa-hero">
          <h1 className="v2-h2">آرمان دمیرچیلو</h1>
          <p className="v2-fa-lead">مهندس هوش مصنوعی، ۱۶ ساله، از تهران.</p>
          <p className="v2-fa-body">
            از یازده سالگی برنامه‌نویسی با پایتون را شروع کردم و از سیزده سالگی درگیر هوش مصنوعی شدم. سیستم‌هایی
            می‌سازم که یک مشکل واقعی را حل کنند: از کنترل هوشمند ترافیک و تقسیم آب گرفته تا پیدا کردن نشانه‌های بیماری
            در صدا. یک همزاد دیجیتال هم از خودم ساخته‌ام که با صدای خودم جواب سؤال‌ها را می‌دهد.
          </p>
          <div className="v2-fa-actions">
            <Link to="/twin" className="v2-btn v2-btn-accent lg lg-pill lg-accent lg-press">
              با همزاد من صحبت کنید
            </Link>
            <Link to="/" className="v2-link" lang="en" dir="ltr">
              English version
            </Link>
          </div>
          <p className="v2-fa-note">همزاد من فعلاً فقط به زبان انگلیسی صحبت می‌کند.</p>
        </header>

        <section className="v2-fa-section" aria-labelledby="fa-honours">
          <h2 id="fa-honours">افتخارات</h2>
          <ul className="v2-fa-list lg">
            {HONOURS.map(([before, name, after]) => (
              <li key={before + name}>
                {before}
                {name && <bdi dir="ltr">{name}</bdi>}
                {after}
              </li>
            ))}
          </ul>
        </section>

        <section className="v2-fa-section" aria-labelledby="fa-projects">
          <h2 id="fa-projects">چند پروژه</h2>
          <div className="v2-fa-grid">
            {PROJECTS.map((p) => (
              <article key={p.title} className="v2-fa-card lg">
                <h3>{p.title}</h3>
                <p>{p.line}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="v2-fa-section" aria-labelledby="fa-contact">
          <h2 id="fa-contact">راه‌های ارتباط</h2>
          <div className="v2-fa-grid">
            {CHANNELS.map((c) => (
              <a key={c.label} className="v2-fa-card lg lg-press" href={c.href} target={c.href.startsWith('mailto:') ? undefined : '_blank'} rel="noopener noreferrer">
                <h3>{c.label}</h3>
                <p lang="en" dir="ltr">{c.value}</p>
              </a>
            ))}
          </div>
        </section>
      </main>

      <V2Footer />
    </div>
  );
}
