import AIAgents from './pages/AIAgents';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import BusinessDashboard from './pages/BusinessDashboard';
import ContactUs from './pages/ContactUs';
import Gamification from './pages/Gamification';
import Home from './pages/Home';
import IntegrationSettings from './pages/IntegrationSettings';
import PayPalManagement from './pages/PayPalManagement';
import Settings from './pages/Settings';
import Support from './pages/Support';
import Surveys from './pages/Surveys';
import UserDashboard from './pages/UserDashboard';
import DailyChallenges from './pages/DailyChallenges';
import VirtualStore from './pages/VirtualStore';
import Guilds from './pages/Guilds';
import DeveloperAnalytics from './pages/DeveloperAnalytics';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIAgents": AIAgents,
    "AdminDashboard": AdminDashboard,
    "AdminUsers": AdminUsers,
    "BusinessDashboard": BusinessDashboard,
    "ContactUs": ContactUs,
    "Gamification": Gamification,
    "Home": Home,
    "IntegrationSettings": IntegrationSettings,
    "PayPalManagement": PayPalManagement,
    "Settings": Settings,
    "Support": Support,
    "Surveys": Surveys,
    "UserDashboard": UserDashboard,
    "DailyChallenges": DailyChallenges,
    "VirtualStore": VirtualStore,
    "Guilds": Guilds,
    "DeveloperAnalytics": DeveloperAnalytics,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};