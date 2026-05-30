import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ScrollToTop from "./components/ScrollToTop";
import LobbyPage from "./pages/LobbyPage";
import LoginPage from "./pages/LoginPage";
import OpenRoomsPage from "./pages/OpenRoomsPage";
import RegisterPage from "./pages/RegisterPage";
import RoomHistoryPage from "./pages/RoomHistoryPage";
import RoomPage from "./pages/RoomPage";

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
        <ToastProvider>
          <AuthProvider>
            <Layout>
            <Routes>
              <Route path="/" element={<LobbyPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/rooms" element={<OpenRoomsPage />} />
              <Route path="/room/:roomId" element={<RoomPage />} />
              <Route path="/rooms/:roomId/history" element={<RoomHistoryPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Layout>
          </AuthProvider>
        </ToastProvider>
    </BrowserRouter>
  );
}
