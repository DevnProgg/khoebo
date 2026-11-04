import uuid

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.models.user import RefreshToken, User


def test_register_login_and_me(client: TestClient, session_factory: sessionmaker[Session]) -> None:
    email = f"new-{uuid.uuid4().hex[:8]}@example.com"
    register = client.post(
        "/api/v1/auth/register",
        json={"email": email.upper(), "full_name": "Ada Lovelace", "password": "Password123"},
    )
    assert register.status_code == 201, register.text
    body = register.json()
    assert body["email"] == email
    assert "hashed_password" not in body

    with session_factory() as session:
        user = session.scalar(select(User).where(User.email == email))
        assert user is not None
        assert user.hashed_password.startswith("$argon2")
        assert user.hashed_password != "Password123"

    login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Password123"}
    )
    assert login.status_code == 200
    tokens = login.json()
    assert tokens["token_type"] == "bearer"

    me = client.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"}
    )
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_phone_only_registration_and_login(client: TestClient) -> None:
    phone = f"+266 58{ uuid.uuid4().int % 10**7 :07d}"
    register = client.post(
        "/api/v1/auth/register",
        json={
            "email": "",
            "phone_number": phone,
            "full_name": "Phone Only",
            "password": "Password123",
        },
    )
    assert register.status_code == 201, register.text
    body = register.json()
    assert body["email"] is None
    assert body["phone_number"] == phone.replace("+", "").replace(" ", "")

    login = client.post(
        "/api/v1/auth/login",
        json={"identifier": phone, "password": "Password123"},
    )
    assert login.status_code == 200, login.text
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {login.json()['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] is None
    assert me.json()["phone_number"] == body["phone_number"]


def test_email_and_phone_can_both_be_registered(client: TestClient) -> None:
    email = f"both-{uuid.uuid4().hex[:8]}@example.com"
    phone = f"26659{uuid.uuid4().int % 10**7:07d}"
    register = client.post(
        "/api/v1/auth/register",
        json={
            "email": email,
            "phone_number": phone,
            "full_name": "Both Contacts",
            "password": "Password123",
        },
    )
    assert register.status_code == 201, register.text
    assert register.json()["email"] == email
    assert register.json()["phone_number"] == phone

    for identifier in (email, phone):
        login = client.post(
            "/api/v1/auth/login",
            json={"identifier": identifier, "password": "Password123"},
        )
        assert login.status_code == 200, (identifier, login.text)


def test_registration_requires_a_contact_method(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "",
            "phone_number": "",
            "full_name": "No Contact",
            "password": "Password123",
        },
    )
    assert response.status_code == 422


def test_duplicate_phone_registration_conflicts(client: TestClient) -> None:
    phone = f"26660{uuid.uuid4().int % 10**7:07d}"
    payload = {
        "phone_number": phone,
        "full_name": "Phone Dupe",
        "password": "Password123",
    }
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    duplicate = client.post(
        "/api/v1/auth/register",
        json={
            "phone_number": f"+{phone[:3]} {phone[3:6]} {phone[6:]}",
            "full_name": "Phone Dupe",
            "password": "Password123",
        },
    )
    assert duplicate.status_code == 409


def test_duplicate_registration_conflicts(client: TestClient) -> None:
    email = f"dupe-{uuid.uuid4().hex[:8]}@example.com"
    payload = {"email": email, "full_name": "Dupe", "password": "Password123"}
    assert client.post("/api/v1/auth/register", json=payload).status_code == 201
    assert client.post("/api/v1/auth/register", json=payload).status_code == 409


def test_weak_passwords_are_rejected(client: TestClient) -> None:
    for password in ["short1", "onlyletters", "12345678", "a1"]:
        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": f"weak-{uuid.uuid4().hex[:8]}@example.com",
                "full_name": "Weak",
                "password": password,
            },
        )
        assert response.status_code == 422, (password, response.text)


def test_invalid_credentials_are_rejected(client: TestClient, user_factory) -> None:
    user = user_factory()
    wrong = client.post(
        "/api/v1/auth/login", json={"email": user["email"], "password": "WrongPassword1"}
    )
    assert wrong.status_code == 401
    unknown = client.post(
        "/api/v1/auth/login",
        json={"email": "nobody@example.com", "password": "Password123"},
    )
    assert unknown.status_code == 401
    assert wrong.json()["detail"] == unknown.json()["detail"]


