from copy import deepcopy
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from bson import ObjectId
import test_deployment as deployment
from test_deployment import main
from app.api import deps
from app.api.endpoints import email_templates as endpoints
from app.services import email_templates as templates, email


class Cursor(list):
    def sort(self, key, direction):
        return Cursor(sorted(self, key=lambda item: item[key], reverse=direction < 0))


class Collection:
    """Small database double; API and rendering share the same stored documents."""
    def __init__(self):
        self.items = []

    def matches(self, item, query):
        return all(item.get(key) != value["$ne"] if isinstance(value, dict)
                   else item.get(key) == value for key, value in query.items())

    def find(self, query):
        return Cursor(deepcopy([item for item in self.items if self.matches(item, query)]))

    def find_one(self, query):
        return next(iter(self.find(query)), None)

    def insert_one(self, doc):
        doc = deepcopy(doc)
        doc.setdefault("_id", ObjectId())
        self.items.append(doc)
        return SimpleNamespace(inserted_id=doc["_id"])

    def update_one(self, query, update, upsert=False):
        for item in self.items:
            if self.matches(item, query):
                item.update(deepcopy(update["$set"]))
                return SimpleNamespace(matched_count=1)
        if upsert:
            self.insert_one({**query, **update["$set"]})
        return SimpleNamespace(matched_count=0)

    def delete_many(self, query):
        before = len(self.items)
        self.items = [item for item in self.items if not self.matches(item, query)]
        return SimpleNamespace(deleted_count=before - len(self.items))

    delete_one = delete_many


class EmailTemplateTests(unittest.TestCase):
    request = deployment.DeploymentTests.request

    def setUp(self):
        database = SimpleNamespace(email_templates=Collection(), email_template_bindings=Collection())
        for module in (endpoints, templates):
            patcher = patch.object(module, "db", database)
            patcher.start(); self.addCleanup(patcher.stop)
        main.app.dependency_overrides[deps.get_current_active_admin] = lambda: SimpleNamespace(is_admin=True)
        self.addCleanup(main.app.dependency_overrides.clear)
        self.payload = {"name": "My verification", "subject": "Hi {{user_name}}",
                        "text_body": "Your code {{otp}}", "html_body": "<p>{{user_name}}: {{otp}}</p>",
                        "event": "verification"}

    def test_crud_assignment_render_and_default_fallback(self):
        first = self.request("POST", "/api/v1/email-templates", json=self.payload)
        self.assertEqual(first.status_code, 201, first.text)
        identifier = first.json()["id"]
        self.assertEqual(templates.render_email("verification", "654321", "A < B")["html_body"],
                         "<p>A &lt; B: 654321</p>")
        changed = {**self.payload, "name": "Second", "subject": "Updated"}
        second = self.request("POST", "/api/v1/email-templates", json=changed).json()
        items = self.request("GET", "/api/v1/email-templates").json()["items"]
        self.assertEqual(sum(item["event"] == "verification" for item in items), 1)
        self.assertEqual(templates.render_email("verification", "123456")["subject"], "Updated")
        changed["event"] = "password_reset"
        self.assertEqual(self.request("PUT", f"/api/v1/email-templates/{second['id']}", json=changed).status_code, 200)
        self.assertEqual(templates.render_email("verification", "123456")["subject"], "Your Deluzex verification code")
        self.assertEqual(self.request("DELETE", f"/api/v1/email-templates/{second['id']}").status_code, 204)
        self.assertEqual(templates.render_email("password_reset", "123456")["subject"], "Reset your Deluzex password")
        self.assertEqual(self.request("DELETE", f"/api/v1/email-templates/{identifier}").status_code, 204)
        self.assertEqual(self.request("GET", "/api/v1/email-templates").json()["items"], [])

    def test_preview_does_not_send_and_matches_delivery(self):
        self.request("POST", "/api/v1/email-templates", json=self.payload)
        with patch.object(email, "_send_smtp_message", return_value={"success": True}) as sender:
            preview = self.request("POST", "/api/v1/email-templates/preview", json=self.payload)
            self.assertEqual(preview.status_code, 200)
            sender.assert_not_called()
            email.send_verification_email("test@example.com", "123456", "Sample Customer")
        message = sender.call_args.args[0]
        self.assertEqual(message["Subject"], preview.json()["subject"])
        self.assertEqual(message.get_payload()[1].get_payload(decode=True).decode(), preview.json()["html_body"])

    def test_unknown_placeholder_and_missing_code_rejected(self):
        for changes in ({"subject": "{{secret}}"}, {"text_body": "No code"},
                        {"subject": "Hello\nBcc: bad@example.com"}, {"html_body": "{{invalid-token}}"}):
            response = self.request("POST", "/api/v1/email-templates", json={**self.payload, **changes})
            self.assertEqual(response.status_code, 422)

    def test_all_endpoints_require_admin(self):
        main.app.dependency_overrides.clear()
        requests = [("GET", ""), ("POST", ""), ("POST", "/preview"),
                    ("PUT", f"/{ObjectId()}"), ("DELETE", f"/{ObjectId()}")]
        for method, path in requests:
            self.assertEqual(self.request(method, "/api/v1/email-templates" + path, json=self.payload).status_code, 401)
        main.app.dependency_overrides[deps.get_current_active_user] = lambda: SimpleNamespace(is_admin=False)
        for method, path in requests:
            self.assertEqual(self.request(method, "/api/v1/email-templates" + path, json=self.payload).status_code, 403)
