'use client'

interface SliderProps {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  step: number
}

export default function Slider({ label, value, onChange, min, max, step }: SliderProps) {
  const id = `slider-${label.toLowerCase().replace(/\s+/g, '-')}`
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <label htmlFor={id} className="text-xs font-medium text-slate-400">
          {label}
        </label>
        <span className="text-xs font-mono text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded">
          {value}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer
          bg-slate-700 accent-emerald-500"
      />
    </div>
  )
}
