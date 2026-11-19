/**
 * Shunting-Yard Algorithm (Dijkstra, 1961)
 * Converts infix expression → postfix (RPN) and records every step.
 */

// 'u-' (unary minus) binds tighter than * / % but looser than ^, so -3 + 5 = 2 and -2 ^ 2 = -4.
// Without an entry here it compared as `undefined` and was never popped before a later operator.
const PRECEDENCE  = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, 'u-': 2.5 };
const RIGHT_ASSOC = new Set(['^']);
const FUNCTIONS   = new Set(['sin', 'cos', 'tan', 'sqrt', 'abs', 'log']);

export function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];

    if (/\s/.test(ch)) { i++; continue; }

    // Multi-char number (including decimals)
    if (/[\d.]/.test(ch)) {
      let num = '';
      while (i < expr.length && /[\d.]/.test(expr[i])) num += expr[i++];
      tokens.push({ type: 'number', value: num });
      continue;
    }

    // Named functions / constants
    if (/[a-zA-Z]/.test(ch)) {
      let name = '';
      while (i < expr.length && /[a-zA-Z]/.test(expr[i])) name += expr[i++];
      if (name === 'pi')  { tokens.push({ type: 'number', value: String(Math.PI) }); continue; }
      if (name === 'e')   { tokens.push({ type: 'number', value: String(Math.E)  }); continue; }
      if (FUNCTIONS.has(name)) { tokens.push({ type: 'function', value: name }); continue; }
      throw new Error(`Unknown identifier: ${name}`);
    }

    // Unary minus
    if (ch === '-' && (tokens.length === 0 || ['operator','lparen'].includes(tokens.at(-1)?.type))) {
      tokens.push({ type: 'unary', value: 'u-' });
      i++; continue;
    }

    if (ch === '(') { tokens.push({ type: 'lparen', value: '(' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen', value: ')' }); i++; continue; }
    if (ch === ',') { tokens.push({ type: 'comma',  value: ',' }); i++; continue; }

    if (ch in PRECEDENCE) { tokens.push({ type: 'operator', value: ch }); i++; continue; }

    throw new Error(`Unknown character: ${ch}`);
  }
  return tokens;
}

export function shuntingYard(tokens) {
  const outputQueue  = [];
  const operatorStack = [];
  const steps        = [];

  const snapshot = (action, token) => steps.push({
    action,
    token,
    outputQueue:   [...outputQueue],
    operatorStack: [...operatorStack],
  });

  for (const token of tokens) {
    const { type, value } = token;

    if (type === 'number') {
      outputQueue.push(token);
      snapshot(`Push number ${value} → Output`, token);

    } else if (type === 'function') {
      operatorStack.push(token);
      snapshot(`Push function ${value} → Stack`, token);

    } else if (type === 'unary') {
      operatorStack.push(token);
      snapshot(`Push unary minus → Stack`, token);

    } else if (type === 'operator') {
      while (
        operatorStack.length &&
        operatorStack.at(-1).type !== 'lparen' &&
        (operatorStack.at(-1).type === 'function' ||
          PRECEDENCE[operatorStack.at(-1).value] > PRECEDENCE[value] ||
          (PRECEDENCE[operatorStack.at(-1).value] === PRECEDENCE[value] && !RIGHT_ASSOC.has(value)))
      ) {
        outputQueue.push(operatorStack.pop());
        snapshot(`Pop higher-prec op → Output (before ${value})`, token);
      }
      operatorStack.push(token);
      snapshot(`Push operator ${value} → Stack`, token);

    } else if (type === 'lparen') {
      operatorStack.push(token);
      snapshot(`Push ( → Stack`, token);

    } else if (type === 'rparen') {
      while (operatorStack.length && operatorStack.at(-1).type !== 'lparen') {
        outputQueue.push(operatorStack.pop());
        snapshot(`Pop until ( → Output`, token);
      }
      if (!operatorStack.length) throw new Error('Mismatched parentheses');
      operatorStack.pop(); // discard (
      snapshot(`Discard (`, token);
      if (operatorStack.at(-1)?.type === 'function') {
        outputQueue.push(operatorStack.pop());
        snapshot(`Pop function → Output`, token);
      }
    }
  }

  while (operatorStack.length) {
    const top = operatorStack.at(-1);
    if (top.type === 'lparen') throw new Error('Mismatched parentheses');
    outputQueue.push(operatorStack.pop());
    snapshot(`Drain stack → Output`, top);
  }

  return { postfix: outputQueue, steps };
}
