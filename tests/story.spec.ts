import { expect, test, type Page } from '@playwright/test';
import { stories } from '../src/stories';

type StoryState = { phase: string; page: number; reacted: boolean };
type ScreenBounds = { left: number; right: number; top: number; bottom: number; clipped: boolean };
type WorldState = {
  heroBounds: ScreenBounds | null;
  starBounds: ScreenBounds | null;
  books: { bounds: ScreenBounds }[];
};
const browserErrors = new WeakMap<Page, string[]>();
const allowedBrowserErrors = new WeakMap<Page, RegExp[]>();
const forest = stories[0];
const forestAnswer = forest.quiz.options[forest.quiz.answer];
const forestWrongAnswer = forest.quiz.options[(forest.quiz.answer + 1) % forest.quiz.options.length];
const japaneseKana = /[\u3041-\u3096\u30a1-\u30fa]/u;

const stage = (page: Page) => page.locator('[data-phase]').first();
async function expectChinese(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN');
  expect(await page.locator('body').innerText(), 'Visible interface copy must not retain Japanese kana.').not.toMatch(japaneseKana);
}

async function expectPhase(page: Page, phase: string) {
  await expect(stage(page)).toHaveAttribute('data-phase', phase);
  await expectChinese(page);
  if (['reading', 'quiz', 'reward'].includes(phase)) {
    const room = await page.locator('.reading-room').boundingBox();
    const viewport = page.viewportSize();
    expect(room?.width, 'The reading room must fill the viewport width.').toBeGreaterThan((viewport?.width ?? 0) * 0.95);
    expect(room?.height, 'The reading room must fill the viewport height.').toBeGreaterThan((viewport?.height ?? 0) * 0.95);
    for (const selector of ['.site-header', '.reading-room .intro', '.experience-note', '.site-footer']) {
      await expect(page.locator(selector), `Shelf content ${selector} must stay hidden during immersive reading.`).toBeHidden();
    }
    await expect(page.getByRole('button', { name: /^(关闭|开启)声音$/ })).toBeVisible();
  }
}

async function markPersistentCanvas(page: Page) {
  await page.locator('.three-stage canvas').evaluate(canvas => canvas.setAttribute('data-qa-persistent-canvas', 'true'));
}

async function expectPersistentCanvas(page: Page) {
  await expect(page.locator('.three-stage canvas[data-qa-persistent-canvas="true"]')).toHaveCount(1);
}

async function state(page: Page): Promise<StoryState> {
  return page.evaluate(() => {
    const app = window as unknown as { __BOOKS_DEBUG__: { getState: () => StoryState } };
    return app.__BOOKS_DEBUG__.getState();
  });
}

async function expectStoryPage(page: Page, expected: number) {
  await expect.poll(async () => (await state(page)).page).toBe(expected);
}

async function worldState(page: Page): Promise<WorldState> {
  return page.evaluate(() => {
    const app = window as unknown as { __BOOKS_DEBUG__: { world: { getDebugState: () => WorldState } } };
    return app.__BOOKS_DEBUG__.world.getDebugState();
  });
}

async function expectCharactersInFrame(page: Page) {
  const { heroBounds, starBounds } = await worldState(page);
  expect(heroBounds, 'The main character must be present.').not.toBeNull();
  expect(starBounds, 'The story object must be present.').not.toBeNull();
  expect(heroBounds?.clipped, `Main character clipped: ${JSON.stringify(heroBounds)}`).toBe(false);
  expect(starBounds?.clipped, `Story object clipped: ${JSON.stringify(starBounds)}`).toBe(false);
}

async function expectShelfCoversInFrame(page: Page) {
  const { books } = await worldState(page);
  expect(books).toHaveLength(3);
  expect(books.every(book => !book.bounds.clipped), `Shelf covers clipped: ${JSON.stringify(books)}`).toBe(true);
}

async function openStory(page: Page) {
  await page.goto('/');
  await expectPhase(page, 'shelf');
  await page.getByRole('button', { name: `打开${forest.title}`, exact: true }).click();
  await expectPhase(page, 'reading');
  await expectStoryPage(page, 0);
  await expectCharactersInFrame(page);
}

