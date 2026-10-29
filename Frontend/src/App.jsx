import GestionApp from "./GestionApp"
import { ThemeProvider } from "./context/ThemeContext"
import { AuthProvider, useAuth } from "./context/AuthContext"
import LoginPage from "./components/LoginPage"
import FeedbackProvider from "./components/ui/FeedbackProvider"
import { LoadingState } from "./components/ui/Spinner"

function AppContent() {
  const { user, verificando } = useAuth();
  // Validando la sesión guardada contra el backend
  if (verificando) return <LoadingState texto="Verificando sesión..." className="min-h-screen" />;
  return user ? <GestionApp /> : <LoginPage />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <FeedbackProvider>
          <AppContent />
        </FeedbackProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
