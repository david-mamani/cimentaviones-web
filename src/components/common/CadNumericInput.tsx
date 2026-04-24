/**
 * CadNumericInput — A numeric input that allows clearing.
 * When empty, shows "—" and treats the value as 0.
 * The parent receives 0 when the field is empty.
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
  const [text, setText] = useState(formatValue(value));
  const [focused, setFocused] = useState(false);
  const prevValue = useRef(value);

  // Sync from parent when value changes externally
  useEffect(() => {
    if (value !== prevValue.current && !focused) {
      setText(formatValue(value));
    }
    prevValue.current = value;
  }, [value, focused]);

  function formatValue(v: number): string {
    // Show nice number without trailing zeros
    return v === 0 ? '' : String(v);
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setText(raw);

    if (raw === '' || raw === '-') {
      onChange(0);
      return;
    }

    const parsed = parseFloat(raw);
    if (!isNaN(parsed)) {
      const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, parsed));
      onChange(clamped);
    }
  };

  const handleFocus = () => {
    setFocused(true);
    // Show the actual number on focus (even if 0)
    if (text === '' && value === 0) {
      setText('');
    }
  };

  const handleBlur = () => {
    setFocused(false);
    // Normalize display
    if (text === '' || text === '-') {
      setText('');
      onChange(0);
    } else {
      const parsed = parseFloat(text);
      if (!isNaN(parsed)) {
        setText(formatValue(parsed));
      }
    }
  };

  const displayValue = focused ? text : (text === '' ? '—' : text);
  const isEmpty = !focused && text === '';

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
        color: isEmpty ? '#555' : undefined,
        fontStyle: isEmpty ? 'italic' : undefined,
      }}
    />
  );
}
