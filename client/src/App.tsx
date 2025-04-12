// client/src/App.tsx
import React from 'react';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Navigate,
    Link,
    Outlet, // Optional for layout structures
    useLocation // Optional for protected route redirects
} from 'react-router-dom';

// Import Auth Context and Provider
import { AuthProvider, useAuth } from './context/AuthContext';

// Import Page/Component Views
import CarSimulation from './components/CarSimulation';
import Login from './pages/Login';
import Register from './pages/Register';

import './style.css';

// Simulation Config Interface (assuming used by CarSimulation)
interface SimulationConfig {
    numCars: number;
    mutationRate?: number;
}

/**
 * A component to protect routes that require authentication.
 * Redirects to login if user is not authenticated.
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const auth = useAuth();
    const location = useLocation();

    if (auth.isLoading) {
        // Show loading indicator while checking auth status
        return <div>Checking authentication...</div>;
    }

    if (!auth.authToken) {
        // Redirect them to the /login page, but save the current location they were
        // trying to go to in case we want to send them back after login.
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // If authenticated, render the child component (e.g., CarSimulation)
    return <>{children}</>;
};


/**
 * Main application component with routing and auth state provided by context.
 */
const AppContent: React.FC = () => {
    const auth = useAuth(); // Get auth state from context

    // Define simulation config (adjust as needed)
    const simulationConfig: SimulationConfig = {
        numCars: 100,
        mutationRate: 0.1
    };

    return (
        <div className="App">
            {/* Navigation Bar */}
            <nav style={{ padding: '10px', background: '#222', color: 'white', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    {/* Show Sim link only if logged in? Or always? */}
                     {auth.authToken && <Link to="/simulation" style={{ color: 'white', marginRight: '15px' }}>Simulation</Link> }
                     {/* Add other links */}
                </div>
                <div>
                    {!auth.authToken && !auth.isLoading ? (
                        <>
                            <Link to="/login" style={{ color: 'white', marginRight: '15px' }}>Login</Link>
                            <Link to="/register" style={{ color: 'white', marginRight: '15px' }}>Register</Link>
                        </>
                    ) : auth.authToken ? (
                        <>
                            <span style={{ marginRight: '15px' }}>Welcome, {auth.currentUser?.username}!</span>
                            <button onClick={auth.logout} style={{ background: 'transparent', border: '1px solid white', color: 'white', cursor: 'pointer' }}>Logout</button>
                        </>
                    ) : null /* Don't show login/register if still loading auth state */}
                </div>
            </nav>

            {/* Application Routes */}
            <Routes>
                 <Route path="/login" element={
                     !auth.authToken ? <Login /> : <Navigate to="/simulation" replace />
                 } />
                 <Route path="/register" element={
                      !auth.authToken ? <Register /> : <Navigate to="/simulation" replace />
                 } />
                 <Route
                     path="/simulation"
                     element={
                         <ProtectedRoute>
                             <CarSimulation config={simulationConfig} />
                         </ProtectedRoute>
                     }
                 />
                 {/* Default route */}
                 <Route path="*" element={
                     auth.authToken ? <Navigate to="/simulation" replace /> : <Navigate to="/login" replace />
                 } />
             </Routes>
        </div>
    );
};

// Wrap the entire app in the Router and AuthProvider
const App: React.FC = () => {
    return (
        <Router>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </Router>
    );
};

export default App;