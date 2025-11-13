import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models.user import User
from .security import decode_access_token

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> User:
    """
    Получает текущего авторизованного пользователя из токена.
    Добавлено детальное логирование для отладки проблем с авторизацией.
    """
    logger.info("=" * 80)
    logger.info("[get_current_user] Начало проверки авторизации")
    logger.info(f"[get_current_user] Токен получен: {'ДА' if token else 'НЕТ'}")
    
    if token:
        logger.info(f"[get_current_user] Токен (первые 30 символов): {token[:30]}...")
        logger.info(f"[get_current_user] Токен (последние 10 символов): ...{token[-10:]}")
        logger.info(f"[get_current_user] Длина токена: {len(token)} символов")
    else:
        logger.error("[get_current_user] ❌ ОШИБКА: токен не получен из заголовка Authorization")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Токен не предоставлен. Пожалуйста, войдите заново."
        )
    
    try:
        logger.info("[get_current_user] Попытка декодирования токена...")
        payload = decode_access_token(token)
        logger.info(f"[get_current_user] ✅ Токен успешно декодирован: {payload}")
        
        user_id_str = payload.get("sub")
        logger.info(f"[get_current_user] user_id из токена (sub): {user_id_str} (тип: {type(user_id_str)})")
        
        if not user_id_str:
            logger.error("[get_current_user] ❌ ОШИБКА: поле 'sub' отсутствует в payload токена")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Токен не содержит идентификатор пользователя"
            )
        
        try:
            user_id = int(user_id_str)
            logger.info(f"[get_current_user] user_id преобразован в int: {user_id}")
        except (ValueError, TypeError) as e:
            logger.error(f"[get_current_user] ❌ ОШИБКА: не удалось преобразовать user_id в int: {e}")
            logger.error(f"[get_current_user] user_id_str: {user_id_str}, тип: {type(user_id_str)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail=f"Неверный формат идентификатора пользователя в токене: {user_id_str}"
            )
        
    except HTTPException:
        # Пробрасываем HTTPException дальше
        raise
    except Exception as e:
        logger.error(f"[get_current_user] ❌ ОШИБКА при декодировании токена: {e}")
        logger.error(f"[get_current_user] Тип ошибки: {type(e).__name__}")
        import traceback
        logger.error(f"[get_current_user] Трассировка:\n{traceback.format_exc()}")
        
        # Проверяем конкретные типы ошибок
        error_str = str(e).lower()
        if "expired" in error_str or "exp" in error_str:
            logger.error("[get_current_user] Причина: токен истек")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Токен истек. Пожалуйста, войдите заново."
            )
        elif "signature" in error_str or "invalid" in error_str:
            logger.error("[get_current_user] Причина: неверная подпись токена")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Неверный токен. Пожалуйста, войдите заново."
            )
        else:
            logger.error(f"[get_current_user] Причина: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, 
                detail="Не удалось проверить токен. Пожалуйста, войдите заново."
            )

    # Поиск пользователя в БД
    logger.info(f"[get_current_user] Поиск пользователя в БД с id={user_id}...")
    user = db.get(User, user_id)
    
    if user is None:
        logger.error(f"[get_current_user] ❌ ОШИБКА: пользователь с id={user_id} не найден в БД")
        # Проверяем, сколько пользователей в БД для отладки
        total_users = db.query(User).count()
        logger.error(f"[get_current_user] Всего пользователей в БД: {total_users}")
        # Показываем несколько последних пользователей для отладки
        if total_users > 0:
            last_users = db.query(User).order_by(User.id.desc()).limit(5).all()
            logger.error(f"[get_current_user] Последние 5 пользователей:")
            for u in last_users:
                logger.error(f"[get_current_user]   - id={u.id}, username={u.username}, uuid={u.uuid}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail=f"Пользователь с id={user_id} не найден в базе данных"
        )
    
    logger.info(f"[get_current_user] ✅ Пользователь найден: id={user.id}, username={user.username}, uuid={user.uuid}")
    logger.info("=" * 80)
    return user


