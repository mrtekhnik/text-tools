// Проверка интерфейса в Chrome: node tests/ui.test.js <url приложения> <папка для снимков> [<url tests/host.html — проверка внутри лаунчера>]
// Пример: python3 -m http.server 8765, затем
//   node tests/ui.test.js http://localhost:8765/index.html /tmp/shots http://localhost:8765/tests/host.html
const {chromium} = require('/opt/npm-tools/node_modules/playwright');
const URL = process.argv[2], OUT = process.argv[3], HOST = process.argv[4];
let ok = 0, fail = 0;
const eq = (n, g, e) => { if (JSON.stringify(g) === JSON.stringify(e)) ok++; else { fail++; console.log('✗', n, '\n   получено:', JSON.stringify(g), '\n   ожидалось:', JSON.stringify(e)); } };
// мини-окно Chrome «картинка в картинке» в тесте заменяется обычным всплывающим окном
const FAKE_PIP = () => { Object.defineProperty(window, 'documentPictureInPicture', {configurable: true, value: {requestWindow: async o => {
  window.__pipFrom = window === window.top ? 'лаунчер' : 'врезка'; return window.open('', 'mini', `width=${o.width},height=${o.height}`); }}}); };
const setText = (page, t) => page.evaluate(t => { const s = document.querySelector('#src'); s.value = t; s.dispatchEvent(new Event('input', {bubbles: true})); }, t);
const outVal = page => page.inputValue('#out');
const stepLabels = page => page.$$eval('#steps .step', ns => ns.map(n => n.firstChild.textContent.trim()));

