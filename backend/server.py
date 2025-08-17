from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from typing import Optional, List
import os
from pymongo import MongoClient
from datetime import datetime, timedelta, timezone
import jwt
import bcrypt
import uuid
import random
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

app = FastAPI(title="LoveActs API Expandida", version="2.0.0")

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuración de MongoDB
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
DB_NAME = os.environ.get('DB_NAME', 'loveacts_expanded_db')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Configuración JWT
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this-in-production')
JWT_ALGORITHM = 'HS256'

security = HTTPBearer()

# Modelos Pydantic Originales
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    partner_id: Optional[str] = None
    partner_code: Optional[str] = None
    partner_name: Optional[str] = None
    partner_custom_name: Optional[str] = None  # Nuevo: apodo personalizado
    partner_photo: Optional[str] = None  # Nuevo: foto de pareja (base64)
    created_at: datetime

class LinkPartnerRequest(BaseModel):
    partner_code: str

# Modelos Expandidos para Actividades
class ActivityCreate(BaseModel):
    description: str
    category: str = "general"  # general, physical, emotional, practical
    time_of_day: Optional[str] = None
    # Nota: rating ahora lo asigna la pareja receptora

class ActivityResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    description: str
    category: str
    rating: Optional[int] = None  # Ahora opcional, lo asigna la pareja
    partner_comment: Optional[str] = None
    time_of_day: Optional[str]
    date: str
    created_at: datetime
    rated_at: Optional[datetime] = None
    is_pending_rating: bool = True

class ActivityRating(BaseModel):
    rating: int  # 1-5 estrellas
    comment: Optional[str] = None

# Nuevos modelos para personalización de pareja
class UpdatePartnerInfo(BaseModel):
    custom_name: Optional[str] = None
    photo: Optional[str] = None  # base64 encoded image

class TotalStatsResponse(BaseModel):
    total_user_activities: int
    total_partner_activities: int
    total_activities_together: int
    relationship_days: int

# Modelos para Estado de Ánimo
class MoodCreate(BaseModel):
    mood_level: int  # 1-5 (1=muy mal, 5=excelente)
    mood_emoji: str  # emoji representativo
    note: Optional[str] = None

class MoodResponse(BaseModel):
    id: str
    user_id: str
    mood_level: int
    mood_emoji: str
    note: Optional[str]
    date: str
    created_at: datetime

# Modelos para Recuerdos
class MemoryResponse(BaseModel):
    activity: ActivityResponse
    days_ago: int
    memory_message: str

class DailyStatsExpanded(BaseModel):
    date: str
    user_activities: List[ActivityResponse]
    partner_activities: List[ActivityResponse]
    pending_ratings_count: int
    user_mood: Optional[MoodResponse]
    partner_mood: Optional[MoodResponse]
    completed_activities_score: int
    total_activities: int

# Funciones de utilidad
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_access_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=7)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get('user_id')
        if user_id is None:
            raise HTTPException(status_code=401, detail="Token inválido")
        
        user = db.users.find_one({"id": user_id})
        if user is None:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

def generate_partner_code() -> str:
    return str(uuid.uuid4())[:8].upper()

def get_partner_info(user):
    """Obtiene información de la pareja del usuario"""
    if not user.get("partner_id"):
        return None
    partner = db.users.find_one({"id": user["partner_id"]})
    return partner

# Endpoints de autenticación (mantenidos)
@app.post("/api/register")
async def register(user_data: UserCreate):
    existing_user = db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    user_id = str(uuid.uuid4())
    partner_code = generate_partner_code()
    
    new_user = {
        "id": user_id,
        "name": user_data.name,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "partner_id": None,
        "partner_code": partner_code,
        "created_at": datetime.now(timezone.utc)
    }
    
    db.users.insert_one(new_user)
    token = create_access_token(user_id)
    
    return {
        "message": "Usuario registrado exitosamente",
        "token": token,
        "user": UserResponse(
            id=user_id,
            name=user_data.name,
            email=user_data.email,
            partner_code=partner_code,
            created_at=new_user["created_at"]
        )
    }

