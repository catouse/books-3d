import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type Callbacks = {
  onSelect: (index: number) => void;
  onInteract: () => void;
  onReady: () => void;
  onError: (message: string) => void;
};
type Mode = 'shelf' | 'opening' | 'story' | 'turning' | 'closing' | 'celebrating';
type AnimatedItem = { object: THREE.Object3D; scale: THREE.Vector3; delay: number };
type Tween = { start: number; duration: number; update: (t: number) => void; done: () => void };
const COLORS = ['#a7bfaa', '#9dbbc8', '#e6b19a'];
const TITLES = [['迷路的', '小星星'], ['鲸鱼与', '海的彼岸'], ['云端的', '失物']];
const INK = '#34483c';
const ease = (x: number) => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
const clamp = THREE.MathUtils.clamp;

/** One persistent WebGL room: shelf → desk → pop-up story → shelf. */
export class StoryWorld {
  private readonly container: HTMLElement;
  private readonly callbacks: Callbacks;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.OrthographicCamera(-7, 7, 3.5, -3.5, .1, 100);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly target = new THREE.Vector3(0, 1.94, -.8);
  private readonly shelf = new THREE.Group();
  private readonly decor = new THREE.Group();
  private readonly popup = new THREE.Group();
  private readonly particles = new THREE.Group();
  private readonly books: THREE.Group[] = [];
  private readonly covers: THREE.Group[] = [];
  private readonly leftPages: THREE.Group[] = [];
  private readonly bookHome: { position: THREE.Vector3; rotation: THREE.Euler }[] = [];
  private readonly interactiveObjects: THREE.Object3D[] = [];
  private readonly tweens: Tween[] = [];
  private readonly popupItems: AnimatedItem[] = [];
  private readonly storyProps = new Map<string, THREE.Object3D>();
  private readonly backdropMaterials = new Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
  private readonly materials = new Set<THREE.Material>();
  private readonly textures = new Set<THREE.Texture>();
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly observer: ResizeObserver;
  private frame = 0;
  private disposed = false;
  private width = 1;
  private height = 1;
  private viewWidth = 13.8;
  private cameraElevation = 6.8;
  private minimumViewHeight = 6.28;
  private immersive = false;
  private shelfLayoutNarrow = false;
  private shelfViewWidth = 13.8;
  private storyFramingMix = 0;
  private storyBackdropOpacity = .18;
  private safeTopInset = 0;
  private safeBottomInset = 0;
  private selected = 0;
  private currentPage = 0;
  private mode: Mode = 'shelf';
  private interactive = false;
  private locked = false;
  private hero: THREE.Group | null = null;
  private star: THREE.Group | null = null;
  private hover: THREE.Object3D | null = null;
  private down: { x: number; y: number } | null = null;
  private starBaseY = 1.1;
  private paperTexture: THREE.CanvasTexture;

  constructor(container: HTMLElement, callbacks: Callbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.paperTexture = this.createPaperTexture();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;outline:none;';
    this.renderer.domElement.setAttribute('aria-label', '立体绘本。点击想读的书，或触碰故事中的角色。');
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.addEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.addEventListener('pointerleave', this.onPointerLeave);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    container.appendChild(this.renderer.domElement);
    this.scene.fog = new THREE.Fog('#f4f0e5', 27, 65);
    this.makeRoom();
    this.makeBooks();
    this.scene.add(this.popup, this.particles);
    this.makeFireflies();
    this.observer = new ResizeObserver(this.resize);
    this.observer.observe(container);
    this.resize();
    this.frame = requestAnimationFrame(this.animate);
    // Everything is generated locally; compile all initial materials before exposing the shelf.
    this.renderer.compile(this.scene, this.camera);
    requestAnimationFrame(() => { if (!this.disposed) this.callbacks.onReady(); });
  }

