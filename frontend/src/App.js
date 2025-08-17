import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Context para autenticación
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Hook para PWA
const usePWA = () => {
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
      setIsInstalled(true);
    }

    // Listen for install prompt
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // Listen for app installed
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
    };

    // Listen for online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Listen for service worker updates
    const handleServiceWorkerUpdate = () => {
      setUpdateAvailable(true);
    };

    // Check for service worker updates
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      navigator.serviceWorker.register('/sw.js').then((registration) => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      });
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const installApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('💕 Usuario aceptó instalar LoveActs');
      } else {
        console.log('💔 Usuario rechazó instalar LoveActs');
      }
      
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  const updateApp = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then((reg) => {
        if (reg && reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      });
    }
  };

  return {
    isInstallable,
    isInstalled,
    isOnline,
    updateAvailable,
    installApp,
    updateApp
  };
};

// Componente PWA Install Button
const PWAInstallButton = () => {
  const { isInstallable, installApp } = usePWA();

  if (!isInstallable) return null;

  return (
    <button
      onClick={installApp}
      className="fixed top-4 right-4 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 z-50 text-sm font-semibold"
    >
      📱 Instalar App
    </button>
  );
};

// Componente Offline Indicator  
const OfflineIndicator = () => {
  const { isOnline } = usePWA();

  if (isOnline) return null;

  return (
    <div className="fixed top-4 left-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm font-semibold">
      📵 Modo Offline
    </div>
  );
};

