import Layout from './Layout';
import AdminDashboard from './pages/AdminDashboard';
import Calendar from './pages/Calendar';
import ClientDashboard from './pages/ClientDashboard';
import Clients from './pages/Clients';
import EquipmentInventory from './pages/EquipmentInventory';
import JobDetails from './pages/JobDetails';
import JobExecution from './pages/JobExecution';
import LiveTracking from './pages/LiveTracking';
import Login from './pages/Login';
import Messages from './pages/Messages';
import Reports from './pages/Reports';
import RoleSelection from './pages/RoleSelection';
import Scheduling from './pages/Scheduling';
import ServiceRequests from './pages/ServiceRequests';
import Settings from './pages/Settings';
import TechnicianDashboard from './pages/TechnicianDashboard';
import TechnicianHome from './pages/TechnicianHome';
import TechnicianJobs from './pages/TechnicianJobs';
import TechnicianNavigation from './pages/TechnicianNavigation';
import TechnicianProfile from './pages/TechnicianProfile';
import Technicians from './pages/Technicians';
import WorkReports from './pages/WorkReports';

export const pagesConfig = {
  Pages: {
    AdminDashboard,
    Calendar,
    ClientDashboard,
    Clients,
    EquipmentInventory,
    JobDetails,
    JobExecution,
    LiveTracking,
    Login,
    Messages,
    Reports,
    RoleSelection,
    Scheduling,
    ServiceRequests,
    Settings,
    TechnicianDashboard,
    TechnicianHome,
    TechnicianJobs,
    TechnicianNavigation,
    TechnicianProfile,
    Technicians,
    WorkReports
  },
  Layout,
  mainPage: 'Login'
};

