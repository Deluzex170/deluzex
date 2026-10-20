import unittest
import sys
import os
from bson import ObjectId
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from main import app
from app.core.database import db

client = TestClient(app)

class TestAdminContactInquiries(unittest.TestCase):
    def test_01_stats_endpoint(self):
        """Positive test: GET /api/v1/contact/stats returns proper breakdown"""
        response = client.get("/api/v1/contact/stats")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("total", data)
        self.assertIn("new", data)
        self.assertIn("contacted", data)
        self.assertIn("resolved", data)
        self.assertIn("archived", data)
        self.assertIsInstance(data["total"], int)

    def test_02_crud_workflow_with_status_and_delete(self):
        """Positive test: Create contact, update status, search/filter, and delete"""
        payload = {
            "name": "Lady Katherine Pendelton",
            "email": "katherine.pendelton@manor.co.uk",
            "phone": "+44 7700 900077",
            "message": "[Project Scope: Penthouse Chandelier]\nInquiry for bespoke crystal illumination.",
        }

        # 1. Create inquiry
        create_res = client.post("/api/v1/contact", json=payload)
        self.assertEqual(create_res.status_code, 200)
        created_data = create_res.json()
        inquiry_id = created_data.get("id") or created_data.get("_id")
        self.assertIsNotNone(inquiry_id)
        self.assertEqual(created_data["status"], "new")

        try:
            # 2. Search inquiry by name
            search_res = client.get(f"/api/v1/contact?search=Pendelton")
            self.assertEqual(search_res.status_code, 200)
            items = search_res.json()
            self.assertTrue(any(i.get("email") == payload["email"] for i in items))

            # 3. Update status to 'contacted'
            patch_res = client.patch(f"/api/v1/contact/{inquiry_id}/status", json={"status": "contacted"})
            self.assertEqual(patch_res.status_code, 200)
            self.assertEqual(patch_res.json()["status"], "contacted")

            # 4. Update status to 'resolved'
            patch_res2 = client.patch(f"/api/v1/contact/{inquiry_id}/status", json={"status": "resolved"})
            self.assertEqual(patch_res2.status_code, 200)
            self.assertEqual(patch_res2.json()["status"], "resolved")

            # 5. Filter by status 'resolved'
            filter_res = client.get("/api/v1/contact?status=resolved")
            self.assertEqual(filter_res.status_code, 200)
            resolved_items = filter_res.json()
            self.assertTrue(any(i.get("_id") == inquiry_id or i.get("id") == inquiry_id for i in resolved_items))

        finally:
            # 6. Delete inquiry
            del_res = client.delete(f"/api/v1/contact/{inquiry_id}")
            self.assertEqual(del_res.status_code, 200)
            self.assertTrue(del_res.json().get("success"))

    def test_03_negative_invalid_status_and_id(self):
        """Negative test: Invalid status strings and bad ObjectIds return 400 / 404"""
        # Invalid status
        res1 = client.patch(f"/api/v1/contact/{str(ObjectId())}/status", json={"status": "random_invalid_status"})
        self.assertEqual(res1.status_code, 400)
        self.assertIn("Invalid status", res1.json().get("detail", ""))

        # Invalid ObjectId format
        res2 = client.patch("/api/v1/contact/not-a-valid-id/status", json={"status": "contacted"})
        self.assertEqual(res2.status_code, 400)

        res3 = client.delete("/api/v1/contact/not-a-valid-id")
        self.assertEqual(res3.status_code, 400)

        # Non-existent valid ObjectId
        fake_id = str(ObjectId())
        res4 = client.patch(f"/api/v1/contact/{fake_id}/status", json={"status": "contacted"})
        self.assertEqual(res4.status_code, 404)

        res5 = client.delete(f"/api/v1/contact/{fake_id}")
        self.assertEqual(res5.status_code, 404)

if __name__ == "__main__":
    unittest.main()
