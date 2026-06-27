import { CopyableEmail } from '../../components/common/CopyableEmail';

export const PrivacyPolicy = () => {
    return (
        <div className="space-y-4 md:space-y-8 pb-16">
            <div className="bg-sffl-navy text-white p-4 md:p-8 rounded-xl md:rounded-2xl shadow-xl">
                <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter">PRIVACY POLICY</h1>
                <p className="text-gray-300 mt-2">How we collect, use, and protect your information</p>
                <p className="text-gray-400 text-sm mt-1">Last updated: 27 June 2026</p>
            </div>

            <section className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-xl shadow-md space-y-6 text-gray-700 dark:text-gray-100 leading-relaxed">
                <p>
                    This Privacy Policy explains how the Showtime Flag Football League ("Showtime", "we",
                    "us", or "our") collects, uses, and safeguards your information when you visit
                    <strong> showtimeflag.football</strong> (the "Site"). By using the Site, you agree to the
                    practices described here.
                </p>

                <div>
                    <h2 className="text-2xl font-bold text-sffl-red mb-3">1. Information We Collect</h2>
                    <ul className="list-disc list-inside space-y-2 ml-2">
                        <li><strong>Account information</strong> you provide when registering — such as your name, email address, and phone number.</li>
                        <li><strong>Transaction information</strong> when you buy tickets or store items — such as billing details and shipping address. Payment card details are handled by our payment provider and are not stored by us.</li>
                        <li><strong>Usage data</strong> collected automatically — such as your IP address, browser type, device information, pages visited, and the dates/times of visits.</li>
                        <li><strong>Cookies and similar technologies</strong> — see the Cookies section below.</li>
                    </ul>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-sffl-red mb-3">2. How We Use Your Information</h2>
                    <ul className="list-disc list-inside space-y-2 ml-2">
                        <li>To create and manage your account.</li>
                        <li>To process ticket purchases, store orders, and deliver confirmations.</li>
                        <li>To operate, maintain, and improve the Site and our services.</li>
                        <li>To communicate with you about your account, purchases, or league updates.</li>
                        <li>To display advertising that helps fund the league (see Advertising below).</li>
                        <li>To protect against fraud and keep the Site secure.</li>
                    </ul>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-sffl-red mb-3">3. Cookies and Tracking Technologies</h2>
                    <p>
                        We use cookies and similar technologies to keep you signed in, remember your
                        preferences, understand how the Site is used, and serve advertising. You can disable
                        cookies in your browser settings, though some parts of the Site may not function
                        properly if you do.
                    </p>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-sffl-red mb-3">4. Advertising and Third-Party Cookies</h2>
                    <div className="bg-gray-100 dark:bg-gray-700 p-6 rounded-xl space-y-3">
                        <p>
                            We use <strong>Google AdSense</strong>, a third-party advertising service, to display
                            ads on the Site. Third-party vendors, including Google, use cookies to serve ads based
                            on your prior visits to this and other websites.
                        </p>
                        <ul className="list-disc list-inside space-y-2 ml-2">
                            <li>
                                Google's use of advertising cookies enables it and its partners to serve ads to you
                                based on your visit to our Site and/or other sites on the Internet.
                            </li>
                            <li>
                                You may opt out of personalised advertising by visiting{' '}
                                <a href="https://www.google.com/settings/ads" target="_blank" rel="noopener noreferrer" className="text-sffl-red font-semibold underline">Google Ads Settings</a>.
                            </li>
                            <li>
                                You can also opt out of third-party vendor cookies for personalised advertising at{' '}
                                <a href="https://www.aboutads.info/choices/" target="_blank" rel="noopener noreferrer" className="text-sffl-red font-semibold underline">aboutads.info/choices</a>.
                            </li>
                        </ul>
                        <p>
                            For more information on how Google uses data when you use our Site, see Google's{' '}
                            <a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener noreferrer" className="text-sffl-red font-semibold underline">Privacy &amp; Terms</a>.
                        </p>
                    </div>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-sffl-red mb-3">5. How We Share Information</h2>
                    <p>
                        We do not sell your personal information. We share it only with service providers who
                        help us operate the Site — such as our payment processor (to complete purchases) and
                        advertising and analytics partners (as described above) — or where required by law.
                    </p>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-sffl-red mb-3">6. Data Security</h2>
                    <p>
                        We take reasonable technical and organisational measures to protect your information.
                        However, no method of transmission or storage is completely secure, and we cannot
                        guarantee absolute security.
                    </p>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-sffl-red mb-3">7. Children's Privacy</h2>
                    <p>
                        The Site is not directed to children under 13, and we do not knowingly collect personal
                        information from them. If you believe a child has provided us with information, please
                        contact us so we can remove it.
                    </p>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-sffl-red mb-3">8. Your Rights</h2>
                    <p>
                        Depending on your location, you may have the right to access, correct, or delete your
                        personal information, or to object to certain processing. To make a request, contact us
                        using the details below.
                    </p>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-sffl-red mb-3">9. Changes to This Policy</h2>
                    <p>
                        We may update this Privacy Policy from time to time. Any changes will be posted on this
                        page with an updated "Last updated" date.
                    </p>
                </div>

                <div>
                    <h2 className="text-2xl font-bold text-sffl-red mb-3">10. Contact Us</h2>
                    <p className="mb-4">
                        If you have any questions about this Privacy Policy or how we handle your information,
                        please reach out:
                    </p>
                    <CopyableEmail email="showtime@sffl.football" label="✉️" className="text-sffl-red font-bold text-lg" />
                </div>
            </section>
        </div>
    );
};
