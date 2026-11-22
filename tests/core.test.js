// Проверка чистого ядра (раскладка, регистр, очистка, починка, даты, числа, строки, обозначения, обезличивание):
// node tests/core.test.js index.html
// Ядро — участок index.html между /*CORE-START*/ и /*CORE-END*/: без DOM, его можно выполнить в node.
const fs = require('fs');
const html = fs.readFileSync(process.argv[2] || 'index.html', 'utf8');
const core = html.slice(html.indexOf('/*CORE-START*/'), html.indexOf('/*CORE-END*/'));
const api = new Function(core + '; return { runSteps, autoLayout, decParse, decTree, decFmt, decList, anonymize, deanonymize, ANON_MAP: () => ANON_MAP };')();
let ok = 0, fail = 0;
const eq = (n, g, e) => { if (JSON.stringify(g) === JSON.stringify(e)) ok++; else { fail++; console.log('✗', n, '\n   получено:', JSON.stringify(g), '\n   ожидалось:', JSON.stringify(e)); } };
const R = (t, type, p) => api.runSteps(t, [{ type, p }], { on: false });

// [шаг, параметр, текст, ожидаемый результат]
const CASES = [
  ["layout", "en-ru", "ghbdtn? rfr ltkf", "привет, как дела"],
  ["layout", "ru-en", "руддщ цщкдв", "hello world"],
  ["layout", "ru-ua", "ыснувати", "існувати"],
  ["layout", "ua-ru", "обїект", "объект"],
  ["layout", "auto", "ghbdtn? rfr ltkf", "привет, как дела"],
  ["layout", "auto", "Ghbdtn^ vbh", "Привет: мир"],
  ["layout", "auto", "руддщ цщкдв", "hello world"],
  ["layout", "auto", "ghbdsn? zr cghfdb", "привіт, як справи"],
  ["layout", "auto", "Ыснувати", "Існувати"],
  ["layout", "auto", "Привет, как дела? Всё хорошо.", "Привет, как дела? Всё хорошо."],
  ["layout", "auto", "Болт М8х20 ГОСТ 7798-70", "Болт М8х20 ГОСТ 7798-70"],
  ["layout", "auto", "PDF, DXF и STEP файлы", "PDF, DXF и STEP файлы"],
  ["layout", "auto", "Hello world", "Hello world"],
  ["layout", "auto", "Проверь ckjdj в SolidWorks", "Проверь слово в SolidWorks"],
  ["layout", "auto", "Київ і Харків", "Київ і Харків"],
  ["case", "upper", "привет мир", "ПРИВЕТ МИР"],
  ["case", "sentence", "ПРИВЕТ. КАК ДЕЛА", "Привет. Как дела"],
  ["case", "title", "болт с гайкой", "Болт С Гайкой"],
  ["clean", "spaces", "а  б   в", "а б в"],
  ["clean", "hyphen", "сло-\nво", "слово"],
  ["clean", "all", "  Это   пере-\nнос  \n\n\nтекста  ", "Это перенос\n\nтекста"],
  ["fix", "enc", "Ðîçì³ðè äëÿ äîâ³äîê.", "Розміри для довідок."],
  ["fix", "enc", "ǋǱǭ ǰǶǱǰǼ", "Вид знизу"],
  ["fix", "enc", "ǓǩǪǮǴȅǶǱǲ ǫǫȎǭ", "Кабельний ввід"],
  ["fix", "pdf", "Í14; 15õ19", "Н14; 15х19"],
  ["fix", "mixed", "Гaйкa Б0ЛТ", "Гайка БОЛТ"],
  ["fix", "spaced", "П р и в е т  м и р", "Привет мир"],
  ["fix", "md", "**Жирный** и `код`\n# Заголовок", "Жирный и код\nЗаголовок"],
  ["fix", "invis", "а­б​в", "абв"],
  ["translit", "ua-lat", "Сергій Щукін", "Serhii Shchukin"],
  ["translit", "ru-lat", "Сергей Щукин", "Sergey Shchukin"],
  ["date", "dmy", "2026-11-21 и 21_11_2026", "21.11.2026 и 21.11.2026"],
  ["date", "under", "Табель 21.11.2026", "Табель 21_11_2026"],
  ["date", "ru", "21.11.2026", "21 ноября 2026 г."],
  ["date", "ua", "21.11.2026", "21 листопада 2026 р."],
  ["roman", "to-ar", "XIX век", "19 век"],
  ["roman", "to-rom", "19 век", "XIX век"],
  ["phone", "intl", "0671234567", "+380671234567"],
  ["lines", "sort", "в\nа\nб", "а\nб\nв"],
  ["lines", "uniq", "а\nб\nа", "а\nб"],
  ["lines", "merge", "Болт М8 — 4 шт\nБолт М8 — 2 шт", "Болт М8 — 6 шт"],
  ["lines", {"k": "wsep", "sep": "_"}, "Табель Відділ КБ, 05 2026", "Табель_Відділ_КБ_05_2026"],
  ["lines", {"k": "filter", "q": "ГОСТ", "keep": true}, "Болт ГОСТ\nВинт ДСТУ", "Болт ГОСТ"],
  ["num", {"m": "card", "l": "ru", "c": "nom", "g": "m", "cur": "UAH"}, "125", "сто двадцать пять"],
  ["numw", "digits", "двадцать пятого", "25-го"]
];
CASES.forEach(([type, p, t, e]) => eq(type + ' ' + JSON.stringify(p) + ': ' + t.slice(0, 30), R(t, type, p), e));

