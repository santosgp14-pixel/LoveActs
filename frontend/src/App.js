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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 border border-pink-100">
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">💕</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">LoveActs</h1>
          <p className="text-gray-600 text-sm">
            {isLogin ? 'Bienvenido de vuelta' : 'Únete y comparte amor cada día'}
          </p>
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

// Componente principal de la aplicación
const Dashboard = () => {
  const { user, logout, fetchUserInfo, token } = useAuth();
  const [currentView, setCurrentView] = useState('home');
  const [activities, setActivities] = useState([]);
  const [partnerActivities, setPartnerActivities] = useState([]);
  const [showPartnerModal, setShowPartnerModal] = useState(false);
  const [partnerCode, setPartnerCode] = useState('');
  const [newActivity, setNewActivity] = useState({
    description: '',
    category: 'general',
    rating: 5,
    time_of_day: ''
  });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [userScore, setUserScore] = useState(0);
  const [partnerScore, setPartnerScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user && selectedDate) {
      fetchDailyActivities();
    }
  }, [selectedDate, user]);

  const fetchDailyActivities = async () => {
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
        setUserScore(data.user_score);
        setPartnerScore(data.partner_score);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
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
          rating: 5,
          time_of_day: ''
        });
        setSuccess('¡Actividad registrada exitosamente!');
        fetchDailyActivities();
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
    return '⭐'.repeat(rating);
  };

  const renderHomeView = () => (
    <div className="space-y-6">
      {/* Header con fecha */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-pink-100">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
          <h2 className="text-2xl font-bold text-gray-800 mb-2 sm:mb-0">
            💕 {new Date(selectedDate).toLocaleDateString('es-ES', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </h2>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>

        {/* Puntuaciones del día */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div className="bg-gradient-to-r from-pink-50 to-pink-100 rounded-lg p-4 text-center">
            <h3 className="text-lg font-semibold text-pink-800">Tus Actos</h3>
            <div className="text-3xl font-bold text-pink-600">{userScore}</div>
            <div className="text-sm text-pink-700">{activities.length} actividades</div>
          </div>
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-4 text-center">
            <h3 className="text-lg font-semibold text-blue-800">
              {user?.partner_id ? 'Pareja' : 'Sin pareja'}
            </h3>
            <div className="text-3xl font-bold text-blue-600">{partnerScore}</div>
            <div className="text-sm text-blue-700">{partnerActivities.length} actividades</div>
          </div>
        </div>
      </div>

      {/* Actividades del usuario */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-pink-100">
        <h3 className="text-xl font-bold text-gray-800 mb-4">🌟 Tus Actos de Amor</h3>
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="bg-pink-50 rounded-lg p-4 border-l-4 border-pink-400">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getCategoryIcon(activity.category)}</span>
                      <span className="text-sm font-medium text-pink-700 capitalize">
                        {activity.category}
                      </span>
                      {activity.time_of_day && (
                        <span className="text-sm text-gray-500">• {activity.time_of_day}</span>
                      )}
                    </div>
                    <p className="text-gray-700 font-medium">{activity.description}</p>
                  </div>
                  <div className="ml-4 text-right">
                    <div className="text-sm">{getStarRating(activity.rating)}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">💝</div>
            <p>Aún no has registrado actos de amor hoy</p>
            <button
              onClick={() => setCurrentView('add')}
              className="mt-3 text-pink-600 hover:text-pink-700 font-medium"
            >
              ¡Añade tu primer acto!
            </button>
          </div>
        )}
      </div>

      {/* Actividades de la pareja */}
      {user?.partner_id && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4">💙 Actos de tu Pareja</h3>
          {partnerActivities.length > 0 ? (
            <div className="space-y-3">
              {partnerActivities.map((activity) => (
                <div key={activity.id} className="bg-blue-50 rounded-lg p-4 border-l-4 border-blue-400">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getCategoryIcon(activity.category)}</span>
                        <span className="text-sm font-medium text-blue-700 capitalize">
                          {activity.category}
                        </span>
                        {activity.time_of_day && (
                          <span className="text-sm text-gray-500">• {activity.time_of_day}</span>
                        )}
                      </div>
                      <p className="text-gray-700 font-medium">{activity.description}</p>
                    </div>
                    <div className="ml-4 text-right">
                      <div className="text-sm">{getStarRating(activity.rating)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">💙</div>
              <p>Tu pareja aún no ha registrado actos de amor hoy</p>
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderAddActivityView = () => (
    <div className="bg-white rounded-xl shadow-lg p-6 border border-pink-100">
      <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
        <span>✨</span> Registrar Acto de Amor
      </h2>

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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Impacto emocional (1-5 estrellas)
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setNewActivity({...newActivity, rating: star})}
                className={`text-2xl transition-all ${
                  star <= newActivity.rating ? 'text-yellow-400' : 'text-gray-300'
                } hover:text-yellow-400`}
              >
                ⭐
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Seleccionaste: {newActivity.rating} estrella{newActivity.rating !== 1 ? 's' : ''}
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

      {/* Estado de vinculación */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-blue-100">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>💑</span> Estado de Pareja
        </h3>

        {user?.partner_id ? (
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-green-600 text-lg">✅</span>
              <h4 className="font-semibold text-green-800">¡Vinculado exitosamente!</h4>
            </div>
            <p className="text-green-700">
              Estás vinculado con tu pareja. Ya pueden empezar a registrar y compartir sus actos de amor.
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
      {/* Header */}
      <header className="bg-white shadow-lg border-b border-pink-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">💕</span>
              <h1 className="text-2xl font-bold text-gray-800">LoveActs</h1>
            </div>
            <div className="text-sm text-gray-600">
              ¡Hola, {user?.name}! 👋
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 text-sm">
            {success}
          </div>
        )}

        {currentView === 'home' && renderHomeView()}
        {currentView === 'add' && renderAddActivityView()}
        {currentView === 'profile' && renderProfileView()}
      </main>

      {/* Navegación inferior */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-pink-100 shadow-lg">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex justify-around py-2">
            <button
              onClick={() => setCurrentView('home')}
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition duration-200 ${
                currentView === 'home' 
                  ? 'text-pink-600 bg-pink-50' 
                  : 'text-gray-600 hover:text-pink-600 hover:bg-pink-50'
              }`}
            >
              <span className="text-xl mb-1">🏠</span>
              <span className="text-xs font-medium">Inicio</span>
            </button>

            <button
              onClick={() => setCurrentView('add')}
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition duration-200 ${
                currentView === 'add' 
                  ? 'text-pink-600 bg-pink-50' 
                  : 'text-gray-600 hover:text-pink-600 hover:bg-pink-50'
              }`}
            >
              <span className="text-xl mb-1">➕</span>
              <span className="text-xs font-medium">Añadir</span>
            </button>

            <button
              onClick={() => setCurrentView('profile')}
              className={`flex flex-col items-center py-2 px-4 rounded-lg transition duration-200 ${
                currentView === 'profile' 
                  ? 'text-pink-600 bg-pink-50' 
                  : 'text-gray-600 hover:text-pink-600 hover:bg-pink-50'
              }`}
            >
              <span className="text-xl mb-1">👤</span>
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-100 via-white to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">💕</div>
          <div className="text-xl text-gray-600">Cargando LoveActs...</div>
        </div>
      </div>
    );
  }

  return user ? <Dashboard /> : <AuthForm />;
};

export default App;