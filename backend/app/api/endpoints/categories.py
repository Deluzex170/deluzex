from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from typing import List, Optional
from bson import ObjectId
from app import models
from app.api.deps import get_current_active_admin
from app.services.imagekit import upload_image_to_imagekit
from app.core.database import db

router = APIRouter()

@router.get("", response_model=List[models.Category])
def read_categories(skip: int = 0, limit: int = 100):
    """
    Get all categories from MongoDB.
    """
    docs = list(db.categories.find().skip(skip).limit(limit))
    return [models.Category(**doc) for doc in docs]


@router.get("/{identifier}", response_model=models.Category)
def read_category(identifier: str):
    """
    Get a single category from MongoDB database by _id (ObjectId) or category_id or name.
    """
    doc = None
    if ObjectId.is_valid(identifier):
        doc = db.categories.find_one({"_id": ObjectId(identifier)})
    if not doc:
        doc = db.categories.find_one({"category_id": identifier})
    if not doc:
        doc = db.categories.find_one({"name": identifier})

    if not doc:
        raise HTTPException(status_code=404, detail="Category not found")

    return models.Category(**doc)


@router.post("", response_model=models.Category)
async def create_category(
    request: Request,
    name: Optional[str] = Form(None),
    category_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    image_file: Optional[UploadFile] = File(None),
    image: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    current_user: models.User = Depends(get_current_active_admin)
):
    """
    Create a new category in MongoDB. Supports both JSON and multipart form data.
    """
    content_type = request.headers.get("content-type", "")
    final_name = name
    final_cat_id = category_id
    final_desc = description
    final_img_url = image_url

    if "application/json" in content_type:
        try:
            body = await request.json()
            final_name = body.get("name", final_name)
            final_cat_id = body.get("category_id", final_cat_id)
            final_desc = body.get("description", final_desc)
            final_img_url = body.get("image_url", final_img_url)
        except Exception:
            pass

    if not final_name or not str(final_name).strip():
        raise HTTPException(status_code=422, detail="Category name is required.")

    upload_target = image_file or image
    if upload_target:
        try:
            final_img_url = await upload_image_to_imagekit(upload_target, folder="/categories")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Image upload failed: {str(e)}")

    cat_id = final_cat_id or str(final_name).strip().lower().replace(" ", "-")

    category_dict = {
        "name": str(final_name).strip(),
        "category_id": cat_id,
        "description": str(final_desc).strip() if final_desc else None,
        "image_url": final_img_url
    }
    
    result = db.categories.insert_one(category_dict)
    category_dict["_id"] = result.inserted_id
    return models.Category(**category_dict)


@router.put("/{identifier}", response_model=models.Category)
async def update_category(
    identifier: str,
    request: Request,
    name: Optional[str] = Form(None),
    category_id: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    image_file: Optional[UploadFile] = File(None),
    image_url: Optional[str] = Form(None),
    current_user: models.User = Depends(get_current_active_admin)
):
    """
    Update an existing category in MongoDB by _id (ObjectId) or category_id.
    Supports both JSON and multipart form data.
    """
    query = None
    if ObjectId.is_valid(identifier):
        query = {"_id": ObjectId(identifier)}
    else:
        query = {"category_id": identifier}

    doc = db.categories.find_one(query)
    if not doc:
        doc = db.categories.find_one({"name": identifier})
        if doc:
            query = {"_id": doc["_id"]}

    if not doc:
        raise HTTPException(status_code=404, detail="Category not found")

    content_type = request.headers.get("content-type", "")
    final_name = name
    final_cat_id = category_id
    final_desc = description
    final_img_url = image_url

    if "application/json" in content_type:
        try:
            body = await request.json()
            if "name" in body:
                final_name = body.get("name")
            if "category_id" in body:
                final_cat_id = body.get("category_id")
            if "description" in body:
                final_desc = body.get("description")
            if "image_url" in body:
                final_img_url = body.get("image_url")
        except Exception:
            pass

    updates = {}
    if final_name is not None:
        updates["name"] = str(final_name).strip()
    if final_cat_id is not None:
        updates["category_id"] = str(final_cat_id).strip()
    if final_desc is not None:
        updates["description"] = str(final_desc).strip()
    if final_img_url is not None:
        updates["image_url"] = final_img_url
    upload_target = image or image_file
    if upload_target:
        try:
            updates["image_url"] = await upload_image_to_imagekit(upload_target, folder="/categories")
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Image upload failed: {str(e)}")

    old_name = doc.get("name")
    if updates:
        db.categories.update_one({"_id": doc["_id"]}, {"$set": updates})
        # If the category name changed, cascade update all products tagged with old_name
        if "name" in updates and old_name and updates["name"] != old_name:
            db.products.update_many(
                {"product_category": old_name},
                {"$set": {"product_category": updates["name"]}}
            )
        doc = db.categories.find_one({"_id": doc["_id"]})

    return models.Category(**doc)


@router.delete("/{identifier}")
def delete_category(
    identifier: str,
    current_user: models.User = Depends(get_current_active_admin)
):
    """
    Delete a category from MongoDB database by _id (ObjectId) or category_id.
    """
    query = None
    if ObjectId.is_valid(identifier):
        query = {"_id": ObjectId(identifier)}
    else:
        query = {"category_id": identifier}

    result = db.categories.delete_one(query)
    if result.deleted_count == 0:
        result = db.categories.delete_one({"name": identifier})

    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")

    return {"message": "Category deleted successfully"}
