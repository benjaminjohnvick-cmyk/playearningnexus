import Home from './pages/Home';
import UserDashboard from './pages/UserDashboard';
import Surveys from './pages/Surveys';
import BusinessDashboard from './pages/BusinessDashboard';
import Settings from './pages/Settings';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Home": Home,
    "UserDashboard": UserDashboard,
    "Surveys": Surveys,
    "BusinessDashboard": BusinessDashboard,
    "Settings": Settings,
}

export const pagesConfig = {
    mainPage: "Home",
    Pages: PAGES,
    Layout: __Layout,
};