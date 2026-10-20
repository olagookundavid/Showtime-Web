import { EnvelopeIcon } from '@heroicons/react/24/outline';
import { CopyableEmail } from '../../components';

export const Whistleblower = () => {
    return (
        <div className="space-y-4 md:space-y-8">
            <section className="p-5 sm:p-8">
                <h2 className="mb-6 flex items-center gap-3 text-2xl font-black text-sffl-navy dark:text-white uppercase">
                    <span className="h-px w-8 shrink-0 bg-sffl-red" aria-hidden="true" />
                    Sexual Harassment Policy
                </h2>

                <div className="border-l-4 border-sffl-red bg-red-50 dark:bg-red-900/20 p-4 sm:p-6 text-gray-800 dark:text-gray-100 leading-relaxed">
                    <p className="font-black uppercase tracking-wide text-sm mb-3">Zero Tolerance Statement</p>
                    <p>
                        The Showtime Flag Football League (SFFL) adheres to a strict <strong>ZERO TOLERANCE</strong> policy
                        regarding sexual harassment. We are committed to providing a safe, respectful, and inclusive
                        environment for all players, officials, staff, and fans.
                    </p>
                </div>

                <div className="mt-8 space-y-6">
                    <div>
                        <h3 className="text-lg sm:text-xl font-black text-sffl-navy dark:text-white uppercase tracking-tight mb-2">What Constitutes Harassment?</h3>
                        <p className="text-gray-700 dark:text-gray-300 mb-3">
                            Sexual harassment includes, but is not limited to:
                        </p>
                        <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 ml-4">
                            <li>Unwelcome sexual advances or requests for sexual favors.</li>
                            <li>Verbal or physical conduct of a sexual nature.</li>
                            <li>Inappropriate touching or physical contact.</li>
                            <li>Making sexual comments, jokes, or gestures.</li>
                            <li>Displaying sexually offensive materials.</li>
                        </ul>
                    </div>

                    <div>
                        <h3 className="text-lg sm:text-xl font-black text-sffl-navy dark:text-white uppercase tracking-tight mb-2">Reporting a Violation</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            If you experience or witness any form of harassment, we urge you to report it immediately.
                            Your safety and well-being are our top priority.
                        </p>
                    </div>

                    <div className="border border-gray-200 dark:border-gray-700 border-t-4 border-t-sffl-red bg-white dark:bg-gray-800 p-5 sm:p-6">
                        <h4 className="font-black text-lg uppercase tracking-tight text-sffl-navy dark:text-white mb-2">Confidential Reporting Channel</h4>
                        <p className="text-gray-700 dark:text-gray-300 mb-4">
                            You can report incidents directly to the league's disciplinary committee via email.
                            All reports will be handled with the utmost confidentiality and urgency.
                        </p>
                        <div className="mt-2 pb-2">
                            <CopyableEmail email="whistleblowers@showtimeflag.football" label={<EnvelopeIcon className="w-5 h-5" aria-label="Email" />} className="text-sffl-red font-bold text-base sm:text-lg" />
                        </div>
                    </div>

                    <div>
                        <h3 className="text-lg sm:text-xl font-black text-sffl-navy dark:text-white uppercase tracking-tight mb-2">Consequences</h3>
                        <p className="text-gray-700 dark:text-gray-300">
                            Any individual found to have violated this policy will face immediate disciplinary action,
                            which may include suspension, permanent ban from the league, and legal action where appropriate.
                        </p>
                    </div>
                </div>
            </section>
        </div>
    );
};