async function reactToScene(page: Page, useCanvas = false) {
  await expectCharactersInFrame(page);
  if (useCanvas) {
    const point = await page.evaluate(() => {
      const app = window as unknown as {
        __BOOKS_DEBUG__: { world?: { getInteractionPoint?: () => { x: number; y: number } | null } };
      };
      return app.__BOOKS_DEBUG__.world?.getInteractionPoint?.() ?? null;
    });
    expect(point, 'The live Three.js character must expose a clickable screen position.').not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
  } else {
    await page.getByTestId('interact').click();
  }
  await expectPhase(page, 'reading');
  await expect.poll(async () => (await state(page)).reacted).toBe(true);
  await expectCharactersInFrame(page);
  await expect(page.getByTestId('next-page')).toBeEnabled();
}

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  allowedBrowserErrors.set(page, []);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', request => {
    if (request.failure()?.errorText !== 'net::ERR_ABORTED') errors.push(`${request.url()}: ${request.failure()?.errorText}`);
  });
});

test.afterEach(({ page }) => {
  const unexpected = browserErrors.get(page)?.filter(message => !allowedBrowserErrors.get(page)?.some(pattern => pattern.test(message)));
  expect(unexpected, 'The WebGL experience must not generate unexpected browser or asset errors.').toEqual([]);
});

