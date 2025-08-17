#!/usr/bin/env python3
"""
Backend Testing Suite for LoveActs V2.0 Application
Tests all critical backend functionality including authentication, partner linking, activities,
rating system, mood tracking, special memories, and gamification.
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import sys
import os
import random

# Backend URL from environment
BACKEND_URL = "https://couples-app-1.preview.emergentagent.com/api"

class LoveActsV2BackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.user1_token = None
        self.user2_token = None
        self.user1_data = None
        self.user2_data = None
        self.user1_partner_code = None
        self.user2_partner_code = None
        self.test_results = []
        self.created_activities = []
        
    def log_result(self, test_name, success, message, details=None):
        """Log test results"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = {
            "test": test_name,
            "status": status,
            "message": message,
            "details": details or {}
        }
        self.test_results.append(result)
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def test_health_check(self):
        """Test health endpoint"""
        try:
            response = self.session.get(f"{BACKEND_URL}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy" and data.get("version") == "2.0.0":
                    self.log_result("Health Check", True, "API V2.0 is healthy")
                    return True
                else:
                    self.log_result("Health Check", False, "Unexpected health response", data)
                    return False
            else:
                self.log_result("Health Check", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Health Check", False, f"Connection error: {str(e)}")
            return False
    
    def test_user_registration(self):
        """Test user registration functionality"""
        # Test User 1 - María
        user1_payload = {
            "name": "María González",
            "email": f"maria.gonzalez.{uuid.uuid4().hex[:8]}@example.com",
            "password": "MiAmor2024!"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/register", json=user1_payload)
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.user1_token = data["token"]
                    self.user1_data = data["user"]
                    self.user1_partner_code = data["user"]["partner_code"]
                    self.log_result("User Registration (User 1)", True, f"María registered successfully with code {self.user1_partner_code}")
                else:
                    self.log_result("User Registration (User 1)", False, "Missing token or user data", data)
                    return False
            else:
                self.log_result("User Registration (User 1)", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("User Registration (User 1)", False, f"Request error: {str(e)}")
            return False
        
        # Test User 2 - Carlos
        user2_payload = {
            "name": "Carlos Rodríguez",
            "email": f"carlos.rodriguez.{uuid.uuid4().hex[:8]}@example.com", 
            "password": "NuestroAmor2024!"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/register", json=user2_payload)
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.user2_token = data["token"]
                    self.user2_data = data["user"]
                    self.user2_partner_code = data["user"]["partner_code"]
                    self.log_result("User Registration (User 2)", True, f"Carlos registered successfully with code {self.user2_partner_code}")
                    return True
                else:
                    self.log_result("User Registration (User 2)", False, "Missing token or user data", data)
                    return False
            else:
                self.log_result("User Registration (User 2)", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("User Registration (User 2)", False, f"Request error: {str(e)}")
            return False
    
    def test_partner_linking(self):
        """Test partner linking functionality"""
        if not self.user1_token or not self.user2_token or not self.user1_partner_code:
            self.log_result("Partner Linking", False, "Missing tokens or partner codes")
            return False
        
        # User 2 links to User 1 using User 1's partner code
        headers = {"Authorization": f"Bearer {self.user2_token}"}
        link_payload = {"partner_code": self.user1_partner_code}
        
        try:
            response = self.session.post(f"{BACKEND_URL}/link-partner", json=link_payload, headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "partner_name" in data and data["partner_name"] == "María González":
                    self.log_result("Partner Linking", True, "Carlos successfully linked to María")
                    return True
                else:
                    self.log_result("Partner Linking", False, "Unexpected response data", data)
                    return False
            else:
                self.log_result("Partner Linking", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Partner Linking", False, f"Request error: {str(e)}")
            return False
    
    def test_create_activities_v2(self):
        """Test creating activities with V2.0 structure (no rating initially)"""
        if not self.user1_token or not self.user2_token:
            self.log_result("Create Activities V2", False, "Missing user tokens")
            return False
        
        # User 1 creates activities (no rating - will be rated by partner)
        activities_user1 = [
            {
                "description": "Le preparé el desayuno favorito en la cama con flores",
                "category": "practical",
                "time_of_day": "morning"
            },
            {
                "description": "Le di un abrazo largo y cálido cuando llegó del trabajo",
                "category": "physical", 
                "time_of_day": "evening"
            },
            {
                "description": "Le escribí una carta de amor expresando mis sentimientos",
                "category": "emotional",
                "time_of_day": "afternoon"
            }
        ]
        
        headers1 = {"Authorization": f"Bearer {self.user1_token}"}
        
        for activity in activities_user1:
            try:
                response = self.session.post(f"{BACKEND_URL}/activities", json=activity, headers=headers1)
                if response.status_code == 200:
                    data = response.json()
                    if "activity" in data and data["activity"]["is_pending_rating"] == True:
                        self.created_activities.append(data["activity"]["id"])
                    else:
                        self.log_result("Create Activities V2 (User 1)", False, "Activity not marked as pending rating", data)
                        return False
                else:
                    self.log_result("Create Activities V2 (User 1)", False, f"HTTP {response.status_code}", response.text)
                    return False
            except Exception as e:
                self.log_result("Create Activities V2 (User 1)", False, f"Request error: {str(e)}")
                return False
        
        # User 2 creates activities
        activities_user2 = [
            {
                "description": "Organicé una cita sorpresa en nuestro lugar favorito",
                "category": "emotional",
                "time_of_day": "evening"
            },
            {
                "description": "Hicimos ejercicio juntos en el parque",
                "category": "physical",
                "time_of_day": "morning"
            }
        ]
        
        headers2 = {"Authorization": f"Bearer {self.user2_token}"}
        
        for activity in activities_user2:
            try:
                response = self.session.post(f"{BACKEND_URL}/activities", json=activity, headers=headers2)
                if response.status_code == 200:
                    data = response.json()
                    if "activity" in data and data["activity"]["is_pending_rating"] == True:
                        self.created_activities.append(data["activity"]["id"])
                    else:
                        self.log_result("Create Activities V2 (User 2)", False, "Activity not marked as pending rating", data)
                        return False
                else:
                    self.log_result("Create Activities V2 (User 2)", False, f"HTTP {response.status_code}", response.text)
                    return False
            except Exception as e:
                self.log_result("Create Activities V2 (User 2)", False, f"Request error: {str(e)}")
                return False
        
        self.log_result("Create Activities V2", True, f"Successfully created {len(self.created_activities)} activities, all pending rating")
        return True
    
    def test_rating_system(self):
        """Test the new rating system where partners rate activities"""
        if not self.user1_token or not self.user2_token or not self.created_activities:
            self.log_result("Rating System", False, "Missing tokens or activities to rate")
            return False
        
        # Get pending ratings for User 2 (should see User 1's activities)
        headers2 = {"Authorization": f"Bearer {self.user2_token}"}
        
        try:
            response = self.session.get(f"{BACKEND_URL}/activities/pending-ratings", headers=headers2)
            if response.status_code == 200:
                data = response.json()
                pending_activities = data.get("activities", [])
                if len(pending_activities) >= 3:  # User 1 created 3 activities
                    self.log_result("Get Pending Ratings", True, f"Found {len(pending_activities)} pending activities to rate")
                else:
                    self.log_result("Get Pending Ratings", False, f"Expected at least 3 pending activities, got {len(pending_activities)}")
                    return False
            else:
                self.log_result("Get Pending Ratings", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get Pending Ratings", False, f"Request error: {str(e)}")
            return False
        
        # Rate some activities
        ratings_to_test = [
            {"rating": 5, "comment": "¡Increíble! Me encantó el desayuno sorpresa"},
            {"rating": 4, "comment": "Muy dulce, me hizo sentir muy amada"},
            {"rating": 5, "comment": "La carta me hizo llorar de felicidad"}
        ]
        
        rated_count = 0
        for i, activity in enumerate(pending_activities[:3]):
            activity_id = activity["id"]
            rating_data = ratings_to_test[i]
            
            try:
                response = self.session.post(f"{BACKEND_URL}/activities/{activity_id}/rate", 
                                           json=rating_data, headers=headers2)
                if response.status_code == 200:
                    rated_count += 1
                else:
                    self.log_result("Rate Activity", False, f"HTTP {response.status_code}", response.text)
                    return False
            except Exception as e:
                self.log_result("Rate Activity", False, f"Request error: {str(e)}")
                return False
        
        # Test rating validation (invalid rating)
        try:
            invalid_rating = {"rating": 6, "comment": "Invalid rating"}
            response = self.session.post(f"{BACKEND_URL}/activities/{pending_activities[0]['id']}/rate", 
                                       json=invalid_rating, headers=headers2)
            if response.status_code == 400:
                self.log_result("Invalid Rating Validation", True, "Correctly rejected rating > 5")
            else:
                self.log_result("Invalid Rating Validation", False, f"Should reject rating > 5, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Invalid Rating Validation", False, f"Request error: {str(e)}")
            return False
        
        # Test duplicate rating prevention
        try:
            duplicate_rating = {"rating": 3, "comment": "Trying to rate again"}
            response = self.session.post(f"{BACKEND_URL}/activities/{pending_activities[0]['id']}/rate", 
                                       json=duplicate_rating, headers=headers2)
            if response.status_code == 400:
                self.log_result("Duplicate Rating Prevention", True, "Correctly prevented duplicate rating")
            else:
                self.log_result("Duplicate Rating Prevention", False, f"Should prevent duplicate rating, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Duplicate Rating Prevention", False, f"Request error: {str(e)}")
            return False
        
        self.log_result("Rating System", True, f"Successfully rated {rated_count} activities with validation working")
        return True
    
    def test_mood_system(self):
        """Test daily mood tracking system with new mood_id system"""
        if not self.user1_token or not self.user2_token:
            self.log_result("Mood System", False, "Missing user tokens")
            return False
        
        # Test creating moods with new mood_id system (string IDs instead of levels)
        moods_to_test = [
            {"mood_id": "happy", "mood_emoji": "🥰", "note": "¡Día increíble con mi pareja!"},
            {"mood_id": "content", "mood_emoji": "😊", "note": "Muy buen día, me siento feliz"},
            {"mood_id": "neutral", "mood_emoji": "😐", "note": "Día normal, nada especial"},
            {"mood_id": "horny", "mood_emoji": "😈", "note": "Feeling frisky today"},
            {"mood_id": "bored", "mood_emoji": "😴", "note": "Nothing exciting happening"},
            {"mood_id": "sleepy", "mood_emoji": "😪", "note": "Need more rest"}
        ]
        
        headers1 = {"Authorization": f"Bearer {self.user1_token}"}
        headers2 = {"Authorization": f"Bearer {self.user2_token}"}
        
        # Test various mood IDs for User 1
        for i, mood_data in enumerate(moods_to_test[:3]):
            try:
                response = self.session.post(f"{BACKEND_URL}/mood", json=mood_data, headers=headers1)
                if response.status_code == 200:
                    data = response.json()
                    if "mood_id" in data and data["mood_id"] == mood_data["mood_id"]:
                        self.log_result(f"Create Mood ID '{mood_data['mood_id']}' (User 1)", True, f"Successfully created mood with ID: {mood_data['mood_id']}")
                    else:
                        self.log_result(f"Create Mood ID '{mood_data['mood_id']}' (User 1)", False, "Invalid mood response", data)
                        return False
                else:
                    self.log_result(f"Create Mood ID '{mood_data['mood_id']}' (User 1)", False, f"HTTP {response.status_code}", response.text)
                    return False
            except Exception as e:
                self.log_result(f"Create Mood ID '{mood_data['mood_id']}' (User 1)", False, f"Request error: {str(e)}")
                return False
        
        # Test various mood IDs for User 2
        for i, mood_data in enumerate(moods_to_test[3:]):
            try:
                response = self.session.post(f"{BACKEND_URL}/mood", json=mood_data, headers=headers2)
                if response.status_code == 200:
                    data = response.json()
                    if "mood_id" in data and data["mood_id"] == mood_data["mood_id"]:
                        self.log_result(f"Create Mood ID '{mood_data['mood_id']}' (User 2)", True, f"Successfully created mood with ID: {mood_data['mood_id']}")
                    else:
                        self.log_result(f"Create Mood ID '{mood_data['mood_id']}' (User 2)", False, "Invalid mood response", data)
                        return False
                else:
                    self.log_result(f"Create Mood ID '{mood_data['mood_id']}' (User 2)", False, f"HTTP {response.status_code}", response.text)
                    return False
            except Exception as e:
                self.log_result(f"Create Mood ID '{mood_data['mood_id']}' (User 2)", False, f"Request error: {str(e)}")
                return False
        
        # Test updating existing mood (should update, not create new)
        try:
            updated_mood = {"mood_id": "excited", "mood_emoji": "🤩", "note": "Actualicé mi estado de ánimo"}
            response = self.session.post(f"{BACKEND_URL}/mood", json=updated_mood, headers=headers1)
            if response.status_code == 200:
                data = response.json()
                if data["mood_id"] == "excited":
                    self.log_result("Update Mood", True, "Successfully updated existing mood with new mood_id")
                else:
                    self.log_result("Update Mood", False, "Should have updated existing mood", data)
                    return False
            else:
                self.log_result("Update Mood", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Update Mood", False, f"Request error: {str(e)}")
            return False
        
        # Test empty mood_id validation
        try:
            invalid_mood = {"mood_id": "", "mood_emoji": "😊", "note": "Empty mood ID"}
            response = self.session.post(f"{BACKEND_URL}/mood", json=invalid_mood, headers=headers1)
            if response.status_code == 400:
                self.log_result("Empty Mood ID Validation", True, "Correctly rejected empty mood_id")
            else:
                self.log_result("Empty Mood ID Validation", False, f"Should reject empty mood_id, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Empty Mood ID Validation", False, f"Request error: {str(e)}")
            return False
        
        # Test missing mood_id validation
        try:
            invalid_mood = {"mood_emoji": "😊", "note": "Missing mood ID"}
            response = self.session.post(f"{BACKEND_URL}/mood", json=invalid_mood, headers=headers1)
            if response.status_code == 422:  # Pydantic validation error
                self.log_result("Missing Mood ID Validation", True, "Correctly rejected missing mood_id")
            else:
                self.log_result("Missing Mood ID Validation", False, f"Should reject missing mood_id, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Missing Mood ID Validation", False, f"Request error: {str(e)}")
            return False
        
        # Test weekly mood retrieval
        try:
            today = datetime.now().date()
            start_of_week = today - timedelta(days=today.weekday())
            start_date = start_of_week.isoformat()
            
            response = self.session.get(f"{BACKEND_URL}/mood/weekly/{start_date}", headers=headers1)
            if response.status_code == 200:
                data = response.json()
                if "user_moods" in data and "partner_moods" in data and "dates" in data:
                    # Check if moods contain mood_id field
                    user_moods = [mood for mood in data["user_moods"] if mood is not None]
                    if user_moods and all("mood_id" in mood for mood in user_moods):
                        self.log_result("Weekly Mood Retrieval", True, f"Retrieved weekly moods with mood_id for 7 days")
                    else:
                        self.log_result("Weekly Mood Retrieval", True, f"Retrieved weekly moods structure (no mood_id data yet)")
                else:
                    self.log_result("Weekly Mood Retrieval", False, "Missing weekly mood data", data)
                    return False
            else:
                self.log_result("Weekly Mood Retrieval", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Weekly Mood Retrieval", False, f"Request error: {str(e)}")
            return False
        
        self.log_result("Mood System", True, "All mood system tests passed with new mood_id system")
        return True
    
    def test_special_memories(self):
        """Test special memories system (5-star activities)"""
        if not self.user1_token or not self.user2_token:
            self.log_result("Special Memories", False, "Missing user tokens")
            return False
        
        headers1 = {"Authorization": f"Bearer {self.user1_token}"}
        
        # Test getting special memories
        try:
            response = self.session.get(f"{BACKEND_URL}/memories/special", headers=headers1)
            if response.status_code == 200:
                data = response.json()
                if "memories" in data:
                    memories = data["memories"]
                    if len(memories) > 0:
                        # Check if memories are 5-star activities
                        all_five_stars = all(memory["activity"]["rating"] == 5 for memory in memories)
                        if all_five_stars:
                            self.log_result("Special Memories Retrieval", True, f"Found {len(memories)} five-star memories")
                        else:
                            self.log_result("Special Memories Retrieval", False, "Not all memories are 5-star activities")
                            return False
                    else:
                        self.log_result("Special Memories Retrieval", True, "No memories yet (expected for new users)")
                else:
                    self.log_result("Special Memories Retrieval", False, "Missing memories data", data)
                    return False
            else:
                self.log_result("Special Memories Retrieval", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Special Memories Retrieval", False, f"Request error: {str(e)}")
            return False
        
        # Test filtered memories
        try:
            response = self.session.get(f"{BACKEND_URL}/memories/filter?days_back=30&category=emotional", headers=headers1)
            if response.status_code == 200:
                data = response.json()
                if "memories" in data and "filter_applied" in data:
                    filter_info = data["filter_applied"]
                    if filter_info["days_back"] == 30 and filter_info["category"] == "emotional":
                        self.log_result("Filtered Memories", True, f"Successfully filtered memories: {len(data['memories'])} found")
                    else:
                        self.log_result("Filtered Memories", False, "Filter not applied correctly", data)
                        return False
                else:
                    self.log_result("Filtered Memories", False, "Missing filtered memories data", data)
                    return False
            else:
                self.log_result("Filtered Memories", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Filtered Memories", False, f"Request error: {str(e)}")
            return False
        
        self.log_result("Special Memories", True, "Special memories system working correctly")
        return True
    
    def test_gamification_system(self):
        """Test gamification and achievements system"""
        if not self.user1_token:
            self.log_result("Gamification System", False, "Missing user token")
            return False
        
        headers1 = {"Authorization": f"Bearer {self.user1_token}"}
        
        # Test achievements endpoint
        try:
            response = self.session.get(f"{BACKEND_URL}/achievements", headers=headers1)
            if response.status_code == 200:
                data = response.json()
                if "achievements" in data and "stats" in data:
                    achievements = data["achievements"]
                    stats = data["stats"]
                    
                    # Check if stats contain expected fields
                    expected_stats = ["total_activities", "five_star_activities", "category_distribution"]
                    if all(field in stats for field in expected_stats):
                        self.log_result("Achievements System", True, f"Retrieved {len(achievements)} achievements and complete stats")
                    else:
                        self.log_result("Achievements System", False, "Missing expected stats fields", stats)
                        return False
                else:
                    self.log_result("Achievements System", False, "Missing achievements or stats data", data)
                    return False
            else:
                self.log_result("Achievements System", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Achievements System", False, f"Request error: {str(e)}")
            return False
        
        # Test correlation endpoint
        try:
            response = self.session.get(f"{BACKEND_URL}/stats/correlation", headers=headers1)
            if response.status_code == 200:
                data = response.json()
                if "correlation_data" in data and "period_days" in data:
                    if data["period_days"] == 30:
                        self.log_result("Mood-Activity Correlation", True, f"Retrieved correlation data for 30 days")
                    else:
                        self.log_result("Mood-Activity Correlation", False, "Incorrect period days", data)
                        return False
                else:
                    self.log_result("Mood-Activity Correlation", False, "Missing correlation data", data)
                    return False
            else:
                self.log_result("Mood-Activity Correlation", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Mood-Activity Correlation", False, f"Request error: {str(e)}")
            return False
        
        self.log_result("Gamification System", True, "Gamification system working correctly")
        return True
    
    def test_expanded_daily_activities(self):
        """Test expanded daily activities endpoint with moods and pending ratings"""
        if not self.user1_token:
            self.log_result("Expanded Daily Activities", False, "Missing user token")
            return False
        
        headers1 = {"Authorization": f"Bearer {self.user1_token}"}
        today = datetime.now().date().isoformat()
        
        try:
            response = self.session.get(f"{BACKEND_URL}/activities/daily/{today}", headers=headers1)
            if response.status_code == 200:
                data = response.json()
                expected_fields = ["user_activities", "partner_activities", "pending_ratings_count", 
                                 "user_mood", "partner_mood", "completed_activities_score", "total_activities"]
                
                if all(field in data for field in expected_fields):
                    pending_count = data["pending_ratings_count"]
                    total_activities = data["total_activities"]
                    score = data["completed_activities_score"]
                    
                    self.log_result("Expanded Daily Activities", True, 
                                  f"Retrieved expanded daily data: {total_activities} activities, {pending_count} pending ratings, score: {score}")
                    return True
                else:
                    missing_fields = [field for field in expected_fields if field not in data]
                    self.log_result("Expanded Daily Activities", False, f"Missing fields: {missing_fields}", data)
                    return False
            else:
                self.log_result("Expanded Daily Activities", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Expanded Daily Activities", False, f"Request error: {str(e)}")
            return False
    
    def test_authorization_security(self):
        """Test that partner-specific endpoints have proper authorization"""
        if not self.user1_token or not self.user2_token or not self.created_activities:
            self.log_result("Authorization Security", False, "Missing tokens or activities")
            return False
        
        # Test that User 1 cannot rate their own activities
        headers1 = {"Authorization": f"Bearer {self.user1_token}"}
        
        # Get User 1's own activities
        try:
            today = datetime.now().date().isoformat()
            response = self.session.get(f"{BACKEND_URL}/activities/daily/{today}", headers=headers1)
            if response.status_code == 200:
                data = response.json()
                user_activities = data.get("user_activities", [])
                
                if user_activities:
                    # Try to rate own activity (should fail)
                    own_activity_id = user_activities[0]["id"]
                    rating_data = {"rating": 5, "comment": "Trying to rate my own activity"}
                    
                    response = self.session.post(f"{BACKEND_URL}/activities/{own_activity_id}/rate", 
                                               json=rating_data, headers=headers1)
                    if response.status_code == 403:
                        self.log_result("Self-Rating Prevention", True, "Correctly prevented user from rating own activity")
                    else:
                        self.log_result("Self-Rating Prevention", False, f"Should prevent self-rating, got {response.status_code}")
                        return False
                else:
                    self.log_result("Self-Rating Prevention", True, "No activities to test self-rating (acceptable)")
            else:
                self.log_result("Authorization Security", False, f"Failed to get daily activities: {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Authorization Security", False, f"Request error: {str(e)}")
            return False
        
        self.log_result("Authorization Security", True, "Authorization security working correctly")
        return True
    
    def run_all_tests(self):
        """Run all backend tests for LoveActs V2.0"""
        print("=" * 70)
        print("🚀 STARTING LOVEACTS V2.0 BACKEND TESTING SUITE")
        print("=" * 70)
        print(f"Testing backend at: {BACKEND_URL}")
        print()
        
        # Test sequence for V2.0
        tests = [
            ("Health Check V2.0", self.test_health_check),
            ("User Registration", self.test_user_registration),
            ("Partner Linking", self.test_partner_linking),
            ("Create Activities V2", self.test_create_activities_v2),
            ("Rating System", self.test_rating_system),
            ("Mood System", self.test_mood_system),
            ("Special Memories", self.test_special_memories),
            ("Gamification System", self.test_gamification_system),
            ("Expanded Daily Activities", self.test_expanded_daily_activities),
            ("Authorization Security", self.test_authorization_security),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            print(f"\n🧪 Running: {test_name}")
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                self.log_result(test_name, False, f"Test execution error: {str(e)}")
                failed += 1
        
        print("\n" + "=" * 70)
        print("📊 LOVEACTS V2.0 TESTING SUMMARY")
        print("=" * 70)
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if "❌ FAIL" in result["status"]:
                    print(f"   • {result['test']}: {result['message']}")
        
        print("\n" + "=" * 70)
        return passed, failed

def main():
    """Main test execution"""
    tester = LoveActsV2BackendTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()