import "@esri/calcite-components/components/calcite-input-number";

/**
 * Whole-number input. `integer` stops the user typing partial decimals ("1."), so the value
 * round-trips through the controlled `value`. `NaN` is reported for an empty field.
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
  return (
    <calcite-input-number
      className={className}
      scale="s"
      integer
      min={min}
      label={label}
      suffix-text="px"
      value={Number.isFinite(value) ? String(value) : ""}
      oncalciteInputNumberInput={(event) => {
        const raw = event.target.value;
        onChange(raw.trim() === "" ? NaN : Number(raw));
      }}
    />
  );
}
