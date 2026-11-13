# Mapuga / OpenStreetMap

HTML: dist/variants/osm.html

Текущая Mapuga: Leaflet, Photon и OSRM. Работает сразу; публичный OSRM demo не подходит как бесплатная инфраструктура приложения с рекламой.

Проверено: 2026-11-13.

1. Ключ не нужен. Для GPS — HTTPS или localhost и разрешение геолокации.

2. Photon допускает умеренную нагрузку без гарантий. OSRM demo — разумное некоммерческое использование, максимум 1 запрос/с.

3. Перед монетизацией заменить публичный маршрутизатор и поиск на коммерчески допустимый тариф или собственный сервер. Расходы сервера не равны нулю.

4. Обязательны атрибуция OSM, HTTP-кеширование тайлов и соблюдение Tile Usage Policy. Массовой загрузки и офлайн-карт в этой версии нет.

Источники:

- [OSM tiles](https://operations.osmfoundation.org/policies/tiles/)
- [Photon](https://github.com/komoot/photon#demo-server)
- [OSRM demo](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server)

Ключей в комплекте нет. Живая проверка платных/ключевых API без ключей не выполнена.
