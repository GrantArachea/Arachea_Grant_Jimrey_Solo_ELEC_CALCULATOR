// ====================== Calculator Logic ======================

// DOM references
const expressionDisplay = document.getElementById("expressionDisplay");
const resultDisplay = document.getElementById("resultDisplay");
const scientificPanel = document.getElementById("scientificPanel");
const modeLabel = document.getElementById("modeLabel");
const toggleSciBtn = document.getElementById("toggleSci");
const themeToggleBtn = document.getElementById("themeToggle");

// Expression is stored as array of tokens { display, value }
let tokens = [];

// ------------- Display / Core helpers -------------

function updateExpressionDisplay() {
  if (!tokens.length) {
    expressionDisplay.textContent = "0";
  } else {
    expressionDisplay.textContent = tokens.map((t) => t.display).join("");
  }
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
  // numbers
  if (/^[0-9]$/.test(display)) return "digit";
  if (display === ".") return "dot";

  // parentheses
  if (display === "(") return "lparen";
  if (display === ")") return "rparen";

  // function opening tokens (end with "(" in value)
  if (typeof value === "string" && value.endsWith("(")) return "funcOpen";

  // constants
  if (
    display === "π" ||
    value === "Math.PI" ||
    display === "e" ||
    value === "Math.E"
  ) {
    return "const";
  }

  // operators
  if ("+-×÷*/%".includes(display) || ["+", "-", "*", "/", "%"].includes(value)) {
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

  // Build multi-digit/decimal numbers: 1 2 3 -> "123", 1 . 5 -> "1.5"
  if (last && isNumberPart(lastType) && isNumberPart(newType)) {
    addToken(display, value);
    return;
  }

  // Implicit multiplication:
  //   1(2)      -> 1 * (2)
  //   1√(9)     -> 1 * √(9)
  //   1sin(30)  -> 1 * sin(30)
  //   1π        -> 1 * π
  //   π2        -> π * 2
  //   )2        -> ) * 2
  let needImplicitMultiply = false;

  if (
    last &&
    (lastType === "digit" || lastType === "rparen" || lastType === "const") &&
    (newType === "lparen" || newType === "funcOpen" || newType === "const" || newType === "digit")
  ) {
    // We already handled digit-digit case above.
    needImplicitMultiply = !(lastType === "digit" && newType === "digit");
  }

  if (needImplicitMultiply) {
    tokens.push({ display: "×", value: "*" });
  }

  addToken(display, value);
}

// ------------- Math helpers (for functions in eval) -------------

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
  return Math.log(x); // natural log
}

function log10(x) {
  if (Math.log10) return Math.log10(x);
  return Math.log(x) / Math.LN10;
}

/**
 * Auto-balance parentheses so user doesn’t need to press ")"
 * Example:
 *  "Math.sqrt(9"   -> "Math.sqrt(9)"
 *  "sinDeg(30"     -> "sinDeg(30)"
 *  "1*(2+3"        -> "1*(2+3)"
 */
function autoBalanceParentheses(expr) {
  let balance = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === "(") {
      balance++;
    } else if (ch === ")") {
      if (balance > 0) balance--;
    }
  }
  if (balance > 0) {
    expr += ")".repeat(balance);
  }
  return expr;
}

/**
 * Format result: normal decimal up to 16 digits, else exponential.
 */
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

  if (digitsOnly.length <= 16) {
    return plain;
  }

  return result.toExponential(15);
}

function evaluateExpression() {
  if (!tokens.length) return;

  let expr = tokens.map((t) => t.value).join("");
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

  if (next === "light") {
    themeToggleBtn.textContent = "Dark mode";
  } else {
    themeToggleBtn.textContent = "Light mode";
  }
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

    // Regular input (digits, operators, functions, π, e, etc.)
    const display =
      btn.dataset.display !== undefined
        ? btn.dataset.display
        : btn.textContent.trim();
    const value =
      btn.dataset.value !== undefined ? btn.dataset.value : display;

    handleInput(display, value);
  });
});

toggleSciBtn.addEventListener("click", toggleScientific);
themeToggleBtn.addEventListener("click", toggleTheme);

// ------------- Keyboard Support -------------

document.addEventListener("keydown", (e) => {
  const key = e.key;

  // Basic digits and decimal
  if (key >= "0" && key <= "9") {
    handleInput(key);
    return;
  }

  if (key === ".") {
    handleInput(".");
    return;
  }

  // Operators
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

  if (key === "%") {
    handleInput("%", "%");
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

  // Evaluate
  if (key === "Enter" || key === "=") {
    e.preventDefault();
    evaluateExpression();
    return;
  }

  // Delete / clear
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
