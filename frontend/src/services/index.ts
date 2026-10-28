export { default as apiClient } from './client';

export {
  loginUser,
  registerUser,
  logoutUser,
  getUserProfile,
  sendEmailVerificationCode,
  confirmEmailVerification,
  updateOwnProfile,
  forgotPassword,
  resetPassword,
} from './auth';

export { getNews, getNewsBySlug, getNewsById, createNews, updateNews, deleteNews } from './news';

export { getRelivePlaylist, reliveApi } from './relive';

export { getLiveStatus, liveApi } from './livestream';

export {
  getHeroSlides,
  getAdminHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
} from './heroSlides';

export {
  getFaqPage,
  getAdminFaqPages,
  getAdminFaqPage,
  createFaqPage,
  updateFaqPage,
  deleteFaqPage,
  createFaqCategory,
  updateFaqCategory,
  deleteFaqCategory,
  createFaqItem,
  updateFaqItem,
  deleteFaqItem,
  reorderFaqs,
} from './faqs';

export {
  getMediaFiles,
  presignMediaUpload,
  createMediaFile,
  replaceMediaFile,
  updateMediaFile,
  deleteMediaFile,
} from './media';

export {
  getSeasonGraphics,
  getSeasonMVPs,
  getAdminSeasonGraphics,
  upsertSeasonGraphic,
  getAdminSeasonMVPs,
  createSeasonMVP,
  updateSeasonMVP,
  deleteSeasonMVP,
} from './teamOfSeason';

export {
  sortCompetitionsBySeason,
  dropdownCompetitionsFor,
  getCompetitions,
  getMatches,
  getStandings,
  getMatchDetail,
  getTeams,
  createMatch,
  updateMatch,
  deleteMatch,
  saveTeamSheet,
  getAdminTeamSheet,
  getTeamHeadTeamSheet,
  saveTeamHeadTeamSheet,
  importMatchCsv,
  createStanding,
  updateStanding,
  deleteStanding,
  getAdminCompetitions,
  createCompetition,
  updateCompetition,
  deleteCompetition,
  generateBracket,
  resetBracket,
  getCupState,
  initializeCup,
  advanceCupRound,
} from './matches';

export {
  getAdminTeams,
  getTeamsByCompetition,
  addTeamToCompetition,
  removeTeamFromCompetition,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamManagers,
  getManagerCandidates,
  assignTeamManager,
  removeTeamManager,
} from './adminTeams';

export {
  getTeamRosterSummary,
  moveToReserve,
  graduatePlayer,
  getPlayers,
  getPlayerById,
  createPlayer,
  updatePlayer,
  deletePlayer,
  restorePlayer,
  assignRandomJerseyNumbers,
} from './players';

export {
  getEventDays,
  getEventDayByDate,
  getEventDayById,
  getTicketProducts,
  getGamePassRules,
  quoteTicketPrice,
  purchaseTicket,
  giftTicket,
  getTicketByReference,
  adminListTickets,
  checkinTicket,
  verifyTicket,
  adminCheckinTicket,
  lookupTicketByCode,
  searchTicketsByEmail,
  getAllEventDays,
  listEventDays,
  createEventDay,
  updateEventDay,
  deleteEventDay,
  adminListTicketProducts,
  adminCreateTicketProduct,
  adminUpdateTicketProduct,
  adminDeleteTicketProduct,
  adminSaveGamePassRules,
  getSeasonPasses,
  getSeasonPassById,
  purchaseSeasonPass,
  adminListSeasonPasses,
  adminCreateSeasonPass,
  adminUpdateSeasonPass,
  adminDeleteSeasonPass,
  adminGetAllocations,
  adminCreateOrUpdateAllocation,
  adminDeleteAllocation,
  createReferralCode,
  lookupReferrals,
  adminListReferrals,
} from './tickets';

export {
  getMyPlayerTicketSheets,
  getMyPlayerTicketSheet,
  issueMyPlayerTickets,
  addMyExtraTicket,
  revokeMyTicket,
  restoreMyTicket,
  adminGetPlayerTicketDays,
  adminGetPlayerTicketDaySheets,
  adminIssuePlayerTickets,
  getMyTickets,
} from './playerTickets';

export { getAdminUsers, updateUserRole, updateUserInfo } from './users';

export {
  getAdminRoles,
  getAdminRoleFeatures,
  getAdminRoleOptions,
  createAdminRole,
  updateAdminRole,
  deleteAdminRole,
} from './roles';

export { getAdminAnalytics } from './analytics';

