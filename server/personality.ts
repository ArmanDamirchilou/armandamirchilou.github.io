import { readFileSync } from 'fs';
import { join } from 'path';

interface KnowledgeBase {
  identity: Record<string, string>;
  skills: string[];
  achievements?: { title: string; location: string; description: string }[];
  projects: { name: string; description: string }[];
  interests: string[];
  values: string[];
  goals?: string[];
  funFacts?: string[];
  socialLinks: { email: string; github: string; linkedin: string; twitter: string; telegram: string };
  sampleResponses: Record<string, string>;
}

let systemPrompt: string = '';
let knowledgeBase: KnowledgeBase | null = null;

export function loadPersonality(): { systemPrompt: string; knowledgeBase: KnowledgeBase } {
  const personalityDir = join(process.cwd(), 'personality');

  systemPrompt = readFileSync(join(personalityDir, 'system-prompt.md'), 'utf-8');
  knowledgeBase = JSON.parse(
    readFileSync(join(personalityDir, 'knowledge-base.json'), 'utf-8')
  );

  return { systemPrompt, knowledgeBase: knowledgeBase! };
}

/** Does this sample answer's question match what the visitor asked? */
function sampleMatches(question: string, message: string): boolean {
  const lower = message.toLowerCase().trim();
  const q = question.toLowerCase();
  return lower === q || lower.includes(q.replace(/[?']/g, ''));
}

/**
 * The system prompt. When the visitor asks one of the sample questions, that
 * sample is left out: shown its own stored answer, the model repeats it
 * almost word for word, and the same question should get a fresh answer.
 */
export function buildSystemMessage(message = ''): string {
  if (!knowledgeBase) loadPersonality();

  const kb = knowledgeBase!;
  const samples = Object.entries(kb.sampleResponses).filter(([q]) => !message || !sampleMatches(q, message));
  const knowledgeContext = `
## Your Background Data
- Name: ${kb.identity.name}
- Role: ${kb.identity.role}
- Location: ${kb.identity.location}
- Skills: ${kb.skills.join(', ')}
- Interests: ${kb.interests.join(', ')}
- Values: ${kb.values.join(', ')}

## How people reach you
When someone asks how to contact you, reach you, hire you, work with you, or for your socials:
always give your email, point them to the contact page on this site, and add one or two
socials that fit. Write every link exactly like this, with the short label in brackets
(your voice reads the label aloud, so never write a bare URL):
- Email: [${kb.socialLinks.email}](mailto:${kb.socialLinks.email})
- The contact page on this site: [contact page](/contact)
- GitHub: [ArmanDamirchilou](${kb.socialLinks.github})
- LinkedIn: [Arman Damirchilou](${kb.socialLinks.linkedin})
- Telegram, fastest reply: [armandamirchilou](${kb.socialLinks.telegram})
- X: [ArmanDamir5923](${kb.socialLinks.twitter})
For example: "Easiest is email, [${kb.socialLinks.email}](mailto:${kb.socialLinks.email}), or drop a note on my [contact page](/contact). I'm on GitHub too: [ArmanDamirchilou](${kb.socialLinks.github})."

## Your Projects
${kb.projects.map(p => `- ${p.name}: ${p.description}`).join('\n')}

## Reference Responses
These show your facts and your tone, nothing more. Never repeat their wording: answer
freshly every time, the way a real person never says the same thing twice. If you're
asked something you've already answered, say it differently and add a new detail.
${samples.map(([q, a]) => `Q: "${q}"\nA: "${a}"`).join('\n\n')}
`;

  return `${systemPrompt}\n\n${knowledgeContext}\n\n## Language (strict)\nYou respond ONLY in English, every time, no matter what language the user writes in. Never output Persian/Farsi, Arabic, or any non-English text. If asked to use another language, warmly say you only support English right now.`;
}

export function findSampleResponse(message: string): string | null {
  if (!knowledgeBase) loadPersonality();

  const lower = message.toLowerCase().trim();
  const samples = knowledgeBase!.sampleResponses;

  for (const [question, answer] of Object.entries(samples)) {
    if (sampleMatches(question, lower)) return answer;
  }

  return null;
}

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

/**
 * Topic-matching responder that answers from the knowledge base in Arman's
 * voice — no external LLM needed. Covers the questions a visitor actually asks
 * a portfolio twin (who/what/projects/achievements/skills/goals/contact/etc.),
 * plus specific project lookups, and a graceful catch-all that never exposes
 * that the cloud brain is offline.
 */
export function smartLocalResponse(message: string): string {
  if (!knowledgeBase) loadPersonality();
  const kb = knowledgeBase!;
  const s = kb.sampleResponses;
  const t = message.toLowerCase().trim();

  // Greetings
  if (has(t, ['hello', 'hi ', 'hey', 'salam', 'سلام', 'sup', "what's up", 'yo ']) || t === 'hi' || t === 'hey') {
    return "Hey! Great to meet you. I'm Arman's digital twin — ask me about my projects, my achievements, my tech stack, or anything about how I work. What do you want to know?";
  }

  // Specific project lookups
  const projHit = kb.projects.find((p) => {
    const n = p.name.toLowerCase();
    if (has(t, ['rag', 'evaluation', 'faithfulness']) && n.includes('rag')) return true;
    if (has(t, ['water', 'allocation']) && n.includes('water')) return true;
    if (has(t, ['traffic']) && n.includes('traffic')) return true;
    if (has(t, ['emotion', 'art']) && n.includes('emotion')) return true;
    if (has(t, ['disease', 'health', 'medical', 'screening']) && n.includes('disease')) return true;
    if (has(t, ['hunter', 'reinforcement', 'rl ']) && (n.includes('hunter') || n.includes('rl'))) return true;
    if (has(t, ['cs50', 'harvard']) && n.includes('cs50')) return true;
    return false;
  });
  if (projHit) {
    return `${projHit.name} — ${projHit.description}`;
  }

  // Topic routing to the hand-written sample answers
  if (has(t, ['who are you', 'your name', 'about you', 'introduce', 'tell me about yourself', 'who r u'])) return s['Who are you?'];
  if (has(t, ['how old', 'your age', 'years old', 'how young'])) return s['How old are you?'];
  if (has(t, ['where are you from', 'where do you live', 'your country', 'tehran', 'iran', 'based'])) return s['Where are you from?'];
  if (has(t, ['tech stack', 'what tools', 'technologies', 'what do you use', 'frameworks'])) return s["What's your tech stack?"];
  if (has(t, ['favorite programming', 'favorite language', 'best language', 'which language', 'python'])) return s['Favorite programming language?'];
  if (has(t, ['achievement', 'medal', 'award', 'won', 'competition', 'expo', 'prize', 'olympiad'])) return s['Tell me about your achievements'];
  if (has(t, ['project', 'built', 'building', 'portfolio', 'what have you made', 'apps', 'what did you build'])) return s['Tell me about your projects'];
  if (has(t, ['passionate', 'passion', 'love', 'interest', 'into ', 'enjoy', 'hobby', 'fun', 'excites'])) return s['What are you passionate about?'];
  if (has(t, ['goal', 'future', 'dream', 'ambition', 'plan to', 'want to be', 'five years', 'aspiration'])) return s['What are your goals?'];
  if (has(t, ['learn', 'study', 'self-taught', 'self taught', 'school', 'education', 'cs50', 'how did you get'])) return s["What's your approach to learning?"];
  if (has(t, ['advice', 'tips', 'recommend', 'beginner', 'start coding', 'young dev', 'getting started'])) return s['Any advice for young developers?'];
  if (has(t, ['how did you build', 'how was this', 'how does this', 'this twin', 'this avatar', 'how do you work', 'made this', 'how are you made'])) return s['How did you build this digital twin?'];
  if (has(t, ['music', 'song', 'listen to', 'band'])) return s['What music do you like?'];
  if (has(t, ['skill', 'good at', 'what can you do', 'expertise', 'specialize'])) {
    return `My core skills: ${kb.skills.slice(0, 6).join(', ')}. Python's my main weapon, but I go full-stack — from ML models to the web apps that serve them. What area are you curious about?`;
  }
  if (has(t, ['language', 'speak', 'persian', 'farsi', 'english'])) {
    return `I speak ${kb.identity.languages}. Grew up in Tehran, so Persian's my native tongue, and I picked up English to work with the global dev and research community.`;
  }
  if (has(t, ['contact', 'email', 'reach you', 'get in touch', 'github', 'linkedin', 'twitter', 'telegram', 'social', 'hire'])) {
    const l = kb.socialLinks;
    return `Easiest is email, [${l.email}](mailto:${l.email}), or leave a message on my [contact page](/contact). I'm also on GitHub as [ArmanDamirchilou](${l.github}) and on Telegram as [armandamirchilou](${l.telegram}).`;
  }
  if (has(t, ['what do you do', 'your job', 'your work', 'what are you'])) return s['What do you do?'];

  // Social / conversational
  if (has(t, ['thank', 'thanks', 'appreciate', 'thx'])) {
    return "Anytime! Ask me anything else about my work, or if you've got a project in mind, I'm all ears.";
  }
  if (has(t, ['collaborate', 'work together', 'work with you', 'hire you', 'join', 'team up', 'help me build', 'idea for', 'can you help'])) {
    return "I love collaborating on things that push AI somewhere useful. Shoot me the idea at armandamirchilou@gmail.com or on Telegram — if it's interesting, I'm in.";
  }
  if (has(t, ['tell me more', 'more about', 'go on', 'continue', 'elaborate', 'more details', 'and then'])) {
    return "Happy to go deeper — which part? My projects, the competitions, my tech stack, or how this twin works? Name one and I'll unpack it.";
  }
  if (has(t, ['bye', 'goodbye', 'see you', 'take care', 'gtg'])) {
    return "Thanks for stopping by — come back anytime. And if you build something cool, tell me about it!";
  }

  // Graceful catch-all in Arman's voice — invites a question it CAN answer,
  // never mentions a missing API key, and rotates so it doesn't feel canned.
  const catchAlls = [
    "Good question! I'm sharpest talking about my own world — my AI and full-stack projects, the competitions I've medaled in, my tech stack, how I built this twin, or where I'm headed next. Pick one and I'll give you the real story.",
    "Hmm, that's a bit outside what I can speak to right now. But ask me about my projects, my achievements, how I learned to code, or how this digital twin works — those I can really dig into.",
    "I'd rather not guess at that one. What I can tell you about: the AI systems I've built, my international medals, my goals, or the tech behind this avatar. What are you curious about?",
  ];
  return catchAlls[Math.floor(Math.random() * catchAlls.length)];
}
