import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createReferralCode, lookupReferrals, type ReferralResponse } from '../../services/api';

export const ReferralGeneratorPage: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'generate' | 'lookup'>('generate');
    
    // Generate state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [generating, setGenerating] = useState(false);
    const [generatedCode, setGeneratedCode] = useState<ReferralResponse | null>(null);
    const [genError, setGenError] = useState('');
    const [copied, setCopied] = useState(false);

    // Lookup state
    const [searchName, setSearchName] = useState('');
    const [lookingUp, setLookingUp] = useState(false);
    const [lookupResults, setLookupResults] = useState<ReferralResponse[]>([]);
    const [lookupError, setLookupError] = useState('');
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setGenError('Name is required');
            return;
        }
        setGenError('');
        setGenerating(true);
        setGeneratedCode(null);

        try {
            const res = await createReferralCode({
                name: name.trim(),
                email: email.trim() || undefined,
            });
            setGeneratedCode(res);
            setName('');
            setEmail('');
        } catch (err: any) {
            setGenError(err.response?.data?.error || 'Failed to generate referral code. Please try again.');
        } finally {
            setGenerating(false);
        }
    };

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchName.trim()) {
            setLookupError('Search name is required');
            return;
        }
        setLookupError('');
        setLookingUp(true);
        setLookupResults([]);

        try {
            const results = await lookupReferrals(searchName.trim());
            const safeResults = results || [];
            setLookupResults(safeResults);
            if (safeResults.length === 0) {
                setLookupError('No referral codes found for this name.');
            }
        } catch (err: any) {
            setLookupError(err.response?.data?.error || 'Failed to search referral codes. Please try again.');
        } finally {
            setLookingUp(false);
        }
    };

    const getReferralLink = (code: string) => {
        const domain = window.location.origin;
        return `${domain}/tickets?ref=${code}`;
    };

    const handleCopy = (link: string, index?: number) => {
        navigator.clipboard.writeText(link);
        if (index !== undefined) {
            setCopiedIndex(index);
            setTimeout(() => setCopiedIndex(null), 2000);
        } else {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="max-w-2xl mx-auto my-8 p-4">
            {/* Header */}
            <div className="bg-sffl-navy text-white p-6 md:p-8 rounded-2xl shadow-xl text-center mb-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-sffl-red/10 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter relative z-10">SFFL REFERRAL PROGRAM</h1>
                <p className="text-gray-300 mt-2 text-xs md:text-sm max-w-md mx-auto relative z-10">
                    Invite friends to secure tickets for SFFL games, track completed sales, and earn rewards!
                </p>
                <div className="mt-4 inline-block">
                    <Link to="/tickets" className="text-sffl-red hover:underline text-xs font-bold">
                        &larr; Back to Tickets Page
                    </Link>
                </div>
            </div>

            {/* Tab Control */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl mb-6 border border-gray-200/50 dark:border-gray-700/50">
                <button
                    onClick={() => setActiveTab('generate')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                        activeTab === 'generate'
                            ? 'bg-white dark:bg-gray-700 text-sffl-navy dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                    🎟️ Generate Code
                </button>
                <button
                    onClick={() => setActiveTab('lookup')}
                    className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all ${
                        activeTab === 'lookup'
                            ? 'bg-white dark:bg-gray-700 text-sffl-navy dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                >
                    🔍 Look Up Code
                </button>
            </div>

            {/* Content Container */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-md p-6 md:p-8">
                {activeTab === 'generate' ? (
                    <div className="space-y-6">
                        {!generatedCode ? (
                            <form onSubmit={handleGenerate} className="space-y-4">
                                <h3 className="text-base font-bold text-gray-900 dark:text-white">Create your referral link</h3>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                        Your Full Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. John Doe"
                                        className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-950 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none text-sm transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                        Email Address <span className="text-gray-400 font-normal ml-1">(optional)</span>
                                    </label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="e.g. john@example.com"
                                        className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-950 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none text-sm transition-all"
                                    />
                                    <p className="text-[10px] text-gray-500 mt-1">If provided, we will send your code and link via email.</p>
                                </div>

                                {genError && (
                                    <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded-lg text-xs font-medium border border-red-200/50 dark:border-red-800/30">
                                        {genError}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={generating}
                                    className="w-full bg-sffl-red hover:bg-[#A52323] text-white font-bold py-2.5 rounded-lg text-sm transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                                >
                                    {generating ? (
                                        <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Generating...</>
                                    ) : (
                                        '⚡ Generate Referral Code'
                                    )}
                                </button>
                            </form>
                        ) : (
                            <div className="space-y-6 text-center animate-fade-in">
                                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 text-green-600 rounded-full flex items-center justify-center text-xl mx-auto">
                                    ✓
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Referral Code Created!</h3>
                                    <p className="text-xs text-gray-500 mt-1">Hello {generatedCode.name}, your code is active and ready to share.</p>
                                </div>

                                <div className="bg-gradient-to-r from-sffl-navy to-slate-800 p-6 rounded-xl border border-sffl-red/30">
                                    <span className="text-[10px] font-bold text-sffl-red uppercase tracking-wider block mb-1">Your Code</span>
                                    <span className="text-3xl font-extrabold text-white tracking-widest block font-mono uppercase">{generatedCode.code}</span>
                                </div>

                                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-150 dark:border-gray-700 text-left">
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300 block mb-1.5">🔗 Share this ticket link:</span>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            readOnly
                                            value={getReferralLink(generatedCode.code)}
                                            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-700 rounded bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-xs font-mono select-all outline-none"
                                        />
                                        <button
                                            onClick={() => handleCopy(getReferralLink(generatedCode.code))}
                                            className={`font-bold px-4 py-1.5 rounded text-xs transition shrink-0 shadow-sm ${
                                                copied ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-sffl-navy text-white hover:bg-slate-800'
                                            }`}
                                        >
                                            {copied ? 'Copied!' : 'Copy Link'}
                                        </button>
                                    </div>
                                </div>

                                {generatedCode.email && (
                                    <p className="text-xs text-gray-500 italic">
                                        📨 We have sent this details to <span className="font-semibold text-gray-700 dark:text-gray-300">{generatedCode.email}</span>.
                                    </p>
                                )}

                                <button
                                    onClick={() => setGeneratedCode(null)}
                                    className="text-xs text-gray-500 hover:text-sffl-red font-bold underline"
                                >
                                    Generate another code
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6">
                        <form onSubmit={handleLookup} className="space-y-4">
                            <h3 className="text-base font-bold text-gray-900 dark:text-white">Search existing referral codes</h3>
                            <div>
                                <label className="block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1.5">
                                    Enter Registered Name <span className="text-red-500">*</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        required
                                        value={searchName}
                                        onChange={(e) => setSearchName(e.target.value)}
                                        placeholder="e.g. John Doe"
                                        className="w-full px-3.5 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-950 dark:text-white focus:ring-2 focus:ring-sffl-red outline-none text-sm transition-all"
                                    />
                                    <button
                                        type="submit"
                                        disabled={lookingUp}
                                        className="bg-sffl-navy hover:bg-slate-800 text-white font-bold px-6 py-2 rounded-lg text-xs transition disabled:opacity-50 shrink-0 shadow-sm flex items-center gap-1.5"
                                    >
                                        {lookingUp ? (
                                            <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> searching...</>
                                        ) : (
                                            'Search'
                                        )}
                                    </button>
                                </div>
                            </div>

                            {lookupError && (
                                <div className="bg-amber-50 dark:bg-amber-900/10 text-amber-800 dark:text-amber-300 p-3 rounded-lg text-xs font-medium border border-amber-200/50 dark:border-amber-900/30">
                                    {lookupError}
                                </div>
                            )}
                        </form>

                        {lookupResults && lookupResults.length > 0 && (
                            <div className="space-y-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                                <h4 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Matching Codes</h4>
                                <div className="divide-y divide-gray-100 dark:divide-gray-800 max-h-72 overflow-y-auto pr-1">
                                    {lookupResults.map((rc, idx) => (
                                        <div key={rc.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm">
                                            <div>
                                                <p className="font-bold text-gray-900 dark:text-white">{rc.name}</p>
                                                <p className="text-[10px] text-gray-500 font-mono">Code: <span className="font-bold text-sffl-navy dark:text-white">{rc.code}</span></p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleCopy(getReferralLink(rc.code), idx)}
                                                    className={`px-3 py-1 rounded text-xs font-bold transition shadow-sm ${
                                                        copiedIndex === idx
                                                            ? 'bg-green-600 text-white hover:bg-green-700'
                                                            : 'bg-sffl-red text-white hover:bg-[#A52323]'
                                                    }`}
                                                >
                                                    {copiedIndex === idx ? 'Copied!' : 'Copy Link'}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
