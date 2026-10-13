import { useState } from 'react';
import { Button, Input } from '../ui';

interface TicketAccessCodeBoxProps {
    /** Called with the trimmed code when the buyer applies it. */
    onApply: (code: string) => void;
}

/** The access-code box on the dark hero: a code shows tickets that are not listed by default. */
export const TicketAccessCodeBox = ({ onApply }: TicketAccessCodeBoxProps) => {
    const [code, setCode] = useState('');

    return (
        <div className="w-full bg-white/10 p-4 lg:w-80">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-200">Access code?</p>
            <div className="flex gap-2">
                <Input
                    tone="dark"
                    shape="square"
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="CODE"
                    aria-label="Access code"
                    className="min-w-0 flex-1"
                />
                <Button tone="dark" variant="secondary" shape="square" className="shrink-0" onClick={() => onApply(code.trim())}>
                    Apply
                </Button>
            </div>
        </div>
    );
};
