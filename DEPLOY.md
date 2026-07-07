# 🚀 Развертывание на Render.com (Бесплатно!)

## За 3 шага:

### 1️⃣ Создайте GitHub аккаунт (если еще нет)
- Перейдите на https://github.com
- Регистрируйтесь

### 2️⃣ Загрузите код на GitHub

```bash
cd /Users/microlab/Downloads/sauna-app

# Инициализируем git (если еще не сделано)
git init
git add .
git commit -m "Initial commit: sauna rental app"

# Создайте репозиторий на GitHub и замените URL
git remote add origin https://github.com/YOUR_USERNAME/sauna-app.git
git branch -M main
git push -u origin main
```

### 3️⃣ Разверните на Render.com

1. Перейдите на https://render.com
2. Нажмите **Sign up** (используйте GitHub)
3. После входа нажмите **New +** → **Web Service**
4. Выберите ваш репозиторий `sauna-app`
5. Заполните:
   - **Name:** `sauna-rental`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free
6. Нажмите **Create Web Service**

### 4️⃣ Ждите развертывания (~2-3 минуты)

Получите ссылку: https://sauna-rental.onrender.com

---

## 📱 На iPhone

1. Safari → введите ссылку с Render.com
2. **Поделиться** → **На экран "Домой"** → **Добавить**
3. Готово! 🎉

---

## ⚠️ Бесплатный план:

- ✅ Полностью работает
- ⏸️ Может "уснуть" после 15 минут неактивности
- 📴 Offline все равно работает на iPhone!
- 🌍 Доступно везде
