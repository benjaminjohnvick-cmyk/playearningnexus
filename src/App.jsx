import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Lazy-load heavy pages to reduce initial bundle size
const EarningsInsights = lazy(() => import('./pages/EarningsInsights'));
const ExploreSurveys = lazy(() => import('./pages/ExploreSurveys'));
const SurveyAnalytics = lazy(() => import('./pages/SurveyAnalytics'));
const AIGeneratorPage = lazy(() => import('./pages/AIGeneratorPage'));
const BusinessSurveyAnalytics = lazy(() => import('./pages/BusinessSurveyAnalytics'));
const ManagePayouts = lazy(() => import('./pages/ManagePayouts'));
const RespondentProfile = lazy(() => import('./pages/RespondentProfile'));
const AdvancedSurveyAnalytics = lazy(() => import('./pages/AdvancedSurveyAnalytics'));
const MyPayouts = lazy(() => import('./pages/MyPayouts'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const MyOrders = lazy(() => import('./pages/MyOrders'));
const SurveyEmbedManager = lazy(() => import('./pages/SurveyEmbedManager'));
const AIAutomationCenter = lazy(() => import('./pages/AIAutomationCenter'));
const PayoutStatus = lazy(() => import('./pages/PayoutStatus'));
const UserAnalytics = lazy(() => import('./pages/UserAnalytics'));
const NotificationInbox = lazy(() => import('./pages/NotificationInbox'));
const SurveyAdminDashboard = lazy(() => import('./pages/SurveyAdminDashboard'));
const SurveyTemplateBuilder = lazy(() => import('./pages/SurveyTemplateBuilder'));
const ReferralLeaderboardPage = lazy(() => import('./pages/ReferralLeaderboardPage'));
const DisputeCenter = lazy(() => import('./pages/DisputeCenter'));
const PartnerOnboarding = lazy(() => import('./pages/PartnerOnboarding'));
const FeedbackAdminDashboard = lazy(() => import('./pages/FeedbackAdminDashboard'));
const GlobalPrestigeHub = lazy(() => import('./pages/GlobalPrestigeHub'));
const SurveyMarketplace = lazy(() => import('./pages/SurveyMarketplace'));
const EarningsSimulatorPage = lazy(() => import('./pages/EarningsSimulatorPage'));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'));
const DailyEarningStreak = lazy(() => import('./pages/DailyEarningStreak'));
const GlobalLeaderboard = lazy(() => import('./pages/GlobalLeaderboard'));
const SurveyIntelligenceDashboard = lazy(() => import('./pages/SurveyIntelligenceDashboard'));
const AgentIntelligenceDashboard = lazy(() => import('./pages/AgentIntelligenceDashboard'));
const RetentionEngine = lazy(() => import('./pages/RetentionEngine'));
const DeveloperRevenueAnalytics = lazy(() => import('./pages/DeveloperRevenueAnalytics'));
const AdvancedInsights = lazy(() => import('./pages/AdvancedInsights'));
const UXHeatmapDashboard = lazy(() => import('./pages/UXHeatmapDashboard'));
const ABTestingCenter = lazy(() => import('./pages/ABTestingCenter'));
const GameVotingHub = lazy(() => import('./pages/GameVotingHub'));
const DeveloperOnboarding = lazy(() => import('./pages/DeveloperOnboarding'));
const DevEngagementAnalytics = lazy(() => import('./pages/DevEngagementAnalytics'));
const DevFinancialDashboard = lazy(() => import('./pages/DevFinancialDashboard'));
const DevABTesting = lazy(() => import('./pages/DevABTesting'));
const DevBugReports = lazy(() => import('./pages/DevBugReports'));
const AIGrowthAssistant = lazy(() => import('./pages/AIGrowthAssistant'));
const SmartNotificationEngine = lazy(() => import('./pages/SmartNotificationEngine'));
const RewardsMarketplace = lazy(() => import('./pages/RewardsMarketplace'));
const ReferralSquads = lazy(() => import('./pages/ReferralSquads'));
const AdminRiskMonitoring = lazy(() => import('./pages/AdminRiskMonitoring'));
const AdminGrowthHeatmap = lazy(() => import('./pages/AdminGrowthHeatmap'));
const Tournaments = lazy(() => import('./pages/Tournaments'));
const TournamentDetails = lazy(() => import('./pages/TournamentDetails'));
const SocialAuthCallback = lazy(() => import('./pages/SocialAuthCallback'));
const SocialMediaSetup = lazy(() => import('./pages/SocialMediaSetup'));
const AIOrderForm = lazy(() => import('./pages/AIOrderForm'));
const DailyTodoList = lazy(() => import('./pages/DailyTodoList'));
const SalesAnalyticsDashboard = lazy(() => import('./pages/SalesAnalyticsDashboard'));
const GoogleAdsOverlay = lazy(() => import('./pages/GoogleAdsOverlay'));
const AdBusinessDashboard = lazy(() => import('./pages/AdBusinessDashboard'));
const AdBusinessOverview = lazy(() => import('./pages/AdBusinessOverview'));
const SmartPayoutDashboard = lazy(() => import('./pages/SmartPayoutDashboard'));
const ContestEntries = lazy(() => import('./pages/ContestEntries'));
const PaidPPCAdsMosaic = lazy(() => import('./pages/PaidPPCAdsMosaic'));
const HeadToHeadContest = lazy(() => import('./pages/HeadToHeadContest'));
const AIContentHub = lazy(() => import('./pages/AIContentHub'));
const Store = lazy(() => import('./pages/Store'));
const AIAgentsSettings = lazy(() => import('./pages/AIAgentsSettings'));
const ReferralCompetition = lazy(() => import('./pages/ReferralCompetition'));
const PPCSurveyBuilder = lazy(() => import('./pages/PPCSurveyBuilder'));
const LevelAndBadgesPage = lazy(() => import('./pages/LevelAndBadgesPage'));
const ReferralContest = lazy(() => import('./pages/ReferralContest'));
const DeveloperPayoutDashboard = lazy(() => import('./pages/DeveloperPayoutDashboard'));
const SellerUpload = lazy(() => import('./pages/SellerUpload'));
const Pricing = lazy(() => import('./pages/Pricing'));
const CompleteProfile = lazy(() => import('./pages/CompleteProfile'));
const AdminCredentials = lazy(() => import('./pages/AdminCredentials'));
const AdminGlobalSettings = lazy(() => import('./pages/AdminGlobalSettings'));
const AdminAuditLogs = lazy(() => import('./pages/AdminAuditLogs'));
const Quests = lazy(() => import('./pages/Quests'));
const ChatRooms = lazy(() => import('./pages/ChatRooms'));
const AdMarketplace = lazy(() => import('./pages/AdMarketplace'));
const AIOrderFulfillmentDashboard = lazy(() => import('./pages/AIOrderFulfillmentDashboard'));
const MarketTrendReport = lazy(() => import('./pages/MarketTrendReport'));
const DeveloperDisputeCenter = lazy(() => import('./pages/DeveloperDisputeCenter'));
const AIPayoutSchedulerPage = lazy(() => import('./pages/AIPayoutSchedulerPage'));
const AIFeedbackABDashboard = lazy(() => import('./pages/AIFeedbackABDashboard'));
const AdFraudDashboard = lazy(() => import('./pages/AdFraudDashboard'));
const AdSentimentAnalysis = lazy(() => import('./pages/AdSentimentAnalysis'));
const GamerTournamentDashboard = lazy(() => import('./pages/GamerTournamentDashboard'));
const ReferralGrowthEngine = lazy(() => import('./pages/ReferralGrowthEngine'));
const AIAgentsCommandCenter = lazy(() => import('./pages/AIAgentsCommandCenter'));
const AffiliateMLMDashboard = lazy(() => import('./pages/AffiliateMLMDashboard'));
const AIAdDiscovery = lazy(() => import('./pages/AIAdDiscovery'));
const WishlistIntelligence = lazy(() => import('./pages/WishlistIntelligence'));
const WishlistSharerLeaderboardPage = lazy(() => import('./pages/WishlistSharerLeaderboardPage'));
const DisputeResolverCenter = lazy(() => import('./pages/DisputeResolverCenter'));
const AIFinancialAdvisor = lazy(() => import('./pages/AIFinancialAdvisor'));
const RealtimeFraudMonitorDashboard = lazy(() => import('./pages/RealtimeFraudMonitorDashboard'));
const GrowthEngineHub = lazy(() => import('./pages/GrowthEngineHub'));
const AILTVDashboard = lazy(() => import('./pages/AILTVDashboard'));
const CompetitiveMonitoringDashboard = lazy(() => import('./pages/CompetitiveMonitoringDashboard'));
const QuickSurveyBuilder = lazy(() => import('./pages/QuickSurveyBuilder'));
const DeveloperToolsHub = lazy(() => import('./pages/DeveloperToolsHub'));
const AdCampaignOptimizerPage = lazy(() => import('./pages/AdCampaignOptimizerPage'));
const AdCampaignManager = lazy(() => import('./pages/AdCampaignManager'));
const MarketAdvisor = lazy(() => import('./pages/MarketAdvisor'));
const RevenueHub = lazy(() => import('./pages/RevenueHub'));
const CRMDashboard = lazy(() => import('./pages/CRMDashboard'));
const AutomationReviewDashboard = lazy(() => import('./pages/AutomationReviewDashboard'));
const WhiteLabelSetup = lazy(() => import('./pages/WhiteLabelSetup'));
const AutomationGuardianDashboard = lazy(() => import('./pages/AutomationGuardianDashboard'));
const DisputeClaimsUser = lazy(() => import('./pages/DisputeClaimsUser'));
const AdminDisputeResolution = lazy(() => import('./pages/AdminDisputeResolution'));
const SubmitDisputeWizard = lazy(() => import('./pages/SubmitDisputeWizard'));
const ReengagementDashboard = lazy(() => import('./pages/ReengagementDashboard'));
const AIDisputeAutomationDashboard = lazy(() => import('./pages/AIDisputeAutomationDashboard'));
const ViralContentDashboard = lazy(() => import('./pages/ViralContentDashboard'));
const BusinessClientReengagementDashboard = lazy(() => import('./pages/BusinessClientReengagementDashboard'));
const AffiliatePortal = lazy(() => import('./pages/AffiliatePortal'));
const CompetitorIntelligenceDashboard = lazy(() => import('./pages/CompetitorIntelligenceDashboard'));
const CompetitorAlertFeed = lazy(() => import('./pages/CompetitorAlertFeed'));
const AffiliateContentSchedulerCalendar = lazy(() => import('./pages/AffiliateContentSchedulerCalendar'));
const ReferralFraudDetectionDashboard = lazy(() => import('./pages/ReferralFraudDetectionDashboard'));
const AffiliateGrowthCampaignDashboard = lazy(() => import('./pages/AffiliateGrowthCampaignDashboard'));
const ContentLibraryBrowser = lazy(() => import('./pages/ContentLibraryBrowser'));
const AIMarketPulse = lazy(() => import('./pages/AIMarketPulse'));
const AffiliateOnboarding = lazy(() => import('./pages/AffiliateOnboarding'));

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const MainPage = mainPageKey ? Pages[mainPageKey] : <></>;

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Redirect new users to social media setup
  const needsSocialSetup = sessionStorage.getItem('needs_social_setup') === 'true';
  const isOnSetupPage = window.location.pathname === '/SocialMediaSetup';
  if (needsSocialSetup && !isOnSetupPage) {
    window.location.replace('/SocialMediaSetup');
    return null;
  }

  // Redirect users with no name to profile completion
  const isOnCompleteProfile = window.location.pathname === '/CompleteProfile';
  if (!isOnCompleteProfile && !authError) {
    // Check after auth resolves and user is authenticated but has no name
    const currentUser = authError ? null : window.__gg_user_cache;
    // We do this check via a side-effect read from sessionStorage flag set on login
    if (sessionStorage.getItem('needs_profile_completion') === 'true') {
      window.location.replace('/CompleteProfile');
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/" element={
        <LayoutWrapper currentPageName={mainPageKey}>
          <MainPage />
        </LayoutWrapper>
      } />
      {Object.entries(Pages).map(([path, Page]) => (
        <Route
          key={path}
          path={`/${path}`}
          element={
            <LayoutWrapper currentPageName={path}>
              <Page />
            </LayoutWrapper>
          }
        />
      ))}
      <Route path="/EarningsInsights" element={<LayoutWrapper currentPageName="EarningsInsights"><EarningsInsights /></LayoutWrapper>} />
      <Route path="/ExploreSurveys" element={<LayoutWrapper currentPageName="ExploreSurveys"><ExploreSurveys /></LayoutWrapper>} />
      <Route path="/SurveyAnalytics" element={<LayoutWrapper currentPageName="SurveyAnalytics"><SurveyAnalytics /></LayoutWrapper>} />
      <Route path="/BusinessSurveyAnalytics" element={<LayoutWrapper currentPageName="BusinessSurveyAnalytics"><BusinessSurveyAnalytics /></LayoutWrapper>} />
      <Route path="/ManagePayouts" element={<LayoutWrapper currentPageName="ManagePayouts"><ManagePayouts /></LayoutWrapper>} />
      <Route path="/RespondentProfile" element={<LayoutWrapper currentPageName="RespondentProfile"><RespondentProfile /></LayoutWrapper>} />
      <Route path="/AdvancedSurveyAnalytics" element={<LayoutWrapper currentPageName="AdvancedSurveyAnalytics"><AdvancedSurveyAnalytics /></LayoutWrapper>} />
      <Route path="/AIGeneratorPage" element={<LayoutWrapper currentPageName="AIGeneratorPage"><AIGeneratorPage /></LayoutWrapper>} />
      <Route path="/MyPayouts" element={<LayoutWrapper currentPageName="MyPayouts"><MyPayouts /></LayoutWrapper>} />
      <Route path="/Campaigns" element={<LayoutWrapper currentPageName="Campaigns"><Campaigns /></LayoutWrapper>} />
      <Route path="/MyOrders" element={<LayoutWrapper currentPageName="MyOrders"><MyOrders /></LayoutWrapper>} />
      <Route path="/SurveyEmbedManager" element={<LayoutWrapper currentPageName="SurveyEmbedManager"><SurveyEmbedManager /></LayoutWrapper>} />
      <Route path="/AIAutomationCenter" element={<LayoutWrapper currentPageName="AIAutomationCenter"><AIAutomationCenter /></LayoutWrapper>} />
      <Route path="/PayoutStatus" element={<LayoutWrapper currentPageName="PayoutStatus"><PayoutStatus /></LayoutWrapper>} />
      <Route path="/UserAnalytics" element={<LayoutWrapper currentPageName="UserAnalytics"><UserAnalytics /></LayoutWrapper>} />
      <Route path="/NotificationInbox" element={<LayoutWrapper currentPageName="NotificationInbox"><NotificationInbox /></LayoutWrapper>} />
      <Route path="/SurveyAdminDashboard" element={<LayoutWrapper currentPageName="SurveyAdminDashboard"><SurveyAdminDashboard /></LayoutWrapper>} />
      <Route path="/SurveyTemplateBuilder" element={<LayoutWrapper currentPageName="SurveyTemplateBuilder"><SurveyTemplateBuilder /></LayoutWrapper>} />
      <Route path="/ReferralLeaderboardPage" element={<LayoutWrapper currentPageName="ReferralLeaderboardPage"><ReferralLeaderboardPage /></LayoutWrapper>} />
      <Route path="/DisputeCenter" element={<LayoutWrapper currentPageName="DisputeCenter"><DisputeCenter /></LayoutWrapper>} />
      <Route path="/PartnerOnboarding" element={<LayoutWrapper currentPageName="PartnerOnboarding"><PartnerOnboarding /></LayoutWrapper>} />
      <Route path="/FeedbackAdminDashboard" element={<LayoutWrapper currentPageName="FeedbackAdminDashboard"><FeedbackAdminDashboard /></LayoutWrapper>} />
      <Route path="/GlobalPrestigeHub" element={<LayoutWrapper currentPageName="GlobalPrestigeHub"><GlobalPrestigeHub /></LayoutWrapper>} />
      <Route path="/SurveyMarketplace" element={<LayoutWrapper currentPageName="SurveyMarketplace"><SurveyMarketplace /></LayoutWrapper>} />
      <Route path="/EarningsSimulatorPage" element={<LayoutWrapper currentPageName="EarningsSimulatorPage"><EarningsSimulatorPage /></LayoutWrapper>} />
      <Route path="/AchievementsPage" element={<LayoutWrapper currentPageName="AchievementsPage"><AchievementsPage /></LayoutWrapper>} />
      <Route path="/DailyEarningStreak" element={<LayoutWrapper currentPageName="DailyEarningStreak"><DailyEarningStreak /></LayoutWrapper>} />
      <Route path="/GlobalLeaderboard" element={<LayoutWrapper currentPageName="GlobalLeaderboard"><GlobalLeaderboard /></LayoutWrapper>} />
      <Route path="/SurveyIntelligenceDashboard" element={<LayoutWrapper currentPageName="SurveyIntelligenceDashboard"><SurveyIntelligenceDashboard /></LayoutWrapper>} />
      <Route path="/AgentIntelligenceDashboard" element={<LayoutWrapper currentPageName="AgentIntelligenceDashboard"><AgentIntelligenceDashboard /></LayoutWrapper>} />
      <Route path="/RetentionEngine" element={<LayoutWrapper currentPageName="RetentionEngine"><RetentionEngine /></LayoutWrapper>} />
      <Route path="/DeveloperRevenueAnalytics" element={<LayoutWrapper currentPageName="DeveloperRevenueAnalytics"><DeveloperRevenueAnalytics /></LayoutWrapper>} />
      <Route path="/AdvancedInsights" element={<LayoutWrapper currentPageName="AdvancedInsights"><AdvancedInsights /></LayoutWrapper>} />
      <Route path="/UXHeatmapDashboard" element={<LayoutWrapper currentPageName="UXHeatmapDashboard"><UXHeatmapDashboard /></LayoutWrapper>} />
      <Route path="/ABTestingCenter" element={<LayoutWrapper currentPageName="ABTestingCenter"><ABTestingCenter /></LayoutWrapper>} />
      <Route path="/GameVotingHub" element={<LayoutWrapper currentPageName="GameVotingHub"><GameVotingHub /></LayoutWrapper>} />
      <Route path="/DeveloperOnboarding" element={<LayoutWrapper currentPageName="DeveloperOnboarding"><DeveloperOnboarding /></LayoutWrapper>} />
      <Route path="/DevEngagementAnalytics" element={<LayoutWrapper currentPageName="DevEngagementAnalytics"><DevEngagementAnalytics /></LayoutWrapper>} />
      <Route path="/DevFinancialDashboard" element={<LayoutWrapper currentPageName="DevFinancialDashboard"><DevFinancialDashboard /></LayoutWrapper>} />
      <Route path="/DevABTesting" element={<LayoutWrapper currentPageName="DevABTesting"><DevABTesting /></LayoutWrapper>} />
      <Route path="/DevBugReports" element={<LayoutWrapper currentPageName="DevBugReports"><DevBugReports /></LayoutWrapper>} />
      <Route path="/AIGrowthAssistant" element={<LayoutWrapper currentPageName="AIGrowthAssistant"><AIGrowthAssistant /></LayoutWrapper>} />
      <Route path="/SmartNotificationEngine" element={<LayoutWrapper currentPageName="SmartNotificationEngine"><SmartNotificationEngine /></LayoutWrapper>} />
      <Route path="/RewardsMarketplace" element={<LayoutWrapper currentPageName="RewardsMarketplace"><RewardsMarketplace /></LayoutWrapper>} />
      <Route path="/ReferralSquads" element={<LayoutWrapper currentPageName="ReferralSquads"><ReferralSquads /></LayoutWrapper>} />
      <Route path="/AdminRiskMonitoring" element={<LayoutWrapper currentPageName="AdminRiskMonitoring"><AdminRiskMonitoring /></LayoutWrapper>} />
      <Route path="/AdminGrowthHeatmap" element={<LayoutWrapper currentPageName="AdminGrowthHeatmap"><AdminGrowthHeatmap /></LayoutWrapper>} />
      <Route path="/Tournaments" element={<LayoutWrapper currentPageName="Tournaments"><Tournaments /></LayoutWrapper>} />
      <Route path="/TournamentDetails" element={<LayoutWrapper currentPageName="TournamentDetails"><TournamentDetails /></LayoutWrapper>} />
      <Route path="/social-auth-callback" element={<LayoutWrapper currentPageName="SocialAuthCallback"><SocialAuthCallback /></LayoutWrapper>} />
      <Route path="/SocialMediaSetup" element={<LayoutWrapper currentPageName="SocialMediaSetup"><SocialMediaSetup /></LayoutWrapper>} />
      <Route path="/AIOrderForm" element={<LayoutWrapper currentPageName="AIOrderForm"><AIOrderForm /></LayoutWrapper>} />
      <Route path="/DailyTodoList" element={<LayoutWrapper currentPageName="DailyTodoList"><DailyTodoList /></LayoutWrapper>} />
      <Route path="/SalesAnalyticsDashboard" element={<LayoutWrapper currentPageName="SalesAnalyticsDashboard"><SalesAnalyticsDashboard /></LayoutWrapper>} />
      <Route path="/GoogleAdsOverlay" element={<LayoutWrapper currentPageName="GoogleAdsOverlay"><GoogleAdsOverlay /></LayoutWrapper>} />
      <Route path="/AdBusinessDashboard" element={<LayoutWrapper currentPageName="AdBusinessDashboard"><AdBusinessDashboard /></LayoutWrapper>} />
      <Route path="/AdBusinessOverview" element={<LayoutWrapper currentPageName="AdBusinessOverview"><AdBusinessOverview /></LayoutWrapper>} />
      <Route path="/SmartPayoutDashboard" element={<LayoutWrapper currentPageName="SmartPayoutDashboard"><SmartPayoutDashboard /></LayoutWrapper>} />
      <Route path="/ContestEntries" element={<LayoutWrapper currentPageName="ContestEntries"><ContestEntries /></LayoutWrapper>} />
      <Route path="/PaidPPCAdsMosaic" element={<PaidPPCAdsMosaic />} />
      <Route path="/HeadToHeadContest" element={<LayoutWrapper currentPageName="HeadToHeadContest"><HeadToHeadContest /></LayoutWrapper>} />
      <Route path="/AIContentHub" element={<LayoutWrapper currentPageName="AIContentHub"><AIContentHub /></LayoutWrapper>} />
      <Route path="/Store" element={<LayoutWrapper currentPageName="Store"><Store /></LayoutWrapper>} />
      <Route path="/AIAgentsSettings" element={<LayoutWrapper currentPageName="AIAgentsSettings"><AIAgentsSettings /></LayoutWrapper>} />
      <Route path="/ReferralCompetition" element={<LayoutWrapper currentPageName="ReferralCompetition"><ReferralCompetition /></LayoutWrapper>} />
      <Route path="/PPCSurveyBuilder" element={<LayoutWrapper currentPageName="PPCSurveyBuilder"><PPCSurveyBuilder /></LayoutWrapper>} />
      <Route path="/LevelAndBadgesPage" element={<LayoutWrapper currentPageName="LevelAndBadgesPage"><LevelAndBadgesPage /></LayoutWrapper>} />
      <Route path="/ReferralContest" element={<LayoutWrapper currentPageName="ReferralContest"><ReferralContest /></LayoutWrapper>} />
      <Route path="/InAppGameStore" element={<LayoutWrapper currentPageName="InAppGameStore"><Store /></LayoutWrapper>} />
      <Route path="/DeveloperPayoutDashboard" element={<LayoutWrapper currentPageName="DeveloperPayoutDashboard"><DeveloperPayoutDashboard /></LayoutWrapper>} />
      <Route path="/SellerUpload" element={<LayoutWrapper currentPageName="SellerUpload"><SellerUpload /></LayoutWrapper>} />
      <Route path="/Pricing" element={<LayoutWrapper currentPageName="Pricing"><Pricing /></LayoutWrapper>} />
      <Route path="/CompleteProfile" element={<CompleteProfile />} />
      <Route path="/AdminCredentials" element={<LayoutWrapper currentPageName="AdminCredentials"><AdminCredentials /></LayoutWrapper>} />
      <Route path="/AdminGlobalSettings" element={<LayoutWrapper currentPageName="AdminGlobalSettings"><AdminGlobalSettings /></LayoutWrapper>} />
      <Route path="/AdminAuditLogs" element={<LayoutWrapper currentPageName="AdminAuditLogs"><AdminAuditLogs /></LayoutWrapper>} />
      <Route path="/Quests" element={<LayoutWrapper currentPageName="Quests"><Quests /></LayoutWrapper>} />
      <Route path="/ChatRooms" element={<LayoutWrapper currentPageName="ChatRooms"><ChatRooms /></LayoutWrapper>} />
      <Route path="/AdMarketplace" element={<LayoutWrapper currentPageName="AdMarketplace"><AdMarketplace /></LayoutWrapper>} />
      <Route path="/AIOrderFulfillmentDashboard" element={<LayoutWrapper currentPageName="AIOrderFulfillmentDashboard"><AIOrderFulfillmentDashboard /></LayoutWrapper>} />
      <Route path="/MarketTrendReport" element={<LayoutWrapper currentPageName="MarketTrendReport"><MarketTrendReport /></LayoutWrapper>} />
      <Route path="/DeveloperDisputeCenter" element={<LayoutWrapper currentPageName="DeveloperDisputeCenter"><DeveloperDisputeCenter /></LayoutWrapper>} />
      <Route path="/AIPayoutSchedulerPage" element={<LayoutWrapper currentPageName="AIPayoutSchedulerPage"><AIPayoutSchedulerPage /></LayoutWrapper>} />
      <Route path="/AIFeedbackABDashboard" element={<LayoutWrapper currentPageName="AIFeedbackABDashboard"><AIFeedbackABDashboard /></LayoutWrapper>} />
      <Route path="/AdFraudDashboard" element={<LayoutWrapper currentPageName="AdFraudDashboard"><AdFraudDashboard /></LayoutWrapper>} />
      <Route path="/AdSentimentAnalysis" element={<LayoutWrapper currentPageName="AdSentimentAnalysis"><AdSentimentAnalysis /></LayoutWrapper>} />
      <Route path="/GamerTournamentDashboard" element={<LayoutWrapper currentPageName="GamerTournamentDashboard"><GamerTournamentDashboard /></LayoutWrapper>} />
      <Route path="/ReferralGrowthEngine" element={<LayoutWrapper currentPageName="ReferralGrowthEngine"><ReferralGrowthEngine /></LayoutWrapper>} />
      <Route path="/AIAgentsCommandCenter" element={<LayoutWrapper currentPageName="AIAgentsCommandCenter"><AIAgentsCommandCenter /></LayoutWrapper>} />
      <Route path="/AffiliateMLMDashboard" element={<LayoutWrapper currentPageName="AffiliateMLMDashboard"><AffiliateMLMDashboard /></LayoutWrapper>} />
      <Route path="/AIAdDiscovery" element={<LayoutWrapper currentPageName="AIAdDiscovery"><AIAdDiscovery /></LayoutWrapper>} />
      <Route path="/WishlistIntelligence" element={<LayoutWrapper currentPageName="WishlistIntelligence"><WishlistIntelligence /></LayoutWrapper>} />
      <Route path="/WishlistSharerLeaderboard" element={<LayoutWrapper currentPageName="WishlistSharerLeaderboard"><WishlistSharerLeaderboardPage /></LayoutWrapper>} />
      <Route path="/DisputeResolverCenter" element={<LayoutWrapper currentPageName="DisputeResolverCenter"><DisputeResolverCenter /></LayoutWrapper>} />
      <Route path="/AIFinancialAdvisor" element={<LayoutWrapper currentPageName="AIFinancialAdvisor"><AIFinancialAdvisor /></LayoutWrapper>} />
      <Route path="/RealtimeFraudMonitor" element={<LayoutWrapper currentPageName="RealtimeFraudMonitor"><RealtimeFraudMonitorDashboard /></LayoutWrapper>} />
      <Route path="/GrowthEngineHub" element={<LayoutWrapper currentPageName="GrowthEngineHub"><GrowthEngineHub /></LayoutWrapper>} />
      <Route path="/AILTVDashboard" element={<LayoutWrapper currentPageName="AILTVDashboard"><AILTVDashboard /></LayoutWrapper>} />
      <Route path="/CompetitiveMonitoringDashboard" element={<LayoutWrapper currentPageName="CompetitiveMonitoringDashboard"><CompetitiveMonitoringDashboard /></LayoutWrapper>} />
      <Route path="/QuickSurveyBuilder" element={<LayoutWrapper currentPageName="QuickSurveyBuilder"><QuickSurveyBuilder /></LayoutWrapper>} />
      <Route path="/DeveloperToolsHub" element={<LayoutWrapper currentPageName="DeveloperToolsHub"><DeveloperToolsHub /></LayoutWrapper>} />
      <Route path="/AdCampaignOptimizer" element={<LayoutWrapper currentPageName="AdCampaignOptimizer"><AdCampaignOptimizerPage /></LayoutWrapper>} />
      <Route path="/AdCampaignManager" element={<LayoutWrapper currentPageName="AdCampaignManager"><AdCampaignManager /></LayoutWrapper>} />
      <Route path="/MarketAdvisor" element={<LayoutWrapper currentPageName="MarketAdvisor"><MarketAdvisor /></LayoutWrapper>} />
      <Route path="/RevenueHub" element={<LayoutWrapper currentPageName="RevenueHub"><RevenueHub /></LayoutWrapper>} />
      <Route path="/CRMDashboard" element={<LayoutWrapper currentPageName="CRMDashboard"><CRMDashboard /></LayoutWrapper>} />
      <Route path="/AutomationReviewDashboard" element={<LayoutWrapper currentPageName="AutomationReviewDashboard"><AutomationReviewDashboard /></LayoutWrapper>} />
      <Route path="/WhiteLabelSetup" element={<WhiteLabelSetup />} />
      <Route path="/AutomationGuardianDashboard" element={<LayoutWrapper currentPageName="AutomationGuardianDashboard"><AutomationGuardianDashboard /></LayoutWrapper>} />
      <Route path="/DisputeClaimsUser" element={<LayoutWrapper currentPageName="DisputeClaimsUser"><DisputeClaimsUser /></LayoutWrapper>} />
      <Route path="/AdminDisputeResolution" element={<LayoutWrapper currentPageName="AdminDisputeResolution"><AdminDisputeResolution /></LayoutWrapper>} />
      <Route path="/SubmitDisputeWizard" element={<LayoutWrapper currentPageName="SubmitDisputeWizard"><SubmitDisputeWizard /></LayoutWrapper>} />
      <Route path="/ReengagementDashboard" element={<LayoutWrapper currentPageName="ReengagementDashboard"><ReengagementDashboard /></LayoutWrapper>} />
      <Route path="/AIDisputeAutomationDashboard" element={<LayoutWrapper currentPageName="AIDisputeAutomationDashboard"><AIDisputeAutomationDashboard /></LayoutWrapper>} />
      <Route path="/ViralContentDashboard" element={<LayoutWrapper currentPageName="ViralContentDashboard"><ViralContentDashboard /></LayoutWrapper>} />
      <Route path="/BusinessClientReengagementDashboard" element={<LayoutWrapper currentPageName="BusinessClientReengagementDashboard"><BusinessClientReengagementDashboard /></LayoutWrapper>} />
      <Route path="/AffiliatePortal" element={<LayoutWrapper currentPageName="AffiliatePortal"><AffiliatePortal /></LayoutWrapper>} />
      <Route path="/CompetitorIntelligenceDashboard" element={<LayoutWrapper currentPageName="CompetitorIntelligenceDashboard"><CompetitorIntelligenceDashboard /></LayoutWrapper>} />
      <Route path="/CompetitorAlertFeed" element={<LayoutWrapper currentPageName="CompetitorAlertFeed"><CompetitorAlertFeed /></LayoutWrapper>} />
      <Route path="/AffiliateContentSchedulerCalendar" element={<LayoutWrapper currentPageName="AffiliateContentSchedulerCalendar"><AffiliateContentSchedulerCalendar /></LayoutWrapper>} />
      <Route path="/ReferralFraudDetectionDashboard" element={<LayoutWrapper currentPageName="ReferralFraudDetectionDashboard"><ReferralFraudDetectionDashboard /></LayoutWrapper>} />
      <Route path="/AffiliateGrowthCampaignDashboard" element={<LayoutWrapper currentPageName="AffiliateGrowthCampaignDashboard"><AffiliateGrowthCampaignDashboard /></LayoutWrapper>} />
      <Route path="/ContentLibraryBrowser" element={<LayoutWrapper currentPageName="ContentLibraryBrowser"><ContentLibraryBrowser /></LayoutWrapper>} />
      <Route path="/AIMarketPulse" element={<LayoutWrapper currentPageName="AIMarketPulse"><AIMarketPulse /></LayoutWrapper>} />
      <Route path="/AffiliateOnboarding" element={<LayoutWrapper currentPageName="AffiliateOnboarding"><AffiliateOnboarding /></LayoutWrapper>} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App