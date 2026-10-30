from fastapi import APIRouter

from app.api.endpoints import health, categories, products, projects, testimonials, newsletter, cart, auth, contact, payments, orders, hero_products, blogs, content, addresses, cards, wishlist, analytics, audit, reviews, collaborations, faqs, coupons, shiprocket, shipping_settings

from app.api.endpoints import email_templates

api_router = APIRouter()
api_router.include_router(email_templates.router, prefix="/email-templates", tags=["email templates"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(products.router, prefix="/products", tags=["products"])
api_router.include_router(reviews.router, prefix="/reviews", tags=["reviews"])
api_router.include_router(projects.router, prefix="/projects", tags=["projects"])
api_router.include_router(blogs.router, prefix="/blogs", tags=["blogs"])
api_router.include_router(testimonials.router, prefix="/testimonials", tags=["testimonials"])
api_router.include_router(newsletter.router, prefix="/newsletter", tags=["newsletter"])
api_router.include_router(cart.router, prefix="/cart", tags=["cart"])
api_router.include_router(contact.router, prefix="/contact", tags=["contact"])
api_router.include_router(payments.router, prefix="/payments", tags=["payments"])
api_router.include_router(orders.router, prefix="/orders", tags=["orders"])
api_router.include_router(shiprocket.router, prefix="/shiprocket", tags=["shiprocket"])
# api_router.include_router(hero_products.router, prefix="/hero-products", tags=["hero-products"])
api_router.include_router(content.router, prefix="/content", tags=["content"])
api_router.include_router(addresses.router, prefix="/user/addresses", tags=["addresses"])
api_router.include_router(addresses.router, prefix="/addresses", tags=["addresses"])
api_router.include_router(cards.router, prefix="/user/cards", tags=["cards"])
api_router.include_router(cards.router, prefix="/cards", tags=["cards"])
api_router.include_router(wishlist.router, prefix="/user/wishlist", tags=["wishlist"])
api_router.include_router(wishlist.router, prefix="/wishlist", tags=["wishlist"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(audit.router, prefix="/audit", tags=["audit"])
api_router.include_router(collaborations.router, prefix="/collaborations", tags=["collaborations"])
api_router.include_router(faqs.router, prefix="/faqs", tags=["faqs"])
api_router.include_router(coupons.router, prefix="/coupons", tags=["coupons"])
api_router.include_router(coupons.admin_router, prefix="/admin/coupons", tags=["admin-coupons"])
api_router.include_router(shipping_settings.router, prefix="/shipping-settings", tags=["shipping-settings"])



