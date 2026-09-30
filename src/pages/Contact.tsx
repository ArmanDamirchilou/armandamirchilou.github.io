import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import '../styles/v2.css';
import { Seo } from '../components/Seo';
import { V2Backdrop, V2Footer, V2Nav, useV2Root } from '../v2/Chrome';
import { ContactPanel } from '../v2/ContactPanel';

export function Contact() {
  useV2Root();

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
        <ContactPanel headingLevel={1} />
      </main>

      <V2Footer />
    </div>
  );
}
