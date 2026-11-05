import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ConnectingScreen from './UI/ConnectingScreen';

export const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <ConnectingScreen />;
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
};
