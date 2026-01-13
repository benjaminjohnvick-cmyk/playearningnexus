import AIAgents from './pages/AIAgents';
import AdminDashboard from './pages/AdminDashboard';
import BusinessDashboard from './pages/BusinessDashboard';
import Home from './pages/Home';
import IntegrationSettings from './pages/IntegrationSettings';
import PayPalManagement from './pages/PayPalManagement';
import Settings from './pages/Settings';
import Surveys from './pages/Surveys';
import UserDashboard from './pages/UserDashboard';
import Support from './pages/Support';
import AdminUsers from './pages/AdminUsers';
import ContactUs from './pages/ContactUs';
import Gamification from './pages/Gamification';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AIAgents": AIAgents,
    "AdminDashboard": AdminDashboard,
    "BusinessDashboard": BusinessDashboard,
    "Home": Home,
    "IntegrationSettings": IntegrationSettings,
    "PayPalManagement": PayPalManagement,
    "Settings": Settings,
    "Surveys": Surveys,
    "UserDashboard": UserDashboard,
    "Support": Support,
    "AdminUsers": AdminUsers,
    "ContactUs": ContactUs,
    "Gamification": Gamification,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};