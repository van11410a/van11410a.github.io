'use strict';

/* ===================================================
   VOCABULARY DEFINITIONS
=================================================== */
const VOCAB = {
  high: {
    weight: 60,
    recurrenceMin: 3,
    recurrenceMax: 6,
    words: [
      'yo','tú','no','sí','quiero','tengo','voy','estoy','es','hay',
      'comer','beber','ir','ver','hacer','hablar','vivir','dormir','necesitar',
      'agua','comida','casa','tiempo','día','persona','lugar','amigo'
    ]
  },
  medium: {
    weight: 30,
    recurrenceMin: 8,
    recurrenceMax: 20,
    words: [
      'con','sin','para','porque','pero','y','en','a','de','o',
      'bueno','malo','grande','pequeño','nuevo','viejo',
      'feliz','triste','cansado','ocupado','uno','dos','tres','mucho','poco'
    ]
  },
  low: {
    weight: 10,
    recurrenceMin: 25,
    recurrenceMax: 60,
    words: [
      'familia','ciudad','escuela','coche','dinero','problema','idea','mundo','camino','puerta',
      'venir','salir','entrar','poner','tomar','dar','decir','pensar','encontrar'
    ]
  }
};

/* ===================================================
   GRAMMAR STAGES
=================================================== */
const STAGES = [
  {
    id: 1,
    name: 'Present Tense',
    desc: 'Core frames only',
    allowPast: false,
    allowConnectors: false,
    allowTimeWords: false,
    allowParaMode: false
  },
  {
    id: 2,
    name: 'Past Tense Intro',
    desc: 'Past verbs unlocked',
    allowPast: true,
    allowConnectors: false,
    allowTimeWords: false,
    allowParaMode: false
  },
  {
    id: 3,
    name: 'Present + Past Mix',
    desc: 'Mixing tenses freely',
    allowPast: true,
    allowConnectors: false,
    allowTimeWords: false,
    allowParaMode: false
  },
  {
    id: 4,
    name: 'Connectors',
    desc: 'y, pero, porque unlocked',
    allowPast: true,
    allowConnectors: true,
    allowTimeWords: false,
    allowParaMode: false
  },
  {
    id: 5,
    name: 'Time Words',
    desc: 'hoy, ayer, mañana, luego',
    allowPast: true,
    allowConnectors: true,
    allowTimeWords: true,
    allowParaMode: false
  },
  {
    id: 6,
    name: 'Story Mode',
    desc: 'Full narrative flow',
    allowPast: true,
    allowConnectors: true,
    allowTimeWords: true,
    allowParaMode: true
  }
];

/* Verb conjugations for core frames */
const PRESENT_VERBS = ['quiero','tengo','voy a','estoy','necesito','me gusta','hay'];
const PAST_VERBS    = ['fui','tuve','estuve','quise','vi'];
const CONNECTORS    = ['y','pero','porque'];
const TIME_WORDS    = ['hoy','ayer','mañana','luego'];

/* Nouns by tier for frame filling */
const NOUNS = {
  high: ['agua','comida','casa','tiempo','día','amigo','lugar','persona'],
  medium: ['ciudad','escuela','coche','dinero','familia','mundo','puerta','camino'],
  low: ['idea','problema']
};

const ADJECTIVES = ['bueno','malo','grande','pequeño','nuevo','viejo','feliz','triste','cansado','ocupado'];

/* ===================================================
   ENGINE STATE
=================================================== */
let state = {
  sentenceIndex: 0,
  stage: 1,
  wordMap: {},          // word -> { freq, lastSeen }
  lastFrame: null,
  mode: 'flow',         // 'flow' | 'story'
  storyTopic: '',
  storySentenceCount: 0
};

/* Build word map entries */
function initWordMap() {
  const allWords = [...VOCAB.high.words, ...VOCAB.medium.words, ...VOCAB.low.words];
  allWords.forEach(w => {
    if (!state.wordMap[w]) {
      state.wordMap[w] = { freq: 0, lastSeen: -999 };
    }
  });
}

/* ===================================================
   PERSISTENCE
=================================================== */
const STORAGE_KEY = 'sfe_v1';

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...state, ...parsed };
    }
  } catch (_) {}
  initWordMap();
}

/* ===================================================
   SPACED REPETITION
=================================================== */
function getTier(word) {
  if (VOCAB.high.words.includes(word))   return 'high';
  if (VOCAB.medium.words.includes(word)) return 'medium';
  return 'low';
}

