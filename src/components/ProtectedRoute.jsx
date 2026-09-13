import { Navigate } from 'react-router-dom';
import { Loading03Icon } from 'hugeicons-react';
import { useAuth } from '../hooks/useAuth';

export const ProtectedRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-[#fbfbfa] dark:bg-[var(--color-dark-bg)]">
                <Loading03Icon className="animate-spin w-8 h-8 text-gray-400 dark:text-gray-500" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return children;
};
