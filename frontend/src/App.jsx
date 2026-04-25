import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ScanPage from './pages/ScanPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';

function Layout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f0' }}>
      <Navbar />
      <div style={{ padding: '32px 16px' }}>{children}</div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route path="/" element={
            <ProtectedRoute roles={['admin']}>
              <Layout><DashboardPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/scan" element={
            <ProtectedRoute>
              <Layout><ScanPage /></Layout>
            </ProtectedRoute>
          } />

          {/* Handle QR scan URL: /scan/PROD-001 redirects to scan page with auto-lookup */}
          <Route path="/scan/:sku" element={
            <ProtectedRoute>
              <Layout><ScanPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/products" element={
            <ProtectedRoute roles={['admin']}>
              <Layout><ProductsPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="/products/:id" element={
            <ProtectedRoute roles={['admin']}>
              <Layout><ProductDetailPage /></Layout>
            </ProtectedRoute>
          } />

          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}