import GestionApp from "./GestionApp"
import { ThemeProvider } from "./context/ThemeContext"
import { AuthProvider, useAuth } from "./context/AuthContext"
import LoginPage from "./components/LoginPage"

function AppContent() {
  const { user } = useAuth();
  return user ? <GestionApp /> : <LoginPage />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
