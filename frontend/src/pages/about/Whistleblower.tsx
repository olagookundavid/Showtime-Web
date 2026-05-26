import { CopyableEmail } from '../../components/common/CopyableEmail';

export const Whistleblower = () => {
    return (
        <div className="space-y-4 md:space-y-8">
            <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">POLICIES & CONDUCT</h1>
                <p className="text-gray-300 mt-2">Ensuring a safe environment for all</p>
            </div>

            <section className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold text-sffl-red">Sexual Harassment Policy</h2>
                <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-sffl-red p-6 text-gray-800 dark:text-gray-100 leading-relaxed">
                    <p className="font-bold mb-4">Zero Tolerance Statement</p>
                    <p>
                        The Showtime Flag Football League (SFFL) adheres to a strict <strong>ZERO TOLERANCE</strong> policy
                        regarding sexual harassment. We are committed to providing a safe, respectful, and inclusive
                        environment for all players, officials, staff, and fans.
                    </p>
                </div>

                <h3 className="text-xl font-bold text-sffl-navy dark:text-white mt-6">What Constitutes Harassment?</h3>
                <p className="text-gray-700 dark:text-gray-100">
                    Sexual harassment includes, but is not limited to:
                </p>
                <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-100 ml-4">
                    <li>Unwelcome sexual advances or requests for sexual favors.</li>
                    <li>Verbal or physical conduct of a sexual nature.</li>
                    <li>Inappropriate touching or physical contact.</li>
                    <li>Making sexual comments, jokes, or gestures.</li>
                    <li>Displaying sexually offensive materials.</li>
                </ul>

                <h3 className="text-xl font-bold text-sffl-navy dark:text-white mt-6">Reporting a Violation</h3>
                <p className="text-gray-700 dark:text-gray-100">
                    If you experience or witness any form of harassment, we urge you to report it immediately.
                    Your safety and well-being are our top priority.
                </p>

                <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-xl mt-4">
                    <h4 className="font-bold text-lg mb-2 dark:text-white">Confidential Reporting Channel</h4>
                    <p className="text-gray-700 dark:text-gray-300 mb-4">
                        You can report incidents directly to the league's disciplinary committee via email.
                        All reports will be handled with the utmost confidentiality and urgency.
                    </p>
                    <div className="mt-2 pb-2">
                        <CopyableEmail email="whistleblowers@sffl.football" label="✉️" className="text-sffl-red font-bold text-lg" />
                    </div>
                </div>

                <h3 className="text-xl font-bold text-sffl-navy dark:text-white mt-6">Consequences</h3>
                <p className="text-gray-700 dark:text-gray-100">
                    Any individual found to have violated this policy will face immediate disciplinary action,
                    which may include suspension, permanent ban from the league, and legal action where appropriate.
                </p>
            </section>
        </div>
    );
};
