import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowLeft, ArrowRight, BookOpen, BookmarkSimple, Check, CircleNotch, HandPointing, Leaf, MoonStars, SpeakerHigh, SpeakerSlash, Sparkle, Star, X } from '@phosphor-icons/react';
import { StoryWorld } from './scene';
import { AudioEngine } from './audio';
import { stories } from './stories';

type Phase = 'loading' | 'shelf' | 'opening' | 'reading' | 'reacting' | 'turning' | 'quiz' | 'celebrating' | 'reward' | 'closing' | 'error';
type State = { phase: Phase; selected: number; page: number; step: number; reacted: boolean };
type Panel = 'help' | 'collection' | null;
const initial: State = { phase: 'loading', selected: 0, page: 0, step: 0, reacted: false };
const storageKey = 'komorebi-treasures-v1';
function readTreasures(): string[] {
  try { const value: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && stories.some(story => story.id === id)) : []; } catch { return []; }
}

function CursorTrail() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce), (pointer: coarse)').matches) return;
    let last = 0;
    const sparks = new Set<HTMLElement>();
    const move = (event: PointerEvent) => {
      if (performance.now() - last < 52) return;
      last = performance.now();
      const spark = document.createElement('i');
      spark.className = 'cursor-spark';
      spark.style.left = `${event.clientX}px`;
      spark.style.top = `${event.clientY}px`;
      document.body.appendChild(spark);
      sparks.add(spark);
      spark.addEventListener('animationend', () => { spark.remove(); sparks.delete(spark); }, { once: true });
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => { window.removeEventListener('pointermove', move); sparks.forEach(spark => spark.remove()); };
  }, []);
  return null;
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className="paper-dialog" aria-labelledby="dialog-title" onCancel={onClose} onClick={event => { if (event.target === ref.current) onClose(); }}>
    <div className="dialog-content">
      <button className="icon-button dialog-close" aria-label="关闭" onClick={onClose}><X size={21} /></button>
      <span className="eyebrow"><Leaf size={15} /> 林间绘本馆</span>
      <h2 id="dialog-title">{title}</h2>
      {children}
    </div>
  </dialog>;
}

