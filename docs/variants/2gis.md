# Mapuga / 2ГИС

HTML: dist/variants/2gis.html

MapGL, Suggest route_endpoint и Routing 7. Подходит для сравнения местного справочника; без ключей и подписки API нельзя проверить.

Проверено: 2026-11-13.

1. Нужен доступ к Map Tiles, Suggest и Routing. Можно использовать один ключ с нужными продуктами или отдельные ограниченные ключи.

2. Демо — месяц. Минимальные месячные пакеты по опубликованному тарифу: Map Tiles 8000 ₽, Suggest 7000 ₽, Routing 6700 ₽. Это нижняя планка 21 700 ₽, а не цена любой нагрузки.

3. До 10 точек вместе со стартом и финишем. Прямой browser Routing 7 зависит от CORS и ограничений ключа. Локальный proxy /api/2gis/route использует MAPUGA_2GIS_ROUTING_KEY в окружении Node.

4. Proxy в комплекте — только для локального теста. Перед публикацией нужны HTTPS, общий серверный лимит, защита от чужого расходования ключа и производственный хостинг.

5. Этот HTML — планировщик. GPS-ведение, GPX и хранение ответов не включены: для них согласовать продукт SDK/навигации и права на хранение/экспорт.

Источники:

- [Тарифы](https://docs.2gis.com/platform-manager/subscription/pricing)
- [MapGL](https://docs.2gis.com/mapgl/start/first-steps)
- [Suggest](https://docs.2gis.com/api/search/suggest/reference/3.0/suggests)
- [Routing 7](https://docs.2gis.com/api/navigation/routing/start)
- [Оферта](https://law.2gis.ru/webapi-offer)

Ключей в комплекте нет. Живая проверка платных/ключевых API без ключей не выполнена.
