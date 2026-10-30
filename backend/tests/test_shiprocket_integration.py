import pytest
from unittest.mock import MagicMock, patch
from bson import ObjectId

from app.services import shiprocket as sr
from app.services.shiprocket import ShiprocketWalletError, ShiprocketError


def test_get_wallet_balance_low():
    with patch.object(sr, "_request", return_value={"data": {"balance_amount": "0"}}):
        bal = sr.get_wallet_balance()
        assert bal["balance"] == 0.0
        assert bal["is_low"] is True
        assert bal["minimum_required"] == 100.0
        assert "billing/recharge" in bal["recharge_url"]


def test_get_wallet_balance_healthy():
    with patch.object(sr, "_request", return_value={"data": {"balance_amount": "500.50"}}):
        bal = sr.get_wallet_balance()
        assert bal["balance"] == 500.50
        assert bal["is_low"] is False


def test_get_pickup_locations_parsing():
    sample_res = {
        "data": {
            "shipping_address": [
                {
                    "id": 12345,
                    "pickup_location": "work",
                    "city": "Banaskantha",
                    "state": "Gujarat",
                    "pin_code": "385210",
                    "phone": "9909382031",
                    "name": "Warehouse",
                    "is_primary_location": 1,
                }
            ]
        }
    }
    with patch.object(sr, "_request", return_value=sample_res):
        locs = sr.get_pickup_locations()
        assert len(locs) == 1
        assert locs[0]["pickup_location"] == "work"
        assert locs[0]["is_primary"] is True


def test_generate_awb_wallet_error():
    err_res = {
        "status_code": 350,
        "message": "Please recharge your ShipRocket wallet. The minimum required balance is Rs 100",
        "awb_assign_status": 0,
        "response": {
            "data": {
                "courier_id": "",
                "awb_assign_error": "Please recharge your ShipRocket wallet. The minimum required balance is Rs 100",
            }
        },
    }
    with patch.object(sr, "_request", return_value=err_res):
        with pytest.raises(ShiprocketWalletError) as exc_info:
            sr.generate_awb(shipment_id=123456)
        assert "Minimum ₹100 required in Shiprocket wallet" in str(exc_info.value)


def test_generate_awb_success():
    ok_res = {
        "awb_assign_status": 1,
        "response": {
            "data": {
                "awb_code": "DEL123456789",
                "courier_name": "Delhivery Express",
                "courier_company_id": 51,
            }
        },
    }
    with patch.object(sr, "_request", return_value=ok_res):
        res = sr.generate_awb(shipment_id=123456, courier_id=51)
        assert res["awb_code"] == "DEL123456789"
        assert res["courier_name"] == "Delhivery Express"


def test_generate_label_url_validation():
    with patch.object(sr, "_request", return_value={"label_url": "https://s3.amazonaws.com/label.pdf"}):
        res = sr.generate_label(shipment_id=123456)
        assert res["label_url"] == "https://s3.amazonaws.com/label.pdf"

    # If label URL is missing, it should raise ShiprocketError rather than return invalid data
    with patch.object(sr, "_request", return_value={"label_created": 1, "message": "Pending"}):
        with pytest.raises(ShiprocketError):
            sr.generate_label(shipment_id=123456)