function isDue(word) {
  const entry = state.wordMap[word];
  if (!entry) return false;
  const tier = getTier(word);
  const cfg  = VOCAB[tier];
  const interval = entry.freq === 0
    ? 0
    : cfg.recurrenceMin + Math.floor(Math.random() * (cfg.recurrenceMax - cfg.recurrenceMin + 1));
  return (state.sentenceIndex - entry.lastSeen) >= interval;
}

function markWordUsed(word) {
  if (!state.wordMap[word]) state.wordMap[word] = { freq: 0, lastSeen: -999 };
  state.wordMap[word].freq++;
  state.wordMap[word].lastSeen = state.sentenceIndex;
}

function getDueWords(tier) {
  return VOCAB[tier].words.filter(w => isDue(w));
}

function countDue() {
  const allWords = [...VOCAB.high.words, ...VOCAB.medium.words, ...VOCAB.low.words];
  return allWords.filter(w => isDue(w)).length;
}

/* ===================================================
   WEIGHTED RANDOM SELECTION
=================================================== */
function weightedPick(arr, exclude = []) {
  const filtered = arr.filter(w => !exclude.includes(w));
  if (filtered.length === 0) return arr[Math.floor(Math.random() * arr.length)];
  return filtered[Math.floor(Math.random() * filtered.length)];
}

function pickWordByWeight(exclude = []) {
  const r = Math.random() * 100;
  let tier;
  if (r < 60)      tier = 'high';
  else if (r < 90) tier = 'medium';
  else             tier = 'low';
  return weightedPick(VOCAB[tier].words, exclude);
}

/* Pick a due word (prefer high, fallback to any) */
function pickDueWord() {
  const highDue = getDueWords('high');
  if (highDue.length > 0) return highDue[Math.floor(Math.random() * highDue.length)];
  const medDue = getDueWords('medium');
  if (medDue.length > 0) return medDue[Math.floor(Math.random() * medDue.length)];
  const lowDue = getDueWords('low');
  if (lowDue.length > 0) return lowDue[Math.floor(Math.random() * lowDue.length)];
  return null;
}

/* ===================================================
   SENTENCE GENERATION
=================================================== */
const FRAMES = [
  'quiero_x',
  'tengo_x',
  'voy_a_x',
  'estoy_x',
  'no_verb_x',
  'me_gusta_x',
  'hay_x'
];

function nounPhrase(exclude = []) {
  /* Pick weighted noun */
  const r = Math.random() * 100;
  let pool;
  if (r < 60)      pool = NOUNS.high;
  else if (r < 85) pool = NOUNS.medium;
  else             pool = NOUNS.low;
  return weightedPick(pool, exclude);
}

