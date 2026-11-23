# Лабораторная работа: развёртывание Strapi и PostgreSQL в Docker

## Описание проекта

Проект демонстрирует разработку и контейнеризацию системы управления контентом Strapi с использованием PostgreSQL.

Реализована база знаний сервисного центра по контрольно-кассовой технике, требованиям 54-ФЗ, системе маркировки «Честный ЗНАК» и ТС ПИоТ. Дополнительно создан статический веб-сайт, получающий опубликованные статьи через REST API Strapi.

## Используемые технологии

- Docker и Docker Compose
- Strapi 5
- PostgreSQL 16
- Node.js 24
- REST API
- HTML, CSS, JavaScript

## Архитектура

Приложение состоит из двух Docker-сервисов:

1. **db** — PostgreSQL для хранения данных.
2. **strapi** — CMS Strapi для управления статьями и изображениями.

Сервисы взаимодействуют через внешнюю сеть `lab-strapi-network`.

Для постоянного хранения данных используются два именованных тома:

- `lab-pgdata` — база данных PostgreSQL.
- `lab-strapi-uploads` — загруженные изображения Strapi.

PostgreSQL доступен только внутри сети Docker. Strapi доступен на локальном компьютере через порт 1337.

## Структура проекта

```text
DockerCompose/
├── compose.yaml
├── .gitignore
├── README.md
├── strapi-app/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── .env.example
│   ├── config/
│   ├── database/
│   ├── public/
│   ├── src/
│   ├── package.json
│   └── package-lock.json
└── site/
```

## Подготовка окружения

Необходимо установить Docker Desktop и запустить Docker Engine.

Создать локальный файл настроек Strapi:

```powershell
Copy-Item .\strapi-app\.env.example .\strapi-app\.env
```

Затем открыть `strapi-app/.env` и указать собственные секретные ключи Strapi и пароль PostgreSQL.

Файл `.env` содержит конфиденциальные настройки и не должен публиковаться в GitHub.

## Создание Docker-ресурсов

Перед первым запуском создать внешнюю сеть:

```powershell
docker network create lab-strapi-network
```

Создать именованные тома:

```powershell
docker volume create lab-pgdata
docker volume create lab-strapi-uploads
```

Эти команды выполняются один раз. Если ресурсы уже существуют, повторно создавать их не требуется.

## Сборка и запуск

Из корневой папки проекта выполнить:

```powershell
docker compose --env-file .\strapi-app\.env up -d --build
```

Проверить состояние контейнеров:

```powershell
docker compose --env-file .\strapi-app\.env ps
```

После запуска:

- Административная панель: http://localhost:1337/admin
- API статей: http://localhost:1337/api/articles?populate=*
- API категорий: http://localhost:1337/api/categories?populate=*

При первом запуске с пустой базой необходимо создать администратора, модели данных и контент. Демонстрационные записи не включены непосредственно в исходный код репозитория.

## Модель данных

### Article

Коллекция статей содержит название, текст, тип материала, дату, рейтинг, изображение и связь с категорией.

### Category

Коллекция категорий используется для классификации статей.

### Media Library

Изображения загружаются через Strapi. Метаданные сохраняются в PostgreSQL, а сами файлы — в томе `lab-strapi-uploads`.

## Демонстрационные данные

В Strapi создана база знаний по контрольно-кассовой технике и маркировке товаров.

### Опубликованные статьи

1. 54-ФЗ: основные требования к применению онлайн-касс.
2. «Честный ЗНАК»: как работает обязательная маркировка товаров.
3. Регистрация онлайн-кассы: ФН, ОФД и постановка на учёт в ФНС.
4. Разрешительный режим: проверка маркированных товаров на кассе.
5. ТС ПИоТ: назначение, требования и подключение к кассе.

### Категории

- ККТ и 54-ФЗ — 2 статьи.
- Маркировка — 2 статьи.
- ТС ПИоТ — 1 статья.

Каждая опубликованная статья содержит текстовый материал и тематическую обложку.

Дополнительно создан тестовый черновик «Проверка сохранности данных Docker Compose» с прикреплённым изображением для проверки работы PostgreSQL и Docker Volume.

Все опубликованные материалы доступны через REST API Strapi.

## Проверка PostgreSQL

Для просмотра опубликованных статей:

```powershell
docker compose --env-file .\strapi-app\.env exec -T db psql -U strapi_user -d strapi_lab -c "SELECT id, title, published_at FROM articles WHERE published_at IS NOT NULL ORDER BY id;"
```

Для просмотра загруженных файлов:

```powershell
docker compose --env-file .\strapi-app\.env exec -T db psql -U strapi_user -d strapi_lab -c "SELECT id, name, url FROM files ORDER BY id;"
```

## Проверка сохранности данных

В ходе лабораторной выполнены остановка и пересоздание контейнеров:

```powershell
docker compose --env-file .\strapi-app\.env down
docker compose --env-file .\strapi-app\.env up -d --no-build
```

После повторного запуска все пять опубликованных статей сохранились. Пять изображений возвращали HTTP 200.

Дополнительно проверена команда:

```powershell
docker compose --env-file .\strapi-app\.env down -v
```

При используемой конфигурации данные сохранились, поскольку оба тома объявлены как `external: true` и не управляются жизненным циклом Docker Compose.

Важно: явное удаление внешних томов через `docker volume rm` приведёт к потере хранящихся в них данных. Для восстановления необходима резервная копия.

## Результаты

- PostgreSQL успешно работает в контейнере.
- Strapi собран в production-режиме с помощью multi-stage Dockerfile.
- Docker Compose управляет двумя сервисами.
- Настроены healthcheck и зависимости запуска.
- Используется внешняя сеть Docker.
- Данные PostgreSQL и изображения размещены в именованных томах.
- Проверены REST API и административная панель.
- Подтверждена сохранность данных после пересоздания контейнеров.
- Проверены таблицы связей между статьями, категориями и изображениями.

## Остановка приложения

Остановить контейнеры:

```powershell
docker compose --env-file .\strapi-app\.env stop
```

Повторно запустить:

```powershell
docker compose --env-file .\strapi-app\.env start
```

Для удаления контейнеров без удаления внешних томов:

```powershell
docker compose --env-file .\strapi-app\.env down
```