/* ---------- раскладка: авто ---------- */
const A = api.autoLayout;
const ENK = "`qwertyuiop[]asdfghjkl;'zxcvbnm,./~QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>?@#$^&";
const RUK = 'ёйцукенгшщзхъфывапролджэячсмитьбю.ЁЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ,"№;:?';
const UAK = "'йцукенгшщзхїфівапролджєячсмитьбю.'ЙЦУКЕНГШЩЗХЇФІВАПРОЛДЖЄЯЧСМИТЬБЮ,\"№;:?";
const re = (t, from, to) => [...t].map(c => { const i = from.indexOf(c); return i >= 0 ? to[i] : c; }).join('');
const RU = ['Привет, как дела? Всё хорошо, спасибо.', 'Добрый день! Прошу согласовать чертёж до конца недели', 'Сегодня я в офисе, перезвоню позже',
  'Это сложный вопрос, давай обсудим завтра', 'Отправил письмо поставщику, жду ответа', 'Нужно проверить размеры детали и толщину листа',
  'Сборочный чертёж и спецификация готовы', 'А мы уже на месте', 'Щука, съезд, объём, подъезд'];
const UK = ['Привіт, як справи? Все добре.', 'Розміри для довідок', 'Відомість покупних виробів', "Прошу погодити креслення до п'ятниці",
  'Їжак їсть яблуко', 'Ми вже на місці, чекаємо', 'Надішліть, будь ласка, специфікацію', 'Є питання щодо товщини листа'];
const EN = ['Hello world, this is a test of English text.', 'Please send me the drawings by Friday', 'The assembly is ready for welding',
  'I will call you back later', 'Check the sheet thickness and the bend radius'];
const KEEP = ['SolidWorks и Inventor установлены', 'Болт М8х20 ГОСТ 7798-70 — 4 шт', 'АЮИА.358-07.01.00.00.00 СК', 'email: test@mail.com, тел. 067 123 45 67',
  'PDF, DXF и STEP файлы', 'ОТК принял партию', 'Київ, Харків і Дніпро — города Украины', 'Розміри для довідок. Невказані граничні відхилення H14, h14'];
[...RU, ...UK, ...EN, ...KEEP].forEach(t => eq('авто: верный текст не меняется: ' + t, A(t), t));
RU.forEach(t => eq('авто: русский в английской раскладке: ' + t, A(re(t, RUK, ENK)), t));
UK.forEach(t => eq('авто: украинский в английской раскладке: ' + t, A(re(t, UAK, ENK)), t));
EN.forEach(t => eq('авто: английский в русской раскладке: ' + t, A(re(t, ENK, RUK)), t));
eq('авто: украинское слово в русской раскладке (ы в начале)', A('ыснувати'), 'існувати');

/* ---------- обозначения ---------- */
const D = s => { const d = api.decParse(s), t = api.decTree(d); return { base: d.base, p: d.p, part: t.part, k: t.k, sub: t.sub, up: t.up.map(q => api.decFmt(d.base, q)) }; };
eq('обозначение изделия', D('АЮИА.358-07.00.00.00.00 СК Блокувальник'), { base: 'АЮИА.358-07', p: [0, 0, 0, 0], part: false, k: -1, sub: 0, up: [] });
eq('обозначение без пар', D('АЮИА.358-07').p, [0, 0, 0, 0]);
eq('обозначение узла', D('АЮИА.358-07.03.02.00.00'), { base: 'АЮИА.358-07', p: [3, 2, 0, 0], part: false, k: 1, sub: 2, up: ['АЮИА.358-07.00.00.00.00', 'АЮИА.358-07.03.00.00.00'] });
eq('обозначение детали', D('АЮИА.358-07.03.02.00.07').up, ['АЮИА.358-07.00.00.00.00', 'АЮИА.358-07.03.00.00.00', 'АЮИА.358-07.03.02.00.00']);
eq('обозначение с (rev.2.0)', D('АЮИА.333-01.00.00.00.00(rev.2.0) СК').base, 'АЮИА.333-01');
eq('номера сборок шагом 10', api.decList([0, 0, 0, 0], 0, 3, 10).map(q => api.decFmt('А', q)), ['А.10.00.00.00', 'А.20.00.00.00', 'А.30.00.00.00']);

/* ---------- обезличивание ---------- */
const an = api.anonymize('Иванов Иван Иванович, тел. 067 123 45 67, ivan@mail.com', { fio: true, tel: true, email: true }, {});
eq('обезличить', an.text, '[ФИО1], тел. [ТЕЛ1], [EMAIL1]');
eq('вернуть данные', api.deanonymize('Ответ для [ФИО1] (ТЕЛ1)', an.map), 'Ответ для Иванов Иван Иванович (067 123 45 67)');

console.log(`\nЯдро: пройдено ${ok}, ошибок ${fail}`);
process.exit(fail ? 1 : 0);
