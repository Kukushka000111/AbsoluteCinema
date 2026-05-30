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
import ProfilePage from "./pages/ProfilePage";
import EditProfilePage from "./pages/EditProfilePage";
import AdminPage from "./pages/AdminPage";

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
              <Route path="/profile/me/edit" element={<EditProfilePage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/profile/:username" element={<ProfilePage />} />
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