(async () => {
  const browser = await chromium.launch({executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox']});
  const errors = [];
  const watch = (page, name) => { page.on('pageerror', e => errors.push(name + ': ' + e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_|Failed to load resource/.test(m.text())) errors.push(name + ' console: ' + m.text()); }); };

  /* ---------- компьютер ---------- */
  const pc = await browser.newContext({viewport: {width: 1400, height: 900}, permissions: ['clipboard-read', 'clipboard-write']});
  const d = await pc.newPage(); watch(d, 'pc');
  await d.goto(URL); await d.waitForSelector('#tools .ttab');
  eq('название в шапке', await d.textContent('header h1'), 'Текстовые инструменты');
  eq('вкладки (на компьютере — вкладками)', await d.$eval('#tools', n => n.classList.contains('tabbed')), true);
  eq('кнопка мини-окна видна (Chrome на ПК)', await d.isVisible('#miniBtn'), true);
  eq('кнопка размера в основном окне скрыта', await d.isVisible('#sizeBtn'), false);
  eq('одна кнопка в основном окне скрыта', await d.isVisible('#quickGo'), false);

  await setText(d, 'ghbdtn? rfr ltkf');
  await d.click('.ttab[data-g="layout"]');
  await d.click('[data-t="layout"][data-p="auto"]');
  eq('раскладка авто', await outVal(d), 'привет, как дела');
  eq('шаг добавлен', await stepLabels(d), ['Раскладка: авто']);
  await d.click('.ttab[data-g="case"]'); await d.click('[data-t="case"][data-p="upper"]');
  eq('второй шаг', await outVal(d), 'ПРИВЕТ, КАК ДЕЛА');
  await d.click('#src'); await d.keyboard.press('Control+z');
  eq('Ctrl+Z отменяет шаг', await outVal(d), 'привет, как дела');
  await d.keyboard.press('Control+y');
  eq('Ctrl+Y повторяет', await outVal(d), 'ПРИВЕТ, КАК ДЕЛА');
  await d.keyboard.press('Control+Enter');
  eq('Ctrl+Enter копирует результат', await d.evaluate(() => navigator.clipboard.readText()), 'ПРИВЕТ, КАК ДЕЛА');
  // все вкладки открываются без ошибок
  const tabs = await d.$$eval('.ttab', ns => ns.filter(n => !n.hidden).map(n => n.dataset.g));
  for (const g of tabs) await d.click(`.ttab[data-g="${g}"]`);
  eq('вкладок не меньше 18', tabs.length >= 18, true);
  await d.click('.ttab[data-g="case"]'); await d.hover('.ttab[data-g="case"]'); await d.mouse.wheel(0, 100); await d.waitForTimeout(50);
  eq('колесо над вкладками на компьютере раздел не меняет', await d.$eval('.ttab.on', n => n.dataset.g), 'case');
  // поиск команды
  await d.keyboard.press('Control+k');
  await d.fill('.pal input', 'мини');
  eq('поиск находит мини-окно', (await d.$$eval('.palitem', ns => ns.map(n => n.textContent))).some(t => t.includes('Мини-окно поверх всех окон')), true);
  await d.keyboard.press('Escape');
  // даты: свой календарь
  await d.click('.ttab[data-g="dates"]'); await d.click('#dateWhich .seg[data-v="custom"]');
  eq('календарь: 7 дней недели', await d.$$eval('.calwd', ns => ns.length), 7);
  await d.click('.calday >> text="15"');
  eq('календарь: дата выбрана', await d.$eval('#dateWhich .seg.on', n => n.dataset.v), 'custom');
  // обозначения
  await d.click('.ttab[data-g="dec"]'); await d.fill('#decIn', 'АЮИА.358-07.03.00.00.00');
  eq('обозначения: сборки следующего уровня', await d.$eval('.decitem .decchip', n => n.textContent), 'АЮИА.358-07.03.01.00.00');
  // меню и справка
  await d.click('#menuBtn');
  eq('меню: пункт мини-окна', (await d.$$eval('.sheet .btn', ns => ns.map(n => n.textContent))).includes('Мини-окно поверх всех окон (Ctrl+M)'), true);
  await d.click('.sheet .btn >> text=Справка');
  await d.waitForSelector('.help details');
  const helpText = (await d.textContent('.help')).toLowerCase();
  const groups = (await d.$$eval('.ttab', ns => ns.map(n => n.textContent.replace('★', '').trim()))).filter(g => g !== 'Частые');
  eq('справка: все группы описаны', groups.filter(g => !helpText.includes(g.toLowerCase().split(' ')[0])), []);
  eq('справка: мини-окно, клавиши, авто', ['мини-окно поверх всех окон', 'ctrl+m', 'одна крупная кнопка', 'авто'].filter(w => !helpText.replace(/\s+/g, '').includes(w.replace(/\s+/g, '')) && !helpText.includes(w)), []);
  await d.keyboard.press('Escape');
  await d.screenshot({path: OUT + '/pc-1.png'});

  /* ---------- телефон ---------- */
  const phone = await browser.newContext({viewport: {width: 393, height: 780}, deviceScaleFactor: 2.75, isMobile: true, hasTouch: true});
  const p = await phone.newPage(); watch(p, 'phone');
  await p.goto(URL); await p.waitForSelector('#tools .ttab');
  eq('телефон: название в шапке', await p.isVisible('header h1'), true);
  eq('телефон: кнопки мини-окна нет', await p.isVisible('#miniBtn'), false);
  eq('телефон: нижняя панель', await p.isVisible('#actbar'), true);
  await p.tap('#tabMenuBtn');
  eq('телефон: список вкладок ▲', await p.$$eval('#tabPop .tabpi', ns => ns.length) >= 18, true);
  await p.tap('#tabPop .tabpi >> text=Раскладка');
  await setText(p, 'руддщ цщкдв');
  await p.tap('[data-t="layout"][data-p="auto"]');
  eq('телефон: раскладка авто', await outVal(p), 'hello world');
  await p.screenshot({path: OUT + '/phone-1.png'});
  await phone.close();

  /* ---------- мини-окно поверх всех окон ---------- */
  const pcm = await browser.newContext({viewport: {width: 1280, height: 720}, colorScheme: 'light', permissions: ['clipboard-read', 'clipboard-write']});
  await pcm.addInitScript(FAKE_PIP);
  const m = await pcm.newPage(); watch(m, 'mini-main');
  await m.goto(URL); await m.waitForSelector('#tools .ttab');
  await setText(m, 'Текст до мини-окна');
  const [mw] = await Promise.all([m.waitForEvent('popup'), m.click('#miniBtn')]);
  watch(mw, 'mini');
  await mw.waitForSelector('#tools .ttab');
  await mw.setViewportSize({width: 460, height: 760});   // настоящее мини-окно — 460×760
  eq('мини: в основном окне надпись', (await m.textContent('#miniNote')).replace(/\s+/g, ' '), 'Текстовые инструментыОткрыто в мини-окне поверх всех оконВернуть сюда');
  eq('мини: интерфейс перенесён', await m.$$eval('#src', ns => ns.length), 0);
  eq('мини: текст на месте', await mw.inputValue('#src'), 'Текст до мини-окна');
  eq('мини: название в шапке', await mw.textContent('header h1'), 'Текстовые инструменты');
  eq('мини: тема «как в системе» — как в основном окне (светлая)', await mw.evaluate(() => [document.documentElement.dataset.theme, getComputedStyle(document.documentElement).colorScheme]), ['light', 'light']);
  eq('мини: раскладка как на телефоне (вкладки внизу)', await mw.$eval('#tools', n => n.classList.contains('tabbed')), false);
  eq('мини: режим обычный', await mw.evaluate(() => document.body.classList.contains('m-full')), true);
  eq('мини: в обычном режиме нет одной кнопки (команды внизу)', await mw.isVisible('#quickGo'), false);
  // окна (меню, настройки) и клавиши работают в мини-окне
  await mw.click('#menuBtn');
  eq('мини: меню открывается в мини-окне', (await mw.$$eval('.sheet .btn', ns => ns.map(n => n.textContent))).includes('Вернуть из мини-окна (Ctrl+M)'), true);
  await mw.click('.sheet .btn >> text=Оформление и настройки…');
  if (!(await mw.isVisible('.sheet .thm button >> text=Тёмная'))) await mw.click('.sheet summary >> text=Тема');
  await mw.click('.sheet .thm button >> text=Тёмная');
  eq('мини: тёмная тема из настроек', [await mw.evaluate(() => document.documentElement.dataset.theme), await m.evaluate(() => document.documentElement.dataset.theme)], ['dark', 'dark']);
  await mw.click('.sheet .thm button >> text=Как в системе');
  eq('мини: снова как в системе', await mw.evaluate(() => document.documentElement.dataset.theme), 'light');
  await mw.keyboard.press('Escape');
  eq('мини: Esc закрывает окно', await mw.$$eval('.sheet', ns => ns.length), 0);
  await setText(mw, 'уже чистый текст');
  await mw.click('.ttab[data-g="case"]'); await mw.click('[data-t="case"][data-p="upper"]');
  eq('мини: команды работают', await mw.inputValue('#out'), 'УЖЕ ЧИСТЫЙ ТЕКСТ');
  await mw.click('#src'); await mw.keyboard.press('Control+z');
  eq('мини: Ctrl+Z', await mw.inputValue('#out'), 'уже чистый текст');
  // колесо мыши над вкладками — следующий / предыдущий раздел
  await mw.hover('.ttab[data-g="case"]');
  await mw.mouse.wheel(0, 100); await mw.waitForTimeout(50);
  eq('мини: колесо вниз — следующий раздел', await mw.$eval('.ttab.on', n => n.dataset.g), 'clean');
  await mw.waitForTimeout(450); await mw.mouse.wheel(0, -100); await mw.waitForTimeout(50);
  eq('мини: колесо вверх — предыдущий раздел', await mw.$eval('.ttab.on', n => n.dataset.g), 'case');
  await mw.screenshot({path: OUT + '/mini-1-full.png'});
  // компактный: одна кнопка «буфер → действие → буфер», выбор действия, результат
  await mw.click('#sizeBtn');
  eq('мини: компактный режим', await mw.evaluate(() => document.body.classList.contains('m-compact')), true);
  await mw.setViewportSize({width: 420, height: 380});
  eq('мини: компактный — кнопка, выбор и результат видны, поле текста скрыто', [await mw.isVisible('#quickGo'), await mw.isVisible('#quickAct'), await mw.isVisible('#out'), await mw.isVisible('#src')], [true, true, true, false]);
  eq('мини: подпись к выбору', await mw.textContent('.quickrow label'), 'Кнопка делает:');
  await mw.evaluate(() => navigator.clipboard.writeText('ghbdtn? rfr ltkf'));
  await mw.click('#quickGo'); await mw.waitForFunction(() => document.querySelector('#quickMsg').textContent);
  eq('мини: результат в буфере', await mw.evaluate(() => navigator.clipboard.readText()), 'привет, как дела');
  eq('мини: сообщение', await mw.textContent('#quickMsg'), '✓ Готово и скопировано: 16 симв.');
  eq('мини: текст из буфера в поле', await mw.inputValue('#src'), 'ghbdtn? rfr ltkf');
  await mw.selectOption('#quickAct', 'fix:md');
  eq('мини: название действия на кнопке', await mw.textContent('#quickName'), 'Ответ ИИ → текст');
  await mw.evaluate(() => navigator.clipboard.writeText('**Жирный** и `код`'));
  await mw.click('#quickGo'); await mw.waitForFunction(() => /Жирный/.test(document.querySelector('#src').value)); await mw.waitForTimeout(150);
  eq('мини: ответ ИИ → текст', await mw.evaluate(() => navigator.clipboard.readText()), 'Жирный и код');
  await mw.evaluate(() => navigator.clipboard.writeText('уже чистый текст'));
  await mw.click('#quickGo'); await mw.waitForFunction(() => /уже/.test(document.querySelector('#src').value)); await mw.waitForTimeout(150);
  eq('мини: без изменений — так и сказано', await mw.textContent('#quickMsg'), 'Ничего не изменилось — текст скопирован как был');
  await mw.selectOption('#quickAct', 'layout:auto');
  await mw.screenshot({path: OUT + '/mini-2-compact.png'});
  await mw.click('#sizeBtn');
  eq('мини: одна кнопка', await mw.evaluate(() => document.body.classList.contains('m-button')), true);
  await mw.setViewportSize({width: 380, height: 176});
  eq('мини: одна кнопка — видны название, кнопка и выбор', [await mw.isVisible('header h1'), await mw.isVisible('#quickGo'), await mw.isVisible('#quickAct'), await mw.isVisible('#out')], [true, true, true, false]);
  eq('мини: одна кнопка — всё помещается', await mw.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1), true);
  await mw.screenshot({path: OUT + '/mini-3-button.png'});
  await mw.keyboard.press('Control+ArrowUp');
  eq('мини: Ctrl+↑ — больше', await mw.evaluate(() => document.body.classList.contains('m-compact')), true);
  await mw.keyboard.press('Control+ArrowDown');
  eq('мини: Ctrl+↓ — меньше', await mw.evaluate(() => document.body.classList.contains('m-button')), true);
  // свернуть до полоски с названием и развернуть
  await mw.keyboard.press('Control+ArrowDown');
  await mw.setViewportSize({width: 300, height: 60});
  eq('мини: свёрнуто — видны только название и «+»', [await mw.evaluate(() => document.body.classList.contains('m-fold')), await mw.isVisible('header h1'), await mw.isVisible('#foldBtn'),
    await mw.isVisible('#quickGo'), await mw.isVisible('#menuBtn'), await mw.textContent('#foldBtn')], [true, true, true, false, false, '+']);
  await mw.screenshot({path: OUT + '/mini-5-fold.png'});
  await mw.click('#foldBtn');
  eq('мини: развернули — прежний режим', await mw.evaluate(() => document.body.classList.contains('m-button')), true);
  await mw.click('#foldBtn');
  eq('мини: кнопка «–» сворачивает', await mw.evaluate(() => document.body.classList.contains('m-fold')), true);
  await mw.keyboard.press('Control+ArrowUp');
  eq('мини: Ctrl+↑ разворачивает', await mw.evaluate(() => document.body.classList.contains('m-button')), true);
  await mw.waitForTimeout(700);
  eq('мини: режим запомнен (не «свёрнуто»)', await m.evaluate(() => JSON.parse(localStorage.getItem('text-tools-v1')).ui.mini), 'button');
  await mw.click('#sizeBtn');
  eq('мини: по кругу — снова обычный', await mw.evaluate(() => document.body.classList.contains('m-full')), true);
  // Ctrl+M в мини-окне — вернуть (окно закрывается во время нажатия)
  await mw.keyboard.press('Control+m').catch(() => {});
  await m.waitForSelector('#src');
  eq('мини: Ctrl+M вернул интерфейс', await m.$$eval('#miniNote', ns => ns.length), 0);
  eq('мини: данные не потерялись', await m.inputValue('#src'), 'уже чистый текст');
  eq('мини: в основном окне снова вкладки', await m.$eval('#tools', n => n.classList.contains('tabbed')), true);
  // Ctrl+Ь (русская раскладка) открывает снова
  const [mw2] = await Promise.all([m.waitForEvent('popup'), m.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', {key: 'ь', code: 'KeyM', ctrlKey: true, bubbles: true})))]);
  await mw2.waitForSelector('#tools .ttab');
  eq('мини: Ctrl+Ь открыл мини-окно', await m.$$eval('#miniNote', ns => ns.length), 1);
  await m.click('#miniNote .btn');   // «Вернуть сюда»
  await m.waitForSelector('#src');
  eq('мини: «Вернуть сюда»', await m.$$eval('#miniNote', ns => ns.length), 0);
  const [mw3] = await Promise.all([m.waitForEvent('popup'), m.click('#miniBtn')]);
  await mw3.waitForSelector('#tools .ttab');
  await mw3.close();
  await m.waitForSelector('#src');
  eq('мини: закрыли окно — всё вернулось', [await m.$$eval('#miniNote', ns => ns.length), await m.inputValue('#src')], [0, 'уже чистый текст']);
  await m.click('#src'); await m.keyboard.press('End'); await m.keyboard.type('!');
  eq('мини: клавиатура снова в основном окне', await m.inputValue('#src'), 'уже чистый текст!');
  await m.screenshot({path: OUT + '/mini-4-back.png'});
  await pcm.close();

  // мини-окно не открылось — окно с ответом браузера
  const pce = await browser.newContext({viewport: {width: 1280, height: 720}});
  await pce.addInitScript(() => { Object.defineProperty(window, 'documentPictureInPicture', {configurable: true, value: {requestWindow: async () => { throw new DOMException('Document PiP requires user activation', 'NotAllowedError'); }}}); });
  const e1 = await pce.newPage(); watch(e1, 'mini-err');
  await e1.goto(URL); await e1.click('#miniBtn');
  await e1.waitForSelector('.sheet h2');
  eq('ошибка: заголовок', await e1.textContent('.sheet h2'), 'Мини-окно не открылось');
  eq('ошибка: ответ браузера', (await e1.textContent('.sheet')).includes('NotAllowedError Document PiP requires user activation'), true);
  eq('ошибка: без всплывающей надписи', await e1.$eval('#toast', n => n.classList.contains('show')), false);
  await pce.close();

  /* ---------- внутри лаунчера: мини-окно запрашивается у окна лаунчера ---------- */
  if (HOST) {
    const pcf = await browser.newContext({viewport: {width: 1280, height: 720}, permissions: ['clipboard-read', 'clipboard-write']});
    await pcf.addInitScript(FAKE_PIP);
    const host = await pcf.newPage(); watch(host, 'host');
    await host.goto(HOST);
    const fr = host.frameLocator('#app');
    await fr.locator('#tools .ttab').first().waitFor();
    await host.frames()[1].evaluate(() => { const s = document.querySelector('#src'); s.value = 'Текст во врезке'; s.dispatchEvent(new Event('input')); });
    const [fw] = await Promise.all([host.waitForEvent('popup'), fr.locator('#miniBtn').click()]);
    await fw.waitForSelector('#tools .ttab');
    await fw.click('#sizeBtn');   // компактный режим — с одной кнопкой
    eq('врезка: мини-окно запрошено у лаунчера', await host.evaluate(() => window.__pipFrom), 'лаунчер');
    eq('врезка: текст в мини-окне', await fw.inputValue('#src'), 'Текст во врезке');
    eq('врезка: надпись во врезке', (await fr.locator('#miniNote p').textContent()), 'Открыто в мини-окне поверх всех окон');
    await fw.evaluate(() => navigator.clipboard.writeText('руддщ'));
    await fw.click('#quickGo'); await fw.waitForFunction(() => document.querySelector('#quickMsg').textContent);
    eq('врезка: одна кнопка работает', await fw.evaluate(() => navigator.clipboard.readText()), 'hello');
    await fw.close();
    await fr.locator('#src').waitFor();
    eq('врезка: после закрытия всё вернулось', await fr.locator('#src').inputValue(), 'руддщ');
    await pcf.close();
  }

  // офлайн-кэш: сервис-воркер установлен, кэш с префиксом text-tools-
  if (/^https?:\/\/(localhost|127\.)|^https:/.test(URL)) {
    await d.reload();
    await d.evaluate(() => navigator.serviceWorker.ready);
    await d.waitForTimeout(800);
    const ver = (await d.evaluate(() => fetch('sw.js').then(r => r.text()))).match(/VERSION = '([^']+)'/)[1];
    eq('кэш', await d.evaluate(async () => (await caches.keys()).filter(k => k.startsWith('text-tools-'))), ['text-tools-' + ver]);
    eq('справка в офлайн-кэше', await d.evaluate(async () => !!(await (await caches.open((await caches.keys()).find(k => k.startsWith('text-tools-')))).match('help.part'))), true);
  }

  eq('ошибок JS нет', errors, []);
  await browser.close();
  console.log(`\nИнтерфейс: пройдено ${ok}, ошибок ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
