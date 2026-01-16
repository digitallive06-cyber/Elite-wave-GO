import { useIPTV } from './contexts/IPTVContext';
import { LoginIPTV } from './components/LoginIPTV';
import { MainApp } from './components/MainApp';

function App() {
  const { profile, loading: iptvLoading } = useIPTV();

  if (!profile && !iptvLoading) {
    return <LoginIPTV />;
  }

  if (iptvLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-white text-lg">Connecting to server...</div>
      </div>
    );
  }

  return <MainApp />;
}

export default App;