// Componente Update Available
const UpdateAvailableNotification = () => {
  const { updateAvailable, updateApp } = usePWA();

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 bg-gradient-to-r from-green-500 to-blue-500 text-white p-4 rounded-lg shadow-lg z-50">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-sm">¡Actualización Disponible!</h4>
          <p className="text-xs opacity-90">Nueva versión de LoveActs lista</p>
        </div>
        <button
          onClick={updateApp}
          className="bg-white text-green-600 px-4 py-2 rounded font-medium text-sm hover:bg-gray-100 transition-colors ml-4"
        >
          Actualizar
        </button>
      </div>
    </div>
  );
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      fetchUserInfo();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch(`${API_URL}/api/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('token');
        setToken(null);
      }
    } catch (error) {
      console.error('Error fetching user info:', error);
      localStorage.removeItem('token');
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, message: data.detail };
      }
    } catch (error) {
      return { success: false, message: 'Error de conexión' };
    }
  };

  const register = async (name, email, password) => {
    try {
      const response = await fetch(`${API_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true };
      } else {
        return { success: false, message: data.detail };
      }
    } catch (error) {
      return { success: false, message: 'Error de conexión' };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      register,
      logout,
      loading,
      fetchUserInfo
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Componente de Login/Registro
const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    let result;
    if (isLogin) {
      result = await login(formData.email, formData.password);
    } else {
      result = await register(formData.name, formData.email, formData.password);
    }

    if (!result.success) {
      setError(result.message);
    }
    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-white to-blue-100 flex items-center justify-center p-4">
      <PWAInstallButton />
      <OfflineIndicator />
      <UpdateAvailableNotification />
      
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border border-pink-100">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">💕</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">LoveActs</h1>
          <p className="text-gray-600 text-sm">
            {isLogin ? 'Bienvenido de vuelta' : 'Únete y comparte amor cada día'}
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            <p className="text-xs text-pink-600">✨ Versión PWA 2.0</p>
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" title="App instalable"></div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required={!isLogin}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition duration-200"
                placeholder="Tu nombre completo"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition duration-200"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition duration-200"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-pink-500 to-blue-500 text-white py-3 rounded-lg font-semibold hover:from-pink-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Procesando...' : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-pink-600 hover:text-pink-700 font-medium text-sm"
          >
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente principal expandido
const Dashboard = () => {
  const { user, logout, fetchUserInfo, token } = useAuth();
  const { isInstalled } = usePWA();
  const [currentView, setCurrentView] = useState('home');
  const [activities, setActivities] = useState([]);
  const [partnerActivities, setPartnerActivities] = useState([]);
  const [pendingRatings, setPendingRatings] = useState([]);
  const [userMood, setUserMood] = useState(null);
  const [partnerMood, setPartnerMood] = useState(null);
  const [memories, setMemories] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [totalStats, setTotalStats] = useState(null); // Nuevo: estadísticas totales
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [showMoodModal, setShowMoodModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showEditPartnerModal, setShowEditPartnerModal] = useState(false); // Nuevo modal
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [partnerCode, setPartnerCode] = useState('');
  const [editPartnerData, setEditPartnerData] = useState({ // Nuevo: datos de edición
    custom_name: '',
    photo: ''
  });
  const [newActivity, setNewActivity] = useState({
    description: '',
    category: 'general',
    time_of_day: ''
  });
  const [newMood, setNewMood] = useState({
    mood_level: 6,
    mood_emoji: '😊',
    note: ''
  });
  const [activityRating, setActivityRating] = useState({
    rating: 5,
    comment: ''
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [completedScore, setCompletedScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user && selectedDate) {
      fetchDailyData();
    }
  }, [selectedDate, user]);

  useEffect(() => {
    if (user) {
      fetchTotalStats(); // Nuevo: cargar estadísticas totales
    }
  }, [user]);

  useEffect(() => {
    if (user && currentView === 'partner') {
      fetchPendingRatings();
    }
  }, [user, currentView]);

  useEffect(() => {
    if (user && currentView === 'memories') {
      fetchMemories();
    }
  }, [user, currentView]);

  useEffect(() => {
    if (user && currentView === 'profile') {
      fetchAchievements();
    }
  }, [user, currentView]);

  const fetchDailyData = async () => {
    try {
      const response = await fetch(`${API_URL}/api/activities/daily/${selectedDate}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setActivities(data.user_activities);
        setPartnerActivities(data.partner_activities);
        setUserMood(data.user_mood);
        setPartnerMood(data.partner_mood);
        setCompletedScore(data.completed_activities_score);
      }
    } catch (error) {
      console.error('Error fetching daily data:', error);
    }
  };

  const fetchPendingRatings = async () => {
    try {
      const response = await fetch(`${API_URL}/api/activities/pending-ratings`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPendingRatings(data.activities);
      }
    } catch (error) {
      console.error('Error fetching pending ratings:', error);
    }
  };

  const fetchMemories = async () => {
    try {
      const response = await fetch(`${API_URL}/api/memories/special`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setMemories(data.memories || []);
      }
    } catch (error) {
      console.error('Error fetching memories:', error);
    }
  };

  const fetchAchievements = async () => {
    try {
      const response = await fetch(`${API_URL}/api/achievements`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAchievements(data.achievements);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    }
  };

  const fetchTotalStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/stats/total`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTotalStats(data);
      }
    } catch (error) {
      console.error('Error fetching total stats:', error);
    }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/activities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newActivity),
      });

      const data = await response.json();

      if (response.ok) {
        setNewActivity({
          description: '',
          category: 'general',
          time_of_day: ''
        });
        setSuccess('¡Actividad registrada! Tu pareja podrá calificarla.');
        fetchDailyData();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.detail);
      }
    } catch (error) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMood = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/mood`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newMood),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('¡Estado de ánimo registrado!');
        setShowMoodModal(false);
        fetchDailyData();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.detail);
      }
    } catch (error) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleRateActivity = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/activities/${selectedActivity.id}/rate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(activityRating),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('¡Actividad calificada exitosamente!');
        setShowRatingModal(false);
        setSelectedActivity(null);
        fetchPendingRatings();
        fetchDailyData();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.detail);
      }
    } catch (error) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkPartner = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/link-partner`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ partner_code: partnerCode }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setShowPartnerModal(false);
        setPartnerCode('');
        fetchUserInfo();
        fetchTotalStats(); // Actualizar estadísticas después de vincular
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.detail);
      }
    } catch (error) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePartnerInfo = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const updateData = {};
      if (editPartnerData.custom_name.trim()) {
        updateData.custom_name = editPartnerData.custom_name.trim();
      }
      if (editPartnerData.photo) {
        updateData.photo = editPartnerData.photo;
      }

      const response = await fetch(`${API_URL}/api/partner-info`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('¡Información de pareja actualizada!');
        setShowEditPartnerModal(false);
        setEditPartnerData({ custom_name: '', photo: '' });
        fetchUserInfo();
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(data.detail);
      }
    } catch (error) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('La imagen debe ser menor a 5MB');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setEditPartnerData({ ...editPartnerData, photo: e.target.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      physical: '🤗',
      emotional: '💝',
      practical: '🏠',
      general: '❤️'
    };
    return icons[category] || '❤️';
  };

  const getStarRating = (rating) => {
    return rating ? '⭐'.repeat(rating) : '⏳ Pendiente';
  };

  const getMoodEmojis = () => [
    { level: 1, emoji: '😭', label: 'Devastado/a' },
    { level: 2, emoji: '😢', label: 'Muy triste' },
    { level: 3, emoji: '😔', label: 'Triste' },
    { level: 4, emoji: '😐', label: 'Neutral' },
    { level: 5, emoji: '🙂', label: 'Tranquilo/a' },
    { level: 6, emoji: '😊', label: 'Contento/a' },
    { level: 7, emoji: '😄', label: 'Alegre' },
    { level: 8, emoji: '😍', label: 'Enamorado/a' },
    { level: 9, emoji: '🥰', label: 'Radiante' },
    { level: 10, emoji: '🤩', label: 'Eufórico/a' }
  ];

  // Vista Home Expandida - MODIFICADA según requisitos
  const renderHomeView = () => (
    <div className="space-y-6">
      {/* Header con fecha actual y estado de ánimo - NUEVO DISEÑO */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-pink-100">
        {/* Fecha actual prominente */}
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            📅 {new Date().toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h2>
          <p className="text-gray-600 text-sm">¡Un nuevo día para demostrar amor!</p>
        </div>

        {/* Selector de estado de ánimo - Justo debajo de la fecha */}
        <div className="flex justify-center mb-6">
          <button
            onClick={() => setShowMoodModal(true)}
            className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition duration-200 flex items-center gap-2"
          >
            <span className="text-xl">{userMood ? userMood.mood_emoji : '😊'}</span>
            <span>Mi Estado de Ánimo</span>
          </button>
        </div>

        {/* Total Acciones - NUEVO */}
        {totalStats && (
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-4 mb-6 border border-yellow-200">
            <div className="text-center">
              <h3 className="text-lg font-bold text-yellow-800 mb-2">💫 Total Acciones Históricas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-yellow-600">{totalStats.total_user_activities}</div>
                  <div className="text-sm text-yellow-700">Tus acciones</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-orange-600">{totalStats.total_partner_activities}</div>
                  <div className="text-sm text-orange-700">Acciones de pareja</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">{totalStats.total_activities_together}</div>
                  <div className="text-sm text-red-700">Total juntos</div>
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-600">
                💕 {totalStats.relationship_days} días registrando amor
              </div>
            </div>
          </div>
        )}

        {/* Estados de ánimo del día */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-gradient-to-r from-purple-50 to-purple-100 rounded-lg p-4 text-center">
            <h3 className="text-lg font-semibold text-purple-800">Tu Estado</h3>
            {userMood ? (
              <>
                <div className="text-3xl">{userMood.mood_emoji}</div>
                <div className="text-sm text-purple-700">{userMood.note || 'Sin nota'}</div>
              </>
            ) : (
              <div className="text-gray-500 text-sm">No registrado hoy</div>
            )}
          </div>
          <div className="bg-gradient-to-r from-indigo-50 to-indigo-100 rounded-lg p-4 text-center">
            <h3 className="text-lg font-semibold text-indigo-800">Estado de Pareja</h3>
            {partnerMood ? (
              <>
                <div className="text-3xl">{partnerMood.mood_emoji}</div>
                <div className="text-sm text-indigo-700">{partnerMood.note || 'Sin nota'}</div>
              </>
            ) : (
              <div className="text-gray-500 text-sm">
                {user?.partner_id ? 'No registrado hoy' : 'Sin pareja'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Accesos rápidos */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-pink-100">
        <h3 className="text-xl font-bold text-gray-800 mb-4">🚀 Accesos Rápidos</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            onClick={() => setCurrentView('add')}
            className="bg-green-500 text-white p-4 rounded-lg hover:bg-green-600 transition duration-200 text-center"
          >
            <div className="text-2xl mb-1">➕</div>
            <div className="text-sm font-medium">Añadir Acto</div>
          </button>
          
          {user?.partner_id && (
            <button
              onClick={() => setCurrentView('partner')}
              className="bg-purple-500 text-white p-4 rounded-lg hover:bg-purple-600 transition duration-200 text-center"
            >
              <div className="text-2xl mb-1">💑</div>
              <div className="text-sm font-medium">Mi Pareja</div>
            </button>
          )}
          
          <button
            onClick={() => setCurrentView('memories')}
            className="bg-yellow-500 text-white p-4 rounded-lg hover:bg-yellow-600 transition duration-200 text-center"
          >
            <div className="text-2xl mb-1">🎭</div>
            <div className="text-sm font-medium">Recuerdos</div>
          </button>
          
          <button
            onClick={() => setCurrentView('history')}
            className="bg-blue-500 text-white p-4 rounded-lg hover:bg-blue-600 transition duration-200 text-center"
          >
            <div className="text-2xl mb-1">📚</div>
            <div className="text-sm font-medium">Historial</div>
          </button>
          
          <button
            onClick={() => setCurrentView('compare')}
            className="bg-orange-500 text-white p-4 rounded-lg hover:bg-orange-600 transition duration-200 text-center"
          >
            <div className="text-2xl mb-1">📊</div>
            <div className="text-sm font-medium">Comparar</div>
          </button>
        </div>
      </div>

      {/* Resumen rápido de actividades de HOY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tus actividades */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-pink-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4">🌟 Tus Actos de Hoy</h3>
          {activities.slice(0, 3).map((activity) => (
            <div key={activity.id} className="bg-pink-50 rounded-lg p-3 mb-3 border-l-4 border-pink-400">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{getCategoryIcon(activity.category)}</span>
                    <span className="text-sm font-medium text-pink-700">
                      {activity.category}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm">{activity.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs">{getStarRating(activity.rating)}</div>
                </div>
              </div>
            </div>
          ))}
          {activities.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              <div className="text-2xl mb-2">💝</div>
              <p className="text-sm">Aún no has registrado actos hoy</p>
            </div>
          )}
        </div>

        {/* Actividades de pareja */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4">💙 Actos de tu Pareja Hoy</h3>
          {partnerActivities.slice(0, 3).map((activity) => (
            <div key={activity.id} className="bg-blue-50 rounded-lg p-3 mb-3 border-l-4 border-blue-400">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span>{getCategoryIcon(activity.category)}</span>
                    <span className="text-sm font-medium text-blue-700">
                      {activity.category}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm">{activity.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-xs">{getStarRating(activity.rating)}</div>
                </div>
              </div>
            </div>
          ))}
          {partnerActivities.length === 0 && (
            <div className="text-center py-4 text-gray-500">
              <div className="text-2xl mb-2">💙</div>
              <p className="text-sm">{user?.partner_id ? 'Tu pareja aún no ha registrado actos hoy' : 'Sin pareja vinculada'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Nueva Vista: Historial - NUEVA SECCIÓN
  const renderHistoryView = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4 sm:mb-0 flex items-center gap-2">
            <span>📚</span> Historial de Actividades
          </h2>
          <div className="flex gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Puntuaciones del día seleccionado */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-r from-pink-50 to-pink-100 rounded-lg p-4 text-center">
            <h3 className="text-lg font-semibold text-pink-800">Actos Completados</h3>
            <div className="text-3xl font-bold text-pink-600">{completedScore}</div>
            <div className="text-sm text-pink-700">Puntuación del día</div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 text-center">
            <h3 className="text-lg font-semibold text-blue-800">Actividades</h3>
            <div className="text-3xl font-bold text-blue-600">
              {activities.length + partnerActivities.length}
            </div>
            <div className="text-sm text-blue-700">Total del día</div>
          </div>
        </div>

        {/* Fecha seleccionada */}
        <div className="text-center mb-6">
          <h3 className="text-lg font-semibold text-gray-700">
            📅 {new Date(selectedDate).toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h3>
        </div>
      </div>

      {/* Actividades detalladas del día */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tus actividades del día */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-pink-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4">🌟 Tus Actos</h3>
          {activities.length > 0 ? (
            <div className="space-y-3">
              {activities.map((activity) => (
                <div key={activity.id} className="bg-pink-50 rounded-lg p-4 border-l-4 border-pink-400">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{getCategoryIcon(activity.category)}</span>
                        <span className="text-sm font-medium text-pink-700 capitalize">
                          {activity.category}
                        </span>
                        {activity.time_of_day && (
                          <span className="text-sm text-gray-500">• {activity.time_of_day}</span>
                        )}
                      </div>
                      <p className="text-gray-700 font-medium mb-2">{activity.description}</p>
                      {activity.partner_comment && (
                        <div className="bg-white rounded p-2 text-sm text-gray-600">
                          💭 Comentario: "{activity.partner_comment}"
                        </div>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-sm">{getStarRating(activity.rating)}</div>
                      {activity.rated_at && (
                        <div className="text-xs text-gray-500">
                          Calificado
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">💝</div>
              <p>No registraste actos este día</p>
            </div>
          )}
        </div>

        {/* Actividades de la pareja del día */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4">💙 Actos de tu Pareja</h3>
          {partnerActivities.length > 0 ? (
            <div className="space-y-3">
              {partnerActivities.map((activity) => (
                <div key={activity.id} className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{getCategoryIcon(activity.category)}</span>
                        <span className="text-sm font-medium text-blue-700 capitalize">
                          {activity.category}
                        </span>
                        {activity.time_of_day && (
                          <span className="text-sm text-gray-500">• {activity.time_of_day}</span>
                        )}
                      </div>
                      <p className="text-gray-700 font-medium mb-2">{activity.description}</p>
                      {activity.partner_comment && (
                        <div className="bg-white rounded p-2 text-sm text-gray-600">
                          💭 Tu comentario: "{activity.partner_comment}"
                        </div>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-sm">{getStarRating(activity.rating)}</div>
                      {activity.rated_at && (
                        <div className="text-xs text-gray-500">
                          Calificado por ti
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">💙</div>
              <p>{user?.partner_id ? 'Tu pareja no registró actos este día' : 'Sin pareja vinculada'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Nueva Vista: Mi Pareja - MODIFICADA
  const renderPartnerView = () => {
    if (!user?.partner_id) {
      return (
        <div className="bg-white rounded-xl shadow-lg p-8 border border-pink-100 text-center">
          <div className="text-6xl mb-4">💔</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Sin Pareja Vinculada</h2>
          <p className="text-gray-600 mb-6">
            Para acceder a esta sección necesitas vincular tu cuenta con tu pareja.
          </p>
          <button
            onClick={() => setShowPartnerModal(true)}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition duration-200"
          >
            🔗 Vincular Pareja
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Información de la pareja - MODIFICADA */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-purple-100">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span>💑</span> Mi Pareja: {user.partner_custom_name || user.partner_name}
            </h2>
            <button
              onClick={() => {
                setEditPartnerData({
                  custom_name: user.partner_custom_name || user.partner_name || '',
                  photo: user.partner_photo || ''
                });
                setShowEditPartnerModal(true);
              }}
              className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition duration-200 text-sm"
            >
              ✏️ Editar Info
            </button>
          </div>

          {/* Foto y datos de pareja - NUEVO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Foto de pareja */}
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-3 rounded-full overflow-hidden bg-gradient-to-r from-purple-100 to-pink-100 flex items-center justify-center">
                {user.partner_photo ? (
                  <img 
                    src={user.partner_photo} 
                    alt="Foto de pareja" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl">👤</span>
                )}
              </div>
              <h3 className="font-bold text-purple-800">{user.partner_custom_name || user.partner_name}</h3>
              <p className="text-sm text-gray-600">Tu media naranja 💕</p>
            </div>

            {/* Estado de ánimo de la pareja */}
            <div className="bg-purple-50 rounded-lg p-4">
              <h3 className="font-semibold text-purple-800 mb-3">Estado de Ánimo Hoy</h3>
              {partnerMood ? (
                <div className="text-center">
                  <div className="text-4xl mb-2">{partnerMood.mood_emoji}</div>
                  <div className="text-sm text-purple-700">
                    Nivel: {partnerMood.mood_level}/5
                  </div>
                  {partnerMood.note && (
                    <div className="text-xs text-gray-600 mt-2">
                      "{partnerMood.note}"
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">
                  <div className="text-2xl mb-2">😐</div>
                  <div className="text-sm">No ha registrado su estado hoy</div>
                </div>
              )}
            </div>

            {/* Actividades pendientes por calificar */}
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-800 mb-3">
                Actos por Calificar ({pendingRatings.length})
              </h3>
              {pendingRatings.length > 0 ? (
                <div className="space-y-2">
                  {pendingRatings.slice(0, 2).map((activity) => (
                    <div key={activity.id} className="bg-white rounded p-2">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-sm font-medium">{activity.description}</p>
                          <p className="text-xs text-gray-500">{activity.date}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedActivity(activity);
                            setShowRatingModal(true);
                          }}
                          className="bg-yellow-500 text-white px-2 py-1 rounded text-xs hover:bg-yellow-600"
                        >
                          Calificar
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingRatings.length > 2 && (
                    <div className="text-xs text-center text-gray-500">
                      +{pendingRatings.length - 2} más por calificar
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 text-sm py-4">
                  ¡Todo calificado! 🎉
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lista completa de actividades de la pareja */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4">💝 Todos sus Actos de Amor</h3>
          {partnerActivities.length > 0 ? (
            <div className="space-y-3">
              {partnerActivities.map((activity) => (
                <div key={activity.id} className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{getCategoryIcon(activity.category)}</span>
                        <span className="text-sm font-medium text-blue-700 capitalize">
                          {activity.category}
                        </span>
                        {activity.time_of_day && (
                          <span className="text-sm text-gray-500">• {activity.time_of_day}</span>
                        )}
                        <span className="text-sm text-gray-500">• {activity.date}</span>
                      </div>
                      <p className="text-gray-700 font-medium mb-2">{activity.description}</p>
                      {activity.partner_comment && (
                        <div className="bg-white rounded p-2 text-sm text-gray-600">
                          💭 Tu comentario: "{activity.partner_comment}"
                        </div>
                      )}
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-sm">{getStarRating(activity.rating)}</div>
                      {activity.rating && activity.rated_at && (
                        <div className="text-xs text-gray-500">
                          Calificado {new Date(activity.rated_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">💙</div>
              <p>Tu pareja aún no ha registrado actos para este día</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Nueva Vista: Recuerdos Especiales - MODIFICADA
  const renderMemoriesView = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-lg p-6 border border-yellow-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span>🎭</span> Recuerdos Especiales
          </h2>
          {/* Botón más pequeño y texto cambiado - MODIFICADO */}
          <button
            onClick={fetchMemories}
            className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 transition duration-200"
          >
            🔄 Actualizar
          </button>
        </div>

        {memories.length > 0 ? (
          <div className="space-y-4">
            {memories.map((memory, index) => (
              <div key={index} className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg p-6 border border-yellow-200">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="text-lg font-semibold text-yellow-800 mb-2">
                      {memory.memory_message}
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{getCategoryIcon(memory.activity.category)}</span>
                      <span className="text-sm font-medium text-yellow-700 capitalize">
                        {memory.activity.category}
                      </span>
                      <span className="text-sm text-gray-600">
                        • {new Date(memory.activity.date).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                    <p className="text-gray-700 font-medium mb-2">
                      "{memory.activity.description}"
                    </p>
                    {memory.activity.partner_comment && (
                      <div className="bg-white rounded p-3 border border-yellow-300">
                        <div className="text-sm text-gray-600">
                          💭 <strong>Comentario:</strong> "{memory.activity.partner_comment}"
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 text-center">
                    <div className="text-2xl mb-1">⭐⭐⭐⭐⭐</div>
                    <div className="text-xs text-yellow-700">
                      Hace {memory.days_ago} días
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <button className="bg-yellow-600 text-white px-3 py-1 rounded text-sm hover:bg-yellow-700">
                    📤 Compartir
                  </button>
                  <button className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700">
                    💾 Guardar
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎭</div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">
              Aún No Hay Recuerdos Especiales
            </h3>
            <p className="text-gray-600 mb-6">
              Los recuerdos se crean cuando tus actos de amor reciben calificaciones de 5 estrellas.
              ¡Sigue creando momentos mágicos!
            </p>
            <button
              onClick={() => setCurrentView('add')}
              className="bg-yellow-500 text-white px-6 py-3 rounded-lg hover:bg-yellow-600 transition duration-200"
            >
              ✨ Crear Nuevo Acto
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // Vista Comparar (simplificada por espacio)
  const renderCompareView = () => (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-orange-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span>📊</span> Comparaciones y Estadísticas
      </h2>
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-bold text-gray-700 mb-2">
          Funcionalidad en Desarrollo
        </h3>
        <p className="text-gray-600">
          Aquí podrás ver gráficos comparativos, correlaciones entre estados de ánimo y actividades,
          y estadísticas avanzadas de tu relación.
        </p>
      </div>
    </div>
  );

  // Vista Añadir Actividad (actualizada)
  const renderAddActivityView = () => (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-pink-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span>✨</span> Registrar Acto de Amor
      </h2>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2">
          <span className="text-blue-600">ℹ️</span>
          <p className="text-sm text-blue-800">
            <strong>Nuevo:</strong> Tu pareja recibirá una notificación para calificar este acto.
            ¡El puntaje lo decide quien lo recibe!
          </p>
        </div>
      </div>

      <form onSubmit={handleAddActivity} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ¿Qué hiciste por tu pareja?
          </label>
          <textarea
            value={newActivity.description}
            onChange={(e) => setNewActivity({...newActivity, description: e.target.value})}
            required
            rows="3"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent resize-none"
            placeholder="Ej: Le preparé su desayuno favorito, le envié un mensaje cariñoso..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoría
            </label>
            <select
              value={newActivity.category}
              onChange={(e) => setNewActivity({...newActivity, category: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            >
              <option value="general">❤️ General</option>
              <option value="physical">🤗 Físico</option>
              <option value="emotional">💝 Emocional</option>
              <option value="practical">🏠 Práctico</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Momento del día
            </label>
            <input
              type="time"
              value={newActivity.time_of_day}
              onChange={(e) => setNewActivity({...newActivity, time_of_day: e.target.value})}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 bg-gradient-to-r from-pink-500 to-blue-500 text-white py-3 rounded-lg font-semibold hover:from-pink-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : '💕 Registrar Acto'}
          </button>
          <button
            type="button"
            onClick={() => setCurrentView('home')}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-200"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );

  // Vista Perfil (expandida con logros)
  const renderProfileView = () => (
    <div className="space-y-6">
      {/* Información del usuario */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-pink-100">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <span>👤</span> Mi Perfil
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Nombre</h3>
              <p className="text-lg font-semibold text-gray-800">{user?.name}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-1">Email</h3>
              <p className="text-lg font-semibold text-gray-800">{user?.email}</p>
            </div>
          </div>

          <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
            <h3 className="text-sm font-medium text-pink-700 mb-2">Tu código de pareja</h3>
            <div className="flex items-center gap-3">
              <code className="text-xl font-mono font-bold text-pink-800 bg-white px-3 py-2 rounded border">
                {user?.partner_code}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(user?.partner_code)}
                className="text-pink-600 hover:text-pink-700 font-medium text-sm"
              >
                📋 Copiar
              </button>
            </div>
            <p className="text-sm text-pink-600 mt-2">
              Comparte este código con tu pareja para vincular sus cuentas
            </p>
          </div>
        </div>
      </div>

      {/* Logros y Insignias */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-yellow-100">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>🏆</span> Logros e Insignias
        </h3>

        {achievements.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {achievements.map((achievement) => (
              <div key={achievement.id} className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{achievement.icon}</span>
                  <div>
                    <h4 className="font-semibold text-yellow-800">{achievement.name}</h4>
                    <p className="text-sm text-yellow-700">{achievement.description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Desbloqueado: {new Date(achievement.unlocked_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🏆</div>
            <p>¡Sigue registrando actos de amor para desbloquear logros!</p>
          </div>
        )}
      </div>

      {/* Estado de vinculación */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>💑</span> Estado de Pareja
        </h3>

        {user?.partner_id ? (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600 text-lg">✅</span>
              <h4 className="font-semibold text-green-800">¡Vinculado con {user.partner_name}!</h4>
            </div>
            <p className="text-green-700">
              Estás vinculado exitosamente. Ya pueden registrar, calificar y compartir actos de amor.
            </p>
          </div>
        ) : (
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-yellow-600 text-lg">⚠️</span>
              <h4 className="font-semibold text-yellow-800">Sin pareja vinculada</h4>
            </div>
            <p className="text-yellow-700 mb-4">
              Para disfrutar completamente de LoveActs, vincula tu cuenta con la de tu pareja.
            </p>
            <button
              onClick={() => setShowPartnerModal(true)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition duration-200"
            >
              🔗 Vincular Pareja
            </button>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-4">⚙️ Configuración</h3>
        <button
          onClick={logout}
          className="w-full bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition duration-200"
        >
          🚪 Cerrar Sesión
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-white to-blue-100">
      <PWAInstallButton />
      <OfflineIndicator />
      <UpdateAvailableNotification />
      
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-pink-100 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">💕</span>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">LoveActs</h1>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-pink-600">✨ Versión PWA 2.0</p>
                  {isInstalled && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span className="text-xs text-green-600">Instalada</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-600">
              ¡Hola, {user?.name}! 👋
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {success}
          </div>
        )}

        {currentView === 'home' && renderHomeView()}
        {currentView === 'add' && renderAddActivityView()}
        {currentView === 'partner' && renderPartnerView()}
        {currentView === 'memories' && renderMemoriesView()}
        {currentView === 'history' && renderHistoryView()}
        {currentView === 'compare' && renderCompareView()}
        {currentView === 'profile' && renderProfileView()}
      </main>

      {/* Navegación inferior expandida - 6 secciones ACTUALIZADA */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-pink-100 shadow-lg">
        <div className="max-w-6xl mx-auto px-2">
          <div className="flex justify-around py-2">
            <button
              onClick={() => setCurrentView('home')}
              className={`flex flex-col items-center py-2 px-2 rounded-lg transition duration-200 ${
                currentView === 'home' 
                  ? 'text-pink-600 bg-pink-50' 
                  : 'text-gray-600 hover:text-pink-600 hover:bg-pink-50'
              }`}
            >
              <span className="text-lg mb-1">🏠</span>
              <span className="text-xs font-medium">Inicio</span>
            </button>

            <button
              onClick={() => setCurrentView('add')}
              className={`flex flex-col items-center py-2 px-2 rounded-lg transition duration-200 ${
                currentView === 'add' 
                  ? 'text-pink-600 bg-pink-50' 
                  : 'text-gray-600 hover:text-pink-600 hover:bg-pink-50'
              }`}
            >
              <span className="text-lg mb-1">➕</span>
              <span className="text-xs font-medium">Añadir</span>
            </button>

            <button
              onClick={() => setCurrentView('partner')}
              className={`flex flex-col items-center py-2 px-2 rounded-lg transition duration-200 ${
                currentView === 'partner' 
                  ? 'text-pink-600 bg-pink-50' 
                  : 'text-gray-600 hover:text-pink-600 hover:bg-pink-50'
              }`}
            >
              <span className="text-lg mb-1">💑</span>
              <span className="text-xs font-medium">Pareja</span>
            </button>

            <button
              onClick={() => setCurrentView('memories')}
              className={`flex flex-col items-center py-2 px-2 rounded-lg transition duration-200 ${
                currentView === 'memories' 
                  ? 'text-pink-600 bg-pink-50' 
                  : 'text-gray-600 hover:text-pink-600 hover:bg-pink-50'
              }`}
            >
              <span className="text-lg mb-1">🎭</span>
              <span className="text-xs font-medium">Recuerdos</span>
            </button>

            <button
              onClick={() => setCurrentView('history')}
              className={`flex flex-col items-center py-2 px-2 rounded-lg transition duration-200 ${
                currentView === 'history' 
                  ? 'text-pink-600 bg-pink-50' 
                  : 'text-gray-600 hover:text-pink-600 hover:bg-pink-50'
              }`}
            >
              <span className="text-lg mb-1">📚</span>
              <span className="text-xs font-medium">Historial</span>
            </button>

            <button
              onClick={() => setCurrentView('profile')}
              className={`flex flex-col items-center py-2 px-2 rounded-lg transition duration-200 ${
                currentView === 'profile' 
                  ? 'text-pink-600 bg-pink-50' 
                  : 'text-gray-600 hover:text-pink-600 hover:bg-pink-50'
              }`}
            >
              <span className="text-lg mb-1">👤</span>
              <span className="text-xs font-medium">Perfil</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Modal para vincular pareja */}
      {showPartnerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">
              🔗 Vincular Pareja
            </h3>
            <p className="text-gray-600 text-sm mb-6 text-center">
              Ingresa el código de pareja que te compartió tu ser querido
            </p>

            <form onSubmit={handleLinkPartner} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Código de Pareja
                </label>
                <input
                  type="text"
                  value={partnerCode}
                  onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                  required
                  placeholder="Ej: ABC12345"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent font-mono text-center text-lg"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-blue-500 text-white py-3 rounded-lg font-semibold hover:from-pink-600 hover:to-blue-600 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition duration-200 disabled:opacity-50"
                >
                  {loading ? 'Vinculando...' : '💕 Vincular'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowPartnerModal(false);
                    setPartnerCode('');
                    setError('');
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-200"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para estado de ánimo */}
      {showMoodModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">
              😊 ¿Cómo te sientes hoy?
            </h3>

            <form onSubmit={handleAddMood} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Selecciona tu estado de ánimo
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {getMoodEmojis().map((mood) => (
                    <button
                      key={mood.level}
                      type="button"
                      onClick={() => setNewMood({
                        ...newMood, 
                        mood_level: mood.level, 
                        mood_emoji: mood.emoji
                      })}
                      className={`p-3 rounded-lg text-center transition duration-200 ${
                        newMood.mood_level === mood.level
                          ? 'bg-purple-100 border-2 border-purple-500'
                          : 'bg-gray-50 border border-gray-200 hover:bg-purple-50'
                      }`}
                    >
                      <div className="text-2xl mb-1">{mood.emoji}</div>
                      <div className="text-xs font-medium">{mood.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nota opcional
                </label>
                <textarea
                  value={newMood.note}
                  onChange={(e) => setNewMood({...newMood, note: e.target.value})}
                  rows="2"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                  placeholder="¿Qué te hace sentir así hoy?"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-purple-500 text-white py-3 rounded-lg font-semibold hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-200 disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : '💜 Registrar Estado'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowMoodModal(false);
                    setError('');
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-200"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para calificar actividades */}
      {showRatingModal && selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">
              ⭐ Calificar Acto de Amor
            </h3>

            <div className="bg-blue-50 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-800 mb-2">
                {selectedActivity.user_name} hizo:
              </h4>
              <p className="text-blue-700">"{selectedActivity.description}"</p>
              <p className="text-sm text-blue-600 mt-2">
                {getCategoryIcon(selectedActivity.category)} {selectedActivity.category} • {selectedActivity.date}
              </p>
            </div>

            <form onSubmit={handleRateActivity} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  ¿Cómo te hizo sentir este acto? (1-5 estrellas)
                </label>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setActivityRating({...activityRating, rating: star})}
                      className={`text-3xl transition-all ${
                        star <= activityRating.rating ? 'text-yellow-400' : 'text-gray-300'
                      } hover:text-yellow-400`}
                    >
                      ⭐
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Seleccionaste: {activityRating.rating} estrella{activityRating.rating !== 1 ? 's' : ''}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comentario opcional
                </label>
                <textarea
                  value={activityRating.comment}
                  onChange={(e) => setActivityRating({...activityRating, comment: e.target.value})}
                  rows="3"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent resize-none"
                  placeholder="Cuéntale cómo te hizo sentir este gesto..."
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-yellow-500 text-white py-3 rounded-lg font-semibold hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 transition duration-200 disabled:opacity-50"
                >
                  {loading ? 'Calificando...' : '⭐ Calificar'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRatingModal(false);
                    setSelectedActivity(null);
                    setError('');
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-200"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para editar información de pareja - NUEVO */}
      {showEditPartnerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-2xl font-bold text-gray-800 mb-4 text-center">
              ✏️ Personalizar Mi Pareja
            </h3>
            <p className="text-gray-600 text-sm mb-6 text-center">
              Agrega un apodo tierno y una foto especial
            </p>

            <form onSubmit={handleUpdatePartnerInfo} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Apodo Tierno
                </label>
                <input
                  type="text"
                  value={editPartnerData.custom_name}
                  onChange={(e) => setEditPartnerData({...editPartnerData, custom_name: e.target.value})}
                  placeholder="Mi amor, corazón, mi vida..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Déjalo vacío para usar el nombre original
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Foto de Pareja
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {editPartnerData.photo && (
                  <div className="mt-3 text-center">
                    <img 
                      src={editPartnerData.photo} 
                      alt="Preview" 
                      className="w-20 h-20 rounded-full mx-auto object-cover border-4 border-purple-200"
                    />
                    <p className="text-xs text-green-600 mt-1">✓ Foto cargada</p>
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Máximo 5MB - JPG, PNG, WEBP
                </p>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition duration-200 disabled:opacity-50"
                >
                  {loading ? 'Guardando...' : '💜 Guardar Cambios'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditPartnerModal(false);
                    setEditPartnerData({ custom_name: '', photo: '' });
                    setError('');
                  }}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition duration-200"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Padding bottom para la navegación fija */}
      <div className="pb-20"></div>
    </div>
  );
};

// Componente principal de la aplicación
const App = () => {
  return (
    <AuthProvider>
      <div className="App">
        <Main />
      </div>
    </AuthProvider>
  );
};

const Main = () => {
  const { user, loading } = useAuth();
  const { isInstalled } = usePWA();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-white to-blue-100 flex items-center justify-center">
        <PWAInstallButton />
        <OfflineIndicator />
        <div className="text-center">
          <div className="text-6xl mb-4">💕</div>
          <div className="text-xl text-gray-600">Cargando LoveActs...</div>
          <div className="flex items-center justify-center gap-2 mt-2">
            <div className="text-sm text-pink-600">✨ Versión PWA 2.0</div>
            {isInstalled && (
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-xs text-green-600">Instalada</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <AuthForm />;
};

export default App;