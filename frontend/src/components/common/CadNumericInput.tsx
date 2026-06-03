import { useState, useEffect, useRef } from 'react';

interface CadNumericInputProps {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export default function CadNumericInput({
  value,
  onChange,
  step = 0.1,
  min,
  max,
  className = 'cad-input',
  style,
  disabled = false,
}: CadNumericInputProps) {
  const [text, setText] = useState(String(value));
  const [focused, setFocused] = useState(false);
  const [cleared, setCleared] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current && !focused) {
      setText(String(value));
      setCleared(false);
    }
    prevValue.current = value;
  }, [value, focused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    const sanitized = raw.replace(/[^0-9.\-,]/g, '').replace(',', '.');
    setText(sanitized);

    if (sanitized === '' || sanitized === '-') {
      setCleared(true);
      onChange(0);
      return;
    }

    setCleared(false);
    const parsed = parseFloat(sanitized);
    if (!isNaN(parsed) && isFinite(parsed)) {
      const clamped = Math.max(min ?? -Infinity, Math.min(max ?? Infinity, parsed));
      onChange(clamped);
    }
  };

  const handleFocus = () => {
    setFocused(true);
  };

  const handleBlur = () => {
    setFocused(false);
    if (text === '' || text === '-') {
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
      disabled={disabled}
      style={{
        ...style,
        color: showDash ? 'var(--text-muted)' : undefined,
        fontStyle: showDash ? 'italic' : undefined,
        opacity: disabled ? 0.5 : undefined,
        cursor: disabled ? 'not-allowed' : undefined,
      }}
    />
  );
}

