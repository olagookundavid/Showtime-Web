import { useState } from 'react';
import ticketsData from '../../data/tickets.json';

export const TicketsPage = () => {
    const [selectedMatch, setSelectedMatch] = useState<typeof ticketsData[0] | null>(null);
    const [quantity, setQuantity] = useState(1);

    const handlePurchase = () => {
        if (!selectedMatch) return;

        // Mock Paystack integration - in production, this would initialize Paystack
        alert(`Mock Purchase:\n\nMatch: ${selectedMatch.matchTitle}\nQuantity: ${quantity}\nTotal: ₦${(selectedMatch.price * quantity).toLocaleString()}\n\n(In production, this would redirect to Paystack)`);

        // Close modal
        setSelectedMatch(null);
        setQuantity(1);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            {/* Header */}
            <div className="bg-gradient-to-r from-sffl-red to-sffl-navy text-white p-8 rounded-2xl shadow-xl">
                <h1 className="text-5xl font-black italic">BUY TICKETS</h1>
                <p className="text-gray-200 mt-2 text-lg">Secure your spot for upcoming matches</p>
            </div>

            {/* Tickets Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {ticketsData.map((ticket) => (
                    <div
                        key={ticket.id}
                        className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-all duration-300 hover:-translate-y-1"
                    >
                        {/* Match Header */}
                        <div className="bg-sffl-navy text-white p-6">
                            <h2 className="font-black text-2xl mb-2">{ticket.matchTitle}</h2>
                            <div className="text-sm space-y-1 text-gray-300">
                                <p className="font-semibold text-white">{ticket.homeTeam} vs {ticket.awayTeam}</p>
                                <p>📅 {new Date(ticket.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
                                <p>🕐 {ticket.time}</p>
                                <p>📍 {ticket.venue}</p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <p className="text-gray-600 mb-4">{ticket.description}</p>

                            {/* Price */}
                            <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-3xl font-black text-sffl-red">₦{ticket.price.toLocaleString()}</span>
                                <span className="text-gray-500">per ticket</span>
                            </div>

                            {/* Buy Button */}
                            {ticket.available ? (
                                <button
                                    onClick={() => setSelectedMatch(ticket)}
                                    className="w-full bg-sffl-red hover:bg-red-700 text-white font-black py-3 px-6 rounded-lg transition transform hover:scale-105 shadow-md"
                                >
                                    Purchase Tickets
                                </button>
                            ) : (
                                <button
                                    disabled
                                    className="w-full bg-gray-300 text-gray-500 font-black py-3 px-6 rounded-lg cursor-not-allowed"
                                >
                                    Sold Out
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Purchase Modal */}
            {selectedMatch && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl max-w-lg w-full p-8 shadow-2xl">
                        <h3 className="text-2xl font-black text-sffl-navy mb-4">Purchase Tickets</h3>

                        <div className="space-y-4 mb-6">
                            <div className="bg-gray-50 p-4 rounded-lg">
                                <div className="font-bold text-sffl-navy">{selectedMatch.matchTitle}</div>
                                <div className="text-sm text-gray-600">{selectedMatch.homeTeam} vs {selectedMatch.awayTeam}</div>
                                <div className="text-sm text-gray-600">{new Date(selectedMatch.date).toLocaleDateString()} at {selectedMatch.time}</div>
                            </div>

                            {/* Quantity Selector */}
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Quantity</label>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="bg-gray-200 hover:bg-gray-300 w-10 h-10 rounded-lg font-bold"
                                    >
                                        −
                                    </button>
                                    <span className="font-bold text-xl w-12 text-center">{quantity}</span>
                                    <button
                                        onClick={() => setQuantity(Math.min(10, quantity + 1))}
                                        className="bg-gray-200 hover:bg-gray-300 w-10 h-10 rounded-lg font-bold"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>

                            {/* Total */}
                            <div className="border-t pt-4">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-gray-700 font-semibold">Total:</span>
                                    <span className="text-3xl font-black text-sffl-red">₦{(selectedMatch.price * quantity).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex gap-3">
                            <button
                                onClick={() => {
                                    setSelectedMatch(null);
                                    setQuantity(1);
                                }}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePurchase}
                                className="flex-1 bg-sffl-red hover:bg-red-700 text-white font-bold py-3 rounded-lg transition"
                            >
                                Pay with Paystack
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 text-center mt-4">
                            You will be redirected to Paystack for secure payment
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};
