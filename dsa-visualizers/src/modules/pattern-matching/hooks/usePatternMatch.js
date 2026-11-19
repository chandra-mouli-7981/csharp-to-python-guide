import { useState, useCallback } from 'react';
import { kmpSearch, buildFailureFunction } from '../algorithms/kmp';
import { rabinKarpSearch } from '../algorithms/rabinKarp';
import { zSearch, buildZArray } from '../algorithms/zAlgorithm';

const DEFAULT_TEXT    = 'the quick brown fox jumps over the lazy dog. the fox ran fast.';
const DEFAULT_PATTERN = 'fox';

export function usePatternMatch() {
  const [text, setText]       = useState(DEFAULT_TEXT);
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [results, setResults] = useState(null);
  const [activeAlgo, setActiveAlgo] = useState('KMP');
  const [activeStep, setActiveStep] = useState(-1);

  const run = useCallback((t = text, p = pattern) => {
    if (!t || !p) return;
    setActiveStep(-1);

    const kmp = kmpSearch(t, p);
    const rk  = rabinKarpSearch(t, p);
    const z   = zSearch(t, p);

    setResults({
      KMP:       { ...kmp,  name: 'KMP',         color: '#6c63ff' },
      RabinKarp: { ...rk,   name: 'Rabin-Karp',  color: '#48cfad' },
      ZAlgo:     { ...z,    name: 'Z-Algorithm', color: '#ffd166' },
      text: t,
      pattern: p,
    });
  }, [text, pattern]);

  const activeResult = results?.[activeAlgo];
  const steps        = activeResult?.steps ?? [];
  const currentStep  = steps[activeStep] ?? null;

  return {
    text, setText,
    pattern, setPattern,
    results, activeAlgo, setActiveAlgo,
    activeStep, setActiveStep,
    steps, currentStep,
    run,
  };
}