export default function App() {
  const [state, setState] = useState<State>(initial);
  const stateRef = useRef(state);
  const stageRef = useRef<HTMLDivElement>(null);
  const stageShellRef = useRef<HTMLDivElement>(null);
  const layoutAnimationRef = useRef<Animation | null>(null);
  const shelfScrollRef = useRef(0);
  const shelfFocusRef = useRef<number | null>(null);
  const [immersive, setImmersive] = useState(false);
  const worldRef = useRef<StoryWorld | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);
  const operationRef = useRef(0);
  const [panel, setPanel] = useState<Panel>(null);
  const panelRef = useRef<Panel>(null);
  const [treasures, setTreasures] = useState(readTreasures);
  const [quizChoice, setQuizChoice] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [storageNotice, setStorageNotice] = useState(false);
  const [retry, setRetry] = useState(0);
  const actions = useRef({ select: (_index: number) => {}, interact: () => {} });
  const story = stories[state.selected];
  const scene = story.scenes[state.page];
  const action = scene.actions[Math.min(state.step, scene.actions.length - 1)];
  const narrative = state.step ? scene.actions[state.step - 1].after : scene.text;
  const isShelf = state.phase === 'shelf' || state.phase === 'loading' || (state.phase === 'closing' && !immersive);
  const isBusy = ['loading', 'opening', 'reacting', 'turning', 'celebrating', 'closing'].includes(state.phase);
  const correct = quizChoice === story.quiz.answer;

  function transition(patch: Partial<State>) {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    setState(next);
  }
  async function startAudio() { try { await audioRef.current?.start(); } catch { /* Sound never blocks reading. */ } }
  async function resizeStage(from: DOMRect | undefined) {
    const element = stageShellRef.current;
    if (!element || !from) return;
    const to = element.getBoundingClientRect();
    const marginLeft = getComputedStyle(element).marginLeft;
    element.classList.add('stage-resizing');
    // Animate real dimensions so WebGL keeps its proportions throughout the move.
    const animation = element.animate([
      { width: `${from.width}px`, height: `${from.height}px`, marginLeft, marginRight: '0px', maxWidth: 'none', transform: `translate(${from.left - to.left}px, ${from.top - to.top}px)` },
      { width: `${to.width}px`, height: `${to.height}px`, marginLeft, marginRight: '0px', maxWidth: 'none', transform: 'translate(0, 0)' },
    ], { duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 540, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    layoutAnimationRef.current = animation;
    try { await animation.finished; } catch { /* A retry or unmount cancels the old transition. */ }
    if (layoutAnimationRef.current === animation) {
      layoutAnimationRef.current = null;
      element.classList.remove('stage-resizing');
    }
  }
  function retryWorld() {
    layoutAnimationRef.current?.cancel();
    worldRef.current?.setImmersive(false);
    setImmersive(false);
    transition({ ...initial });
    setRetry(value => value + 1);
  }
  function fail(reason: unknown) {
    operationRef.current += 1;
    console.error(reason);
    setError('绘本没能顺利打开，请再试一次。');
    transition({ phase: 'error' });
  }
  async function select(index: number) {
    if (stateRef.current.phase !== 'shelf' || panelRef.current) return;
    const world = worldRef.current;
    if (!world) return;
    const operation = ++operationRef.current;
    const from = stageShellRef.current?.getBoundingClientRect();
    shelfScrollRef.current = window.scrollY;
    world.setImmersive(true);
    void startAudio();
    audioRef.current?.click();
    flushSync(() => {
      transition({ phase: 'opening', selected: index, page: 0, step: 0, reacted: false });
      setQuizChoice(null);
      setImmersive(true);
    });
    try {
      await resizeStage(from);
      if (operation !== operationRef.current) return;
      await world.openBook(index);
      if (operation === operationRef.current) transition({ phase: 'reading' });
    } catch (reason) { if (operation === operationRef.current) fail(reason); }
  }
  async function interact() {
    const current = stateRef.current;
    if (current.phase !== 'reading' || current.reacted || panelRef.current) return;
    const world = worldRef.current;
    if (!world) return;
    const operation = ++operationRef.current;
    transition({ phase: 'reacting' });
    if (current.selected === 2 && (current.page === 0 || current.page === 3)) audioRef.current?.storyBell(current.page === 0);
    else audioRef.current?.click();
    try {
      await world.react(current.step);
      if (operation !== operationRef.current) return;
      const step = current.step + 1;
      transition({ phase: 'reading', step, reacted: step === stories[current.selected].scenes[current.page].actions.length });
    } catch (reason) { if (operation === operationRef.current) fail(reason); }
  }
  async function next() {
    const current = stateRef.current;
    if (current.phase !== 'reading' || !current.reacted || panelRef.current) return;
    audioRef.current?.paper();
    if (current.page === 3) { transition({ phase: 'quiz' }); return; }
    const world = worldRef.current;
    if (!world) return;
    const operation = ++operationRef.current;
    transition({ phase: 'turning' });
    try { await world.turnPage(current.page + 1); if (operation === operationRef.current) transition({ phase: 'reading', page: current.page + 1, step: 0, reacted: false }); } catch (reason) { if (operation === operationRef.current) fail(reason); }
  }
  async function back() {
    if (!['reading', 'quiz', 'reward', 'error'].includes(stateRef.current.phase) || panelRef.current) return;
    const world = worldRef.current;
    if (!world) return;
    const operation = ++operationRef.current;
    const selected = stateRef.current.selected;
    transition({ phase: 'closing' });
    audioRef.current?.paper();
    try {
      await world.closeBook();
      if (operation !== operationRef.current) return;
      const from = stageShellRef.current?.getBoundingClientRect();
      flushSync(() => setImmersive(false));
      window.scrollTo({ top: shelfScrollRef.current, behavior: 'instant' });
      await resizeStage(from);
      if (operation !== operationRef.current) return;
      world.setImmersive(false);
      shelfFocusRef.current = selected;
      transition({ phase: 'shelf', page: 0, step: 0, reacted: false });
      setQuizChoice(null);
    } catch (reason) { if (operation === operationRef.current) fail(reason); }
  }
  function answer(index: number) {
    if (stateRef.current.phase !== 'quiz' || correct) return;
    audioRef.current?.click();
    setQuizChoice(index);
  }
  async function collect() {
    if (stateRef.current.phase !== 'quiz') return;
    const world = worldRef.current;
    if (!world) return;
    const operation = ++operationRef.current;
    transition({ phase: 'celebrating' });
    audioRef.current?.sparkle();
    try {
      await world.celebrate();
      if (operation !== operationRef.current) return;
      const nextTreasures = Array.from(new Set([...treasures, story.id]));
      setTreasures(nextTreasures);
      try { localStorage.setItem(storageKey, JSON.stringify(nextTreasures)); } catch { setStorageNotice(true); }
      transition({ phase: 'reward' });
    } catch (reason) { if (operation === operationRef.current) fail(reason); }
  }
  function openPanel(nextPanel: Panel) { panelRef.current = nextPanel; setPanel(nextPanel); void startAudio(); audioRef.current?.click(); }
  function toggleSound() { const value = !mutedRef.current; mutedRef.current = value; setMuted(value); audioRef.current?.setMuted(value); void startAudio(); }
  actions.current = { select: index => void select(index), interact: () => void interact() };

  useLayoutEffect(() => {
    document.documentElement.classList.toggle('reading-active', immersive);
    return () => document.documentElement.classList.remove('reading-active');
  }, [immersive]);

  useEffect(() => {
    let active = true;
    const audio = new AudioEngine();
    audio.setMuted(mutedRef.current);
    audioRef.current = audio;
    let world: StoryWorld | null = null;
    void document.fonts.ready.then(() => {
      if (!active || !stageRef.current) return;
      try {
        world = new StoryWorld(stageRef.current, {
          onSelect: index => actions.current.select(index),
          onInteract: () => actions.current.interact(),
          onReady: () => { if (active) transition({ phase: 'shelf' }); },
          onError: message => { if (active) { operationRef.current += 1; setError(message); transition({ phase: 'error' }); } },
        });
        worldRef.current = world;
        if (import.meta.env.DEV) {
          (window as unknown as { __BOOKS_DEBUG__: unknown }).__BOOKS_DEBUG__ = { getState: () => stateRef.current, world };
        }
      } catch { if (active) { setError('当前浏览器无法显示立体绘本。请启用 WebGL 后再试一次。'); transition({ phase: 'error' }); } }
    });
    return () => { active = false; operationRef.current += 1; layoutAnimationRef.current?.cancel(); world?.dispose(); audio.dispose(); worldRef.current = null; };
  }, [retry]);
  useEffect(() => { worldRef.current?.setInteractive(!panel && state.phase === 'reading' && !state.reacted, state.step); }, [panel, state]);

  useEffect(() => {
    if (!panel && state.phase === 'shelf' && shelfFocusRef.current !== null) {
      // The shelf choices must be enabled by React before focus can be restored.
      document.querySelector<HTMLButtonElement>(`[data-book="${shelfFocusRef.current}"]`)?.focus({ preventScroll: true });
      shelfFocusRef.current = null;
      return;
    }
    if (panel || !['reading', 'quiz', 'reward'].includes(state.phase)) return;
    const selector = state.phase === 'reading' ? `[data-testid="${state.reacted ? 'next-page' : 'interact'}"]` : state.phase === 'quiz' ? '.quiz-option' : '.reward-panel .primary-button';
    const frame = requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(selector)?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [state, panel]);

  return <div className="app" data-phase={state.phase}>
    <CursorTrail />
    <a href={isShelf ? "#book-selection" : "#story-controls"} className="skip-link">{isShelf ? "选择绘本" : "跳到故事操作"}</a>
    <header className="site-header" hidden={immersive}>
      <button className="brand" aria-label="林间绘本馆书架" disabled={isBusy || isShelf} onClick={() => void back()}>
        <span className="brand-icon"><BookOpen size={29} weight="duotone" /><span /></span>
        <span className="brand-name">林间绘本馆<span className="brand-sub">翻开一页，走进一个世界。</span></span>
      </button>
      <nav className="main-nav" aria-label="主菜单">
        <button className={isShelf ? 'nav-button active' : 'nav-button'} disabled={isBusy} aria-current={isShelf ? 'page' : undefined} onClick={() => { if (!isShelf) void back(); }}>书架</button>
        <button className="nav-button" onClick={() => openPanel('help')}>怎么玩</button>
      </nav>
      <div className="header-actions">
        <button className="collection-button" onClick={() => openPanel('collection')} aria-label={`我的收藏 ${treasures.length} / ${stories.length}`}><Star size={19} weight={treasures.length ? 'fill' : 'regular'} /><span>我的收藏</span><span className="collection-count">{treasures.length}</span></button>
        <span className="header-divider" />
        <button className="sound-button" aria-label={muted ? '开启声音' : '关闭声音'} aria-pressed={!muted} onClick={toggleSound}>{muted ? <SpeakerSlash size={20} /> : <SpeakerHigh size={20} />}<span>声音 {muted ? '关' : '开'}</span></button>
      </div>
    </header>

    <main>
      <section className={`reading-room ${isShelf ? 'shelf-mode' : 'story-mode'}${immersive ? ' is-immersive' : ''}`} aria-label="立体绘本小屋">
        <div className="intro" hidden={immersive}>
          <div className="intro-kicker"><span />{isShelf ? '会跃出纸页的小小图书馆' : story.tag}<span /></div>
          <h1>{isShelf ? <>翻开书，<span className="accent-word">奇遇开始。<svg viewBox="0 0 290 12" aria-hidden="true"><path d="M4 7Q135-2 286 5" /></svg></span></> : story.title}</h1>
          <p>{isShelf ? '书页的另一边，有个世界正等着你。' : state.phase === 'reward' ? story.keepsake : '轻轻一点，陪朋友试试办法。'}</p>
        </div>

        <div ref={stageShellRef} className="stage-shell">
          <div className="stage-topline">
            {isShelf ? <span className="shelf-label"><span className="little-dot" /> 今日书架 <span className="shelf-total">{stories.length} 本</span></span> : <button className="back-button" aria-label="返回书架" disabled={isBusy} onClick={() => void back()}><ArrowLeft size={17} /> 返回书架</button>}
            {!isShelf && <span className="reader-title" role="heading" aria-level={1}>{story.title}</span>}
            {isShelf ? <span className="stage-aside"><Leaf size={14} /> 今天，想去哪里冒险？</span> : <div className="reader-tools"><div className="page-indicator" aria-label={`第 ${state.page + 1} 页，共 4 页`}><span>{String(state.page + 1).padStart(2, '0')}</span><div className="page-dots">{story.scenes.map((_, index) => <i key={index} className={index <= state.page ? 'filled' : ''} />)}</div><span>04</span></div><button className="sound-button" aria-label={muted ? '开启声音' : '关闭声音'} aria-pressed={!muted} onClick={toggleSound}>{muted ? <SpeakerSlash size={20} /> : <SpeakerHigh size={20} />}<span>声音 {muted ? '关' : '开'}</span></button></div>}
          </div>
          <div ref={stageRef} className="three-stage" role="img" aria-label={isShelf ? `木书架上摆着 ${stories.length} 本动物朋友的绘本，也可以点击下方书名选择。` : `${story.title}。${narrative} 也可以使用下方按钮参与故事。`} />
          {(state.phase === 'loading' || state.phase === 'error') && <div className="stage-loading" role="status">
            <BookOpen size={38} weight="duotone" />
            <p>{state.phase === 'loading' ? '正在准备故事…' : error}</p>
            {state.phase === 'loading' ? <span className="loading-line" /> : <button className="primary-button" onClick={retryWorld}>再试一次 <ArrowRight size={17} /></button>}
          </div>}
          {isBusy && state.phase !== 'loading' && <div className="transition-label" role="status"><CircleNotch size={15} className="spin" />{state.phase === 'opening' ? '正在打开绘本…' : state.phase === 'turning' ? '正在翻页…' : state.phase === 'closing' ? '正在放回书架…' : state.phase === 'celebrating' ? '一份小小的礼物，送给你。' : '看看会发生什么吧…'}</div>}
        </div>

        {isShelf ? <div className="shelf-content" id="book-selection">
          <div className="book-selection">{stories.map((book, index) => <button key={book.id} data-book={index} className="book-choice" aria-label={`打开${book.title}`} disabled={isBusy} onClick={() => void select(index)}>
            <span className={`book-theme theme-${book.theme}`}>{book.tag}</span>
            <span className="book-title">{book.title}<ArrowRight size={17} /></span>
            <span className="book-meta">{book.duration}<span>·</span> 4 个场景 {treasures.includes(book.id) && <Check size={14} aria-label="已读" />}</span>
          </button>)}</div>
          <p className="selection-hint"><HandPointing size={19} /> 选一本喜欢的绘本，开始冒险吧。</p>
        </div> : <div className="story-content" id="story-controls" aria-live="polite" aria-atomic="true">
          {['opening', 'reading', 'reacting', 'turning', 'closing'].includes(state.phase) && <div className="narrative">
            <div className="narrative-copy"><span className="chapter-label">{String(state.page + 1).padStart(2, '0')} <span /> {scene.title}</span><p>{narrative}</p></div>
            <div className="narrative-action">{state.reacted ? <button data-testid="next-page" className="primary-button" disabled={isBusy} onClick={() => void next()}>{state.page === 3 ? '收下这段小回忆' : '翻到下一页'}<ArrowRight size={18} /></button> : <><button data-testid="interact" className="interaction-button" disabled={isBusy} onClick={() => void interact()}><HandPointing size={19} />{action.label}</button><span className="action-hint">{action.hint}</span></>}</div>
          </div>}
          {state.phase === 'quiz' && <div className="quiz-panel"><span className="chapter-label"><Sparkle size={16} /> 一起想想这个故事</span><h2>{story.quiz.question}</h2><div className="quiz-options">{story.quiz.options.map((option, index) => <button key={option} disabled={correct} aria-pressed={quizChoice === index} className={`quiz-option ${quizChoice === index ? correct ? 'is-correct' : 'is-wrong' : ''}`} onClick={() => answer(index)}>{quizChoice === index && correct && <Check size={17} />}{option}</button>)}</div><div className="quiz-feedback"><p>{quizChoice === null ? '可以选一选，也可以直接收下故事书签。' : correct ? <>你发现了！{story.quiz.explanation}</> : story.quiz.hint}</p><button data-testid="collect-reward" className="primary-button" onClick={() => void collect()}>收下故事书签 <BookmarkSimple size={17} /></button></div></div>}
          {(state.phase === 'reward' || state.phase === 'celebrating') && <div className="reward-panel"><span className="reward-emblem"><Star size={30} weight="duotone" /></span><div><span className="chapter-label">这段故事的小纪念</span><h2>{state.phase === 'celebrating' ? `正在收好「${story.reward}」…` : `收集到了「${story.reward}」！`}</h2><p>{story.keepsake}</p>{state.phase === 'reward' && <p>{storageNotice ? '浏览器暂时无法保存，收藏只在本次打开期间保留。' : '已经放进“我的收藏”，替你好好保管啦。'}</p>}</div><button className="primary-button" disabled={isBusy} onClick={() => void back()}>返回书架 <ArrowRight size={18} /></button></div>}
        </div>}
      </section>

      <section className="experience-note" aria-label="绘本玩法" hidden={immersive}>
        <div className="note-heading"><span className="note-symbol"><Sparkle size={23} weight="duotone" /></span><div><h2>小小的触碰，大大的冒险。</h2><p>不用着急，按自己的节奏来。</p></div></div>
        <div className="journey-steps"><div><BookOpen size={23} /><span>打开绘本</span></div><span className="step-line" /><div><HandPointing size={23} /><span>轻触，发现惊喜</span></div><span className="step-line" /><div><Star size={23} /><span>收集故事礼物</span></div></div>
      </section>
    </main>
    <footer className="site-footer" hidden={immersive}><span>© 2026 林间绘本馆</span><span><span className="little-dot" /> 让一个温柔的故事，住进心里。</span><button onClick={() => openPanel('help')}>关于绘本馆 <ArrowRight size={13} /></button></footer>

    {panel === 'help' && <Modal title="欢迎来到绘本世界。" onClose={() => openPanel(null)}><p className="dialog-intro">这是一座轻轻触碰，故事就会跃出纸页的小小图书馆。</p><ol className="help-steps"><li><BookOpen size={25} /><div><h3>打开一本喜欢的绘本</h3><p>点击书架上的绘本，或下方的书名。</p></div></li><li><HandPointing size={25} /><div><h3>陪朋友发现线索、试试办法</h3><p>跟着提示轻触画面，也可以使用下方的按钮。不用着急，每一步都由你决定。</p></div></li><li><Star size={25} /><div><h3>收好这段故事的小纪念</h3><p>读完就能收下书签。最后的问题可以选一选，也可以和身边的人聊聊；不用答对才拿礼物。收藏会保存在当前浏览器中。</p></div></li></ol><p className="quiet-note"><SpeakerHigh size={19} /> 第一次操作后，会响起轻柔的音乐。点击右上角的声音按钮，随时可以静音。</p><button className="primary-button full-width" onClick={() => openPanel(null)}>开始冒险吧 <ArrowRight size={18} /></button></Modal>}
    {panel === 'collection' && <Modal title="我的故事收藏。" onClose={() => openPanel(null)}><p className="dialog-intro">把故事里遇见的温柔，好好收藏。 <strong>{treasures.length} / {stories.length}</strong></p><div className="treasure-list">{stories.map(book => { const owned = treasures.includes(book.id); return <div key={book.id} className={`treasure-item ${owned ? 'owned' : ''}`}><span className={`treasure-icon theme-${book.theme}`}>{owned ? <Star size={29} weight="duotone" /> : <BookmarkSimple size={26} />}</span><div><h3>{owned ? book.reward : '还有一份礼物，等你发现'}</h3><p>{book.title}</p></div>{owned && <Check size={18} />}</div>; })}</div><p className="quiet-note"><MoonStars size={19} /> {treasures.length ? '下次再来，这些礼物还会在这里。' : '读完一本绘本，就能收集一份礼物。'}</p><button className="primary-button full-width" onClick={() => openPanel(null)}>返回绘本 <ArrowRight size={18} /></button></Modal>}
  </div>;
}
