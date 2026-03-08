/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import AIAgents from './pages/AIAgents';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AffiliateMarketplace from './pages/AffiliateMarketplace';
import BusinessDashboard from './pages/BusinessDashboard';
import CRMDashboard from './pages/CRMDashboard';
import ContactUs from './pages/ContactUs';
import CreatorDashboard from './pages/CreatorDashboard';
import CreatorMarketplace from './pages/CreatorMarketplace';
import DailyChallenges from './pages/DailyChallenges';
import DeveloperAIDashboard from './pages/DeveloperAIDashboard';
import DeveloperAnalytics from './pages/DeveloperAnalytics';
import DeveloperEventManagement from './pages/DeveloperEventManagement';
import DeveloperIAPDashboard from './pages/DeveloperIAPDashboard';
import DeveloperLeaderboards from './pages/DeveloperLeaderboards';
import DeveloperPortfolio from './pages/DeveloperPortfolio';
import EventsManagement from './pages/EventsManagement';
import GameAnalyticsDashboard from './pages/GameAnalyticsDashboard';
import GameDetail from './pages/GameDetail';
import GameGuides from './pages/GameGuides';
import GameStore from './pages/GameStore';
import Gamification from './pages/Gamification';
import GuildDetails from './pages/GuildDetails';
import Guilds from './pages/Guilds';
import Home from './pages/Home';
import InAppGameStore from './pages/InAppGameStore';
import InAppStore from './pages/InAppStore';
import IntegrationSettings from './pages/IntegrationSettings';
import Leaderboard from './pages/Leaderboard';
import MonetizationHub from './pages/MonetizationHub';
import MoneyTransfer from './pages/MoneyTransfer';
import MovieStarGenerator from './pages/MovieStarGenerator';
import MyPurchases from './pages/MyPurchases';
import NotificationSettings from './pages/NotificationSettings';
import PayPalManagement from './pages/PayPalManagement';
import PayoutHistory from './pages/PayoutHistory';
import PayoutSettings from './pages/PayoutSettings';
import ReferralAnalytics from './pages/ReferralAnalytics';
import ReferralContest from './pages/ReferralContest';
import ReferralDashboard from './pages/ReferralDashboard';
import ReferralTracking from './pages/ReferralTracking';
import Settings from './pages/Settings';
import SocialMediaGenerator from './pages/SocialMediaGenerator';
import StreamerAnalytics from './pages/StreamerAnalytics';
import Support from './pages/Support';
import Surveys from './pages/Surveys';
import TournamentDetails from './pages/TournamentDetails';
import Tournaments from './pages/Tournaments';
import UserDashboard from './pages/UserDashboard';
import UserInbox from './pages/UserInbox';
import UserProfile from './pages/UserProfile';
import VirtualStore from './pages/VirtualStore';
import Wishlist from './pages/Wishlist';
import PPCMarketplace from './pages/PPCMarketplace';
import Withdrawal from './pages/Withdrawal';
import ReferralHub from './pages/ReferralHub';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIAgents": AIAgents,
    "AdminDashboard": AdminDashboard,
    "AdminUsers": AdminUsers,
    "AffiliateMarketplace": AffiliateMarketplace,
    "BusinessDashboard": BusinessDashboard,
    "CRMDashboard": CRMDashboard,
    "ContactUs": ContactUs,
    "CreatorDashboard": CreatorDashboard,
    "CreatorMarketplace": CreatorMarketplace,
    "DailyChallenges": DailyChallenges,
    "DeveloperAIDashboard": DeveloperAIDashboard,
    "DeveloperAnalytics": DeveloperAnalytics,
    "DeveloperEventManagement": DeveloperEventManagement,
    "DeveloperIAPDashboard": DeveloperIAPDashboard,
    "DeveloperLeaderboards": DeveloperLeaderboards,
    "DeveloperPortfolio": DeveloperPortfolio,
    "EventsManagement": EventsManagement,
    "GameAnalyticsDashboard": GameAnalyticsDashboard,
    "GameDetail": GameDetail,
    "GameGuides": GameGuides,
    "GameStore": GameStore,
    "Gamification": Gamification,
    "GuildDetails": GuildDetails,
    "Guilds": Guilds,
    "Home": Home,
    "InAppGameStore": InAppGameStore,
    "InAppStore": InAppStore,
    "IntegrationSettings": IntegrationSettings,
    "Leaderboard": Leaderboard,
    "MonetizationHub": MonetizationHub,
    "MoneyTransfer": MoneyTransfer,
    "MovieStarGenerator": MovieStarGenerator,
    "MyPurchases": MyPurchases,
    "NotificationSettings": NotificationSettings,
    "PayPalManagement": PayPalManagement,
    "PayoutHistory": PayoutHistory,
    "PayoutSettings": PayoutSettings,
    "ReferralAnalytics": ReferralAnalytics,
    "ReferralContest": ReferralContest,
    "ReferralDashboard": ReferralDashboard,
    "ReferralTracking": ReferralTracking,
    "Settings": Settings,
    "SocialMediaGenerator": SocialMediaGenerator,
    "StreamerAnalytics": StreamerAnalytics,
    "Support": Support,
    "Surveys": Surveys,
    "TournamentDetails": TournamentDetails,
    "Tournaments": Tournaments,
    "UserDashboard": UserDashboard,
    "UserInbox": UserInbox,
    "UserProfile": UserProfile,
    "VirtualStore": VirtualStore,
    "Wishlist": Wishlist,
    "PPCMarketplace": PPCMarketplace,
    "Withdrawal": Withdrawal,
    "ReferralHub": ReferralHub,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};