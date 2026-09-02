import { Routes, Route, Navigate } from 'react-router-dom'
import { ToastHost } from './components/Toast.jsx'
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
      <Route path="/register/:eventId" element={<PublicRegister />} />
      <Route path="/me/:claimToken" element={<StudentSelfService />} />
      <Route path="/scan" element={<GateScanner />} />
      <Route path="/admin" element={<AdminHome />} />
      <Route path="/admin/event/:eventId" element={<AdminDashboard />} />
      <Route path="/admin/event/:eventId/registrations" element={<AdminRegistrations />} />
      <Route path="/admin/event/:eventId/settings" element={<AdminSettings />} />
      <Route path="/admin/event/:eventId/export" element={<AdminExport />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  )
}
