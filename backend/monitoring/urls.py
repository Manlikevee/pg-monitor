from django.urls import path

from .views import DatabaseCheckView

urlpatterns = [
    path("monitor/check/", DatabaseCheckView.as_view(), name="monitor-check"),
]