export {
  getSiteTrafficSummary,
  getSiteMatchDays,
  getSiteEvents,
  downloadSiteTrafficExport,
} from './siteAnalytics';

export {
  getPlayerStats,
  getPlayerStatById,
  getTeamStats,
  upsertPlayerStat,
  getStatDates,
  getStatsCompare,
  getPublicMatchStats,
} from './stats';

export {
  getAdminProducts,
  getAdminLowStockAlerts,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  getAdminSales,
  getAdminSalesReport,
  getAdminPaymentMethods,
  createAdminPaymentMethod,
  toggleAdminPaymentMethod,
  sellerGetProducts,
  sellerLogSale,
  sellerGetSales,
  sellerGetPaymentMethods,
} from './inventory';

export {
  getStoreProducts,
  getStoreProduct,
  initializeCheckout,
  verifyStorePayment,
  getOrderByReference,
  getSavedAddresses,
  saveSavedAddress,
  getCustomerOrders,
  getAdminStoreProducts,
  createAdminStoreProduct,
  updateAdminStoreProduct,
  deleteAdminStoreProduct,
  getAdminOrders,
  getAdminOrder,
  updateOrderFulfillment,
  verifyAdminStoreOrder,
  cancelAdminStoreOrder,
  saveAdminProductVariants,
  saveAdminProductImages,
  getProductReviews,
  createProductReview,
  getMyProductReview,
  deleteAdminProductReview,
} from './store';

export {
  getMatchPlays,
  getAdminMatchPlays,
  createPlay,
  updatePlay,
  deletePlay,
  rederiveSituations,
  recomputeAllStats,
  setPBPLock,
  commitDerivedStats,
  overrideMatchMVP,
  getGameRules,
  upsertGameRules,
  recomputeScore,
  commitScore,
} from './playByPlay';

export { contractsApi, adminContractsApi, playerContractsApi } from './contracts';

export { transfersApi, getMyTransfers, adminTransfersApi } from './transfers';

export { notificationsApi } from './notifications';

export { claimApi, teamHeadClaimsApi, adminClaimsApi } from './claims';

export { appSettingsApi } from './settings';

export { commentsApi } from './comments';

export { discountsApi } from './discounts';

export {
  getBadges,
  getPlayerBadges,
  getAdminBadges,
  createAdminBadge,
  updateAdminBadge,
  deleteAdminBadge,
  getBadgeIcons,
  createBadgeIcon,
  updateBadgeIcon,
  deleteBadgeIcon,
  awardAdminBadge,
  deleteAdminBadgeAward,
  backfillMVPBadges,
  getAdminBadgeAwards,
} from './badges';

export {
  getLatestTOTW,
  getTOTWById,
  getTOTWArchive,
  getAdminTOTWs,
  getAdminTOTWById,
  createAdminTOTW,
  updateAdminTOTW,
  deleteAdminTOTW,
  publishAdminTOTW,
} from './totw';

export {
  getCurrentPOTWPoll,
  getPOTWPoll,
  getPOTWPolls,
  getPOTWWinners,
  voteForPOTW,
  getAdminPOTWPoll,
  saveAdminPOTWPoll,
  deleteAdminPOTWPoll,
  overrideAdminPOTW,
  clearAdminPOTWOverride,
  getAdminPlayerDayStats,
  saveTOTWArticle,
} from './potw';

export { getBroadcastDays, getBroadcastDay, setBroadcastDayOnAir, getBroadcastScenes } from './broadcast';

export * from './newsletter';
export * from './siteTracker';

// ─── Fantasy module ────────────────────────────────────────────────────────

export { getFantasyCarousel, getAdminFantasyCarousel, addFantasyCarouselSlide, quickAddFantasyArticle, updateFantasyCarouselSlide, removeFantasyCarouselSlide } from './fantasy/carousel';

export { fantasyCoreApi } from './fantasy/core';

export { getPlayerLeaderboard } from './fantasy/playerLeaderboard';

export { getFantasyPlayerDetail } from './fantasy/playerDetail';

export { getPlayerBreakdown, getPlayerPriceHistory, getGameweekReport } from './fantasy/reports';

export { fantasyLeaguesApi, fantasyLeagueApi } from './fantasy/leagues';

export { fantasySeasonApi, formatFantasyPrice } from './fantasy/dashboard';

export { fantasySquadApi } from './fantasy/squad';

export { fantasyWalletApi, koboToNaira, formatKobo } from './fantasy/wallet';

export { fantasyAdminApi } from './fantasy/admin';
