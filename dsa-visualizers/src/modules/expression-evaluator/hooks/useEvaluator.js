import { useState, useCallback, useRef } from 'react';
import { tokenize, shuntingYard } from '../algorithms/shuntingYard';
import { evaluatePostfix } from '../algorithms/evaluator';

export function useEvaluator() {
  const [expression, setExpression]     = useState('');
  const [postfix, setPostfix]           = useState([]);
  const [parseSteps, setParseSteps]     = useState([]);
  const [evalSteps, setEvalSteps]       = useState([]);
  const [currentStep, setCurrentStep]   = useState(-1);
  const [phase, setPhase]               = useState('parse'); // 'parse' | 'eval'
  const [result, setResult]             = useState(null);
  const [error, setError]               = useState('');
  const [isPlaying, setIsPlaying]       = useState(false);
  const [tokens, setTokens]             = useState([]);
  const timerRef = useRef(null);

  const evaluate = useCallback((expr) => {
    clearInterval(timerRef.current);
    setIsPlaying(false);
    setResult(null);
    setError('');
    setCurrentStep(-1);
    setPhase('parse');

    try {
      const toks             = tokenize(expr);
      const { postfix: pfx, steps: pSteps } = shuntingYard(toks);
      const { result: res, steps: eSteps }  = evaluatePostfix(pfx);

      setTokens(toks);
      setPostfix(pfx);
      setParseSteps(pSteps);
      setEvalSteps(eSteps);
      setResult(res);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const stepForward = useCallback(() => {
    const allSteps = phase === 'parse' ? parseSteps : evalSteps;
    if (currentStep < allSteps.length - 1) {
      setCurrentStep(c => c + 1);
    } else if (phase === 'parse' && evalSteps.length) {
      setPhase('eval');
      setCurrentStep(0);
    }
  }, [phase, parseSteps, evalSteps, currentStep]);

  const stepBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(c => c - 1);
    } else if (phase === 'eval') {
      setPhase('parse');
      setCurrentStep(parseSteps.length - 1);
    }
  }, [phase, parseSteps, currentStep]);

  const play = useCallback(() => {
    if (isPlaying) { clearInterval(timerRef.current); setIsPlaying(false); return; }
    setIsPlaying(true);
    timerRef.current = setInterval(() => {
      setCurrentStep(prev => {
        setPhase(ph => {
          const allSteps = ph === 'parse' ? parseSteps : evalSteps;
          if (prev < allSteps.length - 1) return ph;
          if (ph === 'parse' && evalSteps.length) {
            setCurrentStep(0);
            return 'eval';
          }
          clearInterval(timerRef.current);
          setIsPlaying(false);
          return ph;
        });
        return prev + 1;
      });
    }, 700);
  }, [isPlaying, parseSteps, evalSteps]);

  const reset = useCallback(() => {
    clearInterval(timerRef.current);
    setIsPlaying(false);
    setCurrentStep(-1);
    setPhase('parse');
  }, []);

  const activeStep = phase === 'parse' ? parseSteps[currentStep] : evalSteps[currentStep];

  return {
    expression, setExpression,
    tokens, postfix,
    parseSteps, evalSteps,
    currentStep, phase, activeStep,
    result, error,
    isPlaying,
    evaluate, stepForward, stepBack, play, reset,
  };
}
