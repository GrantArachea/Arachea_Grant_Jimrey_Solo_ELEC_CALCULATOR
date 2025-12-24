// calculator2.js
// ====================== Calculator Logic (REAL % + auto-eval on %) ======================
//
// % behavior (calculator-like):
// - 10%            -> 0.1
// - 50 × 10%       -> 5
// - 50 + 10%       -> 55
// - 200 - 25%      -> 150
// - 200 ÷ 25%      -> 800
//
// Extra behavior:
// - Pressing % auto-evaluates immediately (no need to press "=")
// - All your existing features remain unchanged otherwise.

const expressionDisplay = document.getElementById("expressionDisplay");
const resultDisplay = document.getElementById("resultDisplay");
const scientificPanel = document.getElementById("scientificPanel");
const modeLabel = document.getElementById("modeLabel");
const toggleSciBtn = document.getElementById("toggleSci");
const themeToggleBtn = document.getElementById("themeToggle");

let tokens = [];

// ------------- Display / Core helpers -------------

function updateExpressionDisplay() {
  if (!tokens.length) expressionDisplay.textContent = "0";
  else expressionDisplay.textContent = tokens.map((t) => t.display).join("");
}

function clearAll() {
  tokens = [];
  resultDisplay.textContent = "0";
  updateExpressionDisplay();
}

function deleteLast() {
  if (!tokens.length) return;
  tokens.pop();
  updateExpressionDisplay();
}

function addToken(display, value) {
  tokens.push({ display, value });
  updateExpressionDisplay();
}

// ------------- Implicit multiplication logic -------------

function getTokenType(display, value) {
  if (/^[0-9]$/.test(display)) return "digit";
  if (display === ".") return "dot";

  if (display === "(") return "lparen";
  if (display === ")") return "rparen";

  if (display === "%" || value === "%") return "percent";

  if (typeof value === "string" && value.endsWith("(")) return "funcOpen";

  if (
    display === "π" ||
    value === "Math.PI" ||
    display === "e" ||
    value === "Math.E"
  ) {
    return "const";
  }

  if ("+-×÷*/".includes(display) || ["+", "-", "*", "/", "%"].includes(value)) {
    return "op";
  }

  return "other";
}

function isNumberPart(type) {
  return type === "digit" || type === "dot";
}

function handleInput(display, value = display) {
  const last = tokens[tokens.length - 1];

  const newType = getTokenType(display, value);
  const lastType = last ? getTokenType(last.display, last.value) : null;

  // Build multi-digit/decimal numbers
  if (last && isNumberPart(lastType) && isNumberPart(newType)) {
    addToken(display, value);
    return;
  }

  // Implicit multiplication (also allow percent -> next operand)
  let needImplicitMultiply = false;
  if (
    last &&
    (lastType === "digit" ||
      lastType === "rparen" ||
      lastType === "const" ||
      lastType === "percent") &&
    (newType === "lparen" ||
      newType === "funcOpen" ||
      newType === "const" ||
      newType === "digit")
  ) {
    needImplicitMultiply = !(lastType === "digit" && newType === "digit");
  }

  if (needImplicitMultiply) {
    tokens.push({ display: "×", value: "*" });
  }

  addToken(display, value);
}

// ------------- Math helpers -------------

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function sinDeg(x) {
  return Math.sin(toRad(x));
}

function cosDeg(x) {
  return Math.cos(toRad(x));
}

function tanDeg(x) {
  return Math.tan(toRad(x));
}

function ln(x) {
  return Math.log(x);
}

function log10(x) {
  if (Math.log10) return Math.log10(x);
  return Math.log(x) / Math.LN10;
}

function autoBalanceParentheses(expr) {
  let balance = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "(") balance++;
    else if (ch === ")") {
      if (balance > 0) balance--;
    }
  }
  if (balance > 0) expr += ")".repeat(balance);
  return expr;
}

