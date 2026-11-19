/**
 * Postfix (RPN) Evaluator
 * Evaluates the token array produced by shuntingYard and records each step.
 */

const FUNCS = {
  sin:  x => Math.sin(x),
  cos:  x => Math.cos(x),
  tan:  x => Math.tan(x),
  sqrt: x => Math.sqrt(x),
  abs:  x => Math.abs(x),
  log:  x => Math.log10(x),
};

export function evaluatePostfix(postfix) {
  const stack = [];
  const steps = [];

  const snap = (action) => steps.push({ action, stack: [...stack] });

  for (const token of postfix) {
    const { type, value } = token;

    if (type === 'number') {
      stack.push(parseFloat(value));
      snap(`Push ${value}`);

    } else if (type === 'unary') {
      if (!stack.length) throw new Error('Invalid expression');
      const a = stack.pop();
      stack.push(-a);
      snap(`Unary − : −(${a}) = ${-a}`);

    } else if (type === 'function') {
      if (!stack.length) throw new Error(`Missing argument for ${value}`);
      const a = stack.pop();
      const r = FUNCS[value]?.(a);
      if (r === undefined) throw new Error(`Unknown function: ${value}`);
      stack.push(r);
      snap(`${value}(${fmt(a)}) = ${fmt(r)}`);

    } else if (type === 'operator') {
      if (stack.length < 2) throw new Error('Not enough operands');
      const b = stack.pop(), a = stack.pop();
      const r = applyOp(value, a, b);
      stack.push(r);
      snap(`${fmt(a)} ${value} ${fmt(b)} = ${fmt(r)}`);
    }
  }

  if (stack.length !== 1) throw new Error('Invalid expression');
  return { result: stack[0], steps };
}

function applyOp(op, a, b) {
  switch (op) {
    case '+': return a + b;
    case '-': return a - b;
    case '*': return a * b;
    case '/':
      if (b === 0) throw new Error('Division by zero');
      return a / b;
    case '%': return a % b;
    case '^': return Math.pow(a, b);
    default: throw new Error(`Unknown operator: ${op}`);
  }
}

function fmt(n) {
  if (typeof n !== 'number') return String(n);
  return Number.isInteger(n) ? String(n) : parseFloat(n.toFixed(6)).toString();
}
