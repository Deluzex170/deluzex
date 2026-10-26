from app.models.category import Category
from app.models.product import Product
from app.models.project import Project
from app.models.blog import Blog
from app.models.testimonial import Testimonial
from app.models.newsletter import NewsletterSubscriber, NewsletterSubscriberCreate
from app.models.cart import CartItem
from app.models.user import User
from app.models.audit import AuditLog
from app.models.contact import ContactMessage, ContactMessageCreate
from app.models.order import Order
from app.models.hero_product import HeroProduct
from app.models.site_content import SiteContent
from app.models.address import Address
from app.models.payment_card import PaymentCard
from app.models.wishlist import WishlistItem
from app.models.visitor_log import VisitorLog
from app.models.review import Review
from app.models.collaboration import CollaborationSubmission
from app.models.faq import FAQItem
from app.models.coupon import Coupon

# For Alembic or Base.metadata.create_all() to discover the models
