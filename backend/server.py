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
from dotenv import load_dotenv

# Cargar variables de entorno
load_dotenv()

app = FastAPI(title="LoveActs API", version="1.0.0")

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
DB_NAME = os.environ.get('DB_NAME', 'loveacts_db')

client = MongoClient(MONGO_URL)
db = client[DB_NAME]

# Configuración JWT
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key-change-this-in-production')
JWT_ALGORITHM = 'HS256'

security = HTTPBearer()

# Modelos Pydantic
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
    created_at: datetime

class LinkPartnerRequest(BaseModel):
    partner_code: str

class ActivityCreate(BaseModel):
    description: str
    category: str = "general"  # general, physical, emotional, practical
    rating: int  # 1-5 estrellas
    time_of_day: Optional[str] = None

class ActivityResponse(BaseModel):
    id: str
    user_id: str
    user_name: str
    description: str
    category: str
    rating: int
    time_of_day: Optional[str]
    date: str
    created_at: datetime

class DailyStatsResponse(BaseModel):
    date: str
    user_activities: List[ActivityResponse]
    partner_activities: List[ActivityResponse]
    user_score: int
    partner_score: int
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
    except jwt.JWTError:
        raise HTTPException(status_code=401, detail="Token inválido")

def generate_partner_code() -> str:
    return str(uuid.uuid4())[:8].upper()

# Endpoints de autenticación
@app.post("/api/register")
async def register(user_data: UserCreate):
    # Verificar si el email ya existe
    existing_user = db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    
    # Crear nuevo usuario
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
    
    # Generar token
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
    
    return {
        "message": "Login exitoso",
        "token": token,
        "user": UserResponse(
            id=user["id"],
            name=user["name"],
            email=user["email"],
            partner_id=user.get("partner_id"),
            partner_code=user["partner_code"],
            created_at=user["created_at"]
        )
    }

@app.get("/api/me")
async def get_current_user_info(current_user = Depends(get_current_user)):
    partner_name = None
    if current_user.get("partner_id"):
        partner = db.users.find_one({"id": current_user["partner_id"]})
        partner_name = partner["name"] if partner else None
    
    return {
        "user": UserResponse(
            id=current_user["id"],
            name=current_user["name"],
            email=current_user["email"],
            partner_id=current_user.get("partner_id"),
            partner_code=current_user["partner_code"],
            created_at=current_user["created_at"]
        ),
        "partner_name": partner_name
    }

# Endpoints de vinculación de parejas
@app.post("/api/link-partner")
async def link_partner(request: LinkPartnerRequest, current_user = Depends(get_current_user)):
    if current_user.get("partner_id"):
        raise HTTPException(status_code=400, detail="Ya tienes una pareja vinculada")
    
    # Buscar usuario con el código
    partner = db.users.find_one({"partner_code": request.partner_code})
    if not partner:
        raise HTTPException(status_code=404, detail="Código de pareja no válido")
    
    if partner["id"] == current_user["id"]:
        raise HTTPException(status_code=400, detail="No puedes vincularte contigo mismo")
    
    if partner.get("partner_id"):
        raise HTTPException(status_code=400, detail="Esta persona ya tiene pareja vinculada")
    
    # Vincular parejas mutuamente
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

@app.delete("/api/unlink-partner")
async def unlink_partner(current_user = Depends(get_current_user)):
    if not current_user.get("partner_id"):
        raise HTTPException(status_code=400, detail="No tienes pareja vinculada")
    
    partner_id = current_user["partner_id"]
    
    # Desvincular parejas
    db.users.update_one(
        {"id": current_user["id"]},
        {"$set": {"partner_id": None}}
    )
    db.users.update_one(
        {"id": partner_id},
        {"$set": {"partner_id": None}}
    )
    
    return {"message": "Pareja desvinculada exitosamente"}

# Endpoints de actividades
@app.post("/api/activities")
async def create_activity(activity: ActivityCreate, current_user = Depends(get_current_user)):
    if not (1 <= activity.rating <= 5):
        raise HTTPException(status_code=400, detail="La calificación debe estar entre 1 y 5")
    
    activity_id = str(uuid.uuid4())
    today = datetime.now(timezone.utc).date().isoformat()
    
    new_activity = {
        "id": activity_id,
        "user_id": current_user["id"],
        "user_name": current_user["name"],
        "description": activity.description,
        "category": activity.category,
        "rating": activity.rating,
        "time_of_day": activity.time_of_day,
        "date": today,
        "created_at": datetime.now(timezone.utc)
    }
    
    db.activities.insert_one(new_activity)
    
    return {
        "message": "Actividad registrada exitosamente",
        "activity": ActivityResponse(**new_activity)
    }

@app.get("/api/activities/daily/{date}")
async def get_daily_activities(date: str, current_user = Depends(get_current_user)):
    try:
        # Validar formato de fecha
        datetime.fromisoformat(date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido (usar YYYY-MM-DD)")
    
    # Obtener actividades del usuario
    user_activities = list(db.activities.find({
        "user_id": current_user["id"],
        "date": date
    }))
    
    user_activities_response = [
        ActivityResponse(**activity) for activity in user_activities
    ]
    
    # Obtener actividades de la pareja (si existe)
    partner_activities_response = []
    if current_user.get("partner_id"):
        partner_activities = list(db.activities.find({
            "user_id": current_user["partner_id"],
            "date": date
        }))
        partner_activities_response = [
            ActivityResponse(**activity) for activity in partner_activities
        ]
    
    # Calcular puntajes
    user_score = sum(activity.rating for activity in user_activities_response)
    partner_score = sum(activity.rating for activity in partner_activities_response)
    
    return DailyStatsResponse(
        date=date,
        user_activities=user_activities_response,
        partner_activities=partner_activities_response,
        user_score=user_score,
        partner_score=partner_score,
        total_activities=len(user_activities_response) + len(partner_activities_response)
    )

@app.get("/api/activities/weekly/{start_date}")
async def get_weekly_stats(start_date: str, current_user = Depends(get_current_user)):
    try:
        start_dt = datetime.fromisoformat(start_date).date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Formato de fecha inválido")
    
    # Generar fechas de la semana
    week_dates = [(start_dt + timedelta(days=i)).isoformat() for i in range(7)]
    
    weekly_stats = []
    total_user_score = 0
    total_partner_score = 0
    total_activities = 0
    
    for date in week_dates:
        daily_stats = await get_daily_activities(date, current_user)
        weekly_stats.append(daily_stats)
        total_user_score += daily_stats.user_score
        total_partner_score += daily_stats.partner_score
        total_activities += daily_stats.total_activities
    
    return {
        "start_date": start_date,
        "daily_stats": weekly_stats,
        "weekly_summary": {
            "user_total_score": total_user_score,
            "partner_total_score": total_partner_score,
            "total_activities": total_activities,
            "average_daily_score": (total_user_score + total_partner_score) / 7
        }
    }

@app.delete("/api/activities/{activity_id}")
async def delete_activity(activity_id: str, current_user = Depends(get_current_user)):
    activity = db.activities.find_one({"id": activity_id})
    if not activity:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    
    if activity["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="No tienes permiso para eliminar esta actividad")
    
    db.activities.delete_one({"id": activity_id})
    return {"message": "Actividad eliminada exitosamente"}

# Endpoint de salud
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "message": "LoveActs API funcionando correctamente"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)