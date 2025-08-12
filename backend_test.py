#!/usr/bin/env python3
"""
Backend Testing Suite for LoveActs Application
Tests all critical backend functionality including authentication, partner linking, and activities.
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import sys
import os

# Backend URL from environment
BACKEND_URL = "https://pareja-app.preview.emergentagent.com/api"

class LoveActsBackendTester:
    def __init__(self):
        self.session = requests.Session()
        self.user1_token = None
        self.user2_token = None
        self.user1_data = None
        self.user2_data = None
        self.user1_partner_code = None
        self.user2_partner_code = None
        self.test_results = []
        
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
                if data.get("status") == "healthy":
                    self.log_result("Health Check", True, "API is healthy")
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
        # Test User 1 - Maria
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
    
    def test_duplicate_email_registration(self):
        """Test that duplicate email registration fails"""
        if not self.user1_data:
            self.log_result("Duplicate Email Test", False, "No user1 data available")
            return False
            
        duplicate_payload = {
            "name": "Another María",
            "email": self.user1_data["email"],
            "password": "DifferentPassword123!"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/register", json=duplicate_payload)
            if response.status_code == 400:
                self.log_result("Duplicate Email Test", True, "Correctly rejected duplicate email")
                return True
            else:
                self.log_result("Duplicate Email Test", False, f"Should have returned 400, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Duplicate Email Test", False, f"Request error: {str(e)}")
            return False
    
    def test_user_login(self):
        """Test user login functionality"""
        if not self.user1_data or not self.user2_data:
            self.log_result("User Login", False, "No user data available for login test")
            return False
        
        # Test User 1 login
        login1_payload = {
            "email": self.user1_data["email"],
            "password": "MiAmor2024!"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/login", json=login1_payload)
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.log_result("User Login (User 1)", True, "María logged in successfully")
                else:
                    self.log_result("User Login (User 1)", False, "Missing token or user data", data)
                    return False
            else:
                self.log_result("User Login (User 1)", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("User Login (User 1)", False, f"Request error: {str(e)}")
            return False
        
        # Test User 2 login
        login2_payload = {
            "email": self.user2_data["email"],
            "password": "NuestroAmor2024!"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/login", json=login2_payload)
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.log_result("User Login (User 2)", True, "Carlos logged in successfully")
                    return True
                else:
                    self.log_result("User Login (User 2)", False, "Missing token or user data", data)
                    return False
            else:
                self.log_result("User Login (User 2)", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("User Login (User 2)", False, f"Request error: {str(e)}")
            return False
    
    def test_invalid_login(self):
        """Test login with invalid credentials"""
        invalid_payload = {
            "email": "nonexistent@example.com",
            "password": "wrongpassword"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/login", json=invalid_payload)
            if response.status_code == 401:
                self.log_result("Invalid Login Test", True, "Correctly rejected invalid credentials")
                return True
            else:
                self.log_result("Invalid Login Test", False, f"Should have returned 401, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Invalid Login Test", False, f"Request error: {str(e)}")
            return False
    
    def test_get_current_user(self):
        """Test getting current user info with JWT token"""
        if not self.user1_token:
            self.log_result("Get Current User", False, "No user1 token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        try:
            response = self.session.get(f"{BACKEND_URL}/me", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "user" in data and data["user"]["id"] == self.user1_data["id"]:
                    self.log_result("Get Current User", True, "Successfully retrieved user info with JWT")
                    return True
                else:
                    self.log_result("Get Current User", False, "Invalid user data returned", data)
                    return False
            else:
                self.log_result("Get Current User", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get Current User", False, f"Request error: {str(e)}")
            return False
    
    def test_unauthorized_access(self):
        """Test that endpoints require valid JWT tokens"""
        try:
            # Test without token
            response = self.session.get(f"{BACKEND_URL}/me")
            if response.status_code == 403:
                self.log_result("Unauthorized Access (No Token)", True, "Correctly rejected request without token")
            else:
                self.log_result("Unauthorized Access (No Token)", False, f"Should have returned 403, got {response.status_code}")
                return False
            
            # Test with invalid token
            headers = {"Authorization": "Bearer invalid_token_here"}
            response = self.session.get(f"{BACKEND_URL}/me", headers=headers)
            if response.status_code == 401:
                self.log_result("Unauthorized Access (Invalid Token)", True, "Correctly rejected invalid token")
                return True
            else:
                self.log_result("Unauthorized Access (Invalid Token)", False, f"Should have returned 401, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Unauthorized Access", False, f"Request error: {str(e)}")
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
    
    def test_mutual_partner_linking(self):
        """Test that partner linking is mutual"""
        if not self.user1_token:
            self.log_result("Mutual Partner Linking", False, "No user1 token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        try:
            response = self.session.get(f"{BACKEND_URL}/me", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if data.get("partner_name") == "Carlos Rodríguez":
                    self.log_result("Mutual Partner Linking", True, "Partner linking is mutual - María sees Carlos as partner")
                    return True
                else:
                    self.log_result("Mutual Partner Linking", False, "Partner linking not mutual", data)
                    return False
            else:
                self.log_result("Mutual Partner Linking", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Mutual Partner Linking", False, f"Request error: {str(e)}")
            return False
    
    def test_invalid_partner_code(self):
        """Test linking with invalid partner code"""
        if not self.user1_token:
            self.log_result("Invalid Partner Code", False, "No user1 token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        invalid_payload = {"partner_code": "INVALID123"}
        
        try:
            response = self.session.post(f"{BACKEND_URL}/link-partner", json=invalid_payload, headers=headers)
            if response.status_code == 404:
                self.log_result("Invalid Partner Code", True, "Correctly rejected invalid partner code")
                return True
            else:
                self.log_result("Invalid Partner Code", False, f"Should have returned 404, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Invalid Partner Code", False, f"Request error: {str(e)}")
            return False
    
    def test_create_activities(self):
        """Test creating activities"""
        if not self.user1_token or not self.user2_token:
            self.log_result("Create Activities", False, "Missing user tokens")
            return False
        
        # User 1 creates activities
        activities_user1 = [
            {
                "description": "Le preparé el desayuno favorito en la cama",
                "category": "practical",
                "rating": 5,
                "time_of_day": "morning"
            },
            {
                "description": "Le di un abrazo largo y cálido",
                "category": "physical", 
                "rating": 4,
                "time_of_day": "evening"
            }
        ]
        
        headers1 = {"Authorization": f"Bearer {self.user1_token}"}
        
        for activity in activities_user1:
            try:
                response = self.session.post(f"{BACKEND_URL}/activities", json=activity, headers=headers1)
                if response.status_code != 200:
                    self.log_result("Create Activities (User 1)", False, f"HTTP {response.status_code}", response.text)
                    return False
            except Exception as e:
                self.log_result("Create Activities (User 1)", False, f"Request error: {str(e)}")
                return False
        
        # User 2 creates activities
        activities_user2 = [
            {
                "description": "Le escribí una nota de amor y la dejé en su bolso",
                "category": "emotional",
                "rating": 5,
                "time_of_day": "morning"
            },
            {
                "description": "Hicimos ejercicio juntos en el parque",
                "category": "physical",
                "rating": 4,
                "time_of_day": "afternoon"
            },
            {
                "description": "Cocinamos la cena juntos",
                "category": "practical",
                "rating": 3,
                "time_of_day": "evening"
            }
        ]
        
        headers2 = {"Authorization": f"Bearer {self.user2_token}"}
        
        for activity in activities_user2:
            try:
                response = self.session.post(f"{BACKEND_URL}/activities", json=activity, headers=headers2)
                if response.status_code != 200:
                    self.log_result("Create Activities (User 2)", False, f"HTTP {response.status_code}", response.text)
                    return False
            except Exception as e:
                self.log_result("Create Activities (User 2)", False, f"Request error: {str(e)}")
                return False
        
        self.log_result("Create Activities", True, "Successfully created activities for both users")
        return True
    
    def test_invalid_activity_rating(self):
        """Test creating activity with invalid rating"""
        if not self.user1_token:
            self.log_result("Invalid Activity Rating", False, "No user1 token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        invalid_activity = {
            "description": "Test activity",
            "category": "general",
            "rating": 6,  # Invalid - should be 1-5
            "time_of_day": "morning"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/activities", json=invalid_activity, headers=headers)
            if response.status_code == 400:
                self.log_result("Invalid Activity Rating", True, "Correctly rejected invalid rating")
                return True
            else:
                self.log_result("Invalid Activity Rating", False, f"Should have returned 400, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Invalid Activity Rating", False, f"Request error: {str(e)}")
            return False
    
    def test_get_daily_activities(self):
        """Test getting daily activities"""
        if not self.user1_token:
            self.log_result("Get Daily Activities", False, "No user1 token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        today = datetime.now().date().isoformat()
        
        try:
            response = self.session.get(f"{BACKEND_URL}/activities/daily/{today}", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "user_activities" in data and "partner_activities" in data:
                    user_count = len(data["user_activities"])
                    partner_count = len(data["partner_activities"])
                    user_score = data.get("user_score", 0)
                    partner_score = data.get("partner_score", 0)
                    
                    self.log_result("Get Daily Activities", True, 
                                  f"Retrieved daily activities - User: {user_count} activities (score: {user_score}), Partner: {partner_count} activities (score: {partner_score})")
                    return True
                else:
                    self.log_result("Get Daily Activities", False, "Missing activity data", data)
                    return False
            else:
                self.log_result("Get Daily Activities", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get Daily Activities", False, f"Request error: {str(e)}")
            return False
    
    def test_get_weekly_stats(self):
        """Test getting weekly statistics"""
        if not self.user1_token:
            self.log_result("Get Weekly Stats", False, "No user1 token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        # Get start of current week (Monday)
        today = datetime.now().date()
        start_of_week = today - timedelta(days=today.weekday())
        start_date = start_of_week.isoformat()
        
        try:
            response = self.session.get(f"{BACKEND_URL}/activities/weekly/{start_date}", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "daily_stats" in data and "weekly_summary" in data:
                    summary = data["weekly_summary"]
                    total_activities = summary.get("total_activities", 0)
                    user_score = summary.get("user_total_score", 0)
                    partner_score = summary.get("partner_total_score", 0)
                    
                    self.log_result("Get Weekly Stats", True, 
                                  f"Retrieved weekly stats - Total activities: {total_activities}, User score: {user_score}, Partner score: {partner_score}")
                    return True
                else:
                    self.log_result("Get Weekly Stats", False, "Missing weekly stats data", data)
                    return False
            else:
                self.log_result("Get Weekly Stats", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Get Weekly Stats", False, f"Request error: {str(e)}")
            return False
    
    def test_delete_activity(self):
        """Test deleting an activity"""
        if not self.user1_token:
            self.log_result("Delete Activity", False, "No user1 token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        # First create an activity to delete
        test_activity = {
            "description": "Actividad de prueba para eliminar",
            "category": "general",
            "rating": 3,
            "time_of_day": "afternoon"
        }
        
        try:
            # Create activity
            response = self.session.post(f"{BACKEND_URL}/activities", json=test_activity, headers=headers)
            if response.status_code != 200:
                self.log_result("Delete Activity", False, "Failed to create test activity")
                return False
            
            activity_data = response.json()
            activity_id = activity_data["activity"]["id"]
            
            # Delete activity
            response = self.session.delete(f"{BACKEND_URL}/activities/{activity_id}", headers=headers)
            if response.status_code == 200:
                self.log_result("Delete Activity", True, "Successfully deleted activity")
                return True
            else:
                self.log_result("Delete Activity", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Delete Activity", False, f"Request error: {str(e)}")
            return False
    
    def test_delete_nonexistent_activity(self):
        """Test deleting a non-existent activity"""
        if not self.user1_token:
            self.log_result("Delete Nonexistent Activity", False, "No user1 token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        fake_id = str(uuid.uuid4())
        
        try:
            response = self.session.delete(f"{BACKEND_URL}/activities/{fake_id}", headers=headers)
            if response.status_code == 404:
                self.log_result("Delete Nonexistent Activity", True, "Correctly returned 404 for non-existent activity")
                return True
            else:
                self.log_result("Delete Nonexistent Activity", False, f"Should have returned 404, got {response.status_code}")
                return False
        except Exception as e:
            self.log_result("Delete Nonexistent Activity", False, f"Request error: {str(e)}")
            return False
    
    def test_unlink_partner(self):
        """Test unlinking partners"""
        if not self.user1_token:
            self.log_result("Unlink Partner", False, "No user1 token available")
            return False
        
        headers = {"Authorization": f"Bearer {self.user1_token}"}
        
        try:
            response = self.session.delete(f"{BACKEND_URL}/unlink-partner", headers=headers)
            if response.status_code == 200:
                self.log_result("Unlink Partner", True, "Successfully unlinked partners")
                return True
            else:
                self.log_result("Unlink Partner", False, f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Unlink Partner", False, f"Request error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("=" * 60)
        print("🚀 STARTING LOVEACTS BACKEND TESTING SUITE")
        print("=" * 60)
        print(f"Testing backend at: {BACKEND_URL}")
        print()
        
        # Test sequence
        tests = [
            ("Health Check", self.test_health_check),
            ("User Registration", self.test_user_registration),
            ("Duplicate Email Registration", self.test_duplicate_email_registration),
            ("User Login", self.test_user_login),
            ("Invalid Login", self.test_invalid_login),
            ("Get Current User", self.test_get_current_user),
            ("Unauthorized Access", self.test_unauthorized_access),
            ("Partner Linking", self.test_partner_linking),
            ("Mutual Partner Linking", self.test_mutual_partner_linking),
            ("Invalid Partner Code", self.test_invalid_partner_code),
            ("Create Activities", self.test_create_activities),
            ("Invalid Activity Rating", self.test_invalid_activity_rating),
            ("Get Daily Activities", self.test_get_daily_activities),
            ("Get Weekly Stats", self.test_get_weekly_stats),
            ("Delete Activity", self.test_delete_activity),
            ("Delete Nonexistent Activity", self.test_delete_nonexistent_activity),
            ("Unlink Partner", self.test_unlink_partner),
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
        
        print("\n" + "=" * 60)
        print("📊 TESTING SUMMARY")
        print("=" * 60)
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if "❌ FAIL" in result["status"]:
                    print(f"   • {result['test']}: {result['message']}")
        
        print("\n" + "=" * 60)
        return passed, failed

def main():
    """Main test execution"""
    tester = LoveActsBackendTester()
    passed, failed = tester.run_all_tests()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()