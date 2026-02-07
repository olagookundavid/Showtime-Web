export const CommissionersNote = () => {
    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-4xl font-black italic tracking-tight">COMMISSIONER'S NOTE</h1>
                <p className="text-gray-300 mt-2">Official league communications and updates</p>
            </div>

            {/* Latest Notice */}
            <section className="bg-white p-8 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-sffl-red mb-4 uppercase tracking-wide">
                    Fines and Infractions - Season 2025
                </h2>
                <div className="text-gray-700 space-y-4 leading-relaxed">
                    <p>
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin vel ipsum quis
                        mauris hendrerit ultricies. Vestibulum ante ipsum primis in faucibus orci luctus
                        et ultrices posuere cubilia curae; Suspendisse potenti.
                    </p>
                    <p>
                        Pellentesque habitant morbi tristique senectus et netus et malesuada fames ac
                        turpis egestas. Donec ac felis vel libero congue bibendum. Curabitur nec lectus
                        id lorem facilisis volutpat. Nulla facilisi.
                    </p>
                    <p>
                        Sed euismod, nisl nec ultricies lacinia, nisl nisl aliquam nisl, nec aliquam
                        nisl nisl nec nisl. Donec vel nisl nec nisl aliquam aliquam.
                    </p>
                </div>
            </section>

            {/* Additional Notices */}
            <section className="bg-white p-8 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-sffl-navy mb-4 uppercase tracking-wide">
                    Upcoming Schedule Changes
                </h2>
                <div className="text-gray-700 space-y-4 leading-relaxed">
                    <p>
                        Maecenas tempus, tellus eget condimentum rhoncus, sem quam semper libero,
                        sit amet adipiscing sem neque sed ipsum. Nam quam nunc, blandit vel,
                        luctus pulvinar, hendrerit id, lorem.
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                        <li>Lorem ipsum dolor sit amet, consectetuer adipiscing elit</li>
                        <li>Aliquam tincidunt mauris eu risus</li>
                        <li>Vestibulum auctor dapibus neque</li>
                    </ul>
                </div>
            </section>

            {/* Signature */}
            <div className="bg-gray-100 p-6 rounded-lg italic text-gray-700">
                <p className="font-semibold">- The Commissioner</p>
                <p className="text-sm text-gray-500">Showtime Flag Football League</p>
            </div>
        </div>
    );
};
