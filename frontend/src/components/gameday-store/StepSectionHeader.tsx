type Props = {
  step: number;
  title: string;
};

/** "1. Choose your admission tier" style numbered heading, shared by the Tickets and Game Pass builders. */
export const StepSectionHeader = ({ step, title }: Props) => (
  <div className="flex items-center gap-3">
    <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-sffl-navy text-xs font-black text-white dark:bg-white dark:text-sffl-navy">
      {step}
    </span>
    <h3 className="text-sm font-black uppercase tracking-widest text-sffl-navy dark:text-white">
      {title}
    </h3>
  </div>
);