function buildFrame(frame, stage, forcedWord) {
  const stageInfo = STAGES[stage - 1];
  const used = [];
  let sentence = '';

  /* Optionally prepend time word */
  let timePrefix = '';
  if (stageInfo.allowTimeWords && Math.random() < 0.35) {
    const tw = TIME_WORDS[Math.floor(Math.random() * TIME_WORDS.length)];
    timePrefix = tw + ', ';
    markWordUsed(tw);
  }

  /* Optionally use past if allowed */
  const usePast = stageInfo.allowPast && stage >= 3
    ? Math.random() < 0.4
    : stageInfo.allowPast && stage === 2
      ? Math.random() < 0.5
      : false;

  const noun = forcedWord && (NOUNS.high.includes(forcedWord) || NOUNS.medium.includes(forcedWord) || NOUNS.low.includes(forcedWord))
    ? forcedWord
    : nounPhrase(used);
  used.push(noun);

  const adj = Math.random() < 0.4 ? weightedPick(ADJECTIVES) : '';

  if (usePast) {
    const v = PAST_VERBS[Math.floor(Math.random() * PAST_VERBS.length)];
    const noun2 = nounPhrase(used);
    sentence = `${timePrefix}${capitalize(v)} ${noun2}${adj ? ' ' + adj : ''}.`;
    markWordUsed(v);
    markWordUsed(noun2);
    if (adj) markWordUsed(adj);
  } else {
    switch (frame) {
      case 'quiero_x':
        sentence = `${timePrefix}${capitalize(forcedSubject())} quiero ${noun}${adj ? ' ' + adj : ''}.`;
        break;
      case 'tengo_x':
        sentence = `${timePrefix}${capitalize(forcedSubject())} tengo ${noun}${adj ? ' ' + adj : ''}.`;
        break;
      case 'voy_a_x':
        sentence = `${timePrefix}${capitalize(forcedSubject())} voy a ${noun}.`;
        break;
      case 'estoy_x': {
        const stateAdj = weightedPick(ADJECTIVES);
        sentence = `${timePrefix}${capitalize(forcedSubject())} estoy ${stateAdj}.`;
        markWordUsed(stateAdj);
        break;
      }
      case 'no_verb_x': {
        const v2 = ['comer','beber','ir','ver','hacer','hablar','dormir','vivir'][Math.floor(Math.random()*8)];
        sentence = `${timePrefix}${capitalize(forcedSubject())} no ${v2} ${noun}.`;
        markWordUsed(v2);
        break;
      }
      case 'me_gusta_x':
        sentence = `${timePrefix}${capitalize(forcedSubject())} me gusta ${noun}${adj ? ' ' + adj : ''}.`;
        break;
      case 'hay_x':
        sentence = `${timePrefix}hay ${noun}${adj ? ' ' + adj : ''}.`;
        break;
      default:
        sentence = `${timePrefix}${capitalize(forcedSubject())} quiero ${noun}.`;
    }
    markWordUsed(noun);
    if (adj) markWordUsed(adj);
  }

  /* Optionally append connector clause (stage 4+) */
  if (stageInfo.allowConnectors && Math.random() < 0.4) {
    const conn = CONNECTORS[Math.floor(Math.random() * CONNECTORS.length)];
    const noun3 = nounPhrase([...used, noun]);
    const frame2 = FRAMES[Math.floor(Math.random() * FRAMES.length)];
    const clause = buildClause(frame2, noun3);
    sentence = sentence.replace('.', '') + ' ' + conn + ' ' + clause + '.';
    markWordUsed(conn);
    markWordUsed(noun3);
  }

  if (forcedWord && !used.includes(forcedWord)) {
    markWordUsed(forcedWord);
  }

  return sentence;
}

function buildClause(frame, noun) {
  switch (frame) {
    case 'quiero_x':   return `quiero ${noun}`;
    case 'tengo_x':    return `tengo ${noun}`;
    case 'voy_a_x':    return `voy a ${noun}`;
    case 'estoy_x':    return `estoy ${weightedPick(ADJECTIVES)}`;
    case 'no_verb_x': {
      const v = ['comer','beber','ir','ver','hacer','hablar'][Math.floor(Math.random()*6)];
      return `no ${v} ${noun}`;
    }
    case 'me_gusta_x': return `me gusta ${noun}`;
    case 'hay_x':      return `hay ${noun}`;
    default:           return `quiero ${noun}`;
  }
}

