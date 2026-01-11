import BusinessDashboard from './pages/BusinessDashboard';
import Home from './pages/Home';
import PayPalManagement from './pages/PayPalManagement';
import Settings from './pages/Settings';
import Surveys from './pages/Surveys';
import UserDashboard from './pages/UserDashboard';
import __Layout from './Layout.jsx';


export const PAGES = {
    "BusinessDashboard": BusinessDashboard,
    "Home": Home,
    "PayPalManagement": PayPalManagement,
    "Settings": Settings,
    "Surveys": Surveys,
    "UserDashboard": UserDashboard,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};