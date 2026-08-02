class Calculator {
    constructor(previousOperandElement, currentOperandElement) {
        this.previousOperandElement = previousOperandElement;
        this.currentOperandElement = currentOperandElement;
        this.deg = true; // trig functions default to degrees
        this.clear();
    }

    clear() {
        this.currentOperand = '0';
        this.previousOperand = '';
        this.operation = undefined;
        this.shouldResetScreen = false;
        this.updateDisplay();
    }

    delete() {
        if (this.shouldResetScreen) return;
        if (this.currentOperand === '0') return;
        if (this.currentOperand.length === 1 || (this.currentOperand.length === 2 && this.currentOperand.startsWith('-'))) {
            this.currentOperand = '0';
        } else {
            this.currentOperand = this.currentOperand.slice(0, -1);
        }
        this.updateDisplay();
    }

    appendNumber(number) {
        if (this.shouldResetScreen) {
            this.currentOperand = '';
            this.shouldResetScreen = false;
        }
        if (number === '.' && this.currentOperand.includes('.')) return;
        if (this.currentOperand === '0' && number !== '.') {
            this.currentOperand = number;
        } else {
            this.currentOperand += number;
        }
        this.updateDisplay();
    }

    chooseOperation(operation) {
        if (this.currentOperand === '' && this.previousOperand === '') return;
        
        if (this.previousOperand !== '' && !this.shouldResetScreen) {
            this.compute();
        }

        this.operation = operation;
        this.previousOperand = this.currentOperand;
        this.shouldResetScreen = true;
        this.updateDisplay();
    }

    negate() {
        if (this.currentOperand === '0') return;
        if (this.currentOperand.startsWith('-')) {
            this.currentOperand = this.currentOperand.slice(1);
        } else {
            this.currentOperand = '-' + this.currentOperand;
        }
        this.updateDisplay();
    }

    percent() {
        if (this.currentOperand === '') return;
        const current = parseFloat(this.currentOperand);
        if (isNaN(current)) return;
        this.currentOperand = (current / 100).toString();
        this.updateDisplay();
    }

    /* ----------------- Scientific operations ----------------- */

    // Unary function applied to the current displayed value.
    applyUnary(type) {
        const current = parseFloat(this.currentOperand);
        if (isNaN(current)) return;

        // Trig: DEG by default, RAD when deg is false.
        const angle = this.deg ? current * Math.PI / 180 : current;
        let result;

        switch (type) {
            case 'sin': result = Math.sin(angle); break;
            case 'cos': result = Math.cos(angle); break;
            case 'tan': result = Math.tan(angle); break;
            case 'log': result = Math.log10(current); break;
            case 'ln':  result = Math.log(current); break;
            case 'sqrt': result = Math.sqrt(current); break;
            case 'cbrt': result = Math.cbrt(current); break;
            case 'square': result = current * current; break;
            case 'cube': result = current * current * current; break;
            case 'reciprocal':
                if (current === 0) { alert('Cannot divide by zero'); this.clear(); return; }
                result = 1 / current;
                break;
            case 'factorial': result = this.factorial(current); break;
            case 'abs': result = Math.abs(current); break;
            default: return;
        }

        this.setResult(result);
    }

    // n! for a non-negative integer.
    factorial(n) {
        if (!Number.isInteger(n) || n < 0 || n > 170) return NaN;
        let r = 1;
        for (let i = 2; i <= n; i++) r *= i;
        return r;
    }

    // Insert a constant (π or e) as a fresh value.
    insertConstant(kind) {
        this.setResult(kind === 'pi' ? Math.PI : Math.E);
    }

    // Toggle trig angle units between degrees and radians.
    toggleDeg() {
        this.deg = !this.deg;
        this.updateDisplay();
    }

    // Store a numeric result, guarding against non-finite values.
    setResult(value) {
        if (typeof value !== 'number' || !isFinite(value)) {
            this.currentOperand = 'Error';
        } else {
            this.currentOperand = (Math.round(value * 1e10) / 1e10) + '';
        }
        this.operation = undefined;
        this.previousOperand = '';
        this.shouldResetScreen = true;
        this.updateDisplay();
    }

    compute() {
        let computation;
        const prev = parseFloat(this.previousOperand);
        const current = parseFloat(this.currentOperand);
        
        if (isNaN(prev) || isNaN(current)) return;

        switch (this.operation) {
            case '+':
            case 'add':
                computation = prev + current;
                break;
            case '−':
            case '-':
            case 'subtract':
                computation = prev - current;
                break;
            case '×':
            case '*':
            case 'multiply':
                computation = prev * current;
                break;
            case '÷':
            case '/':
            case 'divide':
                if (current === 0) {
                    alert("Cannot divide by zero");
                    this.clear();
                    return;
                }
                computation = prev / current;
                break;
            case 'power':
                computation = prev ** current;
                break;
            case 'mod':
                if (current === 0) {
                    alert("Cannot divide by zero");
                    this.clear();
                    return;
                }
                computation = prev % current;
                break;
            default:
                return;
        }

        // Fix potential floating point inaccuracy (e.g., 0.1 + 0.2 = 0.30000000000000004)
        this.currentOperand = Math.round(computation * 1e10) / 1e10 + '';
        this.operation = undefined;
        this.previousOperand = '';
        this.shouldResetScreen = true;
        this.updateDisplay();
    }

    getDisplayNumber(number) {
        const stringNumber = number.toString();
        if (stringNumber === '') return '';
        if (stringNumber === '-') return '-';
        if (stringNumber === 'Error' || stringNumber === 'NaN' ||
            stringNumber === 'Infinity' || stringNumber === '-Infinity') return stringNumber;

        const parts = stringNumber.split('.');
        const integerDigits = parseFloat(parts[0]);
        const decimalDigits = parts[1];

        let integerDisplay;
        if (isNaN(integerDigits)) {
            integerDisplay = '';
        } else {
            integerDisplay = integerDigits.toLocaleString('en', { maximumFractionDigits: 0 });
        }

        if (decimalDigits != null) {
            return `${integerDisplay}.${decimalDigits}`;
        } else {
            return integerDisplay;
        }
    }

    updateDisplay() {
        this.currentOperandElement.innerText = this.getDisplayNumber(this.currentOperand);
        if (this.operation != null) {
            let symbol = this.operation;
            if (symbol === 'add') symbol = '+';
            if (symbol === 'subtract') symbol = '−';
            if (symbol === 'multiply') symbol = '×';
            if (symbol === 'divide') symbol = '÷';
            if (symbol === 'power') symbol = '^';
            if (symbol === 'mod') symbol = 'mod';
            this.previousOperandElement.innerText = `${this.getDisplayNumber(this.previousOperand)} ${symbol}`;
        } else {
            this.previousOperandElement.innerText = '';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const previousOperandElement = document.getElementById('previous-operand');
    const currentOperandElement = document.getElementById('current-operand');
    const calculator = new Calculator(previousOperandElement, currentOperandElement);

    // Basic / Scientific mode toggle.
    const calculatorEl = document.getElementById('calculator');
    const modeToggle = document.getElementById('mode-toggle');
    const angleToggle = document.getElementById('angle-toggle');

    modeToggle.addEventListener('click', () => {
        const sci = calculatorEl.classList.toggle('in-sci');
        modeToggle.textContent = sci ? 'Basic' : 'Scientific';
        angleToggle.classList.toggle('hidden', !sci);
    });

    angleToggle.addEventListener('click', () => {
        calculator.toggleDeg();
        angleToggle.textContent = calculator.deg ? 'DEG' : 'RAD';
    });

    document.querySelectorAll('[data-number]').forEach(button => {
        button.addEventListener('click', () => {
            calculator.appendNumber(button.getAttribute('data-number'));
        });
    });

    const UNARY = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'cbrt',
        'square', 'cube', 'reciprocal', 'factorial', 'abs'];
    const CONSTANTS = ['pi', 'e'];

    document.querySelectorAll('[data-action]').forEach(button => {
        button.addEventListener('click', () => {
            const action = button.getAttribute('data-action');
            switch (action) {
                case 'clear':
                    calculator.clear();
                    break;
                case 'delete':
                    calculator.delete();
                    break;
                case 'negate':
                    calculator.negate();
                    break;
                case 'percent':
                    calculator.percent();
                    break;
                case 'add':
                case 'subtract':
                case 'multiply':
                case 'divide':
                case 'power':
                case 'mod':
                    calculator.chooseOperation(action);
                    break;
                case 'calculate':
                    calculator.compute();
                    break;
                default:
                    if (UNARY.includes(action)) calculator.applyUnary(action);
                    else if (CONSTANTS.includes(action)) calculator.insertConstant(action);
                    break;
            }
        });
    });

    // Keyboard support
    document.addEventListener('keydown', (e) => {
        if ((e.key >= '0' && e.key <= '9') || e.key === '.') {
            calculator.appendNumber(e.key);
        } else if (e.key === '+') {
            calculator.chooseOperation('add');
        } else if (e.key === '-') {
            calculator.chooseOperation('subtract');
        } else if (e.key === '*') {
            calculator.chooseOperation('multiply');
        } else if (e.key === '/') {
            e.preventDefault();
            calculator.chooseOperation('divide');
        } else if (e.key === 'Enter' || e.key === '=') {
            e.preventDefault();
            calculator.compute();
        } else if (e.key === 'Backspace') {
            calculator.delete();
        } else if (e.key === 'Escape') {
            calculator.clear();
        } else if (e.key === '%') {
            calculator.percent();
        }
    });
});
