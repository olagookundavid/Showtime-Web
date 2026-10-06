import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircleIcon, ChevronRightIcon, EnvelopeIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { playerPortalApi, type ContractData } from '../../services/api';
import { DashboardPageHeader } from '../../components/dashboard/DashboardPageHeader';
import { RunnerIcon } from '../../components/icons/RunnerIcon';
import { Button } from '../../components/ui';
import { Spinner } from '../../components/ui/Spinner';
import { NotLinkedNotice } from '../../components/player-portal/NotLinkedNotice';
import { OfferResponseDialog, type OfferResponse } from '../../components/player-portal/OfferResponseDialog';
import { PLAYER_PORTAL_CONTRACTS_PATH } from '../../components/player-portal/playerPortalNav';
import { apiError } from '../../components/player-portal/apiError';

const statLabelClass = 'text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase';
const statValueClass = 'text-lg sm:text-xl font-black text-gray-900 dark:text-white';

export const PlayerPortalOverview: React.FC = () => {
    const [contracts, setContracts] = useState<ContractData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [notLinked, setNotLinked] = useState<boolean>(false);
    // Accept and reject wait here for the confirm dialog.
    const [respondTo, setRespondTo] = useState<OfferResponse | null>(null);

    const fetchContracts = async () => {
        setLoading(true);
        try {
            const res = await playerPortalApi.getContracts();
            setContracts(res || []);
            setNotLinked(false);
        } catch (err) {
            // An unlinked account is an expected state, not a failure — explain
            // it in place rather than firing an error toast at the player.
            if (apiError(err).code === 'PLAYER_NOT_LINKED') {
                setNotLinked(true);
            } else {
                toast.error('Failed to load contract details');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchContracts();
    }, []);

    const activeContract = contracts.find(c => c.status === 'ACTIVE');
    const pendingOffers = contracts.filter(c => c.status === 'PENDING');

    return (
        <div className="space-y-6 sm:space-y-8">
            <DashboardPageHeader
                title="Overview"
                subtitle="Your current contract and any offers waiting for your answer."
            />

            {/* Either/or, never both. With no player record behind the account the
                status card below falls through to its "Free Agent — managers can
                issue offers to sign you" state, which is a different situation
                entirely and reads as a contradiction next to the notice. */}
            {notLinked ? <NotLinkedNotice /> : (
            <>
            {/* Pending Offers Alert Section */}
            {pendingOffers.length > 0 && (
                <section className="space-y-4">
                    <h2 className="inline-flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
                        <EnvelopeIcon className="w-5 h-5 text-sffl-red" aria-hidden="true" />
                        Pending Offers ({pendingOffers.length})
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {pendingOffers.map(c => (
                            <div key={c.id} className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-lg border-2 border-sffl-red/30 space-y-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {c.team?.logo ? (
                                            <img src={c.team.logo} alt="" className="w-10 h-10 shrink-0 object-contain" />
                                        ) : (
                                            <div className="w-10 h-10 shrink-0 bg-sffl-navy text-white rounded-xl flex items-center justify-center font-bold text-sm">
                                                {c.team?.name?.slice(0, 2) || 'TM'}
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <h3 className="font-bold text-lg text-gray-900 dark:text-white wrap-break-word">{c.team?.name}</h3>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">Offered on {new Date(c.offered_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-bold rounded-md whitespace-nowrap">
                                        Action required
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2 text-sm bg-gray-50 dark:bg-gray-700/50 p-3 rounded-xl">
                                    <div className="min-w-0">
                                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Length</span>
                                        <span className="font-bold text-gray-900 dark:text-white">{c.contract_length?.toLocaleString()} team matches</span>
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-xs text-gray-500 dark:text-gray-400 block">Player Value</span>
                                        <span className="font-bold text-sffl-red">{c.player_value.toLocaleString()} pts</span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <Button
                                        variant="success"
                                        className="flex-1"
                                        icon={CheckCircleIcon}
                                        onClick={() => setRespondTo({ contract: c, action: 'accept' })}
                                    >
                                        Accept Offer
                                    </Button>
                                    <Button
                                        variant="danger"
                                        className="flex-1"
                                        icon={XCircleIcon}
                                        onClick={() => setRespondTo({ contract: c, action: 'reject' })}
                                    >
                                        Reject
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* Active Contract Status Card */}
            <section className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-gray-100 dark:border-gray-700 pb-3">
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">Current Contract</h2>
                    <Link
                        to={PLAYER_PORTAL_CONTRACTS_PATH}
                        className="inline-flex items-center gap-1 min-h-11 text-xs font-bold text-sffl-red hover:underline"
                    >
                        Contract history
                        <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
                    </Link>
                </div>

                {loading ? (
                    <Spinner label="Loading your contract" />
                ) : activeContract ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                        <div className="col-span-2 lg:col-span-1 space-y-1 min-w-0">
                            <span className={statLabelClass}>Current Team</span>
                            <div className="flex items-center gap-3 min-w-0">
                                {activeContract.team?.logo && (
                                    <img src={activeContract.team.logo} alt="" className="w-8 h-8 shrink-0 object-contain" />
                                )}
                                <h3 className={`${statValueClass} wrap-break-word min-w-0`}>{activeContract.team?.name}</h3>
                            </div>
                        </div>

                        <div className="space-y-1 min-w-0">
                            <span className={statLabelClass}>Contract Length</span>
                            <p className={statValueClass}>{activeContract.contract_length?.toLocaleString()} matches</p>
                        </div>

                        <div className="space-y-1 min-w-0">
                            <span className={statLabelClass}>Matches Played</span>
                            <p className={statValueClass}>{activeContract.matches_played?.toLocaleString()} matches</p>
                        </div>

                        <div className="space-y-1 min-w-0">
                            <span className={statLabelClass}>Remaining</span>
                            <p className="text-lg sm:text-xl font-black text-green-600 dark:text-green-400">{activeContract.matches_remaining?.toLocaleString()} matches</p>
                        </div>
                    </div>
                ) : (
                    <div className="p-6 sm:p-8 text-center bg-gray-50 dark:bg-gray-700/30 rounded-xl">
                        <RunnerIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" aria-hidden="true" />
                        <h3 className="font-bold text-gray-900 dark:text-white text-lg">Free Agent</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">You are not currently under contract with any team. Team managers can issue offers to sign you.</p>
                    </div>
                )}
            </section>
            </>
            )}

            <OfferResponseDialog
                request={respondTo}
                onCancel={() => setRespondTo(null)}
                onDone={() => {
                    setRespondTo(null);
                    fetchContracts();
                }}
            />
        </div>
    );
};

export default PlayerPortalOverview;
