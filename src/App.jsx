import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastHost } from './components/Toast.jsx'
import RequireStaff from './components/RequireStaff.jsx'
import PublicRegister from './pages/PublicRegister.jsx'
import StudentSelfService from './pages/StudentSelfService.jsx'
import GateScanner from './pages/GateScanner.jsx'
import AdminHome from './pages/AdminHome.jsx'
import AdminDashboard from './pages/AdminDashboard.jsx'
import AdminRegistrations from './pages/AdminRegistrations.jsx'
import AdminSettings from './pages/AdminSettings.jsx'
import AdminExport from './pages/AdminExport.jsx'
import NotFound from './pages/NotFound.jsx'

export default function App() {
  return (
    <>
    <ToastHost />
    <Routes>
      <Route path="/" element={<Navigate to="/admin" replace />} />
      {/* Public — no auth */}
      <Route path="/register/:eventId" element={<PublicRegister />} />
      <Route path="/me/:claimToken" element={<StudentSelfService />} />

      {/* Gate staff (admins allowed too) */}
      <Route path="/scan" element={<RequireStaff role="staff"><GateScanner /></RequireStaff>} />

      {/* Admin only */}
      <Route path="/admin" element={<RequireStaff role="admin"><AdminHome /></RequireStaff>} />
      <Route path="/admin/event/:eventId" element={<RequireStaff role="admin"><AdminDashboard /></RequireStaff>} />
      <Route path="/admin/event/:eventId/registrations" element={<RequireStaff role="admin"><AdminRegistrations /></RequireStaff>} />
      <Route path="/admin/event/:eventId/settings" element={<RequireStaff role="admin"><AdminSettings /></RequireStaff>} />
      <Route path="/admin/event/:eventId/export" element={<RequireStaff role="admin"><AdminExport /></RequireStaff>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  )
}
