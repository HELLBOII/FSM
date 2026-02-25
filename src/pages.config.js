import Layout from './Layout';
import AdminDashboard from './pages/AdminDashboard';
import Calendar from './pages/Calendar';
import ClientDashboard from './pages/ClientDashboard';
import Clients from './pages/Clients';
import EquipmentInventory from './pages/EquipmentInventory';
import JobDetails from './pages/JobDetails';
import AdminJobDetails from './pages/AdminJobDetails';
import JobExecution from './pages/JobExecution';
import AdminJobExecution from './pages/AdminJobExecution';
import LiveTracking from './pages/LiveTracking';
import Map from './pages/Map';
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
import AdminTechnicianJobs from './pages/AdminTechnicianJobs';
import TechnicianNavigation from './pages/TechnicianNavigation';
import TechnicianEquipment from './pages/TechnicianEquipment';
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
    AdminJobDetails,
    JobExecution,
    AdminJobExecution,
    LiveTracking,
    Map,
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
    AdminTechnicianJobs,
    TechnicianNavigation,
    TechnicianProfile,
    TechnicianEquipment,
    Technicians,
    WorkReports
  },
  Layout,
  mainPage: 'Login'
};

