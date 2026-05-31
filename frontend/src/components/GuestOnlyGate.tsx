import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function GuestOnlyGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <p className="text-fastwatch-muted">Загрузка...</p>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}
