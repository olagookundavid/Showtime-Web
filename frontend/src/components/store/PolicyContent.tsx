// Policy copy lives here so it's editable in one place and reused by any UI
// that wants to surface it (product page modal, future policy hub page, etc).

export const ReturnPolicyContent = () => (
    <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <p>We want you to be happy with every item you purchase from Showtime Store. If you're not completely satisfied with your order, we're here to help.</p>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Return Window</h3>
            <p>You have <strong>15 days</strong> after receiving your item to request a return.</p>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Return Conditions</h3>
            <p>To be eligible for a return:</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>Item must be unused, unworn, and in original packaging</li>
                <li>Tags must still be attached</li>
                <li>You must provide a receipt or proof of purchase</li>
            </ul>
            <p>Returns that do not meet these conditions will not be accepted.</p>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">How to Start a Return</h3>
            <p>Email <a href="mailto:support@showtimestore.com" className="text-sffl-red font-bold underline">support@showtimestore.com</a> within 15 days of delivery.</p>
            <p>Please include:</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>Order number</li>
                <li>Reason for return</li>
                <li>Photo (if the item is defective or damaged)</li>
            </ul>
            <p>If your return is approved, we'll send instructions and the return address below:</p>
        </section>

        <section className="space-y-2 bg-gray-50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-700 rounded-xl p-4">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Return Address</h3>
            <p className="font-bold text-sffl-navy dark:text-white">3 Akinyemi Avenue, Lekki, Lagos, Nigeria</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 italic">Note: Items sent back without requesting a return first will not be accepted.</p>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Who Pays for Return Shipping?</h3>
            <p>If the item is <strong>defective, damaged, or incorrect</strong>, we will cover the return shipping cost.</p>
            <p>If the return is for any other reason (e.g., size doesn't fit, changed your mind), <strong>you are responsible for the return shipping cost</strong>.</p>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Non-Returnable Items</h3>
            <p>We do not accept returns on:</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>Sale or clearance items</li>
                <li>Gift cards</li>
                <li>Personalized or custom items</li>
            </ul>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Exchanges</h3>
            <p>If you'd like to exchange an item, the fastest method is to:</p>
            <ol className="list-decimal pl-5 space-y-1">
                <li>Initiate a return</li>
                <li>Make a new purchase for the replacement item after the return is approved</li>
            </ol>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Refund Process</h3>
            <p>Once we receive and inspect your return, we'll notify you of the outcome.</p>
            <p>If approved:</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>A refund will be issued to your original payment method within <strong>15 business days</strong></li>
                <li>Refund processing times may vary depending on your bank</li>
            </ul>
            <p>If more than 15 business days have passed since we approved your refund, please contact us at <a href="mailto:support@showtimestore.com" className="text-sffl-red font-bold underline">support@showtimestore.com</a>.</p>
        </section>

        <section className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Questions?</h3>
            <p>Reach us anytime at:</p>
            <p className="font-bold"><a href="mailto:support@showtimestore.com" className="text-sffl-red underline">support@showtimestore.com</a></p>
            <p className="font-bold"><a href="tel:+2349036682255" className="text-sffl-red underline">+234 903 668 2255</a></p>
        </section>
    </div>
);

export const PrivacyPolicyContent = () => (
    <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <p className="text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">Last updated: July 9, 2025</p>

        <p>
            At Showtime Store, your privacy is important to us. This Privacy Policy outlines how we collect, use, disclose, and protect your information when you visit our website <a href="https://www.showtimestore.com" target="_blank" rel="noreferrer noopener" className="text-sffl-red font-bold underline">https://www.showtimestore.com</a> and interact with our products and services.
        </p>
        <p>By using our website, you consent to the practices described in this policy.</p>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Information We Collect</h3>
            <p>We may collect the following types of information:</p>
            <p className="font-bold">Personal Information</p>
            <p>When you place an order, sign up for our newsletter, or contact us, we may collect:</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>Full name</li>
                <li>Phone number</li>
                <li>Email address</li>
                <li>Billing and shipping address</li>
                <li>Payment details (processed via secure third-party providers)</li>
            </ul>
            <p className="font-bold pt-1">Non-Personal Information</p>
            <p>We may collect anonymous data including:</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>IP address</li>
                <li>Browser type and device information</li>
                <li>Pages visited, time spent, and referring URLs</li>
            </ul>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">How We Use Your Information</h3>
            <p>We use your information to:</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>Process and fulfill your orders</li>
                <li>Provide customer support</li>
                <li>Send order confirmations and shipping updates</li>
                <li>Communicate promotional offers (with your consent)</li>
                <li>Improve our website and services</li>
            </ul>
            <p className="font-bold">We do not sell, rent, or lease your personal data to any third parties.</p>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Payment Information</h3>
            <p>All payments are processed via secure third-party payment gateways such as Paystack. We do not store your credit or debit card information.</p>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Cookies and Tracking Technologies</h3>
            <p>We use cookies to enhance your browsing experience, remember your preferences, and analyze website traffic. You can choose to disable cookies in your browser settings.</p>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Sharing of Information</h3>
            <p>We may share your information with:</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>Trusted service providers (e.g., logistics, payment processors)</li>
                <li>Law enforcement or regulatory bodies if required by law</li>
            </ul>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Data Retention</h3>
            <p>We retain your personal information for as long as necessary to fulfill your order, comply with legal obligations, or resolve disputes.</p>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Your Rights Under Nigeria Data Protection Regulation (NDPR)</h3>
            <p>As a resident of Nigeria, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>Request access to your personal data</li>
                <li>Correct or update inaccurate data</li>
                <li>Withdraw consent at any time</li>
                <li>Request deletion of your personal data (where legally applicable)</li>
            </ul>
            <p>To exercise these rights, email us at <a href="mailto:support@showtimestore.com" className="text-sffl-red font-bold underline">support@showtimestore.com</a>.</p>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Data Security</h3>
            <p>We implement security measures (SSL encryption, secure hosting, password protection) to protect your data from unauthorized access, alteration, or disclosure.</p>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Third-Party Links</h3>
            <p>Our site may contain links to other websites. We are not responsible for the privacy practices or content of external sites.</p>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Updates to This Policy</h3>
            <p>We may update this Privacy Policy periodically. Any changes will be posted on this page with the revised "Effective Date."</p>
        </section>

        <section className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">Contact Us</h3>
            <p>For questions, complaints, or data access requests, contact:</p>
            <p className="font-bold text-sffl-navy dark:text-white">Showtime Store</p>
            <p><a href="mailto:support@showtimestore.com" className="text-sffl-red font-bold underline">support@showtimestore.com</a></p>
            <p><a href="tel:+2349036682255" className="text-sffl-red font-bold underline">+234 903 668 2255</a></p>
            <p>3, Akinyemi Avenue, Lekki, Lagos</p>
        </section>
    </div>
);

export const ShippingPolicyContent = () => (
    <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
        <p className="text-[11px] uppercase tracking-wider font-bold text-gray-500 dark:text-gray-400">Last updated: 9 July 2025</p>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">1. Order Processing</h3>
            <ul className="list-disc pl-5 space-y-1">
                <li>All orders are processed within <strong>1–2 days</strong> after payment confirmation.</li>
                <li>During peak periods (e.g., major launches, holiday sales), processing may take up to 3 days. We will notify you of any unexpected delays.</li>
            </ul>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">2. Customized Jerseys</h3>
            <ul className="list-disc pl-5 space-y-1">
                <li>Personalized jerseys require a lead time of <strong>7–10 days</strong> before shipping commences.</li>
                <li>Once customization is complete, you will receive a confirmation email or SMS with tracking details.</li>
                <li>Fees for customization are non-refundable once production has begun. Please review all personalization details carefully before finalizing your order.</li>
            </ul>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">3. Domestic Shipping (Nigeria)</h3>
            <ul className="list-disc pl-5 space-y-1">
                <li>We partner with reputable couriers (e.g., GIG Logistics, DHL Express, FedEx) to deliver across Nigeria.</li>
                <li>Once your order ships, you will receive a confirmation email or SMS containing a tracking number and courier details.</li>
                <li><strong>Delivery Timeframes:</strong> 3–7 days</li>
            </ul>
            <p className="font-bold pt-1">Shipping Fees:</p>
            <ul className="list-disc pl-5 space-y-1">
                <li>Flat rate of <strong>₦3,000</strong> for orders under ₦50,000</li>
                <li><strong>Free standard shipping</strong> on orders ₦50,000 and above</li>
                <li>Additional fees may apply for remote or hard-to-reach locations; you will be notified before shipping.</li>
            </ul>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">4. International Shipping</h3>
            <ul className="list-disc pl-5 space-y-1">
                <li>We currently ship to select countries in Africa, Europe, and North America.</li>
                <li>International orders may take <strong>7–21 days</strong>, depending on destination and customs processing.</li>
                <li>Shipping fees vary by weight and destination; exact costs will be calculated at checkout.</li>
                <li>Customers are responsible for any applicable customs duties, import taxes, or other fees imposed by destination countries. Showtime Store is not liable for additional charges upon delivery.</li>
            </ul>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">5. Order Tracking and Notifications</h3>
            <ul className="list-disc pl-5 space-y-1">
                <li>As soon as your order is dispatched, you will receive an email or SMS with a tracking link.</li>
                <li>You may track your shipment on the courier's website using the provided tracking number.</li>
                <li>If you do not receive tracking information within 2 days of placing your order, please contact our customer support team (see Section 8).</li>
            </ul>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">6. Delivery Issues</h3>
            <ul className="list-disc pl-5 space-y-1">
                <li>Please ensure that your shipping address is accurate and complete. Showtime Store is not responsible for delivery delays or non-delivery due to incorrect or incomplete addresses.</li>
                <li>If a courier attempts delivery and you are unavailable, the package will be held at a nearby pickup location. You will be notified of the nearest pickup point by the courier.</li>
                <li>For lost, stolen, or damaged packages, please contact us within <strong>48 hours</strong> of the expected delivery date. We will work with the courier to investigate and resolve the issue.</li>
            </ul>
        </section>

        <section className="space-y-2">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">7. Returns and Exchanges</h3>
            <ul className="list-disc pl-5 space-y-1">
                <li>Shipping for returns or exchanges is the responsibility of the customer, unless the item is defective or an error was made on our part.</li>
                <li>Customized jerseys are not eligible for return unless damaged or incorrect personalization was applied.</li>
                <li>For full details on returns and exchanges, please refer to our Return Policy.</li>
            </ul>
        </section>

        <section className="space-y-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <h3 className="font-black text-sffl-navy dark:text-white uppercase tracking-wider text-xs">8. Contact Information</h3>
            <p>If you have any questions about shipping, tracking, or delivery, please reach out through our 24-hour support channel:</p>
            <p className="font-bold"><a href="mailto:support@showtimestore.com" className="text-sffl-red underline">support@showtimestore.com</a></p>
            <p className="font-bold"><a href="tel:+2349036682255" className="text-sffl-red underline">+234 90 FOOTBALL (+234 903 668 2255)</a></p>
            <p className="text-xs text-gray-500 dark:text-gray-400 italic pt-2">
                Thank you for shopping with Showtime Store. We're committed to delivering your favorite flag football gear quickly, reliably, and at the best possible value.
            </p>
        </section>
    </div>
);
