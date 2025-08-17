#!/usr/bin/env python3
"""
Focused test for time_of_day field removal from activities
Tests that activities can be created with and without time_of_day field
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import sys
import os

# Backend URL from environment
BACKEND_URL = "https://couples-app-1.preview.emergentagent.com/api"

class TimeOfDayFieldTester:
    def __init__(self):
        self.session = requests.Session()
        self.user_token = None
        self.partner_token = None
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
    
    def setup_test_users(self):
        """Setup test users with provided credentials"""
        # Try to login with existing test user first
        login_payload = {
            "email": "test@example.com",
            "password": "password123"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/login", json=login_payload)
            if response.status_code == 200:
                data = response.json()
                self.user_token = data["token"]
                self.log_result("Login Test User", True, "Successfully logged in with test@example.com")
                return True
            else:
                # User doesn't exist, create it
                register_payload = {
                    "name": "Test User",
                    "email": "test@example.com",
                    "password": "password123"
                }
                
                response = self.session.post(f"{BACKEND_URL}/register", json=register_payload)
                if response.status_code == 200:
                    data = response.json()
                    self.user_token = data["token"]
                    self.log_result("Register Test User", True, "Successfully registered test@example.com")
                    return True
                else:
                    self.log_result("Setup Test User", False, f"Failed to register: {response.status_code}", response.text)
                    return False
        except Exception as e:
            self.log_result("Setup Test User", False, f"Request error: {str(e)}")
            return False
    
    def test_create_activity_without_time_of_day(self):
        """Test creating activities WITHOUT time_of_day field"""
        if not self.user_token:
            self.log_result("Create Activity Without time_of_day", False, "Missing user token")
            return False
        
        headers = {"Authorization": f"Bearer {self.user_token}"}
        
        # Activity without time_of_day field
        activity_payload = {
            "description": "Prepared a surprise dinner for my partner",
            "category": "practical"
            # Note: NO time_of_day field included
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/activities", json=activity_payload, headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "activity" in data:
                    activity = data["activity"]
                    # Check that activity was created successfully
                    if (activity["description"] == activity_payload["description"] and 
                        activity["category"] == activity_payload["category"]):
                        
                        # Check that time_of_day is None or not present
                        time_of_day = activity.get("time_of_day")
                        if time_of_day is None:
                            self.created_activities.append(activity["id"])
                            self.log_result("Create Activity Without time_of_day", True, 
                                          f"Successfully created activity without time_of_day (value: {time_of_day})")
                            return True
                        else:
                            self.log_result("Create Activity Without time_of_day", False, 
                                          f"Expected time_of_day to be None, got: {time_of_day}")
                            return False
                    else:
                        self.log_result("Create Activity Without time_of_day", False, 
                                      "Activity data doesn't match input", data)
                        return False
                else:
                    self.log_result("Create Activity Without time_of_day", False, 
                                  "Missing activity in response", data)
                    return False
            else:
                self.log_result("Create Activity Without time_of_day", False, 
                              f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Create Activity Without time_of_day", False, f"Request error: {str(e)}")
            return False
    
    def test_create_activity_with_time_of_day(self):
        """Test creating activities WITH time_of_day field"""
        if not self.user_token:
            self.log_result("Create Activity With time_of_day", False, "Missing user token")
            return False
        
        headers = {"Authorization": f"Bearer {self.user_token}"}
        
        # Activity with time_of_day field
        activity_payload = {
            "description": "Gave a warm hug when partner came home",
            "category": "physical",
            "time_of_day": "evening"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/activities", json=activity_payload, headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "activity" in data:
                    activity = data["activity"]
                    # Check that activity was created successfully with time_of_day
                    if (activity["description"] == activity_payload["description"] and 
                        activity["category"] == activity_payload["category"] and
                        activity["time_of_day"] == activity_payload["time_of_day"]):
                        
                        self.created_activities.append(activity["id"])
                        self.log_result("Create Activity With time_of_day", True, 
                                      f"Successfully created activity with time_of_day: {activity['time_of_day']}")
                        return True
                    else:
                        self.log_result("Create Activity With time_of_day", False, 
                                      "Activity data doesn't match input", data)
                        return False
                else:
                    self.log_result("Create Activity With time_of_day", False, 
                                  "Missing activity in response", data)
                    return False
            else:
                self.log_result("Create Activity With time_of_day", False, 
                              f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Create Activity With time_of_day", False, f"Request error: {str(e)}")
            return False
    
    def test_retrieve_daily_activities(self):
        """Test retrieving daily activities to ensure both types work"""
        if not self.user_token:
            self.log_result("Retrieve Daily Activities", False, "Missing user token")
            return False
        
        headers = {"Authorization": f"Bearer {self.user_token}"}
        today = datetime.now().date().isoformat()
        
        try:
            response = self.session.get(f"{BACKEND_URL}/activities/daily/{today}", headers=headers)
            if response.status_code == 200:
                data = response.json()
                if "user_activities" in data:
                    user_activities = data["user_activities"]
                    
                    # Check if we can find our created activities
                    found_without_time = False
                    found_with_time = False
                    
                    for activity in user_activities:
                        if activity["id"] in self.created_activities:
                            if activity["time_of_day"] is None:
                                found_without_time = True
                            elif activity["time_of_day"] == "evening":
                                found_with_time = True
                    
                    if found_without_time and found_with_time:
                        self.log_result("Retrieve Daily Activities", True, 
                                      f"Successfully retrieved {len(user_activities)} activities, including both with and without time_of_day")
                        return True
                    elif len(self.created_activities) == 0:
                        self.log_result("Retrieve Daily Activities", True, 
                                      f"Retrieved {len(user_activities)} activities (no test activities to verify)")
                        return True
                    else:
                        self.log_result("Retrieve Daily Activities", False, 
                                      f"Could not find created activities in daily response. Found: {found_without_time}, {found_with_time}")
                        return False
                else:
                    self.log_result("Retrieve Daily Activities", False, 
                                  "Missing user_activities in response", data)
                    return False
            else:
                self.log_result("Retrieve Daily Activities", False, 
                              f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Retrieve Daily Activities", False, f"Request error: {str(e)}")
            return False
    
    def test_activity_creation_edge_cases(self):
        """Test edge cases for activity creation"""
        if not self.user_token:
            self.log_result("Activity Creation Edge Cases", False, "Missing user token")
            return False
        
        headers = {"Authorization": f"Bearer {self.user_token}"}
        
        # Test with empty time_of_day
        activity_payload = {
            "description": "Sent a sweet good morning message",
            "category": "emotional",
            "time_of_day": ""  # Empty string
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/activities", json=activity_payload, headers=headers)
            if response.status_code == 200:
                data = response.json()
                activity = data.get("activity", {})
                time_of_day = activity.get("time_of_day")
                
                # Empty string should be preserved or converted to None
                if time_of_day == "" or time_of_day is None:
                    self.log_result("Empty time_of_day Test", True, 
                                  f"Successfully handled empty time_of_day (value: '{time_of_day}')")
                else:
                    self.log_result("Empty time_of_day Test", False, 
                                  f"Unexpected time_of_day value: '{time_of_day}'")
                    return False
            else:
                self.log_result("Empty time_of_day Test", False, 
                              f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Empty time_of_day Test", False, f"Request error: {str(e)}")
            return False
        
        # Test with null time_of_day explicitly
        activity_payload = {
            "description": "Made coffee for both of us",
            "category": "practical",
            "time_of_day": None  # Explicit null
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/activities", json=activity_payload, headers=headers)
            if response.status_code == 200:
                data = response.json()
                activity = data.get("activity", {})
                time_of_day = activity.get("time_of_day")
                
                if time_of_day is None:
                    self.log_result("Null time_of_day Test", True, 
                                  "Successfully handled explicit null time_of_day")
                else:
                    self.log_result("Null time_of_day Test", False, 
                                  f"Expected null, got: '{time_of_day}'")
                    return False
            else:
                self.log_result("Null time_of_day Test", False, 
                              f"HTTP {response.status_code}", response.text)
                return False
        except Exception as e:
            self.log_result("Null time_of_day Test", False, f"Request error: {str(e)}")
            return False
        
        self.log_result("Activity Creation Edge Cases", True, "All edge cases handled correctly")
        return True
    
    def run_time_of_day_tests(self):
        """Run all time_of_day related tests"""
        print("=" * 70)
        print("🧪 TESTING TIME_OF_DAY FIELD REMOVAL FROM ACTIVITIES")
        print("=" * 70)
        print(f"Testing backend at: {BACKEND_URL}")
        print("Testing with credentials: test@example.com / password123")
        print()
        
        # Test sequence
        tests = [
            ("Setup Test User", self.setup_test_users),
            ("Create Activity Without time_of_day", self.test_create_activity_without_time_of_day),
            ("Create Activity With time_of_day", self.test_create_activity_with_time_of_day),
            ("Retrieve Daily Activities", self.test_retrieve_daily_activities),
            ("Activity Creation Edge Cases", self.test_activity_creation_edge_cases),
        ]
        
        passed = 0
        failed = 0
        
        for test_name, test_func in tests:
            print(f"\n🔍 Running: {test_name}")
            try:
                if test_func():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                self.log_result(test_name, False, f"Test execution error: {str(e)}")
                failed += 1
        
        print("\n" + "=" * 70)
        print("📊 TIME_OF_DAY FIELD TESTING SUMMARY")
        print("=" * 70)
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        print(f"📈 Success Rate: {(passed/(passed+failed)*100):.1f}%")
        
        if failed > 0:
            print("\n🔍 FAILED TESTS:")
            for result in self.test_results:
                if "❌ FAIL" in result["status"]:
                    print(f"   • {result['test']}: {result['message']}")
        else:
            print("\n🎉 ALL TESTS PASSED!")
            print("✅ Activities can be created WITHOUT time_of_day field")
            print("✅ Activities can be created WITH time_of_day field") 
            print("✅ Daily activities retrieval works for both types")
            print("✅ Edge cases (empty/null time_of_day) handled correctly")
        
        print("\n" + "=" * 70)
        return passed, failed

def main():
    """Main test execution"""
    tester = TimeOfDayFieldTester()
    passed, failed = tester.run_time_of_day_tests()
    
    # Exit with appropriate code
    sys.exit(0 if failed == 0 else 1)

if __name__ == "__main__":
    main()