// client/src/context/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode, useCallback } from 'react';

// Define API base URL (could be imported from a config file)
const API_BASE_URL = 'http://localhost:5000';

// Define the structure for user info
interface User {
    id: string;
    username: string;
}

// Define the shape of the context data
interface AuthContextType {
    authToken: string | null;
    currentUser: User | null;
    isLoading: boolean; // To track initial auth check
    login: (token: string, user: User) => void;
    logout: () => void;
}

// Create the context with a default value (usually null or undefined)
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define the Props for the AuthProvider component
interface AuthProviderProps {
    children: ReactNode; // To wrap around components that need auth context
}

// Create the AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [authToken, setAuthToken] = useState<string | null>(null);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true); // Start loading initially

    // Function to handle successful login
    const login = useCallback((token: string, user: User) => {
        localStorage.setItem('authToken', token); // Persist token
        setAuthToken(token);
        setCurrentUser(user);
        console.log("AuthContext: User logged in", user);
    }, []);

    // Function to handle logout
    const logout = useCallback(() => {
        localStorage.removeItem('authToken'); // Clear token
        setAuthToken(null);
        setCurrentUser(null);
        console.log("AuthContext: User logged out");
        // Optionally redirect to login page here if needed globally
        // window.location.href = '/login'; // Or use react-router navigation
    }, []);

    // Effect to check for existing token on initial load
    useEffect(() => {
        const initializeAuth = async () => {
            setIsLoading(true);
            const token = localStorage.getItem('authToken');
            if (token) {
                // --- TODO: Secure Token Validation ---
                // Replace client-side decode with a fetch call to a protected backend route
                // like '/api/auth/me' which verifies the token and returns user data.
                // If the backend call fails (invalid/expired token), call logout().
                // Example fetch call (requires backend endpoint):
                /*
                try {
                    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (!response.ok) throw new Error('Token validation failed');
                    const userData: User = await response.json();
                    setAuthToken(token);
                    setCurrentUser(userData);
                    console.log("AuthContext: Token validated via backend, user set", userData);
                } catch (error) {
                    console.error("AuthContext: Token validation failed", error);
                    logout(); // Clear invalid token
                }
                */

                // --- Insecure Client-Side Decode (Temporary Placeholder) ---
                // WARNING: Only use for non-critical info display, NOT for actual security checks.
                try {
                    const payloadBase64 = token.split('.')[1];
                    const decodedPayload = JSON.parse(atob(payloadBase64));
                     if (decodedPayload && decodedPayload.userId && decodedPayload.username) {
                        console.log("AuthContext: User inferred from token (client-side)", decodedPayload);
                        setAuthToken(token); // Set token in state
                        setCurrentUser({ id: decodedPayload.userId, username: decodedPayload.username });
                    } else { logout(); } // Invalid payload
                } catch (error) { console.error("AuthContext: Error decoding token", error); logout(); }
                // --- End Placeholder ---

            } else {
                 setCurrentUser(null); // No token found
            }
            setIsLoading(false); // Finished initial check
        };
        initializeAuth();
    }, [logout]); // Include logout in dependency array as it's used

    // Value provided by the context
    const value: AuthContextType = {
        authToken,
        currentUser,
        isLoading,
        login,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to easily use the Auth Context
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};