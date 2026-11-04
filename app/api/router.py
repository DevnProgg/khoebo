from fastapi import APIRouter

from app.api.routes import (
    accounting,
    analytics,
    auth,
    businesses,
    inventory,
    reminders,
    reports,
    sales,
    tax,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(businesses.router)
api_router.include_router(inventory.router)
api_router.include_router(sales.router)
api_router.include_router(accounting.router)
api_router.include_router(reports.router)
api_router.include_router(analytics.router)
api_router.include_router(reminders.router)
api_router.include_router(tax.router)
