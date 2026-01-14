import AIAgents from './pages/AIAgents';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import BusinessDashboard from './pages/BusinessDashboard';
import ContactUs from './pages/ContactUs';
import DailyChallenges from './pages/DailyChallenges';
import DeveloperAnalytics from './pages/DeveloperAnalytics';
import Gamification from './pages/Gamification';
import Guilds from './pages/Guilds';
import Home from './pages/Home';
import IntegrationSettings from './pages/IntegrationSettings';
import PayPalManagement from './pages/PayPalManagement';
import Settings from './pages/Settings';
import Support from './pages/Support';
import Surveys from './pages/Surveys';
import UserDashboard from './pages/UserDashboard';
import VirtualStore from './pages/VirtualStore';
import GameGuides from './pages/GameGuides';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIAgents": AIAgents,
    "AdminDashboard": AdminDashboard,
    "AdminUsers": AdminUsers,
    "BusinessDashboard": BusinessDashboard,
    "ContactUs": ContactUs,
    "DailyChallenges": DailyChallenges,
    "DeveloperAnalytics": DeveloperAnalytics,
    "Gamification": Gamification,
    "Guilds": Guilds,
    "Home": Home,
    "IntegrationSettings": IntegrationSettings,
    "PayPalManagement": PayPalManagement,
    "Settings": Settings,
    "Support": Support,
    "Surveys": Surveys,
    "UserDashboard": UserDashboard,
    "VirtualStore": VirtualStore,
    "GameGuides": GameGuides,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};