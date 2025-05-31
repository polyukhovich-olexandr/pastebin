# Використовуємо офіційний образ Node.js на базі Alpine Linux (легковісний)
FROM node:18-alpine

# Встановлюємо залежності для роботи з MySQL та інших системних пакетів
RUN apk add --no-cache python3 make g++

# Створюємо робочу директорію додатка
WORKDIR /app

# Копіюємо файли залежностей
COPY package.json package-lock.json ./

# Встановлюємо залежності проекту
RUN npm install --production

# Копіюємо всі файли проекту (крім вказаних в .dockerignore)
COPY . .

# Створюємо директорію для завантажень, якщо її немає
RUN mkdir -p /app/private/uploads

# Відкриваємо порт, на якому працює додаток
EXPOSE 8080

# Команда для запуску додатка
CMD ["node", "server.js"]