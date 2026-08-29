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
import AdminSettings from './pages/AdminSettings';
import AIOptimization from './pages/AIOptimization';
import AdminPricingFeedback from './pages/AdminPricingFeedback';
import AdminUsers from './pages/AdminUsers';
import AffiliateMarketplace from './pages/AffiliateMarketplace';
import AdGridSurvey from './pages/AdGridSurvey';
import AIShoppingAssistant from './pages/AIShoppingAssistant';
import BuyingDesk from './pages/BuyingDesk';
import OpsConsole from './pages/OpsConsole';
import SetupWizard from './pages/SetupWizard';
import BusinessDashboard from './pages/BusinessDashboard';
import BusinessPortal from './pages/BusinessPortal';
import CRMDashboard from './pages/CRMDashboard';
import Challenges from './pages/Challenges';
import ContactUs from './pages/ContactUs';
import CreatorDashboard from './pages/CreatorDashboard';
import CreatorMarketplace from './pages/CreatorMarketplace';
import DailyChallenges from './pages/DailyChallenges';
import EarnOnTheGo from './pages/EarnOnTheGo';
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
import Gamification from './pages/Gamification';
import GrowthEngine from './pages/GrowthEngine';
import GuildDetails from './pages/GuildDetails';
import Guilds from './pages/Guilds';
import Home from './pages/Home';
import Profit from './pages/Profit';
import ProviderAdvisor from './pages/ProviderAdvisor';
import InAppGameStore from './pages/InAppGameStore';
import InAppStore from './pages/InAppStore';
import IntegrationSettings from './pages/IntegrationSettings';
import Leaderboard from './pages/Leaderboard';
import WeeklyLeaderboard from './pages/WeeklyLeaderboard';
import Categories from './pages/Categories';
import Marketplace from './pages/Marketplace';
import MonetizationHub from './pages/MonetizationHub';
import MoneyTransfer from './pages/MoneyTransfer';
import MovieStarGenerator from './pages/MovieStarGenerator';
import MyPurchases from './pages/MyPurchases';
import NotificationHistory from './pages/NotificationHistory';
import NotificationSettings from './pages/NotificationSettings';
import PPCMarketplace from './pages/PPCMarketplace';
import PayPalManagement from './pages/PayPalManagement';
import PayoutHistory from './pages/PayoutHistory';
import PayoutSettings from './pages/PayoutSettings';
import ReferralAnalytics from './pages/ReferralAnalytics';
import ReferralContest from './pages/ReferralContest';
import ReferralDashboard from './pages/ReferralDashboard';
import ReferralHub from './pages/ReferralHub';
import ReferralTracking from './pages/ReferralTracking';
import ServicesStore from './pages/ServicesStore';
import Settings from './pages/Settings';
import SocialMediaGenerator from './pages/SocialMediaGenerator';
import StreamerAnalytics from './pages/StreamerAnalytics';
import Support from './pages/Support';
import Surveys from './pages/Surveys';
import SurveyProfile from './pages/SurveyProfile';
import TournamentDetails from './pages/TournamentDetails';
import Tournaments from './pages/Tournaments';
import UserDashboard from './pages/UserDashboard';
import UserInbox from './pages/UserInbox';
import UserProfile from './pages/UserProfile';
import VirtualStore from './pages/VirtualStore';
import Wishlist from './pages/Wishlist';
import Withdrawal from './pages/Withdrawal';
import __Layout from './Layout.jsx';


import CreativeStudio from './pages/CreativeStudio';

import SurveyStudio from './pages/SurveyStudio';

import JoinAndConnect from './pages/JoinAndConnect';

import AdminVideoEngine from './pages/AdminVideoEngine';

import ConceptPolls from './pages/ConceptPolls';

export const PAGES = {
    "AdminVideoEngine": AdminVideoEngine,
    "ConceptPolls": ConceptPolls,
    "JoinAndConnect": JoinAndConnect,
    "SurveyStudio": SurveyStudio,
    "CreativeStudio": CreativeStudio,
    "AIAgents": AIAgents,
    "AdminDashboard": AdminDashboard,
    "AdminSettings": AdminSettings,
    "AIOptimization": AIOptimization,
    "AdminPricingFeedback": AdminPricingFeedback,
    "AdminUsers": AdminUsers,
    "AffiliateMarketplace": AffiliateMarketplace,
    "AdGridSurvey": AdGridSurvey,
    "AIShoppingAssistant": AIShoppingAssistant,
    "BuyingDesk": BuyingDesk,
    "OpsConsole": OpsConsole,
    "SetupWizard": SetupWizard,
    "BusinessDashboard": BusinessDashboard,
    "BusinessPortal": BusinessPortal,
    "CRMDashboard": CRMDashboard,
    "Challenges": Challenges,
    "ContactUs": ContactUs,
    "CreatorDashboard": CreatorDashboard,
    "CreatorMarketplace": CreatorMarketplace,
    "DailyChallenges": DailyChallenges,
    "EarnOnTheGo": EarnOnTheGo,
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
    "Gamification": Gamification,
    "GrowthEngine": GrowthEngine,
    "GuildDetails": GuildDetails,
    "Guilds": Guilds,
    "Home": Home,
    "Profit": Profit,
    "ProviderAdvisor": ProviderAdvisor,
    "InAppGameStore": InAppGameStore,
    "InAppStore": InAppStore,
    "IntegrationSettings": IntegrationSettings,
    "Leaderboard": Leaderboard,
    "WeeklyLeaderboard": WeeklyLeaderboard,
    "Categories": Categories,
    "Marketplace": Marketplace,
    "MonetizationHub": MonetizationHub,
    "MoneyTransfer": MoneyTransfer,
    "MovieStarGenerator": MovieStarGenerator,
    "MyPurchases": MyPurchases,
    "NotificationHistory": NotificationHistory,
    "NotificationSettings": NotificationSettings,
    "PPCMarketplace": PPCMarketplace,
    "PayPalManagement": PayPalManagement,
    "PayoutHistory": PayoutHistory,
    "PayoutSettings": PayoutSettings,
    "ReferralAnalytics": ReferralAnalytics,
    "ReferralContest": ReferralContest,
    "ReferralDashboard": ReferralDashboard,
    "ReferralHub": ReferralHub,
    "ReferralTracking": ReferralTracking,
    "ServicesStore": ServicesStore,
    "Settings": Settings,
    "SocialMediaGenerator": SocialMediaGenerator,
    "StreamerAnalytics": StreamerAnalytics,
    "Support": Support,
    "Surveys": Surveys,
    "SurveyProfile": SurveyProfile,
    "TournamentDetails": TournamentDetails,
    "Tournaments": Tournaments,
    "UserDashboard": UserDashboard,
    "UserInbox": UserInbox,
    "UserProfile": UserProfile,
    "VirtualStore": VirtualStore,
    "Wishlist": Wishlist,
    "Withdrawal": Withdrawal,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};