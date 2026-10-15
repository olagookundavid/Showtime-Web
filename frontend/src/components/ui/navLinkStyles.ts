const navLinkBase =
    'relative min-h-11 inline-flex items-center font-bold transition-colors duration-300 ' +
    'after:absolute after:left-0 after:bottom-1 after:h-0.75 after:w-full after:rounded-full ' +
    'after:bg-sffl-red after:origin-left after:scale-x-0 after:transition-transform ' +
    'after:duration-300 after:ease-out motion-reduce:after:transition-none ' +
    'hover:after:scale-x-100 focus-visible:after:scale-x-100 ' +
    'outline-none focus-visible:text-sffl-red';

/** A text link with the Navbar's red underline-bar treatment: a full bar under the active link, growing in on hover/focus for the rest. */
export const navLinkClass = (active: boolean, color = 'text-white') =>
    `${navLinkBase} ${color} ${active ? 'after:scale-x-100' : 'hover:text-sffl-red'}`;
