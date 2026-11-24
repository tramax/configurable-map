import { useEffect, useRef, useState } from "react";
import "@esri/calcite-components/components/calcite-input-number";

/**
 * Number input that keeps what the user typed ("1.", "-") as text and only reports parsable
 * values, so editing isn't fought by the controlled value. `NaN` is reported for an empty field.
 */
export default function NumberInput({
  value,
  onChange,
  min,
  label,
  className,
}: {
  value: number;
  onChange: (nextValue: number) => void;
  min?: number;
  label: string;
  className?: string;
}) {
  const [text, setText] = useState(Number.isFinite(value) ? String(value) : "");
  // Re-sync when the value is changed from outside (field change, reset), not while typing.
  const lastReported = useRef(value);
  useEffect(() => {
    if (!Object.is(value, lastReported.current)) {
      lastReported.current = value;
      setText(Number.isFinite(value) ? String(value) : "");
    }
  }, [value]);

  return (
    <calcite-input-number
      className={className}
      scale="s"
      step="any"
      min={min}
      label={label}
      suffix-text="px"
      value={text}
      oncalciteInputNumberInput={(event) => {
        const raw = event.target.value;
        setText(raw);
        const next = raw.trim() === "" ? NaN : Number(raw);
        lastReported.current = next;
        onChange(next);
      }}
    />
  );
}
