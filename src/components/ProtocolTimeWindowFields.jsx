import { useId } from 'react';

export const ProtocolTimeWindowFields = ({ start, end, onStartChange, onEndChange }) => {
    const id = useId();
    const sameTimes = Boolean(start && end && start === end);
    return (
        <fieldset className="space-y-3 min-w-0">
            <div className="grid grid-cols-2 gap-3">
                {[
                    { key: 'start', label: 'Start time', value: start, onChange: onStartChange },
                    { key: 'end', label: 'End time', value: end, onChange: onEndChange }
                ].map((field) => (
                    <div key={field.key} className="min-w-0 space-y-1.5">
                        <label htmlFor={`${id}-${field.key}`} className="block text-[11px] text-slate-500">{field.label}</label>
                        <input
                            id={`${id}-${field.key}`}
                            type="time"
                            value={field.value}
                            onInput={(e) => field.onChange(e.currentTarget.value)}
                            onChange={(e) => field.onChange(e.target.value)}
                            aria-describedby={sameTimes ? `${id}-error` : undefined}
                            aria-invalid={sameTimes}
                            className="block w-full min-w-0 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-sm font-mono text-slate-200 [color-scheme:dark] focus:outline-none focus:border-purple-500"
                        />
                    </div>
                ))}
            </div>
            {sameTimes && <p id={`${id}-error`} className="text-[11px] text-rose-300">Times must differ.</p>}
        </fieldset>
    );
};
