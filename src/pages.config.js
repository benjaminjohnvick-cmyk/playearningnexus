import AIAgents from './pages/AIAgents';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import BusinessDashboard from './pages/BusinessDashboard';
import ContactUs from './pages/ContactUs';
import DailyChallenges from './pages/DailyChallenges';
import DeveloperAIDashboard from './pages/DeveloperAIDashboard';
import DeveloperAnalytics from './pages/DeveloperAnalytics';
import DeveloperIAPDashboard from './pages/DeveloperIAPDashboard';
import DeveloperPortfolio from './pages/DeveloperPortfolio';
import EventsManagement from './pages/EventsManagement';
import GameAnalyticsDashboard from './pages/GameAnalyticsDashboard';
import GameDetail from './pages/GameDetail';
import GameGuides from './pages/GameGuides';
import GameStore from './pages/GameStore';
import Gamification from './pages/Gamification';
import Guilds from './pages/Guilds';
import Home from './pages/Home';
import InAppStore from './pages/InAppStore';
import IntegrationSettings from './pages/IntegrationSettings';
import MonetizationHub from './pages/MonetizationHub';
import MyPurchases from './pages/MyPurchases';
import PayPalManagement from './pages/PayPalManagement';
import Settings from './pages/Settings';
import SocialMediaGenerator from './pages/SocialMediaGenerator';
import Support from './pages/Support';
import Surveys from './pages/Surveys';
import UserDashboard from './pages/UserDashboard';
import UserProfile from './pages/UserProfile';
import VirtualStore from './pages/VirtualStore';
import StreamerAnalytics from './pages/StreamerAnalytics';
import GuildDetails from './pages/GuildDetails';
import Tournaments from './pages/Tournaments';
import TournamentDetails from './pages/TournamentDetails';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIAgents": AIAgents,
    "AdminDashboard": AdminDashboard,
    "AdminUsers": AdminUsers,
    "BusinessDashboard": BusinessDashboard,
    "ContactUs": ContactUs,
    "DailyChallenges": DailyChallenges,
    "DeveloperAIDashboard": DeveloperAIDashboard,
    "DeveloperAnalytics": DeveloperAnalytics,
    "DeveloperIAPDashboard": DeveloperIAPDashboard,
    "DeveloperPortfolio": DeveloperPortfolio,
    "EventsManagement": EventsManagement,
    "GameAnalyticsDashboard": GameAnalyticsDashboard,
    "GameDetail": GameDetail,
    "GameGuides": GameGuides,
    "GameStore": GameStore,
    "Gamification": Gamification,
    "Guilds": Guilds,
    "Home": Home,
    "InAppStore": InAppStore,
    "IntegrationSettings": IntegrationSettings,
    "MonetizationHub": MonetizationHub,
    "MyPurchases": MyPurchases,
    "PayPalManagement": PayPalManagement,
    "Settings": Settings,
    "SocialMediaGenerator": SocialMediaGenerator,
    "Support": Support,
    "Surveys": Surveys,
    "UserDashboard": UserDashboard,
    "UserProfile": UserProfile,
    "VirtualStore": VirtualStore,
    "StreamerAnalytics": StreamerAnalytics,
    "GuildDetails": GuildDetails,
    "Tournaments": Tournaments,
    "TournamentDetails": TournamentDetails,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};