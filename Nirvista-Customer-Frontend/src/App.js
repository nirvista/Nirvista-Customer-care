import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './Components/login';
import Signup from './Components/signup';
import ProtectedRoute from './Components/ProtectedRoute';
import Dashboard from './pages/Dashboard';
import Agents from './pages/Agents';
import Supervisors from './pages/Supervisors';
import Companies from './pages/Companies';

function App() {
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
        </Router>
    );
}

export default App;