function forcedSubject() {
  return Math.random() < 0.6 ? 'yo' : 'tú';
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pickNextFrame() {
  const frames = [...FRAMES];
  /* Avoid repeating last frame */
  const candidates = state.lastFrame ? frames.filter(f => f !== state.lastFrame) : frames;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function generateSentence() {
  const frame = pickNextFrame();
  state.lastFrame = frame;

  /* Check for due word to force */
  const dueWord = pickDueWord();
  const sentence = buildFrame(frame, state.stage, dueWord);

  state.sentenceIndex++;
  return sentence;
}

/* ===================================================
   STORY MODE
=================================================== */
const STORY_TRANSITIONS = [
  'Después,','Luego,','También,','Un día,','Al final,','Entonces,'
];

function generateStorySection(topic, sectionNum) {
  const stageInfo = STAGES[state.stage - 1];
  const lines = [];
  const count = 3 + Math.floor(Math.random() * 2); // 3–4 sentences per section

  /* Opening for section 1 */
  if (sectionNum === 1) {
    const opening = buildStoryOpening(topic);
    lines.push(opening);
  }

  for (let i = 0; i < count; i++) {
    const frame = pickNextFrame();
    state.lastFrame = frame;
    const dueWord = pickDueWord();
    const s = buildFrame(frame, state.stage, dueWord);

    /* Prepend transition from section 2 onward */
    if (sectionNum > 1 && i === 0) {
      const trans = STORY_TRANSITIONS[Math.floor(Math.random() * STORY_TRANSITIONS.length)];
      lines.push(trans + ' ' + s.charAt(0).toLowerCase() + s.slice(1));
    } else {
      lines.push(s);
    }

    state.sentenceIndex++;
    state.storySentenceCount++;
  }

  return lines.join(' ');
}

function buildStoryOpening(topic) {
  const clean = topic.trim().toLowerCase();
  const templates = [
    `Hay un lugar: ${clean}.`,
    `Un día, voy a ${clean}.`,
    `Quiero ver ${clean}.`,
    `Estoy en ${clean}.`
  ];
  const t = templates[Math.floor(Math.random() * templates.length)];
  state.sentenceIndex++;
  return t;
}

/* ===================================================
   UI RENDERING
=================================================== */
const feed         = document.getElementById('feed');
const modeBadge    = document.getElementById('mode-badge');
const stageNumber  = document.getElementById('stage-number');
const stageName    = document.getElementById('stage-name');
const stageDesc    = document.getElementById('stage-desc');
const stageDots    = document.querySelectorAll('.stage-dot');
const btnNext      = document.getElementById('btn-next');
const btnPrevStage = document.getElementById('btn-prev-stage');
const btnNextStage = document.getElementById('btn-next-stage');
const btnReset     = document.getElementById('btn-reset');
const btnStartStory= document.getElementById('btn-start-story');
const btnNextStory = document.getElementById('btn-next-story');
const storyTopicInput = document.getElementById('story-topic');
const modalOverlay = document.getElementById('modal-overlay');
const modalCancel  = document.getElementById('modal-cancel');
const modalConfirm = document.getElementById('modal-confirm');
const themeToggle  = document.getElementById('theme-toggle');

/* Stat bar */
const statSentences = document.getElementById('stat-sentences');
const statStage     = document.getElementById('stat-stage');
const statWords     = document.getElementById('stat-words');

/* Progress panel */
const progSentences = document.getElementById('prog-sentences');
const progWords     = document.getElementById('prog-words');
const progDue       = document.getElementById('prog-due');
const progStage     = document.getElementById('prog-stage');

function addFeedItem(text, type = 'flow') {
  /* De-highlight previous current */
  const prev = feed.querySelector('.current');
  if (prev) prev.classList.remove('current');

  const item = document.createElement('div');
  item.className = `feed-item current${type === 'story' ? ' story-block' : ''}`;

  const idx = document.createElement('div');
  idx.className = 'feed-index';
  idx.textContent = type === 'story'
    ? `Story · section ${state.storySentenceCount}`
    : `#${state.sentenceIndex}`;

  const txt = document.createElement('div');
  txt.textContent = text;

  item.appendChild(idx);
  item.appendChild(txt);
  feed.appendChild(item);

  /* Scroll to bottom */
  item.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function updateStageUI() {
  const s = STAGES[state.stage - 1];
  stageNumber.textContent = state.stage;
  stageName.textContent   = s.name;
  stageDesc.textContent   = s.desc;

  stageDots.forEach((dot, i) => {
    dot.classList.remove('active', 'done');
    if (i + 1 === state.stage) dot.classList.add('active');
    else if (i + 1 < state.stage) dot.classList.add('done');
  });

  btnPrevStage.disabled = state.stage <= 1;
  btnNextStage.disabled = state.stage >= STAGES.length;
}

function updateStats() {
  const tracked = Object.values(state.wordMap).filter(e => e.freq > 0).length;
  const due = countDue();

  statSentences.textContent = `${state.sentenceIndex} sentences`;
  statStage.textContent     = `Stage ${state.stage}`;
  statWords.textContent     = `${tracked} words tracked`;

  progSentences.textContent = state.sentenceIndex;
  progWords.textContent     = tracked;
  progDue.textContent       = due;
  progStage.textContent     = `${state.stage} / ${STAGES.length}`;
}

function enterFlowMode() {
  state.mode = 'flow';
  modeBadge.textContent = 'Flow Mode';
  modeBadge.classList.remove('story');
  btnNext.classList.remove('hidden');
  btnNextStory.classList.add('hidden');
  btnStartStory.classList.remove('hidden');
  storyTopicInput.value = '';
}

function enterStoryMode() {
  state.mode = 'story';
  modeBadge.textContent = 'Story Mode';
  modeBadge.classList.add('story');
  btnNext.classList.add('hidden');
  btnNextStory.classList.remove('hidden');
  btnStartStory.classList.add('hidden');
}

/* ===================================================
   EVENT HANDLERS
=================================================== */
btnNext.addEventListener('click', () => {
  const sentence = generateSentence();
  addFeedItem(sentence, 'flow');
  updateStats();
  saveState();
});

btnPrevStage.addEventListener('click', () => {
  if (state.stage > 1) {
    state.stage--;
    updateStageUI();
    updateStats();
    saveState();
  }
});

btnNextStage.addEventListener('click', () => {
  if (state.stage < STAGES.length) {
    state.stage++;
    updateStageUI();
    updateStats();
    saveState();
  }
});

btnStartStory.addEventListener('click', () => {
  const topic = storyTopicInput.value.trim();
  if (!topic) {
    storyTopicInput.focus();
    storyTopicInput.style.borderColor = 'var(--danger)';
    setTimeout(() => { storyTopicInput.style.borderColor = ''; }, 1200);
    return;
  }
  state.storyTopic = topic;
  state.storySentenceCount = 1;
  enterStoryMode();
  const section = generateStorySection(topic, 1);
  addFeedItem(section, 'story');
  updateStats();
  saveState();
});

btnNextStory.addEventListener('click', () => {
  state.storySentenceCount++;
  const section = generateStorySection(state.storyTopic, state.storySentenceCount);
  addFeedItem(section, 'story');
  updateStats();
  saveState();

  /* After stage 6 story, offer continuation text */
  if (STAGES[state.stage - 1].allowParaMode && state.storySentenceCount >= 6) {
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = '<div class="feed-index">Tip</div><div><em>Type a new topic or press "Next Section" to continue this story.</em></div>';
    feed.appendChild(item);

    const continueBtn = document.createElement('button');
    continueBtn.className = 'btn btn-ghost btn-sm';
    continueBtn.textContent = 'End Story';
    continueBtn.style.cssText = 'margin:8px 24px 0;width:auto;';
    continueBtn.addEventListener('click', () => {
      enterFlowMode();
      saveState();
      continueBtn.remove();
      item.remove();
    });
    feed.appendChild(continueBtn);
  }
});

btnReset.addEventListener('click', () => {
  modalOverlay.classList.remove('hidden');
});

modalCancel.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
});

modalConfirm.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEY);
  state = {
    sentenceIndex: 0,
    stage: 1,
    wordMap: {},
    lastFrame: null,
    mode: 'flow',
    storyTopic: '',
    storySentenceCount: 0
  };
  initWordMap();
  feed.innerHTML = '';
  modalOverlay.classList.add('hidden');
  enterFlowMode();
  updateStageUI();
  updateStats();

  /* Show welcome message */
  showWelcome();
});

modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay.classList.add('hidden');
});

themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  document.body.classList.toggle('light');
  localStorage.setItem('sfe_theme', document.body.classList.contains('dark') ? 'dark' : 'light');
});

/* ===================================================
   WELCOME / INIT
=================================================== */
function showWelcome() {
  const item = document.createElement('div');
  item.className = 'feed-item';
  item.style.fontStyle = 'italic';
  item.style.color = 'var(--text-2)';
  item.innerHTML = `
    <div class="feed-index">Welcome</div>
    <div>Press <strong>Next Sentence</strong> to begin your Spanish flow session. Start with Stage 1 and advance when ready.</div>
  `;
  feed.appendChild(item);
}

function restoreSession() {
  /* Re-render sentence count as static placeholder */
  if (state.sentenceIndex > 0) {
    const item = document.createElement('div');
    item.className = 'feed-item';
    item.innerHTML = `<div class="feed-index">Session restored</div><div style="color:var(--text-2);font-style:italic">${state.sentenceIndex} sentences generated. Continue where you left off.</div>`;
    feed.appendChild(item);
  } else {
    showWelcome();
  }

  if (state.mode === 'story' && state.storyTopic) {
    enterStoryMode();
  }
}

/* ===================================================
   BOOT
=================================================== */
(function init() {
  /* Theme */
  const savedTheme = localStorage.getItem('sfe_theme') || 'light';
  document.body.classList.remove('light','dark');
  document.body.classList.add(savedTheme);

  /* State */
  loadState();
  updateStageUI();
  updateStats();
  restoreSession();
})();
