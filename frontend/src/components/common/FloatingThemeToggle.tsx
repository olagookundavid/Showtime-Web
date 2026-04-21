import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

export const FloatingThemeToggle = () => {
    const { isDarkMode, toggleDarkMode } = useTheme();
    const [position, setPosition] = useState({ x: 20, y: 80 }); // Default position: bottom-right (percentages)
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<HTMLButtonElement>(null);
    const dragStartRef = useRef({ x: 0, y: 0 });
    const posStartRef = useRef({ x: 0, y: 0 });
    const hasMovedRef = useRef(false);

    // Load saved position
    useEffect(() => {
        const savedPos = localStorage.getItem('sffl_toggle_pos');
        if (savedPos) {
            try {
                const parsed = JSON.parse(savedPos);
                if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
                    setPosition(parsed);
                }
            } catch (e) {
                console.error("Failed to parse toggle position", e);
            }
        }
    }, []);

    const handlePointerDown = (e: React.PointerEvent) => {
        setIsDragging(true);
        hasMovedRef.current = false;
        dragStartRef.current = { x: e.clientX, y: e.clientY };
        posStartRef.current = position;
        
        if (dragRef.current) {
            dragRef.current.setPointerCapture(e.pointerId);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging) return;
        
        const dx = e.clientX - dragStartRef.current.x;
        const dy = e.clientY - dragStartRef.current.y;
        
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasMovedRef.current = true;
        }

        // Convert delta to percentages based on window size
        const dxPct = (dx / window.innerWidth) * 100;
        const dyPct = (dy / window.innerHeight) * 100;

        // Calculate new position relative to bottom-right origin
        let newX = posStartRef.current.x - dxPct;
        let newY = posStartRef.current.y - dyPct;

        // Clamp to screen bounds (approximate with button size)
        newX = Math.max(2, Math.min(newX, 95));
        newY = Math.max(2, Math.min(newY, 95));

        setPosition({ x: newX, y: newY });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        setIsDragging(false);
        if (dragRef.current) {
            dragRef.current.releasePointerCapture(e.pointerId);
        }
        
        if (hasMovedRef.current) {
            localStorage.setItem('sffl_toggle_pos', JSON.stringify(position));
        }
    };

    const handleClick = () => {
        if (!hasMovedRef.current) {
            toggleDarkMode();
        }
    };

    // Use derived styles based on standard right/bottom CSS
    const style = {
        right: `${position.x}vw`,
        bottom: `${position.y}vh`,
        touchAction: 'none' // Prevent scrolling while dragging on mobile
    };

    return (
        <button
            ref={dragRef}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={style}
            className={`fixed z-[9999] p-3 rounded-full backdrop-blur-md shadow-2xl transition-transform active:scale-90 flex items-center justify-center border-2
                ${isDarkMode 
                    ? 'bg-sffl-navy/90 text-yellow-400 border-white/20' 
                    : 'bg-white/90 text-sffl-navy border-sffl-navy/10'}
                ${isDragging ? 'scale-110 cursor-grabbing' : 'cursor-grab hover:scale-110'}
            `}
            aria-label="Toggle dark mode"
        >
            {isDarkMode ? (
                <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
            ) : (
                <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
            )}
        </button>
    );
};
