import os
import sys
import json
from datetime import datetime
from bson import json_util, ObjectId

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.core.database import db

def main():
    backup_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'backups')
    os.makedirs(backup_dir, exist_ok=True)

    all_orders = list(db.orders.find())
    target_id_str = "6ad8e0949d6876caffa72155"
    target_id = ObjectId(target_id_str)

    target_order = next((o for o in all_orders if str(o['_id']).endswith("ffa72155") or o['_id'] == target_id), None)
    if not target_order:
        print(f"ERROR: Target order {target_id_str} not found in database!")
        return

    print(f"Target order confirmed: {target_order['_id']} | Total: {target_order.get('total') or target_order.get('total_amount')}")

    # Save backup of all orders
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = os.path.join(backup_dir, f"orders_backup_all_{timestamp}.json")
    with open(backup_file, "w", encoding="utf-8") as f:
        f.write(json_util.dumps(all_orders, indent=2))
    print(f"Backup of all {len(all_orders)} orders saved to: {backup_file}")

    # Filter orders to delete
    to_delete_ids = [o['_id'] for o in all_orders if o['_id'] != target_order['_id']]
    print(f"Orders queued for deletion: {len(to_delete_ids)}")

    if to_delete_ids:
        delete_result = db.orders.delete_many({"_id": {"$in": to_delete_ids}})
        print(f"Successfully deleted {delete_result.deleted_count} orders from database.")

    # Verification
    remaining = list(db.orders.find())
    print(f"Current orders count in DB: {len(remaining)}")
    for r in remaining:
        print(f"  - Order _id: {r['_id']} | Total: {r.get('total') or r.get('total_amount')} | Created: {r.get('created_at')}")

if __name__ == "__main__":
    main()