@app.post("/api/login")
async def login(user_data: UserLogin):
    user = db.users.find_one({"email": user_data.email})
    if not user or not verify_password(user_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    
    token = create_access_token(user["id"])
    partner = get_partner_info(user)
    
    return {
        "message": "Login exitoso",
        "token": token,
        "user": UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            partner_id=user.get("partner_id"),
            partner_code=user["partner_code"],
            partner_name=partner["name"] if partner else None,
            created_at=user["created_at"]
        )
    }

@app.get("/api/me")
async def get_current_user_info(current_user = Depends(get_current_user)):
    partner = get_partner_info(current_user)
    
    # Obtener información personalizada de pareja
    partner_custom_name = current_user.get("partner_custom_name")
    partner_photo = current_user.get("partner_photo")
    
    return {
        "user": UserResponse(
            id=current_user["id"],
            name=current_user["name"],
            email=current_user["email"],
            partner_id=current_user.get("partner_id"),
            partner_code=current_user["partner_code"],
            partner_name=partner["name"] if partner else None,
            partner_custom_name=partner_custom_name,
            partner_photo=partner_photo,
            created_at=current_user["created_at"]
        )
    }

# Endpoints de vinculación (mantenidos)
@app.post("/api/link-partner")
async def link_partner(request: LinkPartnerRequest, current_user = Depends(get_current_user)):
    if current_user.get("partner_id"):
        raise HTTPException(status_code=400, detail="Ya tienes una pareja vinculada")
    
    partner = db.users.find_one({"partner_code": request.partner_code})
    if not partner:
        raise HTTPException(status_code=404, detail="Código de pareja no válido")
    
    if partner["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="No puedes vincularte contigo mismo")
    
    if partner.get("partner_id"):
        raise HTTPException(status_code=400, detail="Esta persona ya tiene pareja vinculada")
    
    db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"partner_id": partner["id"]}}
    )
    db.users.update_one(
        {"id": partner["id"]},
        {"$set": {"partner_id": current_user["id"]}}
    )
    
    return {
        "message": f"¡Vinculado exitosamente con {partner['name']}!",
        "partner_name": partner["name"]
    }

# Endpoints de Actividades EXPANDIDOS
@app.post("/api/activities")
async def create_activity(activity: ActivityCreate, current_user = Depends(get_current_user)):
    activity_id = str(uuid.uuid4())
    today = datetime.now(timezone.utc).date().isoformat()
    
    new_activity = {
        "id": activity_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "description": activity.description,
        "category": activity.category,
        "time_of_day": activity.time_of_day,
        "date": today,
        "rating": None,  # Será asignado por la pareja
        "partner_comment": None,
        "is_pending_rating": True,
        "created_at": datetime.now(timezone.utc),
        "rated_at": None
    }
    
    db.activities.insert_one(new_activity)
    
    return {
        "message": "Actividad registrada exitosamente. Tu pareja podrá calificarla.",
        "activity": ActivityResponse(**new_activity)
    }

