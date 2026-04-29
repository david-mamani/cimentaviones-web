/**
 * CadNumericInput — A numeric input that allows clearing.
 * When the field is cleared (empty), shows "—" and treats the value as 0.
 * When the user explicitly types 0, it shows "0" (not a dash).
 */
import { useState, useEffect, useRef } from 'react';

interface CadNumericInputProps {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function CadNumericInput({
  value,
  onChange,
  step = 0.1,
  min,
  max,
  className = 'cad-input',
  style,
}: CadNumericInputProps) {
  // text holds the raw string the user sees/types
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  // Track whether the field was explicitly cleared (not just value===0)
  const [cleared, setCleared] = useState(false);
  const prevValue = useRef(value);

  // Sync from parent when value changes externally
  useEffect(() => {
    if (value !== prevValue.current && !focused) {
      setText(String(value));
      setCleared(false);
    }
    prevValue.current = value;
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    if (raw === '' || raw === '-') {
      setCleared(true);
      onChange(0);
      return;
    }

    setCleared(false);
    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, parsed));
      onChange(clamped);
    }
  };

  const handleFocus = () => {
    setFocused(true);
    // On focus, show the actual text (empty if cleared, '0' if zero was typed)
  };

  const handleBlur = () => {
    setFocused(false);
    if (text === '' || text === '-') {
      // Field was cleared → keep it cleared (dash will show)
      setText('');
      setCleared(true);
      onChange(0);
    } else {
      const parsed = parseFloat(text);
      if (!isNaN(parsed)) {
        setText(String(parsed));
        setCleared(false);
      }
    }
  };

  // Show dash only when the field was explicitly cleared, NOT when value is 0
  const showDash = !focused && cleared && text === '';
  const displayValue = focused ? text : (showDash ? '—' : text);

  return (
    <input
      className={className}
      type="text"
      inputMode="decimal"
      value={displayValue}
      step={step}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      style={{
        ...style,
        color: showDash ? '#555' : undefined,
        fontStyle: showDash ? 'italic' : undefined,
      }}
    />
  );
}