test('a complete story: character interaction, four pages, quiz, reward, and return to shelf', async ({ page }) => {
  test.setTimeout(180_000);
  expect(JSON.stringify(stories), 'Every authored story must use the Chinese translation.').not.toMatch(japaneseKana);
  await page.goto('/');
  await expectPhase(page, 'shelf');
  await expectShelfCoversInFrame(page);
  const shelfCanvas = await page.locator('.three-stage canvas').boundingBox();
  expect(shelfCanvas).not.toBeNull();
  await markPersistentCanvas(page);
  await page.screenshot({ path: 'artifacts/shelf-desktop.png' });
  await page.getByRole('button', { name: `打开${forest.title}`, exact: true }).click();
  await expectPhase(page, 'reading');
  await expectPersistentCanvas(page);
  const readingCanvas = await page.locator('.three-stage canvas').boundingBox();
  expect(readingCanvas?.height).toBeGreaterThan(shelfCanvas!.height * 1.3);
  await page.screenshot({ path: 'artifacts/reading-desktop.png' });

  for (let index = 0; index < 4; index += 1) {
    await expectStoryPage(page, index);
    await expect.poll(async () => (await state(page)).reacted).toBe(false);
    await reactToScene(page, index === 0);
    await page.getByTestId('next-page').click();
    await expectPhase(page, index === 3 ? 'quiz' : 'reading');
  }

  await page.getByRole('button', { name: forestWrongAnswer, exact: true }).click();
  await expectPhase(page, 'quiz');
  await expect(page.getByTestId('collect-reward')).toHaveCount(0);
  await page.getByRole('button', { name: forestAnswer, exact: true }).click();
  await expect(page.getByText('答对啦！', { exact: false })).toBeVisible();
  await page.getByTestId('collect-reward').click();
  await expectPhase(page, 'reward');
  await expect(page.getByRole('heading', { name: `收集到了「${forest.reward}」！`, exact: true })).toBeVisible();
  await expectPersistentCanvas(page);
  await page.getByRole('button', { name: '返回书架', exact: true }).first().click();
  await expectPhase(page, 'shelf');
  await expectPersistentCanvas(page);
  await expect(page.getByRole('button', { name: '我的收藏 1 / 3', exact: true })).toBeVisible();
  await page.reload();
  await expectPhase(page, 'shelf');
  await page.getByRole('button', { name: '我的收藏 1 / 3', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectChinese(page);
  await expect(page.getByRole('heading', { name: forest.reward, exact: true })).toBeVisible();
});

test('rapid clicks cannot skip an interaction or advance more than one page', async ({ page }) => {
  await openStory(page);
  const interaction = await page.getByTestId('interact').boundingBox();
  expect(interaction).not.toBeNull();
  await page.mouse.click(interaction!.x + interaction!.width / 2, interaction!.y + interaction!.height / 2, { clickCount: 7, delay: 20 });
  await expectPhase(page, 'reading');
  await expect.poll(async () => (await state(page)).reacted).toBe(true);
  await expectStoryPage(page, 0);

  const next = await page.getByTestId('next-page').boundingBox();
  expect(next).not.toBeNull();
  const hiddenDuringFlip = page.waitForFunction(() => {
    const app = window as unknown as {
      __BOOKS_DEBUG__: { world: { getDebugState: () => { locked: boolean; popupsVisible: boolean } } };
    };
    const world = app.__BOOKS_DEBUG__.world.getDebugState();
    return world.locked && !world.popupsVisible;
  }, undefined, { polling: 'raf', timeout: 30_000 });
  const [, observedHiddenFrame] = await Promise.all([
    page.mouse.click(next!.x + next!.width / 2, next!.y + next!.height / 2, { clickCount: 7, delay: 20 }),
    hiddenDuringFlip,
  ]);
  await observedHiddenFrame.dispose();
  await expectPhase(page, 'reading');
  await expectStoryPage(page, 1);
  await expect.poll(async () => (await state(page)).reacted).toBe(false);
  await expectCharactersInFrame(page);
});

for (const story of stories.slice(1)) {
  test(`${story.title}: all four scenes lead to its own quiz and collectible`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await expectPhase(page, 'shelf');
    await expectShelfCoversInFrame(page);
    await page.getByRole('button', { name: `打开${story.title}`, exact: true }).click();
    await expectPhase(page, 'reading');
    await page.screenshot({ path: `artifacts/reading-${story.id}-desktop.png` });
    for (let index = 0; index < 4; index += 1) {
      await expectStoryPage(page, index);
      await reactToScene(page);
      await page.getByTestId('next-page').click();
      await expectPhase(page, index === 3 ? 'quiz' : 'reading');
    }
    await page.getByRole('button', { name: story.quiz.options[story.quiz.answer], exact: true }).click();
    await page.getByTestId('collect-reward').click();
    await expectPhase(page, 'reward');
    await expect(page.getByRole('heading', { name: `收集到了「${story.reward}」！`, exact: true })).toBeVisible();
    await page.getByRole('button', { name: '返回书架', exact: true }).first().click();
    await expectPhase(page, 'shelf');
    await expect(page.getByRole('button', { name: '我的收藏 1 / 3', exact: true })).toBeVisible();
  });
}

test('sound, help, and collection controls remain accessible', async ({ page }) => {
  await page.goto('/');
  await expectPhase(page, 'shelf');
  const mute = page.getByRole('button', { name: /^(关闭|开启)声音$/ });
  const initial = await mute.getAttribute('aria-pressed');
  expect(initial).toMatch(/^(true|false)$/);
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', initial === 'true' ? 'false' : 'true');
  await mute.click();
  await expect(mute).toHaveAttribute('aria-pressed', initial!);

  await page.getByRole('button', { name: '怎么玩', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectChinese(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: '我的收藏 0 / 3', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expectChinese(page);
  await expect(page.getByText('0 / 3', { exact: true }).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('reduced motion preserves story interaction and page order', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openStory(page);
  await reactToScene(page);
  await page.getByTestId('next-page').click();
  await expectPhase(page, 'reading');
  await expectStoryPage(page, 1);
  await expect.poll(async () => (await state(page)).reacted).toBe(false);
  await expect(page.getByTestId('interact')).toBeEnabled();
});

test('keyboard focus follows the story through opening, interaction, and page turn', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expectPhase(page, 'shelf');
  await page.getByRole('button', { name: `打开${forest.title}`, exact: true }).focus();
  await page.keyboard.press('Enter');
  await expectPhase(page, 'reading');
  await expect(page.getByTestId('interact')).toBeFocused();
  await page.keyboard.press('Enter');
  await expectPhase(page, 'reading');
  await expect(page.getByTestId('next-page')).toBeFocused();
  await page.keyboard.press('Enter');
  await expectPhase(page, 'reading');
  await expectStoryPage(page, 1);
  await expect(page.getByTestId('interact')).toBeFocused();
});

test('blocked storage still awards the treasure with a clear session-only notice', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException('Storage disabled for this test', 'QuotaExceededError'); };
  });
  await openStory(page);
  for (let index = 0; index < 4; index += 1) {
    await reactToScene(page);
    await page.getByTestId('next-page').click();
    await expectPhase(page, index === 3 ? 'quiz' : 'reading');
  }
  await page.getByRole('button', { name: forestAnswer, exact: true }).click();
  await page.getByTestId('collect-reward').click();
  await expectPhase(page, 'reward');
  await expect(page.getByText('浏览器暂时无法保存，收藏只在本次打开期间保留。', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: `收集到了「${forest.reward}」！`, exact: true })).toBeVisible();
});