  private material(color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: .83, metalness: 0, ...extra });
    this.materials.add(mat);
    return mat;
  }

  private mesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent?: THREE.Object3D) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent?.add(mesh);
    return mesh;
  }

  private round(w: number, h: number, d: number, r: number, material: THREE.Material, parent?: THREE.Object3D) {
    return this.mesh(new RoundedBoxGeometry(w, h, d, 3, r), material, parent);
  }

  private ball(x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material, parent: THREE.Object3D) {
    const mesh = this.mesh(new THREE.SphereGeometry(1, 28, 20), material, parent);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    return mesh;
  }

  private createPaperTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fffdf4'; ctx.fillRect(0, 0, 256, 256);
    let seed = 42;
    for (let i = 0; i < 15000; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const x = seed % 256;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const y = seed % 256;
      ctx.fillStyle = i % 2 ? 'rgba(98,83,50,.034)' : 'rgba(255,255,255,.15)';
      ctx.fillRect(x, y, 1, 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    this.textures.add(texture);
    return texture;
  }

  private makeRoom() {
    const ambient = new THREE.AmbientLight('#fffbeb', .80);
    const hemi = new THREE.HemisphereLight('#fff8e8', '#b3b5a0', 1.45);
    const sun = new THREE.DirectionalLight('#fff4d7', 2.35);
    sun.position.set(-4, 10, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -10; sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -6;
    sun.shadow.normalBias = .055;
    sun.shadow.bias = -.0004;
    sun.shadow.radius = 5;
    const fill = new THREE.DirectionalLight('#d8e9e5', .8);
    fill.position.set(6, 5, -2);
    this.scene.add(ambient, hemi, sun, fill);

    const wood = this.material('#dcc8a6', { roughness: .91 });
    const woodEdge = this.material('#bda987');
    const table = this.round(15, .29, 6.8, .14, this.material('#dcc9a9'), this.scene);
    table.position.set(0, -.45, 2.4);
    const tableRim = this.round(15, .055, 6.77, .025, this.material('#cdbb9b'), this.scene);
    tableRim.position.set(0, -.57, 2.4);
    // Delicate elongated wood-grain marks remain quiet behind the pop-up theatre.
    const grain = this.material('#bcaa8c', { transparent: true, opacity: .12 });
    for (let i = 0; i < 15; i++) {
      const line = this.round(3 + (i % 4), .004, .008, .002, grain, this.scene);
      line.position.set(Math.sin(i * 5) * 3.5, -.301, -.2 + i * .43);
    }
    const board = this.round(12.4, .22, 1.7, .08, wood, this.shelf);
    board.position.set(0, 1.01, -2.35);
    const edge = this.round(12.3, .055, .085, .025, woodEdge, this.shelf);
    edge.position.set(0, .982, -1.51);
    for (const x of [-4.5, 4.5]) {
      const bracket = this.round(.14, .62, .7, .05, wood, this.shelf);
      bracket.position.set(x, .65, -2.7);
    }
    this.shelf.position.y = -.75; this.decor.position.y = -.75;
    this.scene.add(this.shelf, this.decor);
    this.makePlant(this.decor, -5.55, 1.12, -2.2);
    this.makeLamp(this.decor, 5.42, 1.12, -2.25);
    this.makeMushroom(this.decor, -4.85, 1.12, -1.97, .46);
    const pebbleMat = this.material('#e0dbc5');
    this.ball(4.8, 1.23, -1.88, .28, .12, .21, pebbleMat, this.decor);
    this.ball(5, 1.25, -1.7, .19, .1, .14, this.material('#c6cdb2'), this.decor);
  }

  private makePlant(parent: THREE.Object3D, x: number, y: number, z: number) {
    const group = new THREE.Group(); parent.add(group); group.position.set(x, y, z);
    const pot = this.mesh(new THREE.CylinderGeometry(.32, .25, .45, 32), this.material('#d8a58b'), group);
    pot.position.y = .225;
    const rim = this.mesh(new THREE.TorusGeometry(.303, .041, 8, 32), this.material('#dcb39a'), group);
    rim.rotation.x = Math.PI / 2; rim.position.y = .43;
    const soil = this.mesh(new THREE.CircleGeometry(.277, 24), this.material('#79614b'), group);
    soil.rotation.x = -Math.PI / 2; soil.position.y = .435;
    const stemMat = this.material('#71846c');
    for (let i = 0; i < 7; i++) {
      const angle = i * 2.399;
      const leaf = this.ball(Math.cos(angle) * .22, .63 + (i % 3) * .24, Math.sin(angle) * .2, .14, .42, .055,
        this.material(i % 2 ? '#8da17e' : '#a8b392'), group);
      leaf.rotation.set(Math.sin(angle) * .5, angle, -Math.cos(angle) * .5);
      const stem = this.mesh(new THREE.CylinderGeometry(.016, .018, .65, 8), stemMat, group);
      stem.position.set(Math.cos(angle) * .085, .65, Math.sin(angle) * .085);
      stem.rotation.z = -Math.cos(angle) * .25;
    }
  }

  private makeLamp(parent: THREE.Object3D, x: number, y: number, z: number) {
    const group = new THREE.Group(); parent.add(group); group.position.set(x, y, z);
    const brass = this.material('#bca176', { roughness: .65 });
    const base = this.mesh(new THREE.CylinderGeometry(.4, .45, .09, 40), brass, group); base.position.y = .045;
    const stem = this.mesh(new THREE.CylinderGeometry(.042, .045, 1.18, 16), brass, group); stem.position.y = .62;
    const shade = this.mesh(new THREE.CylinderGeometry(.33, .65, .65, 40, 1, false),
      this.material('#eed8a4', { emissive: '#f7cb73', emissiveIntensity: .18, side: THREE.DoubleSide }), group);
    shade.position.y = 1.34;
    const trim = this.mesh(new THREE.TorusGeometry(.636, .028, 8, 40), brass, group);
    trim.rotation.x = Math.PI / 2; trim.position.y = 1.015;
    const light = new THREE.PointLight('#ffcf79', 3, 5, 2); light.position.y = 1.15; group.add(light);
  }

  private coverTexture(index: number) {
    const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 1000;
    const c = canvas.getContext('2d')!;
    c.fillStyle = COLORS[index]; c.fillRect(0, 0, 768, 1000);
    const ellipse = (x: number, y: number, rx: number, ry: number, color: string, angle = 0) => {
      c.fillStyle = color; c.beginPath(); c.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2); c.fill();
    };
    const star = (x: number, y: number, r: number, color: string, rotation = 0) => {
      c.fillStyle = color; c.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = rotation + i * Math.PI / 5 - Math.PI / 2;
        const radius = i % 2 ? r * .47 : r;
        const px = x + Math.cos(a) * radius; const py = y + Math.sin(a) * radius;
        i ? c.lineTo(px, py) : c.moveTo(px, py);
      }
      c.closePath(); c.fill();
    };
    // The front artwork is a final, hand-composed illustration, rendered at book-print resolution.
    c.strokeStyle = 'rgba(250,249,223,.50)'; c.lineWidth = 2; c.strokeRect(32, 32, 704, 936);
    c.strokeStyle = 'rgba(58,78,58,.16)'; c.lineWidth = 2; c.beginPath(); c.moveTo(23, 0); c.lineTo(23, 1000); c.stroke();
    c.fillStyle = index === 1 ? '#f5f2df' : INK;
    c.textAlign = 'center';
    c.font = '500 61px "Songti SC", "STSong", "SimSun", serif';
    c.fillText(TITLES[index][0], 388, 155);
    c.font = '500 77px "Songti SC", "STSong", "SimSun", serif';
    c.fillText(TITLES[index][1], 388, 252);
    if (index === 0) {
      ellipse(393, 804, 306, 186, '#87a88e');
      ellipse(275, 848, 297, 133, '#74957c');
      ellipse(580, 882, 257, 167, '#8aaa84');
      for (const [x, y, size] of [[106, 670, 105], [663, 631, 113], [79, 458, 70], [647, 790, 94]]) {
        c.fillStyle = '#6e927c'; c.fillRect(x - 7, y, 14, size * 1.4);
        ellipse(x, y, size * .48, size, '#bed1a2');
        c.strokeStyle = '#9db78e'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, y - size * .7); c.lineTo(x, y + size * .8); c.stroke();
      }
      ellipse(355, 728, 92, 112, '#f3eee0');
      ellipse(348, 600, 104, 92, '#fff9e9');
      ellipse(304, 474, 27, 93, '#fff9e9', -.17); ellipse(379, 466, 27, 98, '#fff9e9', .12);
      ellipse(306, 477, 12, 69, '#e1b6a3', -.17); ellipse(380, 469, 12, 71, '#e1b6a3', .12);
      ellipse(315, 597, 8, 11, '#3e483c'); ellipse(382, 596, 8, 11, '#3e483c');
      ellipse(294, 622, 18, 9, '#edc1ad'); ellipse(404, 620, 18, 9, '#edc1ad');
      ellipse(350, 617, 7, 5, '#bc9589');
      c.strokeStyle = '#8d8873'; c.lineWidth = 3; c.beginPath(); c.arc(350, 621, 10, .2, Math.PI - .2); c.stroke();
      ellipse(286, 735, 29, 52, '#fff9e9', -.48); ellipse(436, 700, 28, 58, '#fff9e9', -.77);
      ellipse(319, 825, 36, 23, '#fff9e9'); ellipse(398, 825, 36, 23, '#fff9e9');
      star(491, 593, 62, '#ffe7a1', .18); ellipse(477, 591, 4, 5, '#a78745'); ellipse(506, 591, 4, 5, '#a78745');
      for (const [x, y] of [[537, 389], [149, 333], [590, 511], [224, 410]]) star(x, y, 11, '#f6ecc0');
      for (const [x, y] of [[193, 860], [574, 839], [517, 898]]) {
        c.fillStyle = '#efe1b7'; c.fillRect(x - 5, y, 10, 33);
        c.fillStyle = '#c57f69'; c.beginPath(); c.ellipse(x, y, 26, 20, 0, Math.PI, Math.PI * 2); c.fill();
        ellipse(x - 9, y - 7, 4, 3, '#f9e4ce'); ellipse(x + 9, y - 8, 4, 3, '#f9e4ce');
      }
    } else if (index === 1) {
      for (let j = 0; j < 4; j++) {
        c.fillStyle = ['#82aaba', '#739eaf', '#608e9e', '#578696'][j]; c.beginPath(); c.moveTo(0, 730 + j * 60);
        for (let x = 0; x <= 768; x += 12) c.lineTo(x, 716 + j * 65 + Math.sin(x / 120 + j) * 24);
        c.lineTo(768, 1000); c.lineTo(0, 1000); c.fill();
      }
      ellipse(375, 637, 213, 126, '#456c81', -.08); ellipse(345, 685, 165, 65, '#cddfe0', -.04);
      c.fillStyle = '#456c81'; c.beginPath(); c.moveTo(529, 654); c.bezierCurveTo(602, 608, 614, 537, 686, 540); c.bezierCurveTo(699, 597, 655, 665, 582, 686); c.fill();
      c.beginPath(); c.moveTo(607, 591); c.bezierCurveTo(614, 524, 579, 481, 555, 516); c.bezierCurveTo(549, 552, 579, 596, 607, 608); c.fill();
      ellipse(344, 697, 38, 62, '#608a9b', -.62); ellipse(245, 632, 10, 13, '#263f4e'); ellipse(250, 627, 3, 4, '#fff9e9');
      ellipse(240, 661, 25, 12, '#ceacab');
      c.strokeStyle = '#263f4e'; c.lineWidth = 4; c.beginPath(); c.arc(227, 656, 22, .2, Math.PI * .65); c.stroke();
      c.strokeStyle = '#e5eee4'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(354, 505); c.bezierCurveTo(356, 465, 343, 410, 307, 427); c.moveTo(354, 480); c.bezierCurveTo(375, 443, 393, 447, 408, 459); c.stroke();
      for (const [x, y, r] of [[165, 451, 13], [569, 366, 18], [126, 819, 10], [564, 815, 10], [616, 739, 7]]) {
        c.strokeStyle = 'rgba(241,249,241,.6)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
      }
      star(572, 437, 35, '#eee0ab', .25);
    } else {
      ellipse(631, 436, 84, 84, '#f0d09b');
      for (const [x, y, s] of [[146, 465, 1], [627, 641, .9], [216, 778, 1.3], [422, 859, 1.4]]) {
        ellipse(x, y, 81 * s, 28 * s, '#f7e5d2'); ellipse(x - 28 * s, y - 19 * s, 30 * s, 31 * s, '#f7e5d2'); ellipse(x + 19 * s, y - 25 * s, 41 * s, 40 * s, '#f7e5d2');
      }
      ellipse(395, 720, 71, 95, '#ba754e');
      c.fillStyle = '#ba754e'; c.beginPath(); c.moveTo(483, 783); c.bezierCurveTo(623, 760, 547, 613, 529, 662); c.bezierCurveTo(500, 697, 456, 722, 450, 766); c.fill();
      c.fillStyle = '#f8e8cf'; c.beginPath(); c.moveTo(529, 662); c.bezierCurveTo(548, 643, 568, 690, 555, 725); c.lineTo(520, 702); c.fill();
      c.fillStyle = '#c5855d'; c.beginPath(); c.moveTo(290, 629); c.lineTo(301, 481); c.lineTo(366, 549); c.lineTo(438, 549); c.lineTo(494, 482); c.lineTo(504, 629); c.closePath(); c.fill();
      ellipse(397, 613, 109, 94, '#c5855d');
      ellipse(348, 645, 54, 44, '#f7e7cf', .38); ellipse(447, 645, 54, 44, '#f7e7cf', -.38);
      c.fillStyle = '#e4b5a0'; c.beginPath(); c.moveTo(308, 511); c.lineTo(317, 570); c.lineTo(348, 554); c.fill(); c.beginPath(); c.moveTo(482, 515); c.lineTo(447, 554); c.lineTo(480, 571); c.fill();
      ellipse(354, 609, 8, 11, '#483d35'); ellipse(442, 609, 8, 11, '#483d35'); ellipse(397, 654, 12, 9, '#483d35');
      ellipse(324, 636, 15, 8, '#dca28a'); ellipse(472, 636, 15, 8, '#dca28a');
      ellipse(365, 807, 25, 17, '#604c3b'); ellipse(428, 807, 25, 17, '#604c3b');
      star(266, 661, 33, '#f9eab8', -.2);
      for (const [x, y] of [[183, 364], [528, 342], [616, 753]]) star(x, y, 10, '#fff0d1');
    }
    c.fillStyle = index === 1 ? '#eaf0df' : 'rgba(60,73,49,.72)';
    c.font = '24px "PingFang SC", "Microsoft YaHei", sans-serif'; c.fillText('小小绘本 · 大大冒险', 389, 945);
    let seed = 12;
    for (let i = 0; i < 31000; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0; const x = seed % 768;
      seed = (seed * 1664525 + 1013904223) >>> 0; const y = seed % 1000;
      c.fillStyle = i % 2 ? 'rgba(255,255,230,.09)' : 'rgba(30,45,25,.035)'; c.fillRect(x, y, 1.4, 1.4);
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.textures.add(texture); return texture;
  }

  private makeBooks() {
    for (let i = 0; i < 3; i++) {
      const group = new THREE.Group(); group.userData.bookIndex = i;
      const coverMat = this.material(COLORS[i]);
      const paper = this.material('#fff9e9', { map: this.paperTexture });
      const block = this.round(2.57, 3.38, .22, .025, paper, group); block.position.z = .005;
      const back = this.round(2.7, 3.55, .055, .025, coverMat, group); back.position.z = -.144;
      const spine = this.round(.14, 3.55, .35, .04, coverMat, group); spine.position.x = -1.295;
      const cover = new THREE.Group(); cover.position.set(-1.35, 0, .15); group.add(cover);
      const lid = this.round(2.7, 3.55, .055, .025, coverMat, cover); lid.position.x = 1.35;
      const artworkMaterial = new THREE.MeshBasicMaterial({ map: this.coverTexture(i), toneMapped: false }); this.materials.add(artworkMaterial);
      const art = this.mesh(new THREE.PlaneGeometry(2.65, 3.5), artworkMaterial, cover);
      art.position.set(1.35, 0, .03); art.castShadow = false;
      const inside = this.mesh(new THREE.PlaneGeometry(2.56, 3.39), paper, cover);
      inside.position.set(1.35, 0, -.029); inside.rotation.y = Math.PI;
      // Fine, understated page edges make these physical paper books.
      const edgeMat = this.material('#c7c1aa', { transparent: true, opacity: .35 });
      for (let l = 0; l < 5; l++) {
        const line = this.mesh(new THREE.BoxGeometry(.007, 3.30, .003), edgeMat, group);
        line.position.set(1.287, 0, -.075 + l * .035);
        const topLine = this.mesh(new THREE.BoxGeometry(2.48, .003, .003), edgeMat, group);
        topLine.position.set(.018, 1.692, -.075 + l * .035);
      }
      const left = new THREE.Group(); group.add(left); left.visible = false;
      const leftPage = this.round(2.57, 3.38, .13, .025, paper, left); leftPage.position.set(-2.7, 0, .08);
      this.books.push(group); this.covers.push(cover); this.leftPages.push(left);
      this.scene.add(group);
    }
    this.positionShelfBooks();
  }

  private positionShelfBooks() {
    const narrow = this.immersive ? this.shelfLayoutNarrow : this.width / this.height < 1.45;
    if (!this.immersive) this.shelfLayoutNarrow = narrow;
    const spacing = narrow ? 2.92 : 3.24;
    for (let i = 0; i < this.books.length; i++) {
      const position = new THREE.Vector3((i - 1) * spacing, 2.175, -2.3 + (i === 1 ? .12 : 0));
      const rotation = new THREE.Euler(0, i === 0 ? .075 : i === 2 ? -.075 : 0, i === 0 ? -.025 : i === 2 ? .023 : 0);
      this.bookHome[i] = { position, rotation };
      if (this.mode === 'shelf') { this.books[i].position.copy(position); this.books[i].rotation.copy(rotation); }
    }
    this.shelf.scale.x = narrow ? .80 : 1;
    this.decor.visible = !narrow;
  }

  private makeMushroom(parent: THREE.Object3D, x: number, y: number, z: number, scale = 1) {
    const g = new THREE.Group(); g.position.set(x, y, z); g.scale.setScalar(scale); parent.add(g);
    const stem = this.mesh(new THREE.CylinderGeometry(.13, .17, .43, 20), this.material('#f8ead1'), g); stem.position.y = .21;
    const cap = this.ball(0, .46, 0, .43, .25, .40, this.material('#c88772'), g);
    for (const [px, pz, size] of [[-.15, .18, .06], [.15, .1, .075], [0, -.14, .07]]) {
      this.ball(px, .658 - Math.abs(px) * .25, pz, size, .018, size, this.material('#f5dfbd'), g);
    }
    cap.userData.decor = true;
    return g;
  }

  private makeRabbit() {
    const g = new THREE.Group();
    const fur = this.material('#fff5df'); const pink = this.material('#e5b9aa');
    const eye = this.material('#41473c', { roughness: .38 });
    this.ball(0, .78, 0, .56, .70, .43, this.material('#e4bd72'), g);
    this.ball(0, .90, .355, .33, .44, .10, this.material('#f4d797'), g);
    this.ball(0, 1.64, .06, .67, .61, .56, fur, g);
    const left = this.ball(-.29, 2.39, .02, .18, .63, .17, fur, g); left.rotation.z = .13;
    const right = this.ball(.29, 2.40, .02, .18, .66, .17, fur, g); right.rotation.z = -.13;
    const li = this.ball(-.30, 2.43, .145, .085, .46, .03, pink, g); li.rotation.z = .13;
    const ri = this.ball(.30, 2.44, .145, .085, .48, .03, pink, g); ri.rotation.z = -.13;
    this.ball(-.235, 1.70, .576, .065, .088, .045, eye, g); this.ball(.235, 1.70, .576, .065, .088, .045, eye, g);
    this.ball(-.252, 1.725, .611, .018, .021, .012, this.material('#fffef6'), g);
    this.ball(.218, 1.725, .611, .018, .021, .012, this.material('#fffef6'), g);
    this.ball(-.39, 1.515, .525, .11, .065, .032, pink, g); this.ball(.39, 1.515, .525, .11, .065, .032, pink, g);
    this.ball(0, 1.545, .621, .057, .040, .035, this.material('#b28d7f'), g);
    const mouth = this.mesh(new THREE.TorusGeometry(.058, .009, 6, 16, Math.PI), this.material('#8f8977'), g);
    mouth.position.set(0, 1.488, .625); mouth.rotation.z = Math.PI;
    this.ball(-.27, .17, .20, .26, .16, .34, fur, g); this.ball(.27, .17, .20, .26, .16, .34, fur, g);
    const armL = this.ball(-.53, .95, .07, .18, .37, .19, fur, g); armL.rotation.z = -.34;
    const armR = this.ball(.53, .96, .08, .18, .37, .19, fur, g); armR.rotation.z = .35;
    g.userData.arm = armR;
    this.ball(.51, .49, -.31, .22, .22, .22, fur, g);
    const button = this.material('#ad824c'); this.ball(0, 1.12, .464, .03, .03, .015, button, g);
    return g;
  }

  private makeWhale() {
    const g = new THREE.Group(); const blue = this.material('#779eac'); const cream = this.material('#e2e8dd');
    this.ball(0, 1.0, 0, 1.09, .67, .59, blue, g);
    this.ball(-.09, .79, .25, .93, .37, .4, cream, g);
    const tail = this.ball(.99, 1.13, -.01, .62, .24, .29, blue, g); tail.rotation.z = .48;
    const t1 = this.ball(1.39, 1.47, -.12, .4, .16, .22, blue, g); t1.rotation.z = .6;
    const t2 = this.ball(1.37, 1.48, .2, .35, .16, .23, blue, g); t2.rotation.z = -.5;
    const fin = this.ball(-.02, .68, .58, .2, .38, .12, this.material('#648d9b'), g); fin.rotation.z = -.5;
    g.userData.arm = fin;
    const ink = this.material('#344b54');
    this.ball(-.58, 1.10, .518, .070, .083, .045, ink, g);
    this.ball(-.595, 1.122, .548, .018, .021, .012, this.material('#fffff5'), g);
    this.ball(-.70, .93, .522, .13, .065, .025, this.material('#d5b5ad'), g);
    const mouth = this.mesh(new THREE.TorusGeometry(.135, .012, 7, 18, Math.PI * .8), ink, g);
    mouth.position.set(-.77, .92, .487); mouth.rotation.z = Math.PI * 1.1;
    g.userData.spout = [];
    for (let i = 0; i < 3; i++) {
      const drop = this.ball(-.1 + (i - 1) * .20, 1.99 + (i === 1 ? .12 : 0), 0, .065, .17, .05, this.material('#d4e8e5'), g);
      drop.rotation.z = (1 - i) * .45; g.userData.spout.push(drop);
    }
    return g;
  }

  private makeFox() {
    const g = new THREE.Group(); const fur = this.material('#cd926a'); const cream = this.material('#fff0d6'); const dark = this.material('#5f5549');
    this.ball(0, .80, 0, .51, .68, .43, fur, g);
    this.ball(0, .86, .34, .30, .40, .14, cream, g);
    this.ball(0, 1.72, .015, .68, .57, .52, fur, g);
    for (const x of [-.43, .43]) {
      const ear = this.mesh(new THREE.ConeGeometry(.29, .70, 3, 1), fur, g); ear.position.set(x, 2.24, -.015); ear.rotation.y = Math.PI; ear.rotation.z = x > 0 ? -.16 : .16;
      const inner = this.mesh(new THREE.ConeGeometry(.16, .43, 3, 1), this.material('#ddb0a0'), g); inner.position.set(x, 2.27, .11); inner.rotation.y = Math.PI; inner.rotation.z = x > 0 ? -.16 : .16;
    }
    const cheekL = this.ball(-.265, 1.52, .39, .36, .255, .22, cream, g); cheekL.rotation.z = -.17;
    const cheekR = this.ball(.265, 1.52, .39, .36, .255, .22, cream, g); cheekR.rotation.z = .17;
    this.ball(-.255, 1.79, .473, .061, .085, .046, dark, g); this.ball(.255, 1.79, .473, .061, .085, .046, dark, g);
    this.ball(-.27, 1.813, .51, .017, .022, .011, cream, g); this.ball(.24, 1.813, .51, .017, .022, .011, cream, g);
    this.ball(0, 1.52, .618, .09, .063, .057, dark, g);
    this.ball(-.44, 1.60, .522, .086, .047, .019, this.material('#dca18b'), g); this.ball(.44, 1.60, .522, .086, .047, .019, this.material('#dca18b'), g);
    this.ball(-.25, .17, .15, .22, .17, .29, dark, g); this.ball(.25, .17, .15, .22, .17, .29, dark, g);
    const armL = this.ball(-.49, .95, .1, .17, .34, .16, fur, g); armL.rotation.z = -.35;
    const armR = this.ball(.49, .97, .1, .17, .34, .16, fur, g); armR.rotation.z = .35; g.userData.arm = armR;
    const tail = this.ball(.65, .67, -.19, .32, .67, .30, fur, g); tail.rotation.z = -.65;
    const tip = this.ball(.97, 1.12, -.19, .27, .30, .265, cream, g); tip.rotation.z = -.65;
    return g;
  }

  private makeStar(color = '#f5d380', face = true) {
    const g = new THREE.Group();
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5 + Math.PI / 2; const radius = i % 2 ? .24 : .49;
      const x = Math.cos(a) * radius; const y = Math.sin(a) * radius;
      i ? shape.lineTo(x, y) : shape.moveTo(x, y);
    }
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .12, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .052, bevelThickness: .047, curveSegments: 12 });
    const body = this.mesh(geometry, this.material(color, { emissive: color, emissiveIntensity: .13, roughness: .54 }), g); body.position.z = -.06;
    if (face) {
      const eye = this.material('#927340');
      this.ball(-.12, .025, .131, .025, .039, .019, eye, g); this.ball(.12, .025, .131, .025, .039, .019, eye, g);
      this.ball(-.19, -.05, .133, .047, .023, .014, this.material('#e6ac7e'), g); this.ball(.19, -.05, .133, .047, .023, .014, this.material('#e6ac7e'), g);
      const mouth = this.mesh(new THREE.TorusGeometry(.039, .006, 6, 12, Math.PI), eye, g); mouth.position.set(0, -.059, .136); mouth.rotation.z = Math.PI;
    }
    return g;
  }

  private makeBell() {
    const g = new THREE.Group();
    const gold = this.material('#dfbc75', { metalness: .15, roughness: .48 });
    const bell = this.mesh(new THREE.CylinderGeometry(.14, .34, .41, 32, 1, true), gold, g); bell.position.y = .05;
    const lip = this.mesh(new THREE.TorusGeometry(.337, .037, 8, 32), gold, g); lip.rotation.x = Math.PI / 2; lip.position.y = -.15;
    this.ball(0, -.20, 0, .08, .08, .08, this.material('#a98c51'), g);
    const ring = this.mesh(new THREE.TorusGeometry(.09, .028, 8, 24), gold, g); ring.position.y = .34;
    const ribbon = this.material('#a6b99c');
    const l = this.ball(-.14, .30, 0, .14, .08, .05, ribbon, g); l.rotation.z = -.3;
    const r = this.ball(.14, .30, 0, .14, .08, .05, ribbon, g); r.rotation.z = .3;
    return g;
  }

  private makeSun() {
    const g = new THREE.Group(); const yellow = this.material('#efcc7d', { emissive: '#f1d591', emissiveIntensity: .2 });
    this.ball(0, 0, 0, .43, .43, .15, yellow, g);
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * Math.PI * 2;
      const ray = this.round(.065, .16, .05, .024, yellow, g); ray.position.set(Math.sin(a) * .59, Math.cos(a) * .59, 0); ray.rotation.z = -a;
    }
    const ink = this.material('#a07c45');
    this.ball(-.13, .025, .146, .025, .04, .02, ink, g); this.ball(.13, .025, .146, .025, .04, .02, ink, g);
    const mouth = this.mesh(new THREE.TorusGeometry(.053, .008, 6, 16, Math.PI), ink, g); mouth.position.set(0, -.06, .156); mouth.rotation.z = Math.PI;
    return g;
  }

  private makeCoral() {
    const g = new THREE.Group(); const coral = this.material('#d9a08e');
    for (let i = 0; i < 5; i++) {
      const branch = this.round(.105, .58 + (i % 2) * .24, .13, .05, coral, g);
      branch.position.set((i - 2) * .14, .28 + (i % 2) * .12, (i % 2) * .04); branch.rotation.z = (2 - i) * .25;
      this.ball((i - 2) * .20, .54 + (i % 2) * .19, (i % 2) * .04, .075, .085, .07, coral, g);
    }
    return g;
  }

  private makeTree(color: string, height: number, style = 0) {
    const g = new THREE.Group();
    const trunk = this.round(.105, height * .69, .115, .025, this.material('#a59069'), g); trunk.position.y = height * .345;
    const leaf = this.material(color, { map: this.paperTexture });
    if (style === 0) {
      this.ball(0, height * .66, 0, height * .30, height * .43, .105, leaf, g);
      const vein = this.round(.018, height * .53, .012, .006, this.material('#a2b29a'), g); vein.position.set(0, height * .65, .11);
      for (let i = 0; i < 3; i++) {
        for (const side of [-1, 1]) {
          const twig = this.round(height * .14, .015, .01, .005, this.material('#a2b29a'), g);
          twig.position.set(side * height * .055, height * (.48 + i * .14), .113); twig.rotation.z = side * .55;
        }
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const cone = this.mesh(new THREE.ConeGeometry(height * (.26 - i * .05), height * .55, 3, 1), leaf, g);
        cone.position.y = height * (.38 + i * .20); cone.scale.z = .17; cone.rotation.y = Math.PI;
      }
    }
    return g;
  }

  private makeCloud() {
    const group = new THREE.Group(); const mat = this.material('#f8f2e5');
    this.ball(0, .18, 0, .73, .21, .21, mat, group);
    this.ball(-.26, .32, 0, .30, .28, .19, mat, group);
    this.ball(.15, .38, 0, .38, .33, .21, mat, group);
    return group;
  }

  private makeFlower(x: number, z: number, color: string) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    const stem = this.mesh(new THREE.CylinderGeometry(.012, .014, .35, 8), this.material('#8caa78'), g); stem.position.y = .17;
    const petalMat = this.material(color);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2; this.ball(Math.cos(a) * .075, .36 + Math.sin(a) * .075, 0, .065, .065, .035, petalMat, g);
    }
    this.ball(0, .36, .035, .036, .036, .020, this.material('#dfbd62'), g); return g;
  }

  private addPopup(object: THREE.Object3D, delay = 0) {
    this.popup.add(object);
    this.popupItems.push({ object, scale: object.scale.clone(), delay });
    object.scale.setScalar(0);
  }

  private makeScene(page: number) {
    this.disposePopup();
    this.storyProps.clear();
    this.popup.position.set(0, .08, 1.25);
    const palette = this.selected;
    const hero = palette === 1 ? this.makeWhale() : palette === 2 ? this.makeFox() : this.makeRabbit();
    hero.scale.setScalar(palette === 1 ? .84 : .77);
    hero.position.set(page === 2 ? -.9 : -.67, 0, .27);
    hero.rotation.y = .11;
    this.hero = hero;
    this.addPopup(hero, .08);
    this.interactiveObjects.push(hero);
    const star = palette === 2 && page !== 2 ? this.makeBell() : palette === 1 && page === 3 ? this.makeSun() : this.makeStar();
    this.starBaseY = page === 3 ? 2.1 : page === 1 ? .66 : 1.05;
    star.position.set(page === 2 ? 1.17 : 1.04, this.starBaseY, page === 1 ? .39 : .19);
    star.scale.setScalar(page === 3 ? .85 : .78);
    star.rotation.z = -.10;
    this.star = star;
    this.addPopup(star, .25); this.interactiveObjects.push(star);
    const colorA = palette === 0 ? '#95af8c' : palette === 1 ? '#8eb8b4' : '#d1b694';
    const colorB = palette === 0 ? '#bdc79f' : palette === 1 ? '#b5c8b3' : '#c7c69f';
    // Low illustrated paper islands leave the faces clearly visible from the camera.
    const island = this.mesh(new THREE.CircleGeometry(1.72, 48), this.material(palette === 0 ? '#d3ddbd' : palette === 1 ? '#b8d2d0' : '#f0dcb9'), undefined);
    island.rotation.x = -Math.PI / 2; island.scale.set(1.25, .69, 1); island.position.set(0, .009, .03); island.castShadow = false;
    this.addPopup(island);
    if (palette === 1) {
      for (let i = 0; i < 5; i++) {
        const seaweed = this.makeTree(i % 2 ? '#9aafa0' : '#90b0aa', 1.1 + (i % 3) * .25, 0);
        seaweed.position.set(i < 3 ? -2.02 + i * .33 : 1.67 + (i - 3) * .38, 0, -.73 + (i % 2) * .20);
        seaweed.rotation.z = Math.sin(i) * .17; this.addPopup(seaweed, .09 + i * .025);
      }
      const coral = this.makeCoral(); coral.position.set(1.62, 0, .56); this.addPopup(coral, .15); this.interactiveObjects.push(coral);
      const shell = new THREE.Group();
      const shellMat = this.material('#e4c5b2');
      for (let i = 0; i < 7; i++) {
        const rib = this.ball(0, .25, 0, .075, .34, .14, shellMat, shell); rib.rotation.z = (i - 3) * .19;
      }
      shell.position.set(1.76, .06, .91); shell.rotation.x = -.25; this.addPopup(shell, .23); this.interactiveObjects.push(shell);
      for (let i = 0; i < 5; i++) {
        const bubble = this.mesh(new THREE.SphereGeometry(.06 + i * .012, 16, 12), this.material('#def0ec', { transparent: true, opacity: .52, roughness: .12 }), undefined);
        bubble.position.set(1.65 + Math.sin(i * 2) * .3, .8 + i * .31, -.45); this.addPopup(bubble, .16 + i * .05);
      }
    } else {
      for (const [x, z, h, color, style] of [[-2.02, -.63, 1.85, colorA, 0], [-1.53, -1.03, 2.37, colorB, 0], [2.03, -.85, 2.05, colorA, 1], [1.50, -1.07, 1.69, colorB, 0]] as const) {
        const tree = this.makeTree(color, h, style); tree.position.set(x, 0, z); tree.rotation.y = x < 0 ? .13 : -.15; this.addPopup(tree, .12 + Math.abs(x) * .015); this.interactiveObjects.push(tree); if (h > 2.2) this.storyProps.set('tree', tree);
      }
      this.addPopup(this.makeMushroom(new THREE.Group(), -1.91, 0, .98, .67), .23);
      const mushroom = this.makeMushroom(new THREE.Group(), 1.95, 0, .70, .64); this.addPopup(mushroom, .24); this.interactiveObjects.push(mushroom); this.storyProps.set('mushroom', mushroom);
      for (const [x, z, color] of [[-1.4, .88, '#f1d195'], [1.72, .18, '#e4b6a2'], [.38, 1.05, '#f1d195']] as const) this.addPopup(this.makeFlower(x, z, color), .29);
    }
    if (page === 1 && palette !== 2) {
      // A small paper bridge is the second spread's physical story prop.
      const bridge = new THREE.Group(); bridge.position.set(.77, 0, .35);
      const beamMat = this.material(palette === 1 ? '#c5d6c7' : '#c4aa82');
      for (let i = 0; i < 7; i++) {
        const plank = this.round(.145, .065, .57, .016, beamMat, bridge); plank.position.set((i - 3) * .17, .15 + Math.sin(i / 6 * Math.PI) * .15, 0);
      }
      for (const x of [-.56, .56]) for (const z of [-.27, .27]) { const pole = this.round(.05, .47, .05, .012, beamMat, bridge); pole.position.set(x, .235, z); }
      this.addPopup(bridge, .12); this.interactiveObjects.push(bridge);
    }
    if (page === 1 && palette === 2) {
      const bridge = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const cloud = this.makeCloud(); cloud.scale.setScalar(.42);
        cloud.position.set(-.1 + i * .48, .40 + (i % 2) * .51, .35 + Math.sin(i) * .14); bridge.add(cloud);
      }
      this.addPopup(bridge, .22); this.interactiveObjects.push(bridge); this.storyProps.set('clouds', bridge);
    }
    if (page === 2 || palette === 2) {
      const cloud = this.makeCloud(); cloud.position.set(.85, page === 2 ? 1.62 : 1.93, -.76); cloud.scale.setScalar(.85); this.addPopup(cloud, .2); this.interactiveObjects.push(cloud);
      if (page === 2) {
        const ladder = new THREE.Group(); ladder.position.set(.75, 0, -.24); ladder.rotation.z = -.16;
        const mat = this.material('#baa27d');
        for (const x of [-.20, .20]) { const rail = this.round(.04, 1.77, .045, .01, mat, ladder); rail.position.set(x, .885, 0); }
        for (let i = 0; i < 6; i++) { const rung = this.round(.43, .035, .04, .01, mat, ladder); rung.position.y = .16 + i * .27; }
        this.addPopup(ladder, .12); this.interactiveObjects.push(ladder);
      }
    }
    if (page === 3) {
      const arch = new THREE.Group(); arch.position.set(.35, 0, -.78);
      const paletteColors = ['#d7ae94', '#e4c38d', '#b6c6a0'];
      for (let i = 0; i < 3; i++) {
        const arc = this.mesh(new THREE.TorusGeometry(1.48 - i * .115, .054, 8, 48, Math.PI), this.material(paletteColors[i]), arch);
        arc.position.y = .79;
      }
      this.addPopup(arch, .17);
      for (let i = 0; i < 4; i++) {
        const tinyStar = this.makeStar('#f6d993', false); tinyStar.scale.setScalar(.20); tinyStar.position.set(-1.34 + i * .88, 2.15 + Math.sin(i * 1.3) * .45, -.3);
        tinyStar.rotation.z = i * .3; this.addPopup(tinyStar, .2 + i * .035);
      }
    }
  }

  private async revealPopup() {
    const maxDelay = .34;
    await this.tween(this.reducedMotion ? 170 : 860, (t) => {
      for (const item of this.popupItems) {
        const progress = clamp((t * (1 + maxDelay) - item.delay) / (1 + maxDelay - item.delay), 0, 1);
        const spring = progress === 1 ? 1 : 1 - Math.pow(1 - progress, 3) * Math.cos(progress * Math.PI * 1.2);
        item.object.scale.copy(item.scale).multiplyScalar(spring);
      }
    }, false);
    for (const item of this.popupItems) item.object.scale.copy(item.scale);
  }

  private async hidePopup() {
    const snapshots = this.popupItems.map(item => item.object.scale.clone());
    await this.tween(390, t => this.popupItems.forEach((item, i) => item.object.scale.copy(snapshots[i]).multiplyScalar(1 - t)));
    this.popupItems.forEach(item => item.object.scale.setScalar(0));
  }

  private makeFireflies() {
    const mat = this.material('#f4d99e', { emissive: '#ffe5ac', emissiveIntensity: .6, transparent: true, opacity: .55 });
    for (let i = 0; i < 23; i++) {
      const particle = this.mesh(new THREE.SphereGeometry(.014 + (i % 3) * .004, 6, 5), mat, this.particles);
      particle.castShadow = false; particle.receiveShadow = false;
      particle.userData.origin = new THREE.Vector3(Math.sin(i * 7.1) * 5.5, .7 + (i * .37) % 4.5, -2 + Math.cos(i * 9.7) * 2.0);
      particle.position.copy(particle.userData.origin);
    }
  }

  private tween(duration: number, update: (t: number) => void, smooth = true) {
    if (this.disposed) return Promise.resolve();
    const effective = this.reducedMotion ? Math.min(duration, 150) : duration;
    return new Promise<void>(resolve => this.tweens.push({ start: performance.now(), duration: effective, update: t => update(smooth ? ease(t) : t), done: resolve }));
  }

  private cameraTo(target: THREE.Vector3, width: number, duration: number, elevation = 8.6, minHeight = 4.55, story = true) {
    const startTarget = this.target.clone(); const startWidth = this.viewWidth;
    const startElevation = this.cameraElevation; const startMinHeight = this.minimumViewHeight;
    const startFramingMix = this.storyFramingMix;
    return this.tween(duration, t => {
      this.target.lerpVectors(startTarget, target, t);
      this.viewWidth = THREE.MathUtils.lerp(startWidth, width, t);
      this.cameraElevation = THREE.MathUtils.lerp(startElevation, elevation, t);
      this.minimumViewHeight = THREE.MathUtils.lerp(startMinHeight, minHeight, t);
      this.storyFramingMix = THREE.MathUtils.lerp(startFramingMix, story ? 1 : 0, t);
      this.updateCamera();
    });
  }

  private updateCamera() {
    const aspect = this.width / this.height;
    const framingMix = this.immersive ? this.storyFramingMix : 0;
    const shortLandscape = this.height < 360 && aspect > 2.7;
    const toolbarHeight = shortLandscape ? 52 : this.width <= 640 ? 64 : 76;
    this.safeTopInset = toolbarHeight * framingMix;
    this.safeBottomInset = 10 * framingMix;
    const safeHeight = Math.max(1, this.height - this.safeTopInset - this.safeBottomInset);
    const safeAspect = this.width / safeHeight;
    // Fit against the visible space below the toolbar. Portrait keeps the whole spread, using most of
    // the screen width; short landscape protects the highest star and the book's front edge.
    // Insets and portrait framing blend into the existing flight instead of snapping the camera.
    const portraitReduction = clamp((1.70 - safeAspect) / .65, 0, 1) * 1.37 * framingMix;
    const contentHeight = Math.max(this.minimumViewHeight, (this.viewWidth - portraitReduction) / safeAspect);
    const h = contentHeight * this.height / safeHeight;
    const w = h * aspect;
    const centerShift = h * (this.safeTopInset - this.safeBottomInset) / (2 * this.height);
    this.camera.left = -w / 2; this.camera.right = w / 2;
    this.camera.top = h / 2 + centerShift; this.camera.bottom = -h / 2 + centerShift;
    this.camera.position.copy(this.target).add(new THREE.Vector3(0, this.cameraElevation, 17));
    this.camera.lookAt(this.target); this.camera.updateProjectionMatrix();
  }

  private resize = () => {
    if (this.disposed) return;
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(rect.width, 1); this.height = Math.max(rect.height, 1);
    this.renderer.setSize(this.width, this.height, false);
    // The room expands before the book starts moving. Preserve the exact shelf arrangement throughout
    // that resize and the eventual collapse, instead of switching layouts based on the immersive aspect.
    if (!this.immersive) {
      this.positionShelfBooks();
      if (this.mode === 'shelf') {
        this.viewWidth = this.shelfLayoutNarrow ? 9.8 : 13.8;
        this.shelfViewWidth = this.viewWidth;
      }
    }
    this.updateCamera();
  };

  /** Call before expanding the persistent canvas, and reset only after it has collapsed to the shelf. */
  setImmersive(value: boolean) {
    if (this.disposed || this.immersive === value) return;
    if (value) this.shelfViewWidth = this.viewWidth;
    this.immersive = value;
    this.hover = null;
    this.down = null;
    this.renderer.domElement.style.cursor = '';
    if (!value) this.resize();
  }

  private prepareBackdropFade() {
    this.backdropMaterials.clear();
    [this.shelf, this.decor, ...this.books.filter((_, index) => index !== this.selected)].forEach(group => group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        if (this.backdropMaterials.has(material)) return;
        this.backdropMaterials.set(material, { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite });
        material.transparent = true; material.depthWrite = false; material.needsUpdate = true;
      });
    }));
  }

  private fadeBackdrop(amount: number, restore = false) {
    this.backdropMaterials.forEach((original, material) => {
      material.opacity = original.opacity * amount;
      if (restore) { material.transparent = original.transparent; material.depthWrite = original.depthWrite; material.needsUpdate = true; }
    });
    if (restore) this.backdropMaterials.clear();
  }

  async openBook(index: number) {
    if (this.disposed || this.locked || this.mode !== 'shelf' || !Number.isInteger(index) || index < 0 || index > 2) return;
    this.locked = true; this.interactive = false; this.selected = index; this.currentPage = 0; this.mode = 'opening'; this.hover = null;
    this.prepareBackdropFade();
    this.storyBackdropOpacity = this.immersive ? .055 : .18;
    const book = this.books[index]; const startPosition = book.position.clone(); const startQuaternion = book.quaternion.clone();
    const endQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    const endPosition = new THREE.Vector3(1.35, -.10, 1.25);
    const cameraMove = this.cameraTo(new THREE.Vector3(0, .89, .98), 7.72, 1450);
    await this.tween(1190, t => {
      book.position.lerpVectors(startPosition, endPosition, t); book.position.y += Math.sin(t * Math.PI) * 1.02;
      book.quaternion.slerpQuaternions(startQuaternion, endQuaternion, t);
      this.fadeBackdrop(1 - t * (1 - this.storyBackdropOpacity));
      this.books.forEach((other, i) => { if (i !== index) other.scale.setScalar(1 - t * .06); });
    });
    if (this.disposed) return;
    await this.tween(810, t => { this.covers[index].rotation.y = -Math.PI * t; });
    if (this.disposed) return;
    this.leftPages[index].visible = true;
    await cameraMove;
    this.makeScene(0); await this.revealPopup();
    this.mode = 'story'; this.locked = false;
  }

  async turnPage(page: number) {
    if (this.disposed || this.locked || this.mode !== 'story' || page < 0 || page > 3 || page === this.currentPage) return;
    this.locked = true; this.interactive = false; this.mode = 'turning'; this.hover = null;
    await this.hidePopup();
    if (this.disposed) return;
    // No pop-up is visible during the entire page flip, including its settling pause.
    this.popup.visible = false;
    const flip = new THREE.Group(); flip.position.set(-1.35, 0, .135); this.books[this.selected].add(flip);
    const pageMesh = this.round(2.57, 3.38, .022, .01, this.material('#fffaf0', { map: this.paperTexture, side: THREE.DoubleSide }), flip);
    pageMesh.position.x = 1.285;
    await this.tween(860, t => { flip.rotation.y = -Math.PI * t; pageMesh.rotation.x = Math.sin(t * Math.PI) * .025; });
    if (this.disposed) return;
    flip.removeFromParent(); this.disposeObject(flip);
    this.currentPage = page;
    this.makeScene(page); this.popup.visible = true;
    const positions = [new THREE.Vector3(0, .89, .98), new THREE.Vector3(.12, .87, 1.06), new THREE.Vector3(-.05, 1.00, 1.01), new THREE.Vector3(0, 1.04, 1.10)];
    const cameraMove = this.cameraTo(positions[page], page === 3 ? 7.92 : page === 2 ? 7.72 : 7.55, 900);
    await this.revealPopup(); await cameraMove;
    this.mode = 'story'; this.locked = false;
  }

  async react() {
    if (this.disposed || this.locked || this.mode !== 'story' || !this.hero || !this.star) return;
    this.locked = true; this.interactive = false;
    const hero = this.hero; const star = this.star;
    const baseY = hero.position.y; const starStart = star.position.clone(); const starScale = star.scale.clone();
    const arm = hero.userData.arm as THREE.Object3D | undefined; const baseArm = arm?.rotation.z ?? 0;
    const mushroom = this.storyProps.get('mushroom');
    const mushroomMaterials: THREE.MeshStandardMaterial[] = [];
    if (this.selected === 0 && this.currentPage === 1 && mushroom) mushroom.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial) mushroomMaterials.push(object.material);
    });
    const clouds = this.storyProps.get('clouds');
    const cloudStarts = clouds?.children.map(cloud => cloud.position.clone()) ?? [];
    const spout = (hero.userData.spout ?? []) as THREE.Object3D[];
    const spoutStarts = spout.map(drop => ({ position: drop.position.clone(), scale: drop.scale.clone() }));
    let droplet: THREE.Group | null = null;
    if (this.selected === 0 && this.currentPage === 2) {
      droplet = this.makeStar('#f5dfa0', false); droplet.scale.setScalar(.15); droplet.position.set(-1.53, 2.34, -1.01); this.popup.add(droplet);
    }
    let rainbow: THREE.Group | null = null;
    if (this.selected === 1 && this.currentPage === 2) {
      rainbow = new THREE.Group(); rainbow.position.set(.25, .72, -.75);
      ['#d9a48b', '#e4c77f', '#acc6a0', '#95b7bf'].forEach((color, i) => {
        const arc = this.mesh(new THREE.TorusGeometry(1.37 - i * .115, .042, 8, 48, Math.PI), this.material(color), rainbow!);
        arc.position.y = .20;
      });
      this.popup.add(rainbow); this.popupItems.push({ object: rainbow, scale: new THREE.Vector3(1, 1, 1), delay: 0 }); rainbow.scale.setScalar(0);
    }
    await this.tween(1140, t => {
      const wave = Math.sin(t * Math.PI);
      hero.position.y = baseY + wave * .16;
      hero.rotation.z = Math.sin(t * Math.PI * 2) * .055;
      if (arm) arm.rotation.z = baseArm + Math.sin(t * Math.PI) * 1.0;
      star.position.set(starStart.x - wave * .54, starStart.y + wave * .30, starStart.z + wave * .20);
      star.rotation.z = -.1 + Math.sin(t * Math.PI * 2) * .18;
      star.scale.copy(starScale).multiplyScalar(1 + wave * .13);
      if (mushroomMaterials.length) {
        mushroomMaterials.forEach(mat => { mat.emissive.set('#f2cb73'); mat.emissiveIntensity = wave * .48; });
        star.scale.copy(starScale).multiplyScalar(1 + t * .12);
      }
      if (droplet) {
        const progress = clamp(t * 1.3, 0, 1);
        droplet.position.lerpVectors(new THREE.Vector3(-1.53, 2.34, -1.01), starStart, progress);
        droplet.position.y += Math.sin(progress * Math.PI) * .42;
        droplet.scale.setScalar(.15 * (1 - Math.max(0, (t - .7) / .3)));
        star.scale.copy(starScale).multiplyScalar(1 + Math.max(0, t - .6) * .35);
      }
      if (rainbow) {
        spout.forEach((drop, i) => {
          const base = spoutStarts[i];
          drop.position.set(base.position.x + Math.sin(t * Math.PI) * (i - 1) * .17, base.position.y + wave * .60, base.position.z);
          drop.scale.copy(base.scale).multiplyScalar(1 + wave * .5);
        });
        rainbow.scale.setScalar(ease(clamp((t - .30) / .7, 0, 1)));
      }
      if (clouds && this.selected === 2 && this.currentPage === 1) clouds.children.forEach((cloud, i) => {
        cloud.position.lerpVectors(cloudStarts[i], new THREE.Vector3(-.06 + i * .47, .14 + Math.sin(i / 3 * Math.PI) * .20, .44), t);
      });
      if (this.selected === 2 && (this.currentPage === 0 || this.currentPage === 3)) star.rotation.z = Math.sin(t * Math.PI * 6) * .32 * (1 - t);
    });
    if (this.disposed) return;
    mushroomMaterials.forEach(mat => { mat.emissiveIntensity = .11; });
    if (droplet) { this.disposeObject(droplet); droplet.removeFromParent(); }
    spout.forEach((drop, i) => { drop.position.copy(spoutStarts[i].position); drop.scale.copy(spoutStarts[i].scale); });
    hero.position.y = baseY; hero.rotation.z = 0; if (arm) arm.rotation.z = baseArm;
    star.position.copy(starStart); star.scale.copy(starScale); star.rotation.z = -.1;
    if (this.selected === 0 && this.currentPage === 3) {
      const origin = star.position.clone();
      await this.tween(700, t => { star.position.lerpVectors(origin, new THREE.Vector3(.45, 2.70, -.23), t); star.rotation.z = -.1 + t * .15; });
      this.starBaseY = 2.70;
    }
    this.locked = false;
  }

  async closeBook() {
    if (this.disposed || this.locked || this.mode === 'shelf') return;
    this.locked = true; this.interactive = false; this.mode = 'closing'; this.hover = null;
    await this.hidePopup(); if (this.disposed) return; this.disposePopup();
    this.leftPages[this.selected].visible = false;
    await this.tween(670, t => { this.covers[this.selected].rotation.y = -Math.PI * (1 - t); });
    if (this.disposed) return;
    const book = this.books[this.selected]; const startPosition = book.position.clone(); const startQuaternion = book.quaternion.clone();
    const home = this.bookHome[this.selected]; const endQuaternion = new THREE.Quaternion().setFromEuler(home.rotation);
    const cameraMove = this.cameraTo(new THREE.Vector3(0, 1.94, -.8), this.immersive ? this.shelfViewWidth : this.shelfLayoutNarrow ? 9.8 : 13.8, 1180, 6.8, 6.28, false);
    await this.tween(1180, t => {
      book.position.lerpVectors(startPosition, home.position, t); book.position.y += Math.sin(t * Math.PI) * 1.0;
      book.quaternion.slerpQuaternions(startQuaternion, endQuaternion, t);
      this.fadeBackdrop(this.storyBackdropOpacity + t * (1 - this.storyBackdropOpacity));
      this.books.forEach((other, i) => { if (i !== this.selected) other.scale.setScalar(.94 + t * .06); });
    });
    await cameraMove;
    this.fadeBackdrop(1, true);
    this.mode = 'shelf'; this.locked = false; this.currentPage = 0; this.positionShelfBooks(); this.updateCamera();
  }

  async celebrate() {
    if (this.disposed || this.locked || this.mode !== 'story') return;
    this.locked = true; this.interactive = false; this.mode = 'celebrating';
    const confetti = new THREE.Group(); this.scene.add(confetti); confetti.position.copy(this.popup.position);
    for (let i = 0; i < 16; i++) {
      const star = this.makeStar(i % 3 ? '#ebcd8b' : '#c0cf9c', false); star.scale.setScalar(.06 + (i % 4) * .022); confetti.add(star);
    }
    const initialY = this.hero?.position.y ?? 0;
    await this.tween(2100, t => {
      confetti.children.forEach((star, i) => {
        const angle = i * 2.399 + t * Math.PI * 2.4;
        const r = .3 + Math.sin(Math.min(t * 1.4, 1) * Math.PI / 2) * (1.1 + (i % 3) * .38);
        star.position.set(Math.cos(angle) * r, .5 + t * 2.7 + Math.sin(i * 1.6) * .4, Math.sin(angle) * r * .42 + .3);
        star.rotation.set(t * 2 + i, t * 3, angle);
        star.scale.setScalar((.06 + (i % 4) * .022) * (t < .8 ? Math.min(t * 8, 1) : (1 - t) * 5));
      });
      if (this.hero) this.hero.position.y = initialY + Math.abs(Math.sin(t * Math.PI * 3)) * .13 * (1 - t);
    }, false);
    if (this.hero) this.hero.position.y = initialY;
    this.disposeObject(confetti); confetti.removeFromParent();
    this.mode = 'story'; this.locked = false;
  }

  setInteractive(value: boolean) {
    this.interactive = value;
    if (!value) { this.hover = null; this.renderer.domElement.style.cursor = ''; }
  }

  getInteractionPoint(): { x: number; y: number } | null {
    if (!this.hero || this.mode !== 'story') return null;
    const world = new THREE.Vector3(0, this.selected === 1 ? 1 : 1.5, .4);
    this.hero.localToWorld(world); world.project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + (world.x + 1) * rect.width / 2, y: rect.top + (1 - world.y) * rect.height / 2 };
  }

  private getScreenBounds(object: THREE.Object3D) {
    // Hidden page stacks belong to the physical book but must not enlarge its visible bounds.
    for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) {
      if (!ancestor.visible) return null;
    }
    object.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    object.traverseVisible(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      if (!materials.some(material => material.visible)) return;
      if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
      if (child.geometry.boundingBox) box.union(child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld));
    });
    if (box.isEmpty()) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    const points: THREE.Vector3[] = [];
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z).project(this.camera));
    const left = rect.left + (Math.min(...points.map(p => p.x)) + 1) * rect.width / 2;
    const right = rect.left + (Math.max(...points.map(p => p.x)) + 1) * rect.width / 2;
    const top = rect.top + (1 - Math.max(...points.map(p => p.y))) * rect.height / 2;
    const bottom = rect.top + (1 - Math.min(...points.map(p => p.y))) * rect.height / 2;
    return { left, right, top, bottom, clipped: left < rect.left || right > rect.right || top < rect.top || bottom > rect.bottom };
  }

  getDebugState() {
    return { mode: this.mode, selected: this.selected, page: this.currentPage, locked: this.locked, interactive: this.interactive, immersive: this.immersive,
      shelfLayoutNarrow: this.shelfLayoutNarrow, cameraView: { width: this.camera.right - this.camera.left, height: this.camera.top - this.camera.bottom }, safeInsets: { top: this.safeTopInset, bottom: this.safeBottomInset },
      popupCount: this.popupItems.length, popupsVisible: this.popup.visible && this.popupItems.some(i => i.object.scale.length() > .01),
      width: this.width, height: this.height, heroBounds: this.hero ? this.getScreenBounds(this.hero) : null, starBounds: this.star ? this.getScreenBounds(this.star) : null, interactionPoint: this.getInteractionPoint(),
      books: this.books.map(book => { const p = book.getWorldPosition(new THREE.Vector3()).project(this.camera); const r = this.renderer.domElement.getBoundingClientRect(); return { x: r.left + (p.x + 1) * r.width / 2, y: r.top + (1 - p.y) * r.height / 2, bounds: this.getScreenBounds(book) }; }) };
  }

  private pick(event: PointerEvent) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.mode === 'shelf' ? this.books : this.interactiveObjects, true)[0]?.object ?? null;
  }

  private onPointerDown = (event: PointerEvent) => { this.down = { x: event.clientX, y: event.clientY }; };
  private onPointerUp = (event: PointerEvent) => {
    const down = this.down; this.down = null;
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 12 || this.locked || (this.immersive && this.mode === 'shelf')) return;
    const object = this.pick(event); if (!object) return;
    if (this.mode === 'shelf') {
      let parent: THREE.Object3D | null = object;
      while (parent && parent.userData.bookIndex === undefined) parent = parent.parent;
      if (parent) this.callbacks.onSelect(parent.userData.bookIndex);
    } else if (this.mode === 'story' && this.interactive) {
      this.interactive = false;
      this.callbacks.onInteract();
    }
  };
  private onPointerMove = (event: PointerEvent) => {
    if (this.locked || (this.immersive && this.mode === 'shelf') || (this.mode !== 'shelf' && !this.interactive)) return;
    const hit = this.pick(event);
    let object: THREE.Object3D | null = hit;
    if (this.mode === 'shelf') while (object && object.userData.bookIndex === undefined) object = object.parent;
    this.hover = object;
    this.renderer.domElement.style.cursor = hit ? 'pointer' : '';
  };
  private onPointerLeave = () => { this.hover = null; this.down = null; this.renderer.domElement.style.cursor = ''; };
  private onContextLost = (event: Event) => { event.preventDefault(); this.callbacks.onError('绘本暂时无法显示，请重试或刷新页面。'); };

  private animate = (now: number) => {
    if (this.disposed) return;
    const elapsed = now * .001;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tween = this.tweens[i]; const progress = clamp((now - tween.start) / tween.duration, 0, 1);
      tween.update(progress);
      if (progress === 1) { this.tweens.splice(i, 1); tween.done(); }
    }
    if (!this.reducedMotion) {
      if (this.mode === 'shelf' && !this.locked) this.books.forEach((book, i) => {
        const goal = this.bookHome[i].position.y + (this.hover === book ? .13 : 0);
        book.position.y = THREE.MathUtils.lerp(book.position.y, goal, .1);
      });
      if (this.mode === 'story' && !this.locked) {
        if (this.star) this.star.position.y = this.starBaseY + Math.sin(elapsed * 1.6) * .048;
        if (this.hero) this.hero.rotation.z = Math.sin(elapsed * 1.1) * .012;
      }
      this.particles.children.forEach((particle, i) => {
        const origin = particle.userData.origin as THREE.Vector3;
        particle.position.set(origin.x + Math.sin(elapsed * .2 + i) * .24, origin.y + Math.sin(elapsed * .32 + i * 2) * .2, origin.z);
        particle.scale.setScalar(.6 + Math.sin(elapsed * .7 + i) * .35);
      });
    }
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame(this.animate);
  };

  private disposeObject(root: THREE.Object3D) {
    const materials = new Set<THREE.Material>();
    root.traverse(obj => {
      if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(mat => materials.add(mat)); }
    });
    materials.forEach(material => { material.dispose(); this.materials.delete(material); });
  }

  private disposePopup() {
    this.disposeObject(this.popup);
    this.popup.clear(); this.popup.visible = true; this.popupItems.length = 0; this.interactiveObjects.length = 0; this.hero = null; this.star = null;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true; cancelAnimationFrame(this.frame); this.observer.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown);
    this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp);
    this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove);
    this.renderer.domElement.removeEventListener('pointerleave', this.onPointerLeave);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.scene.traverse(obj => { if (obj instanceof THREE.Mesh) obj.geometry.dispose(); });
    this.materials.forEach(mat => mat.dispose()); this.textures.forEach(tex => tex.dispose());
    this.tweens.splice(0).forEach(tween => tween.done());
    this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
