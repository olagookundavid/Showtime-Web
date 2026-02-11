export const CommissionersNote = () => {
    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="bg-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-4xl font-black italic tracking-tight">COMMISSIONER'S NOTE</h1>
                <p className="text-gray-300 mt-2">Official league communications and updates</p>
            </div>

            {/* Latest Notice */}
            <section className="bg-white p-8 rounded-xl shadow-md">
                <h2 className="text-2xl font-bold text-sffl-red mb-4 uppercase tracking-wide">
                    Fines and Infractions
                </h2>
                <div className="bg-gray-50 border-l-4 border-sffl-navy p-4 mb-6 text-sm text-gray-600">
                    <p>Referenced Document: <a href="https://aoazee-my.sharepoint.com/:w:/g/personal/adebare_sffl_football/ERffMZ1Eju5Er0jxbZ15H-wBmIr7nYwtkmWWPTdcztg8ag?e=Ht8k7s" target="_blank" rel="noopener noreferrer" className="text-sffl-red hover:underline">Fines_and_Infractions_2025.docx</a></p>
                </div>

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

            {/* Signature */}
            <div className="bg-gray-100 p-6 rounded-lg italic text-gray-700">
                <p className="font-semibold">- The Commissioner</p>
                <p className="text-sm text-gray-500">Showtime Flag Football League</p>
            </div>
        </div>
    );
};