test('WebGL unavailable shows a usable error and retry recovers when rendering becomes available', async ({ page }) => {
  allowedBrowserErrors.set(page, [/THREE\.WebGLRenderer: Error creating WebGL context\./]);
  await page.addInitScript(() => {
    const flags = window as unknown as { __ALLOW_WEBGL__: boolean };
    flags.__ALLOW_WEBGL__ = false;
    HTMLCanvasElement.prototype.getContext = new Proxy(HTMLCanvasElement.prototype.getContext, {
      apply(target, context, args) {
        if (String(args[0]).startsWith('webgl') && !flags.__ALLOW_WEBGL__) return null;
        return Reflect.apply(target, context, args);
      },
    });
  });
  await page.goto('/');
  await expectPhase(page, 'error');
  await expect(page.getByRole('status')).toContainText('WebGL');
  await page.evaluate(() => { (window as unknown as { __ALLOW_WEBGL__: boolean }).__ALLOW_WEBGL__ = true; });
  await page.getByRole('button', { name: '再试一次', exact: true }).click();
  await expectPhase(page, 'shelf');
  await expect(page.locator('.three-stage canvas')).toHaveCount(1);
  await page.getByRole('button', { name: `打开${forest.title}`, exact: true }).click();
  await expectPhase(page, 'reading');
  await expect(page.getByTestId('interact')).toBeEnabled();
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('touch layout has no horizontal overflow and supports story interaction', async ({ page }) => {
    await page.goto('/');
    await expectPhase(page, 'shelf');
    await expectShelfCoversInFrame(page);
    const shelfCanvas = await page.locator('.three-stage canvas').boundingBox();
    expect(shelfCanvas).not.toBeNull();
    await markPersistentCanvas(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'artifacts/shelf-mobile.png' });
    await page.getByRole('button', { name: `打开${forest.title}`, exact: true }).tap();
    await expectPhase(page, 'reading');
    await expectPersistentCanvas(page);
    const readingCanvas = await page.locator('.three-stage canvas').boundingBox();
    expect(readingCanvas?.height).toBeGreaterThan(shelfCanvas!.height * 1.3);
    await expectCharactersInFrame(page);
    await expect(page.getByTestId('interact')).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: 'artifacts/reading-mobile.png' });
    await page.getByTestId('interact').tap();
    await expectPhase(page, 'reading');
    await expect.poll(async () => (await state(page)).reacted).toBe(true);
    await page.getByTestId('next-page').tap();
    await expectPhase(page, 'reading');
    await expectStoryPage(page, 1);
    await expectCharactersInFrame(page);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('short landscape reading preserves the canvas and restores a scrolled shelf', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/');
    await expectPhase(page, 'shelf');
    const book = page.getByRole('button', { name: `打开${forest.title}`, exact: true });
    await book.scrollIntoViewIfNeeded();
    await book.tap({ trial: true });
    const shelfScroll = await page.evaluate(() => window.scrollY);
    expect(shelfScroll, 'This case must open from a shelf that has actually been scrolled.').toBeGreaterThan(50);
    await markPersistentCanvas(page);
    await book.tap();
    await expectPhase(page, 'reading');
    await expectPersistentCanvas(page);
    await expectCharactersInFrame(page);
    await expect(page.getByTestId('interact')).toBeInViewport({ ratio: 1 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'artifacts/reading-landscape.png' });

    const sound = page.getByRole('button', { name: /^(关闭|开启)声音$/ });
    const initialSound = await sound.getAttribute('aria-pressed');
    await sound.tap();
    await expect(sound).toHaveAttribute('aria-pressed', initialSound === 'true' ? 'false' : 'true');
    await page.getByTestId('interact').tap();
    await expectPhase(page, 'reading');
    await expect(page.getByTestId('next-page')).toBeInViewport({ ratio: 1 });
    await page.getByTestId('next-page').tap();
    await expectPhase(page, 'reading');
    await expectStoryPage(page, 1);
    await expectCharactersInFrame(page);
    await page.getByRole('button', { name: '返回书架', exact: true }).tap();
    await expectPhase(page, 'shelf');
    await expectPersistentCanvas(page);
    await expectShelfCoversInFrame(page);
    await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - shelfScroll)).toBeLessThan(2);
    await expect(book).toBeFocused();
    await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.locator('.reading-room .intro')).toBeVisible();
    await expect(page.locator('.experience-note')).toBeVisible();
    await expect(page.locator('.site-footer')).toBeVisible();
  });
});
