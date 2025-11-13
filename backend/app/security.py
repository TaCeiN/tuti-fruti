import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError, JWTClaimsError

from .core.config import settings

logger = logging.getLogger(__name__)


def create_access_token(subject: str, expires_minutes: Optional[int] = None) -> str:
    expire_delta = expires_minutes or settings.access_token_expire_minutes
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=expire_delta)
    to_encode = {"sub": subject, "exp": expire}
    
    logger.info(f"[create_access_token] Создание токена для user_id={subject}, expire_minutes={expire_delta}")
    logger.info(f"[create_access_token] Токен истечет: {expire}")
    
    token = jwt.encode(to_encode, settings.secret_key, algorithm="HS256")
    logger.info(f"[create_access_token] ✅ Токен создан, длина: {len(token)} символов")
    return token


def decode_access_token(token: str) -> dict:
    """
    Декодирует JWT токен с детальным логированием ошибок.
    """
    logger.info(f"[decode_access_token] Начало декодирования токена")
    logger.info(f"[decode_access_token] Длина токена: {len(token)} символов")
    logger.info(f"[decode_access_token] Токен (первые 30 символов): {token[:30]}...")
    logger.info(f"[decode_access_token] Токен (последние 10 символов): ...{token[-10:]}")
    logger.info(f"[decode_access_token] Используемый secret_key: {'установлен' if settings.secret_key else 'НЕ УСТАНОВЛЕН'}")
    if settings.secret_key:
        logger.info(f"[decode_access_token] Длина secret_key: {len(settings.secret_key)} символов")
    
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        logger.info(f"[decode_access_token] ✅ Токен успешно декодирован: {payload}")
        
        # Проверяем срок действия токена
        exp = payload.get("exp")
        if exp:
            exp_datetime = datetime.fromtimestamp(exp, tz=timezone.utc)
            now = datetime.now(tz=timezone.utc)
            time_until_expiry = exp_datetime - now
            logger.info(f"[decode_access_token] Токен истечет: {exp_datetime}")
            logger.info(f"[decode_access_token] Осталось времени: {time_until_expiry}")
            if time_until_expiry.total_seconds() < 0:
                logger.error(f"[decode_access_token] ❌ Токен уже истек! Время истечения: {exp_datetime}, сейчас: {now}")
        
        return payload
        
    except ExpiredSignatureError as e:
        logger.error(f"[decode_access_token] ❌ ОШИБКА: Токен истек: {e}")
        logger.error(f"[decode_access_token] Трассировка:\n{type(e).__name__}: {e}")
        raise
    except JWTClaimsError as e:
        logger.error(f"[decode_access_token] ❌ ОШИБКА: Неверные claims в токене: {e}")
        logger.error(f"[decode_access_token] Трассировка:\n{type(e).__name__}: {e}")
        raise
    except JWTError as e:
        logger.error(f"[decode_access_token] ❌ ОШИБКА: Ошибка JWT: {e}")
        logger.error(f"[decode_access_token] Тип ошибки: {type(e).__name__}")
        logger.error(f"[decode_access_token] Трассировка:\n{str(e)}")
        raise
    except Exception as e:
        logger.error(f"[decode_access_token] ❌ ОШИБКА: Неожиданная ошибка при декодировании токена: {e}")
        logger.error(f"[decode_access_token] Тип ошибки: {type(e).__name__}")
        import traceback
        logger.error(f"[decode_access_token] Трассировка:\n{traceback.format_exc()}")
        raise 


