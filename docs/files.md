# Файлы репозитория Mapuga

Всего **57 файлов**. Сгенерировано командой `npm run docs:files`.

Точки входа: [личная Mapuga](../dist/index.html), [API-каталог](../dist/variants/index.html), [бизнес-демо](../dist/fleet-demo.html), [калькулятор](../dist/variants/calculator.html). HTML запускается через локальный сервер `npm start`; GitHub хранит исходники и сам по себе не запускает сервер.

| Файл | Назначение |
| --- | --- |
| [.gitignore](../.gitignore) | Исключает зависимости, ключи окружения, логи, локальные скриншоты и временный помощник публикации. |
| [README.md](../README.md) | Вход в проект: запуск, личная Mapuga, варианты API, отдельное бизнес-демо и ссылки на документацию. |
| [dist/app.js](../dist/app.js) | События и интерфейс личной Mapuga: адреса, остановки, карта, маршрут, сохранение и GPX. |
| [dist/config.js](../dist/config.js) | Публичные настройки сервисов базового прототипа; секретных API-ключей нет. |
| [dist/core.js](../dist/core.js) | Общая логика стран и городов, Photon/OSRM, валидация адресов, метрики, GPX. |
| [dist/country-picker.css](../dist/country-picker.css) | Оформление подсказок выбора страны. |
| [dist/fleet-core.js](../dist/fleet-core.js) | Модель локальных организаций, машин, рейсов, видимости, назначения и временной симуляции. |
| [dist/fleet-demo.css](../dist/fleet-demo.css) | Адаптивное оформление бизнес-демо, карточек, карты и форм. |
| [dist/fleet-demo.html](../dist/fleet-demo.html) | Отдельная страница организаций, автопарка, маршрутов и просмотра поставок. |
| [dist/fleet-demo.js](../dist/fleet-demo.js) | Интерфейс бизнес-демо, Photon/OSRM, карта, симуляция движения и синхронизация вкладок. |
| [dist/icon.svg](../dist/icon.svg) | Векторная иконка Mapuga. |
| [dist/index.html](../dist/index.html) | Основная бесплатная личная Mapuga: форма маршрута, карта и навигация. |
| [dist/navigation-session.js](../dist/navigation-session.js) | Сеанс GPS/демо, события позиции, таймеры и озвучивание. |
| [dist/navigation.css](../dist/navigation.css) | Оформление панели навигации. |
| [dist/navigation.js](../dist/navigation.js) | Подготовка маршрута и русские инструкции манёвров, сопоставление позиции с маршрутом. |
| [dist/providers/adapters.js](../dist/providers/adapters.js) | Подключение SDK и сервисов поиска, маршрута и отображения разных провайдеров. |
| [dist/providers/catalog.js](../dist/providers/catalog.js) | Требования, источники, функции и ограничения пяти API-профилей. |
| [dist/providers/data.js](../dist/providers/data.js) | Преобразование ответов Geoapify, Google, 2ГИС и Яндекса в общий формат. |
| [dist/providers/economics.js](../dist/providers/economics.js) | Формулы рекламной выручки, кредитов Geoapify и отдельных Google SKU. |
| [dist/styles.css](../dist/styles.css) | Основные стили личной Mapuga и адаптация к ширине экрана. |
| [dist/variants/2gis.html](../dist/variants/2gis.html) | Генерируемый 2ГИС-планировщик с ключами и локальным вариантом routing proxy. |
| [dist/variants/calculator.html](../dist/variants/calculator.html) | Генерируемая страница интерактивного калькулятора рекламы и API. |
| [dist/variants/calculator.js](../dist/variants/calculator.js) | Поля и пересчёт сценариев калькулятора, таблицы расходов и результата. |
| [dist/variants/geoapify.html](../dist/variants/geoapify.html) | Генерируемый Geoapify-вариант, форма ключа и требования Free/production. |
| [dist/variants/google.html](../dist/variants/google.html) | Генерируемый Google-планировщик, ключ, billing и требования Maps/Places/Routes. |
| [dist/variants/index.html](../dist/variants/index.html) | Генерируемый каталог сравнения пяти API-вариантов. |
| [dist/variants/lab.css](../dist/variants/lab.css) | Общие адаптивные стили API-каталога, планировщиков, калькулятора и страниц требований. |
| [dist/variants/lab.js](../dist/variants/lab.js) | Общий интерфейс пяти вариантов: выбор города/страны, ключи, адреса, остановки и маршрут. |
| [dist/variants/osm.html](../dist/variants/osm.html) | Генерируемый OSM/Photon/OSRM-вариант без ключа с требованиями. |
| [dist/variants/play-market.html](../dist/variants/play-market.html) | Генерируемая памятка подготовки Android, Google Play и рекламной монетизации. |
| [dist/variants/yandex.html](../dist/variants/yandex.html) | Генерируемый Яндекс-планировщик с отдельными ключами и лицензионными условиями. |
| [dist/vendor/leaflet/LICENSE](../dist/vendor/leaflet/LICENSE) | Лицензия и уведомление об авторских правах Leaflet. |
| [dist/vendor/leaflet/leaflet.css](../dist/vendor/leaflet/leaflet.css) | Сторонние стили Leaflet. |
| [dist/vendor/leaflet/leaflet.js](../dist/vendor/leaflet/leaflet.js) | Сторонняя библиотека Leaflet для отображения OSM/Geoapify-карт. |
| [docs/files.md](../docs/files.md) | Полная карта файлов репозитория с назначением; создаётся командой npm run docs:files. |
| [docs/fleet-demo.md](../docs/fleet-demo.md) | Возможности бизнес-демо, сценарий тестирования, ограничения и следующий серверный этап. |
| [docs/map-providers.md](../docs/map-providers.md) | Сравнение данных карт и провайдеров для Казахстана/СНГ; первоначальное исследование. |
| [docs/monetization.md](../docs/monetization.md) | Генерируемые сценарии выручки и стоимости API, допущения и официальные источники. |
| [docs/play-console-account.md](../docs/play-console-account.md) | Personal/organization, разовая цена US$25, тестирование, AdMob и официальные ссылки. |
| [docs/variants/2gis.md](../docs/variants/2gis.md) | Генерируемые требования и ссылки для 2ГИС-варианта. |
| [docs/variants/geoapify.md](../docs/variants/geoapify.md) | Генерируемые требования и ссылки для Geoapify-варианта. |
| [docs/variants/google.md](../docs/variants/google.md) | Генерируемые требования и ссылки для Google-варианта. |
| [docs/variants/osm.md](../docs/variants/osm.md) | Генерируемые требования и ссылки для OSM-варианта. |
| [docs/variants/yandex.md](../docs/variants/yandex.md) | Генерируемые требования и ссылки для Яндекс-варианта. |
| [package.json](../package.json) | Версия проекта, требование Node.js и команды запуска, генерации, тестов и инвентаризации. |
| [scripts/build-variants.mjs](../scripts/build-variants.mjs) | Генератор HTML-вариантов, требований, калькулятора, плана Play и финансового отчёта. |
| [scripts/check-api.mjs](../scripts/check-api.mjs) | Ручная сетевая проверка Photon/OSRM на публичных тестовых адресах. |
| [scripts/inventory.mjs](../scripts/inventory.mjs) | Генератор этого полного перечня файлов с назначением каждого. |
| [scripts/routing-proxy.mjs](../scripts/routing-proxy.mjs) | Локальный 2ГИС Routing proxy с проверкой точек, origin, лимита и ключом из окружения. |
| [scripts/serve.mjs](../scripts/serve.mjs) | Локальный HTTP-сервер dist и обработчик 2ГИС proxy; слушает только 127.0.0.1. |
| [scripts/setup-vendor.mjs](../scripts/setup-vendor.mjs) | Загрузка Leaflet и его лицензии из официального npm-пакета. |
| [tests/adapters.test.cjs](../tests/adapters.test.cjs) | Контракты SDK Google, 2ГИС и Яндекса на тестовых ответах без платных запросов. |
| [tests/core.test.cjs](../tests/core.test.cjs) | Страны, города, географические ограничения, порядок точек, ответы API и GPX. |
| [tests/fleet.test.cjs](../tests/fleet.test.cjs) | Доступ к рейсам, отзыв, владение машиной, регистрация, временная симуляция и сохранение. |
| [tests/navigation.test.cjs](../tests/navigation.test.cjs) | Манёвры, прогресс навигации, погрешности GPS, сеанс, разрешения, демо и голос. |
| [tests/providers.test.cjs](../tests/providers.test.cjs) | Нормализация провайдеров и расчёты рекламы/API с раздельными квотами. |
| [tests/proxy.test.cjs](../tests/proxy.test.cjs) | Ограничения и безопасная передача запросов локального routing proxy. |

В Git не входят `node_modules/`, `.env*`, логи, локальные настройки агента и `preview/` со скриншотами QA. Локальное браузерное хранилище с маршрутами и введённые в UI API-ключи в репозиторий не попадают. Временный помощник публикации также исключён. `.git/` — локальная служебная история Git, а не файл исходного репозитория.

Генерируемые страницы редактируются через `scripts/build-variants.mjs` и `dist/providers/catalog.js`, затем `npm run build:variants`. Для нового файла добавьте назначение в `scripts/inventory.mjs` и обновите перечень.
