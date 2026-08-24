# Web Calculator

A calculator where you type the whole expression like text instead of
punching one operation at a time. `2 + 3 × 4` just works, with proper
precedence. The caret moves freely (arrow keys or the on-screen ◀ ▶), so
fixing a typo means stepping back two characters, not starting over.

Open `index.html` and it runs — plain HTML/CSS/JS, nothing to install.

Beyond the basics: parentheses, unary minus, factorial, `mod`, powers.
Scientific mode adds trig with a DEG/RAD switch, logs, roots, `π` and `e`.
The keyboard works throughout — digits, operators, arrows, Enter to
evaluate, Escape to clear — and in scientific mode letters are shortcuts,
like `s` for `sin(`.

One quirk on purpose: Backspace deletes a whole token, so `sin(` goes in
with one key and comes out with one key.
