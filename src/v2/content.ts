// Everything the homepage says about Arman, in one place. Facts only come from
// personality/knowledge-base.json and the previous site copy; nothing here is
// invented for the design. Copy rules: no em-dashes, no emoji.

export const LINKS = {
  email: 'armandamirchilou@gmail.com',
  github: 'https://github.com/ArmanDamirchilou',
  linkedin: 'https://www.linkedin.com/in/arman-damirchilou-a98322369/',
  x: 'https://x.com/ArmanDamir5923',
  telegram: 'https://t.me/armandamirchilou',
};

// The three statements the hero cycles through as the camera orbits.
export const HERO_LINES = [
  { big: 'Arman Damirchilou.', small: 'AI engineer. Sixteen. Tehran.' },
  { big: 'Python at eleven.', small: 'Neural networks at thirteen.' },
  { big: 'Now it talks back.', small: 'I built a digital twin of myself. Scroll on, or ask it anything.' },
];

export const MANIFESTO =
  "I don't want to just study AI. I want to build the systems people rely on: machines that see traffic, share scarce water, hear illness in a voice, and talk back like a person. Every project here started as a problem that annoyed me.";

export const STATS = [
  { value: 16, suffix: '', label: 'years old' },
  { value: 5, suffix: '', label: 'podiums and rankings' },
  { value: 3, suffix: '', label: 'continents competed on' },
  { value: 7, suffix: '', label: 'AI systems built' },
];

export type Milestone = {
  year: string;
  title: string;
  place: string;
  note: string;
  medal?: 'gold' | 'silver' | 'bronze' | 'honor';
};

export const JOURNEY: Milestone[] = [
  { year: '2021', title: 'First line of Python', place: 'Tehran', note: 'Eleven years old, self-taught, building small games first.' },
  { year: '2023', title: 'National Computer Olympiad', place: 'Iran', note: 'Ranked at thirteen, the same year I went deep into AI.', medal: 'honor' },
  { year: '2024', title: '2nd Place, National AI Cup', place: 'Iran', note: 'Nationwide artificial intelligence competition.', medal: 'silver' },
  { year: '2024', title: 'Honorary Diploma, Bright Expo', place: 'France', note: 'International exhibition of inventions.', medal: 'honor' },
  { year: '2024', title: 'Bronze, 1 Idea 1 World', place: 'Turkey', note: 'International idea and invention olympiad.', medal: 'bronze' },
  { year: '2025', title: 'Gold Medal, Innoverse Expo', place: 'United States', note: 'International invention and innovation expo.', medal: 'gold' },
  { year: '2026', title: 'The digital twin goes live', place: 'This website', note: 'A 3D version of me with my personality and a voice, open to anyone.' },
];

export type Project = {
  id: string;
  title: string;
  field: string;
  line: string;
  detail: string;
  stack: string[];
  href?: string;
  internal?: boolean;
  cta?: string;
  image?: string;
};

export const PROJECTS: Project[] = [
  {
    id: 'twin',
    title: 'Digital Twin',
    field: 'Voice AI, LLMs, 3D',
    line: 'A version of me you can actually talk to.',
    detail:
      'A rigged 3D avatar with live lip-sync, an LLM brain loaded with my personality and history, and speech synthesis. Built the rendering, the animation system and the backend myself.',
    stack: ['Three.js', 'React', 'Node', 'LLMs', 'TTS'],
    href: '/twin',
    internal: true,
    cta: 'Talk to it',
    image: 'work/twin.jpg',
  },
  {
    id: 'rag',
    title: 'RAG-Eval',
    field: 'NLP, open source',
    line: 'Measures whether a retrieval pipeline can be trusted.',
    detail:
      'An evaluation harness for retrieval-augmented generation that scores faithfulness, answer relevancy, context precision and recall, so teams can see where their answers go wrong.',
    stack: ['Python', 'LLMs', 'Evaluation'],
    href: 'https://github.com/ArmanDamirchilou',
    cta: 'View on GitHub',
  },
  {
    id: 'traffic',
    title: 'Intelligent Traffic Control',
    field: 'Computer vision',
    line: 'Reads live traffic and adapts the signals to it.',
    detail:
      'A computer vision system that analyses traffic flow in real time and optimises signal timing. Tehran has ten million people and famous traffic, so this one was personal.',
    stack: ['Python', 'Computer vision', 'Deep learning'],
  },
  {
    id: 'water',
    title: 'Smart Water Allocation',
    field: 'Machine learning, optimisation',
    line: 'Shares scarce water where it matters most.',
    detail:
      'A machine learning system that optimises how water is distributed across a region, aimed at the water-scarce areas where every allocation decision counts.',
    stack: ['Python', 'ML', 'Optimisation'],
  },
  {
    id: 'voice',
    title: 'Voice-based Disease Screening',
    field: 'Medical AI research',
    line: 'Listens for signs of illness in how people speak.',
    detail:
      'An audio analysis system that predicts health conditions from voice patterns. My first step into medical AI research.',
    stack: ['Python', 'Audio ML', 'Signal processing'],
  },
  {
    id: 'art',
    title: 'Emotion-to-Art',
    field: 'Generative AI',
    line: 'Turns a written feeling into an image.',
    detail:
      'A multimodal system that combines NLP, computer vision and generative models to convert emotions described in text into visual art.',
    stack: ['NLP', 'Generative models'],
  },
  {
    id: 'rl',
    title: 'RL Intelligent Hunter',
    field: 'Reinforcement learning',
    line: 'An agent that teaches itself to hunt.',
    detail:
      'A reinforcement learning agent that learns to navigate and pursue targets in simulated environments, with no hand-written strategy.',
    stack: ['Python', 'RL', 'Simulation'],
  },
];

// The admissions-facing summary: what a reader would put in a file about me.
export const PROFILE: { label: string; items: string[] }[] = [
  {
    label: 'Education',
    items: [
      'High school student in Tehran, Iran (born 2010)',
      'Self-taught in programming since age eleven',
      "Harvard CS50's Introduction to AI with Python",
    ],
  },
  {
    label: 'Research interests',
    items: [
      'Machine learning systems that ship to real users',
      'Computer vision and speech',
      'Reinforcement learning',
      'Evaluation and reliability of LLM systems',
    ],
  },
  {
    label: 'Honours',
    items: [
      'Gold Medal, Innoverse Expo, USA (2025)',
      '2nd Place, National AI Cup, Iran (2024)',
      'Bronze Medal, 1 Idea 1 World, Turkey (2024)',
      'Honorary Diploma, Bright Expo, France (2024)',
      'National Computer Olympiad rankings, Iran (2023)',
    ],
  },
  {
    label: 'Technical skills',
    items: [
      'Python (advanced), PyTorch, scikit-learn',
      'Computer vision, NLP, deep learning',
      'React, TypeScript, Node.js, Flask, Django',
      'Three.js and WebGL, Blender, Unity',
    ],
  },
  {
    label: 'Languages',
    items: ['Persian (native)', 'English (fluent)'],
  },
  {
    label: 'Goals',
    items: [
      'Study computer science and AI at university',
      'Build an AI lab that turns research into products people rely on',
    ],
  },
];
