# Mapuga / Geoapify

HTML: dist/variants/geoapify.html

OSM-данные через коммерчески допустимый сервис. Free: 3000 кредитов в день, до 5 запросов/с, без банковской карты. Свежесть организаций не гарантируется.

Проверено: 2026-11-13.

1. Создать проект Geoapify и browser key; ограничить ключ разрешёнными доменами. Ключ вводится только в память текущей вкладки.

2. Free разрешён для commercial production с атрибуцией Geoapify и источников. При превышении квоты нужен тариф/изменение нагрузки; безлимитного бесплатного API нет.

3. Тайл = 0,25 кредита, autocomplete = 1, маршрут = число точек − 1; длинные маршруты имеют дополнительные кредиты. GPS сопоставляется локально, но движение карты загружает новые тайлы.

4. GPS, русские подсказки, демо, GPX и локальное сохранение предусмотрены. Перед Android-релизом нужны тесты реальной поездки, HTTPS/нативные разрешения и privacy policy.

Источники:

- [Тарифы и commercial Free](https://www.geoapify.com/pricing/)
- [Стоимость запросов](https://www.geoapify.com/pricing-details/)
- [Autocomplete](https://apidocs.geoapify.com/docs/geocoding/address-autocomplete/)
- [Routing + GPS](https://www.geoapify.com/routing-api/)
- [Права на результаты](https://www.geoapify.com/products-and-services/)

Ключей в комплекте нет. Живая проверка платных/ключевых API без ключей не выполнена.
