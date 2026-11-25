const tone: Record<string, string> = {
  W: 'bg-emerald-600 text-white',
  D: 'bg-gray-400 text-white dark:bg-gray-500',
  L: 'bg-red-600 text-white',
};
const word: Record<string, string> = { W: 'won', D: 'drew', L: 'lost' };

/** The last five results as W, D and L tiles, oldest first. */
export const FormBadges = ({ form }: { form: string }) => {
  if (!form) return <span className="text-gray-400">&mdash;</span>;
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`Last results: ${[...form].map((r) => word[r]).join(', ')}`}>
      {[...form].map((r, i) => (
        <span key={i} aria-hidden="true" className={`w-5 h-5 rounded text-[10px] font-black inline-flex items-center justify-center ${tone[r]}`}>
          {r}
        </span>
      ))}
    </span>
  );
};
