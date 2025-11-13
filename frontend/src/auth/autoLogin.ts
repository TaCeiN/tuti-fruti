/**
 * Ожидает загрузки Max WebApp SDK и получения initData
 * Делает повторные попытки с интервалом
 * Увеличено время ожидания для надежной работы с медленной загрузкой SDK
 */
async function waitForInitData(maxAttempts: number = 30, intervalMs: number = 500): Promise<string | null> {
  const w = window as any
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    console.log(`[waitForInitData] Попытка ${attempt + 1}/${maxAttempts}`)
    
    // Проверяем все возможные источники
    const initData = getInitData()
    if (initData) {
      console.log(`[waitForInitData] ✅ initData найден на попытке ${attempt + 1}`)
      return initData
    }
    
    // Проверяем, загружается ли SDK
    if (w?.MaxWebApp || w?.Telegram?.WebApp || w?.Max?.WebApp) {
      console.log(`[waitForInitData] SDK обнаружен, но initData еще нет, ждем...`)
    }
    
    // Если это не последняя попытка, ждем перед следующей
    if (attempt < maxAttempts - 1) {
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }
  }
  
  console.log(`[waitForInitData] ❌ initData не найден после ${maxAttempts} попыток`)
  return null
}

/**
 * Получает initData из различных источников Max WebApp
 * Max открывает мини-приложение как обычную веб-страницу и передает данные через:
 * 1. URL параметры (?initData=... или другие параметры)
 * 2. postMessage от родительского окна
 * 3. window.MaxWebApp.initData (если SDK загружен)
 */
