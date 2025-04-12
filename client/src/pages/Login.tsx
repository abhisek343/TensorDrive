// client/src/pages/Login.tsx
import React, { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Import Link and useNavigate
import { useAuth } from '../context/AuthContext'; // Import useAuth hook

// Define API base URL
const API_BASE_URL = 'http://localhost:5000';

const Login: React.FC = () => {
    const [username, setUsername] = useState<string>('');
    const [password, setPassword] = useState<string>('');
    const [message, setMessage] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const auth = useAuth(); // Get auth context methods
    const navigate = useNavigate(); // Hook for redirection

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setMessage(''); setIsLoading(true);

        if (!username.trim() || !password.trim()) { /* ... validation ... */ return; }

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || `HTTP error! Status: ${response.status}`);

            // Call the login function from AuthContext
            auth.login(data.token, data.user);

            setMessage(`Login successful! Welcome ${data.user?.username}. Redirecting...`);
            // Redirect to simulation page after successful login
             setTimeout(() => navigate('/simulation', { replace: true }), 1000); // Delay redirect slightly

        } catch (error) {
            console.error("Login error:", error);
            setMessage(error instanceof Error ? error.message : 'Login failed.');
        } finally {
            setIsLoading(false);
        }
    };

    // ... (Styles remain the same) ...
    const formStyle: React.CSSProperties = { /* ... */ };
    const inputStyle: React.CSSProperties = { /* ... */ };
    const buttonStyle: React.CSSProperties = { /* ... */ };
    const messageStyle: React.CSSProperties = { /* ... */ };

    return (
        <div style={{ fontFamily: 'sans-serif' }}>
            <form onSubmit={handleSubmit} style={formStyle}>
                <h2>Login</h2>
                {/* ... (Username and Password inputs remain the same) ... */}
                 <label htmlFor="login-username">Username:</label>
                 <input type="text" id="login-username" value={username} onChange={(e) => setUsername(e.target.value)} required style={inputStyle} disabled={isLoading}/>
                 <label htmlFor="login-password">Password:</label>
                 <input type="password" id="login-password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} disabled={isLoading} />

                <button type="submit" disabled={isLoading} style={buttonStyle}>
                    {isLoading ? 'Logging in...' : 'Login'}
                </button>

                {message && ( <div style={messageStyle}> {message} </div> )}

                {/* Link to Register page */}
                <p style={{marginTop: '15px', textAlign: 'center'}}>
                    Don't have an account? <Link to="/register">Register here</Link>
                </p>
            </form>
        </div>
    );
};

export default Login;