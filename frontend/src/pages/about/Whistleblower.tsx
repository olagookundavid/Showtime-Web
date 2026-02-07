export const Whistleblower = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-4xl font-black italic">WHISTLEBLOWER & POLICIES</h1>
                <p className="text-gray-300 mt-2">Reporting violations and league policies</p>
            </div>

            <section className="bg-white p-8 rounded-xl shadow-md space-y-6">
                <h2 className="text-2xl font-bold text-sffl-red">Our Commitment to Integrity</h2>
                <p className="text-gray-700 leading-relaxed">
                    Showtime Flag Football League is committed to maintaining the highest standards
                    of integrity, fairness, and ethical conduct. We take all reports of misconduct
                    seriously and have established clear policies for reporting and addressing violations.
                </p>

                <div className="bg-red-50 border-l-4 border-sffl-red p-6 my-6">
                    <h3 className="font-bold text-lg text-sffl-navy mb-2">Zero Tolerance Policy</h3>
                    <p className="text-gray-700">
                        SFFL has zero tolerance for harassment, discrimination, violence, cheating,
                        or any behavior that undermines the integrity of the league or endangers
                        participants.
                    </p>
                </div>

                <h2 className="text-2xl font-bold text-sffl-navy mt-8">What to Report</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="bg-gray-100 p-5 rounded-lg">
                        <h3 className="font-bold text-sffl-red mb-2">🚫 Rule Violations</h3>
                        <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                            <li>Use of ineligible players</li>
                            <li>Tampering with equipment</li>
                            <li>Falsifying registration documents</li>
                        </ul>
                    </div>
                    <div className="bg-gray-100 p-5 rounded-lg">
                        <h3 className="font-bold text-sffl-red mb-2">⚠️ Safety Concerns</h3>
                        <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                            <li>Unsafe playing conditions</li>
                            <li>Dangerous player conduct</li>
                            <li>Inadequate medical response</li>
                        </ul>
                    </div>
                    <div className="bg-gray-100 p-5 rounded-lg">
                        <h3 className="font-bold text-sffl-red mb-2">🛑 Misconduct</h3>
                        <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                            <li>Harassment or bullying</li>
                            <li>Discrimination</li>
                            <li>Threats or violence</li>
                        </ul>
                    </div>
                    <div className="bg-gray-100 p-5 rounded-lg">
                        <h3 className="font-bold text-sffl-red mb-2">💰 Financial Issues</h3>
                        <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                            <li>Misuse of league funds</li>
                            <li>Bribery or corruption</li>
                            <li>Fraudulent transactions</li>
                        </ul>
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-sffl-navy mt-8">How to Report</h2>
                <div className="bg-sffl-navy text-white p-6 rounded-xl">
                    <p className="mb-4">
                        Reports can be made anonymously or with identification. All reports are
                        treated confidentially and investigated thoroughly.
                    </p>
                    <div className="space-y-3">
                        <div>
                            <span className="font-bold">Email:</span>{' '}
                            <a href="mailto:whistleblower@sffl.football" className="text-sffl-red hover:underline">
                                whistleblower@sffl.football
                            </a>
                        </div>
                        <div>
                            <span className="font-bold">Phone:</span> +234 XXX XXX XXXX
                        </div>
                        <div>
                            <span className="font-bold">In Person:</span> Speak to any league official or the Commissioner
                        </div>
                    </div>
                </div>

                <h2 className="text-2xl font-bold text-sffl-navy mt-8">Protection Against Retaliation</h2>
                <p className="text-gray-700 leading-relaxed">
                    SFFL prohibits retaliation against anyone who makes a good-faith report of
                    suspected violations. Individuals found retaliating against whistleblowers
                    will face disciplinary action, including suspension or expulsion from the league.
                </p>

                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mt-6">
                    <p className="text-sm text-gray-700">
                        <strong>Note:</strong> False or malicious reports made with intent to harm
                        another person's reputation will be subject to disciplinary action.
                    </p>
                </div>
            </section>
        </div>
    );
};
