import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import EarningsInsights from './pages/EarningsInsights';
import ExploreSurveys from './pages/ExploreSurveys';
import SurveyAnalytics from './pages/SurveyAnalytics';
import AIGeneratorPage from './pages/AIGeneratorPage';
import BusinessSurveyAnalytics from './pages/BusinessSurveyAnalytics';
import ManagePayouts from './pages/ManagePayouts';
import RespondentProfile from './pages/RespondentProfile';
import AdvancedSurveyAnalytics from './pages/AdvancedSurveyAnalytics';
import MyPayouts from './pages/MyPayouts';
import Campaigns from './pages/Campaigns';
import MyOrders from './pages/MyOrders';
import SurveyEmbedManager from './pages/SurveyEmbedManager';
import AIAutomationCenter from './pages/AIAutomationCenter';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

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

  // Render the main app
  return (
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
      <Route path="*" element={<PageNotFound />} />
    </Routes>
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