@app.post("/api/activities/{activity_id}/rate")
async def rate_activity(activity_id: str, rating_data: ActivityRating, current_user = Depends(get_current_user)):
    if not (1 <= rating_data.rating <= 5):
        raise HTTPException(status_code=400, detail="La calificación debe estar entre 1 y 5")
    
    # Buscar la actividad
    activity = db.activities.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    # Verificar que el usuario actual es la pareja del creador de la actividad
    activity_creator = db.users.find_one({"id": activity["user_id"]})
    if not activity_creator or activity_creator.get("partner_id") != current_user["id"]:
        raise HTTPException(status_code=403, detail="Solo puedes calificar actividades de tu pareja")
    
    # Verificar que no haya sido calificada ya
    if not activity.get("is_pending_rating", True):
        raise HTTPException(status_code=400, detail="Esta actividad ya ha sido calificada")
    
    # Actualizar la actividad con la calificación
    db.activities.update_one(
        {"id": activity_id},
        {
            "$set": {
                "rating": rating_data.rating,
                "partner_comment": rating_data.comment,
                "is_pending_rating": False,
                "rated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    return {
        "message": "Actividad calificada exitosamente",
        "rating": rating_data.rating,
        "comment": rating_data.comment
    }

@app.get("/api/activities/daily/{date}")
async def get_daily_activities(date: str, current_user = Depends(get_current_user)):
    try:
        datetime.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (usar YYYY-MM-DD)")
    
    # Actividades del usuario
    user_activities = list(db.activities.find({
        "user_id": current_user["id"],
        "date": date
    }))
    user_activities_response = [ActivityResponse(**activity) for activity in user_activities]
    
    # Actividades de la pareja
    partner_activities_response = []
    if current_user.get("partner_id"):
        partner_activities = list(db.activities.find({
            "user_id": current_user["partner_id"],
            "date": date
        }))
        partner_activities_response = [ActivityResponse(**activity) for activity in partner_activities]
    
    # Contar actividades pendientes de calificar
    pending_ratings = db.activities.count_documents({
        "user_id": current_user.get("partner_id", ""),
        "is_pending_rating": True
    })
    
    # Obtener estados de ánimo
    user_mood = db.moods.find_one({"user_id": current_user["id"], "date": date})
    partner_mood = db.moods.find_one({"user_id": current_user.get("partner_id", ""), "date": date})
    
    # Calcular puntaje solo de actividades calificadas
    completed_score = sum(
        activity.rating for activity in user_activities_response + partner_activities_response 
        if activity.rating is not None
    )
    
    return DailyStatsExpanded(
        date=date,
        user_activities=user_activities_response,
        partner_activities=partner_activities_response,
        pending_ratings_count=pending_ratings,
        user_mood=MoodResponse(**user_mood) if user_mood else None,
        partner_mood=MoodResponse(**partner_mood) if partner_mood else None,
        completed_activities_score=completed_score,
        total_activities=len(user_activities_response) + len(partner_activities_response)
    )

@app.get("/api/activities/pending-ratings")
async def get_pending_ratings(current_user = Depends(get_current_user)):
    """Obtiene actividades de la pareja que están pendientes de calificar"""
    if not current_user.get("partner_id"):
        return {"activities": [], "count": 0}
    
    pending_activities = list(db.activities.find({
        "user_id": current_user["partner_id"],
        "is_pending_rating": True
    }).sort("created_at", -1))
    
    activities_response = [ActivityResponse(**activity) for activity in pending_activities]
    
    return {
        "activities": activities_response,
        "count": len(activities_response)
    }

# Endpoints para Estado de Ánimo
@app.post("/api/mood")
async def create_mood(mood_data: MoodCreate, current_user = Depends(get_current_user)):
    if not (1 <= mood_data.mood_level <= 5):
        raise HTTPException(status_code=400, detail="El nivel de ánimo debe estar entre 1 y 5")
    
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Verificar si ya existe un estado de ánimo para hoy
    existing_mood = db.moods.find_one({"user_id": current_user["id"], "date": today})
    
    mood_id = str(uuid.uuid4())
    mood_doc = {
        "id": mood_id,
        "user_id": current_user["id"],
        "mood_level": mood_data.mood_level,
        "mood_emoji": mood_data.mood_emoji,
        "note": mood_data.note,
        "date": today,
        "created_at": datetime.now(timezone.utc)
    }
    
    if existing_mood:
        # Actualizar estado de ánimo existente
        db.moods.update_one(
            {"user_id": current_user["id"], "date": today},
            {"$set": mood_doc}
        )
        message = "Estado de ánimo actualizado exitosamente"
    else:
        # Crear nuevo estado de ánimo
        db.moods.insert_one(mood_doc)
        message = "Estado de ánimo registrado exitosamente"
    
    return {
        "message": message,
        "mood": MoodResponse(**mood_doc)
    }

@app.get("/api/mood/weekly/{start_date}")
async def get_weekly_moods(start_date: str, current_user = Depends(get_current_user)):
    try:
        start_dt = datetime.fromisoformat(start_date).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    week_dates = [(start_dt + timedelta(days=i)).isoformat() for i in range(7)]
    
    user_moods = []
    partner_moods = []
    
    for date in week_dates:
        user_mood = db.moods.find_one({"user_id": current_user["id"], "date": date})
        user_moods.append(MoodResponse(**user_mood) if user_mood else None)
        
        if current_user.get("partner_id"):
            partner_mood = db.moods.find_one({"user_id": current_user["partner_id"], "date": date})
            partner_moods.append(MoodResponse(**partner_mood) if partner_mood else None)
        else:
            partner_moods.append(None)
    
    return {
        "start_date": start_date,
        "user_moods": user_moods,
        "partner_moods": partner_moods,
        "dates": week_dates
    }

# Endpoints para Recuerdos Especiales
@app.get("/api/memories/special")
async def get_special_memories(current_user = Depends(get_current_user)):
    """Obtiene recuerdos aleatorios de actividades con 5 estrellas"""
    if not current_user.get("partner_id"):
        return {"memories": [], "message": "Necesitas tener pareja vinculada para ver recuerdos"}
    
    # Buscar actividades de ambos con 5 estrellas
    five_star_activities = list(db.activities.find({
        "$and": [
            {
                "$or": [
                    {"user_id": current_user["id"]},
                    {"user_id": current_user["partner_id"]}
                ]
            },
            {"rating": 5},
            {"is_pending_rating": False}
        ]
    }))
    
    if not five_star_activities:
        return {
            "memories": [],
            "message": "Aún no tienes recuerdos especiales. ¡Sigue creando momentos de 5 estrellas!"
        }
    
    # Seleccionar aleatoriamente hasta 5 actividades
    selected_activities = random.sample(
        five_star_activities, 
        min(5, len(five_star_activities))
    )
    
    memories = []
    for activity in selected_activities:
        activity_date = datetime.fromisoformat(activity["date"]).date()
        today = datetime.now(timezone.utc).date()
        days_ago = (today - activity_date).days
        
        # Crear mensaje personalizado
        if activity["user_id"] == current_user["id"]:
            memory_message = f"¡Recuerda cuando hiciste esto por tu pareja hace {days_ago} días! Tu pareja lo amó ⭐⭐⭐⭐⭐"
        else:
            memory_message = f"¡Recuerda este hermoso gesto de tu pareja hace {days_ago} días! ⭐⭐⭐⭐⭐"
        
        memories.append(MemoryResponse(
            activity=ActivityResponse(**activity),
            days_ago=days_ago,
            memory_message=memory_message
        ))
    
    return {
        "memories": memories,
        "total_five_star_activities": len(five_star_activities),
        "message": f"¡Tienes {len(five_star_activities)} recuerdos especiales de 5 estrellas!"
    }

@app.get("/api/memories/filter")
async def get_filtered_memories(
    days_back: int = 30,
    category: Optional[str] = None,
    current_user = Depends(get_current_user)
):
    """Obtiene recuerdos filtrados por período y categoría"""
    if not current_user.get("partner_id"):
        raise HTTPException(status_code=400, detail="Necesitas tener pareja vinculada")
    
    # Calcular fecha límite
    limit_date = (datetime.now(timezone.utc).date() - timedelta(days=days_back)).isoformat()
    
    # Construir filtros
    filters = {
        "$and": [
            {
                "$or": [
                    {"user_id": current_user["id"]},
                    {"user_id": current_user["partner_id"]}
                ]
            },
            {"rating": 5},
            {"is_pending_rating": False},
            {"date": {"$gte": limit_date}}
        ]
    }
    
    if category and category != "all":
        filters["$and"].append({"category": category})
    
    activities = list(db.activities.find(filters).sort("date", -1))
    
    memories = []
    for activity in activities:
        activity_date = datetime.fromisoformat(activity["date"]).date()
        today = datetime.now(timezone.utc).date()
        days_ago = (today - activity_date).days
        
        if activity["user_id"] == current_user["id"]:
            memory_message = f"Tu gesto especial hace {days_ago} días"
        else:
            memory_message = f"Gesto especial de tu pareja hace {days_ago} días"
        
        memories.append(MemoryResponse(
            activity=ActivityResponse(**activity),
            days_ago=days_ago,
            memory_message=memory_message
        ))
    
    return {
        "memories": memories,
        "filter_applied": {
            "days_back": days_back,
            "category": category or "all"
        },
        "total_found": len(memories)
    }

# Endpoints de estadísticas expandidas
@app.get("/api/stats/correlation")
async def get_mood_activity_correlation(current_user = Depends(get_current_user)):
    """Correlaciona actividades con mejoras en el estado de ánimo"""
    if not current_user.get("partner_id"):
        return {"correlation": [], "message": "Necesitas pareja vinculada para ver correlaciones"}
    
    # Obtener datos de los últimos 30 días
    end_date = datetime.now(timezone.utc).date()
    start_date = end_date - timedelta(days=30)
    
    correlation_data = []
    for i in range(30):
        date = (start_date + timedelta(days=i)).isoformat()
        
        # Estado de ánimo de la pareja ese día
        partner_mood = db.moods.find_one({"user_id": current_user["partner_id"], "date": date})
        
        # Actividades del usuario hacia la pareja ese día
        user_activities = list(db.activities.find({
            "user_id": current_user["id"],
            "date": date,
            "rating": {"$exists": True, "$ne": None}
        }))
        
        if partner_mood and user_activities:
            avg_activity_rating = sum(act["rating"] for act in user_activities) / len(user_activities)
            
            correlation_data.append({
                "date": date,
                "partner_mood_level": partner_mood["mood_level"],
                "your_activities_avg_rating": avg_activity_rating,
                "activities_count": len(user_activities)
            })
    
    return {
        "correlation_data": correlation_data,
        "period_days": 30,
        "message": f"Datos de correlación de los últimos 30 días ({len(correlation_data)} días con datos)"
    }

# Endpoints de gamificación expandida
@app.get("/api/achievements")
async def get_user_achievements(current_user = Depends(get_current_user)):
    """Obtiene logros y insignias del usuario"""
    # Calcular estadísticas para insignias
    total_activities = db.activities.count_documents({"user_id": current_user["id"]})
    five_star_activities = db.activities.count_documents({
        "user_id": current_user["id"],
        "rating": 5,
        "is_pending_rating": False
    })
    
    # Actividades por categoría
    categories = ["physical", "emotional", "practical", "general"]
    category_counts = {}
    for cat in categories:
        category_counts[cat] = db.activities.count_documents({
            "user_id": current_user["id"],
            "category": cat
        })
    
    # Verificar recuerdos revisados (simulado)
    memories_viewed = db.moods.count_documents({"user_id": current_user["id"]})
    
    # Generar insignias
    achievements = []
    
    if total_activities >= 10:
        achievements.append({
            "id": "first_steps",
            "name": "Primeros Pasos",
            "description": "Has registrado 10 actos de amor",
            "icon": "🎯",
            "unlocked_at": datetime.now(timezone.utc)
        })
    
    if five_star_activities >= 5:
        achievements.append({
            "id": "five_star_lover",
            "name": "Amante 5 Estrellas",
            "description": "Has recibido 5 calificaciones de 5 estrellas",
            "icon": "⭐",
            "unlocked_at": datetime.now(timezone.utc)
        })
    
    if category_counts["emotional"] >= 5:
        achievements.append({
            "id": "emotional_master",
            "name": "Maestro Emocional",
            "description": "Has registrado 5 actos emocionales",
            "icon": "💝",
            "unlocked_at": datetime.now(timezone.utc)
        })
    
    if memories_viewed >= 10:
        achievements.append({
            "id": "nostalgic_year",
            "name": "Nostálgico del Año",
            "description": "Has revisado muchos recuerdos especiales",
            "icon": "📸",
            "unlocked_at": datetime.now(timezone.utc)
        })
    
    return {
        "achievements": achievements,
        "stats": {
            "total_activities": total_activities,
            "five_star_activities": five_star_activities,
            "category_distribution": category_counts,
            "memories_engagement": memories_viewed
        }
    }

# Endpoint de salud
@app.get("/api/health")
async def health_check():
    return {
        "status": "healthy", 
        "message": "LoveActs API Expandida funcionando correctamente",
        "version": "2.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)