def test_authentication_is_required(client: TestClient) -> None:
    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        client.get(
            "/api/v1/auth/me", headers={"Authorization": "Bearer not-a-token"}
        ).status_code
        == 401
    )


def test_refresh_token_rotation_and_reuse_detection(
    client: TestClient, user_factory
) -> None:
    user = user_factory()
    original_refresh = user["refresh_token"]

    refreshed = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": original_refresh}
    )
    assert refreshed.status_code == 200, refreshed.text
    new_tokens = refreshed.json()
    assert new_tokens["refresh_token"] != original_refresh

    reused = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": original_refresh}
    )
    assert reused.status_code == 401

    second = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": new_tokens["refresh_token"]}
    )
    assert second.status_code == 200


def test_refresh_token_cannot_be_used_as_access_token(
    client: TestClient, user_factory
) -> None:
    user = user_factory()
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {user['refresh_token']}"},
    )
    assert response.status_code == 401


def test_logout_revokes_refresh_token(client: TestClient, user_factory) -> None:
    user = user_factory()
    response = client.post(
        "/api/v1/auth/logout", json={"refresh_token": user["refresh_token"]}
    )
    assert response.status_code == 204
    refresh = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": user["refresh_token"]}
    )
    assert refresh.status_code == 401


def test_change_password_revokes_sessions(client: TestClient, user_factory) -> None:
    user = user_factory()
    wrong = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "WrongPassword1", "new_password": "NewPassword123"},
        headers=user["headers"],
    )
    assert wrong.status_code == 400

    changed = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": user["password"], "new_password": "NewPassword123"},
        headers=user["headers"],
    )
    assert changed.status_code == 204

    old_login = client.post(
        "/api/v1/auth/login", json={"email": user["email"], "password": user["password"]}
    )
    assert old_login.status_code == 401
    new_login = client.post(
        "/api/v1/auth/login", json={"email": user["email"], "password": "NewPassword123"}
    )
    assert new_login.status_code == 200

    revoked = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": user["refresh_token"]}
    )
    assert revoked.status_code == 401


def test_deactivated_user_is_locked_out(
    client: TestClient, user_factory, session_factory: sessionmaker[Session]
) -> None:
    user = user_factory()
    with session_factory() as session:
        db_user = session.get(User, uuid.UUID(user["id"]))
        db_user.is_active = False
        session.commit()

    login = client.post(
        "/api/v1/auth/login",
        json={"email": user["email"], "password": user["password"]},
    )
    assert login.status_code == 403
    me = client.get("/api/v1/auth/me", headers=user["headers"])
    assert me.status_code == 403


def test_superuser_only_user_management(
    client: TestClient, user_factory, session_factory: sessionmaker[Session]
) -> None:
    normal = user_factory()
    assert client.get("/api/v1/users", headers=normal["headers"]).status_code == 403

    admin = user_factory()
    with session_factory() as session:
        db_admin = session.get(User, uuid.UUID(admin["id"]))
        db_admin.is_superuser = True
        session.commit()

    listing = client.get("/api/v1/users", headers=admin["headers"])
    assert listing.status_code == 200
    assert any(row["id"] == normal["id"] for row in listing.json())

    deactivate = client.patch(
        f"/api/v1/users/{normal['id']}/status",
        json={"is_active": False},
        headers=admin["headers"],
    )
    assert deactivate.status_code == 200
    assert deactivate.json()["is_active"] is False

    self_deactivate = client.patch(
        f"/api/v1/users/{admin['id']}/status",
        json={"is_active": False},
        headers=admin["headers"],
    )
    assert self_deactivate.status_code == 400


def test_refresh_tokens_are_hashed(
    client: TestClient, user_factory, session_factory: sessionmaker[Session]
) -> None:
    user = user_factory()
    with session_factory() as session:
        tokens = session.scalars(select(RefreshToken)).all()
        assert tokens
        assert all(token.token_hash != user["refresh_token"] for token in tokens)
        assert all(len(token.token_hash) == 64 for token in tokens)
