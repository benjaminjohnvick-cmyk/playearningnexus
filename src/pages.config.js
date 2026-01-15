import AIAgents from './pages/AIAgents';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import BusinessDashboard from './pages/BusinessDashboard';
import ContactUs from './pages/ContactUs';
import DailyChallenges from './pages/DailyChallenges';
import DeveloperAIDashboard from './pages/DeveloperAIDashboard';
import DeveloperAnalytics from './pages/DeveloperAnalytics';
import GameAnalyticsDashboard from './pages/GameAnalyticsDashboard';
import GameDetail from './pages/GameDetail';
import GameGuides from './pages/GameGuides';
import GameStore from './pages/GameStore';
import Gamification from './pages/Gamification';
import Guilds from './pages/Guilds';
import Home from './pages/Home';
import InAppStore from './pages/InAppStore';
import IntegrationSettings from './pages/IntegrationSettings';
import PayPalManagement from './pages/PayPalManagement';
import Settings from './pages/Settings';
import Support from './pages/Support';
import Surveys from './pages/Surveys';
import UserDashboard from './pages/UserDashboard';
import VirtualStore from './pages/VirtualStore';
import UserProfile from './pages/UserProfile';
import MyPurchases from './pages/MyPurchases';
import DeveloperIAPDashboard from './pages/DeveloperIAPDashboard';
import MonetizationHub from './pages/MonetizationHub';
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
    "GameAnalyticsDashboard": GameAnalyticsDashboard,
    "GameDetail": GameDetail,
    "GameGuides": GameGuides,
    "GameStore": GameStore,
    "Gamification": Gamification,
    "Guilds": Guilds,
    "Home": Home,
    "InAppStore": InAppStore,
    "IntegrationSettings": IntegrationSettings,
    "PayPalManagement": PayPalManagement,
    "Settings": Settings,
    "Support": Support,
    "Surveys": Surveys,
    "UserDashboard": UserDashboard,
    "VirtualStore": VirtualStore,
    "UserProfile": UserProfile,
    "MyPurchases": MyPurchases,
    "DeveloperIAPDashboard": DeveloperIAPDashboard,
    "MonetizationHub": MonetizationHub,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};