function getInitData(): string | null {
  const w = window as any
  
  console.log('[getInitData] Начинаем поиск initData...')
  console.log('[getInitData] window.location.href:', window.location.href)
  console.log('[getInitData] window.location.search:', window.location.search)
  console.log('[getInitData] window.location.hash:', window.location.hash)
  
  // 1. Попытка получить из Max WebApp SDK
  console.log('[getInitData] Проверяем window.MaxWebApp:', w?.MaxWebApp)
  if (w?.MaxWebApp?.initData) {
    console.log('[getInitData] ✅ Найден в window.MaxWebApp.initData')
    return w.MaxWebApp.initData
  }
  
  // Проверяем другие возможные пути к Max WebApp SDK
  if (w?.Telegram?.WebApp?.initData) {
    console.log('[getInitData] ✅ Найден в window.Telegram.WebApp.initData')
    return w.Telegram.WebApp.initData
  }
  
  if (w?.Max?.WebApp?.initData) {
    console.log('[getInitData] ✅ Найден в window.Max.WebApp.initData')
    return w.Max.WebApp.initData
  }
  
  // 1.5. Проверяем sessionStorage (может быть сохранен из postMessage)
  const fromPostMessage = sessionStorage.getItem('initData_from_postMessage')
  if (fromPostMessage) {
    console.log('[getInitData] ✅ Найден в sessionStorage (из postMessage)')
    return fromPostMessage
  }
  
  // 2. Попытка получить из URL параметров (самый частый случай для Max)
  const urlParams = new URLSearchParams(location.search)
  
  // Пробуем разные варианты названий параметров
  let fromUrl = urlParams.get('initData') || 
                urlParams.get('init_data') || 
                urlParams.get('data') ||
                urlParams.get('tgWebAppData') ||
                urlParams.get('webAppData')
  
  if (fromUrl) {
    console.log('[getInitData] ✅ ✅ Найден в URL параметрах')
    return decodeURIComponent(fromUrl)
  }
  
  // 3. Попытка получить из hash
  const hashParams = new URLSearchParams(location.hash.substring(1))
  const fromHash = hashParams.get('initData') || hashParams.get('init_data') || hashParams.get('data')
  if (fromHash) {
    console.log('[getInitData] ✅ Найден в hash')
    return decodeURIComponent(fromHash)
  }
  
  // 4. Попытка получить из window.location (полный URL может содержать initData)
  const fullUrl = window.location.href
  const urlMatch = fullUrl.match(/[?&#](?:initData|init_data|data|tgWebAppData|webAppData)=([^&?#]+)/i)
  if (urlMatch) {
    console.log('[getInitData] ✅ Найден в полном URL через regex')
    return decodeURIComponent(urlMatch[1])
  }
  
  // 5. Пробуем найти в любых параметрах URL (может быть в другом формате)
  const allParams = new URLSearchParams(fullUrl.split('?')[1] || '')
  for (const [key, value] of allParams.entries()) {
    const keyLower = key.toLowerCase()
    if (keyLower.includes('init') || keyLower.includes('data') || keyLower.includes('webapp')) {
      console.log(`[getInitData] Найден параметр ${key}, пробуем использовать...`)
      return decodeURIComponent(value)
    }
  }
  
  // 6. Проверяем, может быть данные переданы как часть query string без имени параметра
  // Например: ?user_id=123&first_name=John (прямые параметры пользователя)
  const userId = urlParams.get('user_id') || urlParams.get('user_id')
  if (userId) {
    console.log('[getInitData] Найден user_id в URL параметрах, формируем initData...')
    const firstName = urlParams.get('first_name') || urlParams.get('first_name') || ''
    const lastName = urlParams.get('last_name') || urlParams.get('last_name') || ''
    const username = urlParams.get('username') || urlParams.get('username') || ''
    
    // Формируем initData в формате URL-encoded
    const parts = [`user_id=${userId}`]
    if (firstName) parts.push(`first_name=${encodeURIComponent(firstName)}`)
    if (lastName) parts.push(`last_name=${encodeURIComponent(lastName)}`)
    if (username) parts.push(`username=${encodeURIComponent(username)}`)
    
    const constructed = parts.join('&')
    console.log('[getInitData] ✅ Сформирован initData из URL параметров:', constructed)
    return constructed
  }
  
  console.log('[getInitData] ❌ initData не найден ни в одном источнике')
  console.log('[getInitData] Все параметры URL:', Array.from(urlParams.entries()))
  console.log('[getInitData] Доступные объекты в window:', Object.keys(w).filter(k => {
    const kLower = k.toLowerCase()
    return kLower.includes('max') || kLower.includes('telegram') || kLower.includes('web')
  }))
  
  return null
}

/**
 * Пытается извлечь user_id из initData для логирования
 */
function extractUserIdFromInitData(initData: string): number | null {
  try {
    // Пытаемся распарсить как JSON
    if (initData.trim().startsWith('{')) {
      const data = JSON.parse(initData)
      return data.user?.user_id || data.user?.id || data.user_id || data.id || null
    }
    
    // Пытаемся распарсить как URL-encoded строку
    const params = new URLSearchParams(initData)
    const userStr = params.get('user')
    if (userStr) {
      try {
        const user = JSON.parse(userStr)
        return user.user_id || user.id || null
      } catch {
        // Если не JSON, пробуем найти user_id напрямую
        return params.get('user_id') ? parseInt(params.get('user_id')!) : null
      }
    }
    
    // Пробуем найти user_id напрямую в параметрах
    const userId = params.get('user_id')
    if (userId) {
      return parseInt(userId)
    }
    
    return null
  } catch (e) {
    console.warn('[autoLogin] Не удалось извлечь user_id из initData:', e)
    return null
  }
}

export async function autoLogin(waitForData: boolean = true): Promise<boolean> {
  console.log('[autoLogin] ========================================')
  console.log('[autoLogin] 🚀 Запуск autoLogin()')
  console.log('[autoLogin] ========================================')
  
  try {
    let initData: string | null = null
    
    // Сначала пробуем получить сразу
    initData = getInitData()
    
    // Если не найден и нужно ждать, делаем повторные попытки
    if (!initData && waitForData) {
      console.log('[autoLogin] ⚠️ initData не найден сразу, ожидаем загрузки SDK...')
      // Увеличено до 30 попыток по 500ms = до 15 секунд для надежной работы с медленной загрузкой SDK
      initData = await waitForInitData(30, 500)
    }
    
    // Для dev режима: если initData все еще не найден, пробуем использовать mock данные
    if (!initData) {
      console.log('[autoLogin] ⚠️ initData не найден после ожидания')
      console.log('[autoLogin] Пробуем использовать сохраненные данные для тестирования...')
      
      // Пробуем получить user_id из localStorage (если был сохранен ранее)
      const savedUserId = localStorage.getItem('dev_user_id')
      if (savedUserId) {
        console.log('[autoLogin] ✅ Найден сохраненный dev_user_id:', savedUserId)
        // Создаем mock initData с user_id в формате, который понимает бэкенд
        initData = `user_id=${savedUserId}&first_name=Dev&last_name=User`
        console.log('[autoLogin] Используем mock initData:', initData)
      } else {
        console.log('[autoLogin] ❌ initData не найден и нет сохраненного dev_user_id')
        console.log('[autoLogin] Для тестирования:')
        console.log('[autoLogin] 1. Откройте мини-приложение через Max бота, или')
        console.log('[autoLogin] 2. В консоли выполните: localStorage.setItem("dev_user_id", "5107783")')
        console.log('[autoLogin]    Затем перезагрузите страницу')
        return false
      }
    }
    
    if (!initData) {
      console.log('[autoLogin] ❌ initData не найден, авторизация невозможна')
      console.log('[autoLogin] Проверьте, что мини-приложение открыто через Max бота')
      return false
    }
    
    console.log('[autoLogin] ✅ initData найден, длина:', initData.length)
    console.log('[autoLogin] Первые 100 символов initData:', initData.substring(0, 100))

    // Пытаемся извлечь user_id для логирования
    const userId = extractUserIdFromInitData(initData)
    if (userId) {
      console.log(`[autoLogin] Найден user_id в initData: ${userId}`)
    }

    console.log('[autoLogin] Найден initData, отправляем на сервер для авторизации...')
    console.log('[autoLogin] Backend найдет пользователя в БД (сохранен при bot_started) и вернет токен')
    
    // Определяем API URL в зависимости от окружения
    const getApiUrl = (): string => {
      if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL
      }
      if (import.meta.env.DEV) {
        return 'http://localhost:8000'
      }
      return 'https://backend-devcore-max.cloudpub.ru'
    }
    
    const apiUrl = getApiUrl()
    const endpoint = `${apiUrl}/auth/webapp-init`
    console.log('[autoLogin] 📡 Отправляем запрос на:', endpoint)
    console.log('[autoLogin] Метод: POST')
    console.log('[autoLogin] Headers: Content-Type: application/json')
    
    const requestBody = JSON.stringify({ initData })
    console.log('[autoLogin] Body size:', requestBody.length, 'bytes')
    
    // Повторные попытки для временных ошибок сервера
    const MAX_RETRIES = 3
    let lastError: any = null
    
    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      try {
        if (retry > 0) {
          console.log(`[autoLogin] Повторная попытка ${retry + 1}/${MAX_RETRIES} через 1 секунду...`)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody
        })
        
        console.log('[autoLogin] 📥 Получен ответ от сервера')
        console.log('[autoLogin] Status:', res.status, res.statusText)
        console.log('[autoLogin] Response URL:', res.url)

        if (!res.ok) {
          const errorText = await res.text().catch(() => 'Unknown error')
          console.error(`[autoLogin] Ошибка ответа сервера (попытка ${retry + 1}/${MAX_RETRIES}):`, res.status, errorText)
          
          // Проверяем, является ли ошибка временной (502, 503, 504, 429)
          const isTemporaryError = res.status === 502 || res.status === 503 || res.status === 504 || res.status === 429
          
          if (isTemporaryError && retry < MAX_RETRIES - 1) {
            // Временная ошибка - пробуем еще раз
            console.log('[autoLogin] Временная ошибка сервера, повторяем попытку...')
            lastError = { status: res.status, errorText }
            continue
          } else {
            // Постоянная ошибка или все попытки исчерпаны
            if (res.status === 502) {
              console.error('[autoLogin] ❌ 502 Bad Gateway - сервер недоступен или перегружен')
              console.error('[autoLogin] Возможные причины:')
              console.error('[autoLogin] 1. Бэкенд не запущен или упал')
              console.error('[autoLogin] 2. Nginx не может подключиться к бэкенду')
              console.error('[autoLogin] 3. Бэкенд перегружен или не отвечает')
              console.error('[autoLogin] 4. Проблемы с сетью между nginx и бэкендом')
            }
            return false
          }
        }
        
        // Успешный ответ - обрабатываем токен
        const data = await res.json().catch(() => null)
        const token = data?.access_token
        if (!token) {
          console.error('[autoLogin] ❌ Токен не получен в ответе')
          console.error('[autoLogin] Ответ сервера:', data)
          return false
        }
        
        console.log('[autoLogin] ✅ Токен получен от сервера, длина:', token.length)
        console.log('[autoLogin] Первые 50 символов токена:', token.substring(0, 50) + '...')
        
        // Сохраняем токен в localStorage
        try {
          localStorage.setItem('token', token)
          console.log('[autoLogin] 🔐 Токен сохранен в localStorage')
          
          // Проверяем, что токен действительно сохранен
          const savedToken = localStorage.getItem('token')
          if (!savedToken || savedToken !== token) {
            console.error('[autoLogin] ❌ ОШИБКА: Токен не сохранен правильно в localStorage!')
            console.error('[autoLogin] Ожидаемый токен:', token.substring(0, 50))
            console.error('[autoLogin] Сохраненный токен:', savedToken ? savedToken.substring(0, 50) : 'null')
            return false
          }
          
          console.log('[autoLogin] ✅ Токен успешно сохранен и проверен в localStorage')
          console.log('[autoLogin] Пользователь найден в БД (был сохранен при bot_started)')
          
          // Небольшая задержка для гарантии сохранения токена перед возвратом
          await new Promise(resolve => setTimeout(resolve, 100))
          console.log('[autoLogin] Задержка завершена, токен гарантированно сохранен')
          
        } catch (e) {
          console.error('[autoLogin] ❌ Ошибка при сохранении токена в localStorage:', e)
          return false
        }
        
        // Получаем данные пользователя из БД (не критично для авторизации)
        try {
          console.log('[autoLogin] Запрашиваем данные пользователя из БД...')
          const userRes = await fetch(`${apiUrl}/auth/me`, {
            method: 'GET',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          })
          
          if (userRes.ok) {
            const userData = await userRes.json().catch(() => null)
            if (userData) {
              // Сохраняем данные пользователя в localStorage
              localStorage.setItem('user', JSON.stringify(userData))
              console.log('[autoLogin] ✅ Данные пользователя получены и сохранены:', userData)
              console.log(`[autoLogin] Пользователь: ${userData.username} (ID: ${userData.id}, UUID: ${userData.uuid})`)
            }
          } else {
            console.warn('[autoLogin] ⚠️ Не удалось получить данные пользователя:', userRes.status)
            // Не критично, токен уже сохранен
          }
        } catch (e) {
          console.warn('[autoLogin] ⚠️ Ошибка при получении данных пользователя:', e)
          // Не критично, токен уже сохранен, продолжаем работу
        }
        
        // Финальная проверка токена перед возвратом
        const finalTokenCheck = localStorage.getItem('token')
        if (!finalTokenCheck) {
          console.error('[autoLogin] ❌ КРИТИЧЕСКАЯ ОШИБКА: Токен исчез из localStorage!')
          return false
        }
        
        console.log('[autoLogin] ✅✅✅ Авторизация успешно завершена! Токен сохранен и проверен.')
        return true
        
      } catch (e) {
        console.error(`[autoLogin] Ошибка при запросе (попытка ${retry + 1}/${MAX_RETRIES}):`, e)
        lastError = e
        
        // Если это не последняя попытка и ошибка сети, пробуем еще раз
        if (retry < MAX_RETRIES - 1) {
          console.log('[autoLogin] Ошибка сети, повторяем попытку...')
          continue
        } else {
          console.error('[autoLogin] ❌ Все попытки исчерпаны, авторизация не удалась')
          return false
        }
      }
    }
    
    // Если дошли сюда, все попытки исчерпаны
    console.error('[autoLogin] ❌ Все попытки авторизации исчерпаны')
    return false
  } catch (e) {
    console.error('[autoLogin] ❌ Исключение:', e)
    return false
  }
}
