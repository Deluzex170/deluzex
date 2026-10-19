from unittest import TestCase
from unittest.mock import MagicMock, patch
import test_deployment as deployment
from app.api.endpoints import blogs, projects, hero_products, testimonials, wishlist, reviews, content, payments
from app.services import whatsapp


class RealDataOnlyTests(TestCase):
    request = deployment.DeploymentTests.request

    def test_empty_catalog_reads_never_seed_records(self):
        cases = [(blogs, "/blogs"), (projects, "/projects"), (hero_products, "/hero-products"),
                 (testimonials, "/testimonials"), (wishlist, "/user/wishlist?email=test@example.com"),
                 (reviews, "/reviews?product_id=product-with-no-reviews"), (content, "/content/homepage")]
        for module, route in cases:
            with self.subTest(route=route):
                database = MagicMock()
                database.site_content.find_one.return_value = None
                with patch.object(module, "db", database):
                    response = self.request("GET", "/api/v1" + route)
                self.assertEqual(response.status_code, 200, response.text)
                writes = [call for call in database.mock_calls if any(
                    operation in call[0] for operation in ("insert_one", "insert_many", "update_one", "delete_one"))]
                self.assertEqual(writes, [], route)
                if module is reviews:
                    self.assertEqual(response.json()["total_reviews"], 0)
                    self.assertEqual(response.json()["average_rating"], 0)

    def test_review_stats_count_only_stored_reviews(self):
        database = MagicMock()
        database.reviews.find.return_value.sort.return_value = [
            {"_id": "one", "rating": 5}, {"_id": "two", "rating": 3}]
        with patch.object(reviews, "db", database):
            stats = reviews.calculate_stats("real-product")
        self.assertEqual(stats["total_reviews"], 2)
        self.assertEqual(stats["average_rating"], 4)
        self.assertEqual(stats["breakdown"][5]["count"], 1)

    def test_missing_whatsapp_config_never_claims_delivery_or_returns_code(self):
        with patch.multiple(whatsapp.settings, WHATSAPP_ACCESS_TOKEN="", WHATSAPP_PHONE_NUMBER_ID=""):
            result = whatsapp.send_whatsapp_otp("+919876543210", "123456")
        self.assertFalse(result["success"])
        self.assertNotIn("123456", str(result))

    def test_removed_demo_generators_and_payment_approval_are_unavailable(self):
        for route in ("/analytics/seed-sample", "/audit/seed-sample", "/payments/confirm-upi-approval", "/payments/process-server-payment"):
            response = self.request("POST", "/api/v1" + route, json={})
            self.assertEqual(response.status_code, 404)

    def test_gateway_failure_does_not_create_an_invented_order(self):
        database = MagicMock()
        database.orders.find_one.return_value = None
        payload = {"email": "test@example.com", "phone": "+919876543210",
                   "shipping_address": {"first_name": "Test", "last_name": "Customer",
                       "street": "Test street", "city": "Test", "state": "Test", "pin_code": "380001"},
                   "items": [{"product_id": "real-product", "title": "Product", "price": 100, "quantity": 1}],
                   "subtotal": 100, "gst": 0, "delivery": 0, "total": 100, "upi_vpa": "customer@upi"}
        with patch.object(payments, "db", database), \
             patch.object(payments.razorpay_service, "create_razorpay_order", side_effect=RuntimeError("offline")):
            response = self.request("POST", "/api/v1/payments/initiate-upi", json=payload)
        self.assertEqual(response.status_code, 502, response.text)
        database.orders.insert_one.assert_not_called()
        database.orders.update_one.assert_not_called()
