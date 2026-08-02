/* ============================================================
   Modern Web Calculator — expression editor
   Type a full expression (with brackets, prefixes like sin(90),
   and stacked functions), move the caret anywhere to edit, and
   evaluate with '='. Styles a caret so you always know where
   you'll insert/delete.
   ============================================================ */
'use strict';

/* Display-time glyph mapping (keeps caret indices aligned 1:1). */
function dispChar(ch) {
    if (ch === '*') return '\u00D7';   // ×
    if (ch === '/') return '\u00F7';   // ÷
    if (ch === '-') return '\u2212';   // −
    return ch;
}
function htmlEscape(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function fmtNumber(x) {
    if (typeof x !== 'number' || !isFinite(x)) return 'Error';
    return (Math.round(x * 1e10) / 1e10) + '';
}

class Calculator {
    constructor(prevEl, curEl) {
        this.prevEl = prevEl;
        this.curEl = curEl;
        this.deg = true;         // trig in degrees by default
        this.exp = '';           // expression text (editor content)
        this.pos = 0;            // caret offset into this.exp
        this.prevText = '';      // the "previous line" (last answer)
        this.repaint();
    }

    /* ---------- editing ---------- */
    clear() { this.exp = ''; this.pos = 0; this.prevText = ''; this.repaint(); }

    insert(text) {
        this.exp = this.exp.slice(0, this.pos) + text + this.exp.slice(this.pos);
        this.pos += text.length;
        this.repaint();
        this.keepCaretVisible();
    }

    erase() {
        if (this.pos <= 0) return;
        // erase the token (number / letters / symbol) immediately left of caret
        let start = this.pos;
        let c = this.exp[start - 1];
        if (/[A-Za-z0-9.]/.test(c)) {
            let j = start - 1;
            while (j > 0 && /[A-Za-z0-9.]/.test(this.exp[j - 1])) j--;
            start = j;
        } else {
            start = this.pos - 1;
        }
        this.exp = this.exp.slice(0, start) + this.exp.slice(this.pos);
        this.pos = start;
        this.repaint();
        this.keepCaretVisible();
    }

    moveLeft() { if (this.pos > 0) { this.pos--; this.repaint(); this.keepCaretVisible(); } }
    moveRight() { if (this.pos < this.exp.length) { this.pos++; this.repaint(); this.keepCaretVisible(); } }
    setPos(p) { this.pos = Math.max(0, Math.min(p, this.exp.length)); this.repaint(); }

    /* ---------- typed tokens ---------- */
    op(sym) {
        const map = { '\u00D7': '*', '\u00F7': '/', '\u2212': '-', '+': '+', 'mod': 'mod', '^': '^' };
        this.insert(map[sym] !== undefined ? map[sym] : sym);
    }
    parenOpen() { this.insert('('); }
    parenClose() {
        // only allow ')' when there is an unmatched open paren before the caret
        const left = this.exp.slice(0, this.pos);
        const open = (left.match(/\(/g) || []).length;
        const close = (this.exp.slice(0, this.pos).match(/\)/g) || []).length;
        if (open > close) this.insert(')');
    }
    fn(name) { this.insert(name + '('); }
    square() { this.insert('^2'); }
    cube() { this.insert('^3'); }
    factorial() { this.insert('!'); }
    constSym(sym) { this.insert(sym === 'pi' ? 'pi' : 'e'); }

    /* ---------- evaluate ---------- */
    calculate() {
        if (!this.exp) return;
        const raw = this.exp;
        const val = evaluateExpr(raw, this.deg);
        if (typeof val === 'number' && isFinite(val)) {
            const s = fmtNumber(val);
            this.prevText = raw + ' = ' + s;
            this.exp = s;
            this.pos = this.exp.length;
        } else {
            this.prevText = raw + ' =';
            this.exp = 'Error';
            this.pos = 0;
        }
        this.repaint();
        this.keepCaretVisible();
    }

    toggleDeg() { this.deg = !this.deg; /* label handled by UI */ }

    /* ---------- paint ---------- */
    repaint() {
        const left = this.exp.slice(0, this.pos);
        const right = this.exp.slice(this.pos);
        let leftD = '', rightD = '';
        for (const ch of left) leftD += dispChar(ch);
        for (const ch of right) rightD += dispChar(ch);
        this.curEl.innerHTML = '<span class="expr-left">' + htmlEscape(leftD) +
            '</span><span class="caret"></span><span class="expr-right">' +
            htmlEscape(rightD) + '</span>';
        this.prevEl.innerText = this.prevText;
    }

    /* Keep the caret within the horizontal view when the expression scrolls. */
    keepCaretVisible() {
        const leftEl = this.curEl.querySelector('.expr-left');
        const caretEl = this.curEl.querySelector('.caret');
        if (!leftEl || !caretEl) return;
        const cw = caretEl.offsetLeft - this.curEl.scrollLeft;
        if (cw > this.curEl.clientWidth - 16) this.curEl.scrollLeft = caretEl.offsetLeft - 24;
        else if (cw < 0) this.curEl.scrollLeft = caretEl.offsetLeft;
    }

    /* Map a pointer position on the display to the nearest caret index. */
    caretFromPointer(event) {
        const el = event.currentTarget;
        const rect = el.getBoundingClientRect();
        const ctx = this._ctx || (this._ctx = document.createElement('canvas').getContext('2d'));
        const cs = window.getComputedStyle(el);
        ctx.font = cs.font || (cs.fontWeight + ' ' + cs.fontSize + ' ' + (cs.fontFamily || 'sans-serif'));
        const base = event.clientX - rect.left - el.scrollLeft;
        let best = 0, bestD = Infinity;
        for (let i = 0; i <= this.exp.length; i++) {
            let w = 0;
            for (const ch of this.exp.slice(0, i)) w += ctx.measureText(dispChar(ch)).width;
            const d = Math.abs(w - base);
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }
}
/* ============================================================
   Expression parser (recursive descent / precedence climbing).
   Supports: numbers, + - * / mod ^, ( ), unary minus, prefix
   functions (sin cos tan log ln sqrt cbrt abs), constants pi & e,
   and postfix factorial '!'. Functions nest: sin(cos(90)).
   ============================================================ */
const BINOPS = {
    '+': { prec: 1, assoc: 'L' },
    '-': { prec: 1, assoc: 'L' },
    '*': { prec: 2, assoc: 'L' },
    '/': { prec: 2, assoc: 'L' },
    'mod': { prec: 2, assoc: 'L' },
    '^': { prec: 3, assoc: 'R' }
};
const FUNCS = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'cbrt', 'abs'];

function tokenize(src) {
    const tokens = [];
    let i = 0;
    while (i < src.length) {
        const ch = src[i];
        if (ch === ' ') { i++; continue; }
        if (/[0-9]/.test(ch) || ch === '.') {
            let j = i; let dots = 0;
            while (j < src.length && (/[0-9]/.test(src[j]) || src[j] === '.')) {
                if (src[j] === '.') dots++;
                if (dots > 1) return null; // malformed number
                j++;
            }
            const val = parseFloat(src.slice(i, j));
            tokens.push({ type: 'num', value: val });
            i = j;
        } else if (/[A-Za-z]/.test(ch)) {
            let j = i;
            while (j < src.length && /[A-Za-z]/.test(src[j])) j++;
            const word = src.slice(i, j);
            if (word === 'mod') tokens.push({ type: 'op', value: 'mod' });
            else tokens.push({ type: 'id', value: word });
            i = j;
        } else if ('+-*/^()!'.indexOf(ch) !== -1) {
            if (ch === '+' || ch === '-' || ch === '*' || ch === '/') tokens.push({ type: 'op', value: ch });
            else if (ch === '^') tokens.push({ type: 'op', value: '^' });
            else if (ch === '(') tokens.push({ type: 'lparen' });
            else if (ch === ')') tokens.push({ type: 'rparen' });
            else if (ch === '!') tokens.push({ type: 'fact' });
            i++;
        } else {
            return null; // unsupported character
        }
    }
    return tokens;
}

function evaluateExpr(src, deg) {
    const tokens = tokenize(src);
    if (!tokens) return NaN;
    let idx = 0;

    const peek = () => (idx < tokens.length ? tokens[idx] : null);

    function parseExpr(minPrec) {
        let left = parseUnary();
        while (true) {
            const t = peek();
            if (!t || t.type !== 'op') break;
            const info = BINOPS[t.value];
            if (!info || info.prec < minPrec) break;
            idx++;
            const rightPrec = info.assoc === 'R' ? info.prec : info.prec + 1;
            const right = parseExpr(rightPrec);
            left = binop(t.value, left, right);
            if (!isFinite(left)) return left;
        }
        return left;
    }

    function parseUnary() {
        const t = peek();
        if (t && t.type === 'op' && t.value === '-') { idx++; return -parseUnary(); }
        if (t && t.type === 'op' && t.value === '+') { idx++; return parseUnary(); }
        return parsePostfix();
    }

    function parsePostfix() {
        let v = parseAtom();
        while (peek() && peek().type === 'fact') {
            idx++;
            if (!(v >= 0 && v === Math.floor(v) && v <= 170)) return NaN;
            let r = 1;
            for (let k = 2; k <= v; k++) r *= k;
            v = r;
        }
        return v;
    }

    function parseAtom() {
        const t = peek();
        if (!t) return NaN;
        if (t.type === 'num') { idx++; return t.value; }
        if (t.type === 'lparen') {
            idx++;
            const v = parseExpr(0);
            if (peek() && peek().type === 'rparen') idx++;
            else return NaN;
            return v;
        }
        if (t.type === 'id') {
            idx++;
            const name = t.value;
            if (name === 'pi') return Math.PI;
            if (name === 'e') return Math.E;
            if (FUNCS.indexOf(name) !== -1) {
                if (peek() && peek().type === 'lparen') idx++;
                else return NaN;
                const arg = parseExpr(0);
                if (peek() && peek().type === 'rparen') idx++;
                else return NaN;
                return applyFn(name, arg, deg);
            }
            return NaN; // unknown identifier
        }
        return NaN; // unexpected
    }

    const val = parseExpr(0);
    if (idx !== tokens.length) return NaN; // leftover tokens
    return val;
}

function binop(op, a, b) {
    if (typeof a !== 'number' || typeof b !== 'number') return NaN;
    switch (op) {
        case '+': return a + b;
        case '-': return a - b;
        case '*': return a * b;
        case '/': return b === 0 ? NaN : a / b;
        case 'mod': return b === 0 ? NaN : a % b;
        case '^': return a ** b;
        default: return NaN;
    }
}

function applyFn(name, x, deg) {
    if (typeof x !== 'number' || isNaN(x)) return NaN;
    const a = deg ? x * Math.PI / 180 : x;
    switch (name) {
        case 'sin': return Math.sin(a);
        case 'cos': return Math.cos(a);
        case 'tan': { const r = Math.tan(a); return isFinite(r) ? r : NaN; }
        case 'log': return x > 0 ? Math.log10(x) : NaN;
        case 'ln': return x > 0 ? Math.log(x) : NaN;
        case 'sqrt': return x >= 0 ? Math.sqrt(x) : NaN;
        case 'cbrt': return Math.cbrt(x);
        case 'abs': return Math.abs(x);
        default: return NaN;
    }
}

/* ============================================================
   UI wiring
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
    const prevEl = document.getElementById('previous-operand');
    const curEl = document.getElementById('current-operand');
    const calc = new Calculator(prevEl, curEl);

    const calculatorEl = document.getElementById('calculator');
    const modeToggle = document.getElementById('mode-toggle');
    const angleToggle = document.getElementById('angle-toggle');

    modeToggle.addEventListener('click', () => {
        const sci = calculatorEl.classList.toggle('in-sci');
        modeToggle.textContent = sci ? 'Basic' : 'Scientific';
        angleToggle.classList.toggle('hidden', !sci);
    });
    angleToggle.addEventListener('click', () => {
        calc.toggleDeg();
        angleToggle.textContent = calc.deg ? 'DEG' : 'RAD';
    });

    document.querySelectorAll('[data-number]').forEach(btn => {
        btn.addEventListener('click', () => calc.insert(btn.getAttribute('data-number')));
    });

    document.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const a = btn.getAttribute('data-action');
            switch (a) {
                case 'clear': calc.clear(); break;
                case 'delete': calc.erase(); break;
                case 'move-left': calc.moveLeft(); break;
                case 'move-right': calc.moveRight(); break;
                case 'op': calc.op(btn.getAttribute('data-sym')); break;
                case 'paren-open': calc.parenOpen(); break;
                case 'paren-close': calc.parenClose(); break;
                case 'calculate': calc.calculate(); break;
                case 'pi': calc.constSym('pi'); break;
                case 'e': calc.constSym('e'); break;
                case 'sin': case 'cos': case 'tan':
                case 'log': case 'ln':
                case 'sqrt': case 'cbrt': case 'abs':
                    calc.fn(a); break;
                case 'square': calc.square(); break;
                case 'cube': calc.cube(); break;
                case 'factorial': calc.factorial(); break;
            }
        });
    });

    curEl.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        calc.setPos(calc.caretFromPointer(ev));
    });

    document.addEventListener('keydown', (e) => {
        const k = e.key;
        if ((k >= '0' && k <= '9') || k === '.') { calc.insert(k); }
        else if (k === '+') { calc.op('+'); }
        else if (k === '-') { calc.op('\u2212'); }
        else if (k === '*') { calc.op('\u00D7'); }
        else if (k === '/') { e.preventDefault(); calc.op('\u00F7'); }
        else if (k === '^') { calc.op('^'); }
        else if (k === '(') { calc.parenOpen(); }
        else if (k === ')') { calc.parenClose(); }
        else if (k === 'Enter' || k === '=') { e.preventDefault(); calc.calculate(); }
        else if (k === 'Backspace') { calc.erase(); }
        else if (k === 'Escape') { calc.clear(); }
        else if (k === 'ArrowLeft') { e.preventDefault(); calc.moveLeft(); }
        else if (k === 'ArrowRight') { e.preventDefault(); calc.moveRight(); }
        else if (k === '!') { calc.factorial(); }
        else if (k === 's') { calc.fn('sin'); }
        else if (k === 'c') { calc.fn('cos'); }
        else if (k === 't') { calc.fn('tan'); }
        else if (k === 'g') { calc.fn('log'); }
        else if (k === 'l') { calc.fn('ln'); }
        else if (k === 'r') { calc.fn('sqrt'); }
        else if (k === 'b') { calc.fn('cbrt'); }
        else if (k === 'a') { calc.fn('abs'); }
        else if (k === 'e') { calc.constSym('e'); }
    });
});