function formatResult(result) {
  if (!Number.isFinite(result)) return "Error";
  if (result === 0) return "0";

  let plain = result.toString();

  if (plain.includes("e") || plain.includes("E")) {
    return result.toExponential(15);
  }

  if (plain.includes(".")) {
    plain = plain.replace(/\.?0+$/, "");
  }

  const digitsOnly = plain.replace(/[^0-9]/g, "");
  if (digitsOnly.length <= 16) return plain;

  return result.toExponential(15);
}

// -------------------- % handling --------------------

function isOpValue(v) {
  return v === "+" || v === "-" || v === "*" || v === "/" || v === "%";
}

function lastIndexWhere(pred, start, arr) {
  for (let i = start; i >= 0; i--) {
    if (pred(i)) return i;
  }
  return -1;
}

/**
 * Returns {start, end} for the last operand ending at endIndex (inclusive).
 * Supports numbers, constants, (...) groups, and function calls like sinDeg(...).
 */
function findLastOperandRange(endIndex, arr) {
  if (endIndex < 0) return null;

  const tks = arr;
  const endTok = tks[endIndex];

  function isFuncOpenToken(tok) {
    return typeof tok?.value === "string" && tok.value.endsWith("(");
  }

  // Closing paren: match it, include possible function open token before "("
  if (endTok.display === ")" || endTok.value === ")") {
    let depth = 0;
    for (let i = endIndex; i >= 0; i--) {
      const d = tks[i].display;
      if (d === ")") depth++;
      else if (d === "(") {
        depth--;
        if (depth === 0) {
          const maybeFunc = i - 1;
          if (maybeFunc >= 0 && isFuncOpenToken(tks[maybeFunc])) {
            return { start: maybeFunc, end: endIndex };
          }
          return { start: i, end: endIndex };
        }
      }
    }
    return { start: 0, end: endIndex };
  }

  const endType = getTokenType(endTok.display, endTok.value);

  if (endType === "const") return { start: endIndex, end: endIndex };

  if (endType === "digit" || endType === "dot") {
    let i = endIndex;
    while (i - 1 >= 0) {
      const type = getTokenType(tks[i - 1].display, tks[i - 1].value);
      if (type === "digit" || type === "dot") i--;
      else break;
    }
    return { start: i, end: endIndex };
  }

  if (endType === "percent") {
    return findLastOperandRange(endIndex - 1, arr);
  }

  return { start: endIndex, end: endIndex };
}

/**
 * Convert % into calculator percent semantics by rewriting the expression.
 * Returns a JS-evaluable string with no % left.
 */
function buildExprWithPercent() {
  const tks = tokens.slice();

  const sliceToValue = (start, end) =>
    tks.slice(start, end + 1).map((t) => t.value).join("");

  for (let i = 0; i < tks.length; i++) {
    const tok = tks[i];
    if (!(tok.display === "%" || tok.value === "%")) continue;

    const bRange = findLastOperandRange(i - 1, tks);
    if (!bRange) throw new Error("Percent without operand");

    const opIndex = lastIndexWhere(
      (k) => {
        const v = tks[k]?.value;
        const d = tks[k]?.display;
        return isOpValue(v) || d === "×" || d === "÷" || d === "−";
      },
      bRange.start - 1,
      tks
    );

    // No operator before B% => (B/100)
    if (opIndex === -1) {
      const bVal = sliceToValue(bRange.start, bRange.end);
      const repl = { display: "%", value: `((${bVal})/100)` };
      tks.splice(bRange.start, i - bRange.start + 1, repl);
      i = bRange.start;
      continue;
    }

    // Normalize operator
    const opTok = tks[opIndex];
    let op = opTok.value;
    if (opTok.display === "×") op = "*";
    if (opTok.display === "÷") op = "/";
    if (opTok.display === "−") op = "-";

    const aRange = findLastOperandRange(opIndex - 1, tks);
    if (!aRange) {
      const bVal = sliceToValue(bRange.start, bRange.end);
      const repl = { display: "%", value: `((${bVal})/100)` };
      tks.splice(bRange.start, i - bRange.start + 1, repl);
      i = bRange.start;
      continue;
    }

    const aVal = sliceToValue(aRange.start, aRange.end);
    const bVal = sliceToValue(bRange.start, bRange.end);

    let newChunk;
    if (op === "+" || op === "-") {
      // A ± B%  => A ± (A*(B/100))
      newChunk = `((${aVal})${op}(((${aVal})*((${bVal})/100))))`;
    } else if (op === "*") {
      // A * B% => A*(B/100)
      newChunk = `((${aVal})*((${bVal})/100))`;
    } else if (op === "/") {
      // A / B% => A/(B/100)
      newChunk = `((${aVal})/((${bVal})/100))`;
    } else {
      newChunk = `((${bVal})/100)`;
    }

    const repl = { display: "%", value: newChunk };
    const replaceStart = aRange.start;
    const replaceCount = i - replaceStart + 1;
    tks.splice(replaceStart, replaceCount, repl);
    i = replaceStart;
  }

  return tks.map((t) => t.value).join("");
}

