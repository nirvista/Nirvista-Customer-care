import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Components/login';
import Signup from './Components/signup';
import ProtectedRoute from './Components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import Supervisors from './pages/Supervisors';
import Companies from './pages/Companies';
import Tickets from './pages/Tickets';
import TicketChat from './pages/TicketChat';
import ChatWidget from './Components/ChatWidget';

function App() {
    // Get widget config from environment variables
const widgetId = process.env.REACT_APP_WIDGET_ID || 'YOUR_WIDGET_ID';
const serverUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:7002';

    return (
        <Router>
            <Routes>
                {/* Public routes */}
                <Route path="/" element={<Login />} />
                <Route path="/signup" element={<Signup />} />

                {/* Protected routes */}
                <Route path="/dashboard" element={
                    <ProtectedRoute allowedRoles={["admin", "supervisor", "agent"]}>
                        <Dashboard />
                    </ProtectedRoute>
                } />
                <Route path="/tickets" element={
                    <ProtectedRoute allowedRoles={["admin", "supervisor", "agent"]}>
                        <Tickets />
                    </ProtectedRoute>
                } />
                <Route path="/tickets/:ticketId" element={
                    <ProtectedRoute allowedRoles={["admin", "supervisor", "agent"]}>
                        <TicketChat />
                    </ProtectedRoute>
                } />
                <Route path="/agents" element={
                    <ProtectedRoute allowedRoles={["admin", "supervisor"]}>
                        <Agents />
                    </ProtectedRoute>
                } />
                <Route path="/supervisors" element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                        <Supervisors />
                    </ProtectedRoute>
                } />
                <Route path="/companies" element={
                    <ProtectedRoute allowedRoles={["admin"]}>
                        <Companies />
                    </ProtectedRoute>
                } />
            </Routes>

            {/* Chat Widget - Only show on public pages or for testing */}
            <ChatWidget
                widgetId={widgetId}
                serverUrl={serverUrl}
                primaryColor="#0b7d7b"
                welcomeMessage="Hi! How can we help you today?"
                position="bottom-right"
            />
        </Router>
    );
}

export default App;