function evaluateExpression() {
  if (!tokens.length) return;

  let expr = buildExprWithPercent();
  expr = autoBalanceParentheses(expr);

  try {
    // eslint-disable-next-line no-eval
    const result = eval(expr);

    if (typeof result === "number" && Number.isFinite(result)) {
      const formatted = formatResult(result);
      if (formatted === "Error") {
        resultDisplay.textContent = "Error";
        return;
      }

      resultDisplay.textContent = formatted;
      tokens = [{ display: formatted, value: String(result) }];
      updateExpressionDisplay();
    } else {
      resultDisplay.textContent = "Error";
    }
  } catch (e) {
    resultDisplay.textContent = "Error";
  }
}

// ------------- UI Toggles -------------

function toggleScientific() {
  const isHidden = scientificPanel.classList.contains("hidden");
  if (isHidden) {
    scientificPanel.classList.remove("hidden");
    modeLabel.textContent = "Basic + Scientific";
    toggleSciBtn.textContent = "Basic only";
  } else {
    scientificPanel.classList.add("hidden");
    modeLabel.textContent = "Basic mode";
    toggleSciBtn.textContent = "Sci panel";
  }
}

function toggleTheme() {
  const current = document.body.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.body.setAttribute("data-theme", next);

  themeToggleBtn.textContent = next === "light" ? "Dark mode" : "Light mode";
}

// ------------- Button Event Wiring -------------

document.querySelectorAll(".btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;

    if (action === "clear") {
      clearAll();
      return;
    }

    if (action === "delete") {
      deleteLast();
      return;
    }

    if (action === "equals") {
      evaluateExpression();
      return;
    }

    const display =
      btn.dataset.display !== undefined
        ? btn.dataset.display
        : btn.textContent.trim();
    const value = btn.dataset.value !== undefined ? btn.dataset.value : display;

    // NEW: auto-eval on percent press
    if (display === "%" || value === "%") {
      handleInput("%", "%");
      evaluateExpression();
      return;
    }

    handleInput(display, value);
  });
});

toggleSciBtn.addEventListener("click", toggleScientific);
themeToggleBtn.addEventListener("click", toggleTheme);

// ------------- Keyboard Support -------------

document.addEventListener("keydown", (e) => {
  const key = e.key;

  if (key >= "0" && key <= "9") {
    handleInput(key);
    return;
  }

  if (key === ".") {
    handleInput(".");
    return;
  }

  if (key === "+") {
    handleInput("+", "+");
    return;
  }

  if (key === "-") {
    handleInput("−", "-");
    return;
  }

  if (key === "*") {
    handleInput("×", "*");
    return;
  }

  if (key === "/") {
    handleInput("÷", "/");
    return;
  }

  // NEW: auto-eval on percent key
  if (key === "%") {
    handleInput("%", "%");
    evaluateExpression();
    return;
  }

  if (key === "(") {
    handleInput("(", "(");
    return;
  }

  if (key === ")") {
    handleInput(")", ")");
    return;
  }

  if (key === "Enter" || key === "=") {
    e.preventDefault();
    evaluateExpression();
    return;
  }

  if (key === "Backspace") {
    deleteLast();
    return;
  }

  if (key === "Delete" || key === "Escape") {
    clearAll();
    return;
  }
});

// Init
updateExpressionDisplay();
